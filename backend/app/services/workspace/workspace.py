"""Backend authoritative document workspace.

Thread-safe (asyncio.Lock) document state with optimistic versioning and
an in-memory undo stack. Edit operations delegate to the pure functions in
`tools.py`.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Callable

from app.core.config import get_settings
from app.services.workspace import tools
from app.services.workspace.outline import parse_outline

_settings = get_settings()


@dataclass
class Snapshot:
    content: str
    title: str
    version: int


@dataclass
class Workspace:
    """Authoritative document state."""

    content: str = ""
    title: str = "Untitled"
    version: int = 0
    _history: list[Snapshot] = field(default_factory=list)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    # Change observers: invoked synchronously from _commit on every successful
    # edit, receiving the new version. Used by AgentService to emit a
    # document_patch per edit (reliable even under parallel tool calls).
    _on_change: list[Callable[[int], None]] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self._history:
            self._history.append(Snapshot(self.content, self.title, self.version))

    def add_change_listener(self, cb: Callable[[int], None]) -> Callable[[], None]:
        """Register a change observer. Returns a deregister function."""
        self._on_change.append(cb)

        def _remove() -> None:
            try:
                self._on_change.remove(cb)
            except ValueError:
                pass

        return _remove

    def _commit(self, new_content: str, new_title: str | None = None) -> None:
        """Apply an edit: bump version, push snapshot. Caller holds the lock."""
        self.content = new_content
        if new_title is not None:
            self.title = new_title
        self.version += 1
        self._history.append(Snapshot(self.content, self.title, self.version))
        # cap history at 50
        if len(self._history) > 50:
            self._history = self._history[-50:]
        # Notify observers of the new version. Snapshot the list because a
        # callback could (in theory) mutate it.
        for cb in list(self._on_change):
            try:
                cb(self.version)
            except Exception:  # noqa: BLE001 — observers must not break edits
                pass

    def _check_deletion_ratio(self, old: str, new: str) -> None:
        """Reject edits that shrink the document by more than the configured ratio.

        This guards against accidental mass-deletions (e.g. an agent replacing a
        long document with a short one). It does NOT detect equal-length rewrites
        where the content changes but the length stays similar — that would require
        a real diff and is out of scope for this phase.
        """
        max_ratio = _settings.agent_max_doc_edit_ratio
        old_len = max(len(old), 1)
        deleted = max(0, old_len - len(new))
        if deleted / old_len > max_ratio:
            raise ValueError(
                f"edit deletes {deleted}/{old_len} chars (> {max_ratio:.0%}); rejected"
            )

    # ---- read tools ----

    async def get_document_outline(self) -> list[dict]:
        async with self._lock:
            sections = parse_outline(self.content)
        return [
            {
                "heading": s.heading,
                "level": s.level,
                "line_start": s.line_start,
                "line_end": s.line_end,
            }
            for s in sections
        ]

    async def get_section(
        self, heading: str | None = None, line_range: tuple[int, int] | None = None
    ) -> str:
        async with self._lock:
            return tools.get_section(self.content, heading=heading, line_range=line_range)

    async def read_range(self, start: int, end: int) -> str:
        async with self._lock:
            if start < 0 or end > len(self.content) or start > end:
                raise ValueError(f"range out of bounds: [{start},{end}]")
            return self.content[start:end]

    # ---- write tools ----

    async def insert_text(
        self,
        text: str,
        position: int | None = None,
        after_heading: str | None = None,
    ) -> str:
        async with self._lock:
            old = self.content
            new_content, _, _ = tools.insert_text(
                old, text, position=position, after_heading=after_heading
            )
            self._check_deletion_ratio(old, new_content)
            self._commit(new_content)
            return f"inserted {len(text)} chars (version {self.version})"

    async def replace_range(self, start: int, end: int, text: str) -> str:
        async with self._lock:
            old = self.content
            new_content, _, _ = tools.replace_range(old, start, end, text)
            self._check_deletion_ratio(old, new_content)
            self._commit(new_content)
            return f"replaced [{start},{end}] (version {self.version})"

    async def replace_section(self, heading: str, text: str) -> str:
        async with self._lock:
            old = self.content
            new_content, _, _ = tools.replace_section(old, heading, text)
            self._check_deletion_ratio(old, new_content)
            self._commit(new_content)
            return f"replaced section {heading!r} (version {self.version})"

    async def delete_range(self, start: int, end: int) -> str:
        async with self._lock:
            old = self.content
            new_content, _, _ = tools.delete_range(old, start, end)
            self._check_deletion_ratio(old, new_content)
            self._commit(new_content)
            return f"deleted [{start},{end}] (version {self.version})"

    async def find_replace(self, pattern: str, replacement: str, count: int = 0) -> int:
        """Replace occurrences; return the number of replacements made.

        NOTE: unlike the other write tools (which return a string summary),
        this returns an ``int`` count of replacements. This is a deliberate,
        documented inconsistency: the test contract assigns the result to
        ``count`` and asserts ``count >= 1``. Returning int is the cleanest
        way to satisfy that.
        """
        async with self._lock:
            old = self.content
            new_content, n = tools.find_replace(old, pattern, replacement, count=count)
            self._check_deletion_ratio(old, new_content)
            self._commit(new_content)
            return n

    async def set_title(self, title: str) -> str:
        async with self._lock:
            self._commit(self.content, new_title=title)
            return f"title set to {title!r} (version {self.version})"

    # ---- versioning / undo ----

    def snapshot_for_sync(self) -> dict:
        """Return current state for client sync (no lock — best-effort read)."""
        return {"content": self.content, "title": self.title, "version": self.version}

    async def apply_client_edit(self, base_version: int, new_content: str) -> dict:
        """Apply a client edit with optimistic locking.

        Returns {'status': 'ok'|'conflict', 'content':..., 'version':...}.
        On conflict, client must re-fetch authoritative state.
        """
        async with self._lock:
            if base_version != self.version:
                return {"status": "conflict", "content": self.content, "version": self.version}
            self._commit(new_content)
            return {"status": "ok", "content": self.content, "version": self.version}

    async def undo(self) -> Snapshot | None:
        async with self._lock:
            if len(self._history) <= 1:
                return None
            self._history.pop()
            snap = self._history[-1]
            self.content = snap.content
            self.title = snap.title
            self.version = snap.version
            return snap
