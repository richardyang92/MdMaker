"""Pure text-editing operations used by Workspace.

Each function takes the current content and returns new content plus the
affected character range. They raise ValueError on invalid arguments so
callers (Workspace) can convert to tool-error results.
"""
from __future__ import annotations

from app.services.workspace.outline import parse_outline


def get_section(
    content: str, heading: str | None = None, line_range: tuple[int, int] | None = None
) -> str:
    """Read a section by heading name or [start,end) line range (0-indexed)."""
    if line_range is not None:
        start, end = line_range
        lines = content.splitlines(keepends=True)
        if start < 0 or end > len(lines) or start >= end:
            raise ValueError(
                f"line_range out of bounds: {line_range}, doc has {len(lines)} lines"
            )
        return "".join(lines[start:end])
    if heading is None:
        raise ValueError("either heading or line_range is required")
    sections = parse_outline(content)
    for s in sections:
        if s.heading == heading:
            return content[s.char_start:s.char_end]
    raise ValueError(f"heading not found: {heading!r}")


def insert_text(
    content: str,
    text: str,
    position: int | None = None,
    after_heading: str | None = None,
) -> tuple[str, int, int]:
    """Insert text; return (new_content, start, end) of inserted range."""
    if position is None and after_heading is None:
        position = len(content)
    if position is not None:
        if position < 0 or position > len(content):
            raise ValueError(f"position out of bounds: {position}, len={len(content)}")
        new = content[:position] + text + content[position:]
        return new, position, position + len(text)
    # after_heading path
    sections = parse_outline(content)
    for s in sections:
        if s.heading == after_heading:
            insert_at = s.char_end
            new = content[:insert_at] + text + content[insert_at:]
            return new, insert_at, insert_at + len(text)
    raise ValueError(f"heading not found: {after_heading!r}")


def replace_range(content: str, start: int, end: int, text: str) -> tuple[str, int, int]:
    """Replace content[start:end] with text."""
    if start < 0 or end > len(content) or start > end:
        raise ValueError(f"range out of bounds: [{start},{end}], len={len(content)}")
    new = content[:start] + text + content[end:]
    return new, start, start + len(text)


def delete_range(content: str, start: int, end: int) -> tuple[str, int, int]:
    """Delete content[start:end]."""
    if start < 0 or end > len(content) or start > end:
        raise ValueError(f"range out of bounds: [{start},{end}], len={len(content)}")
    new = content[:start] + content[end:]
    return new, start, start


def find_replace(
    content: str, pattern: str, replacement: str, count: int = 0
) -> tuple[str, int]:
    """Replace occurrences of pattern. count=0 means all. Return (new, num_replaced)."""
    if not pattern:
        raise ValueError("pattern must be non-empty")
    if count == 0:
        return content.replace(pattern, replacement), content.count(pattern)
    return content.replace(pattern, replacement, count), min(count, content.count(pattern))


def replace_section(content: str, heading: str, text: str) -> tuple[str, int, int]:
    """Replace the section governed by `heading` with `text`."""
    sections = parse_outline(content)
    for s in sections:
        if s.heading == heading:
            new = content[: s.char_start] + text + content[s.char_end :]
            return new, s.char_start, s.char_start + len(text)
    raise ValueError(f"heading not found: {heading!r}")


def replace_document(content: str, text: str) -> tuple[str, int, int]:
    """Replace the ENTIRE document body with `text`.

    Unlike the section/range tools, this is an explicit full-document overwrite —
    the natural operation for "create a new article from scratch" — so the
    deletion-ratio guard does NOT apply at the Workspace layer. Returns
    (new_content, 0, len(text)) to match the (new, start, end) convention.
    """
    return text, 0, len(text)
