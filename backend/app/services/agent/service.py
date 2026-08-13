"""AgentService — assembles a PydanticAI Agent with document-editing tools.

The agent loop, tool dispatch, streaming, and multi-provider handling are
all delegated to PydanticAI. This class is the thin glue that:
  1. builds the Agent (model + system prompt + deps = Workspace),
  2. registers Workspace operations as @agent.tool,
  3. runs the agent and translates the event stream into SSE dicts.

Reliability guarantees implemented here (see docs/AGENT_TESTING_REPORT.md):
  - **document_patch reliability**: after every write-tool result we re-check the
    workspace version, so each independent edit emits its own patch instead of
    being merged into one when several tools land in the same event batch.
  - **thought aggregation**: token-level PartDeltaEvent deltas are buffered per
    part-index and flushed on PartEndEvent / tool boundaries, so the frontend
    receives a few substantial thought events rather than hundreds of token
    fragments (which caused render storms).
  - **cooperative cancellation**: the run loop polls `stop_event` between events
    so an external `/stop` request interrupts the stream promptly.
"""

from __future__ import annotations

import asyncio
from typing import AsyncGenerator, Optional

from pydantic_ai import Agent, RunContext, UsageLimits
from pydantic_ai.exceptions import UsageLimitExceeded
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.core.config import get_settings
from app.services.agent.translator import (
    make_document_patch,
    make_thought_delta,
    translate_event,
)
from app.services.workspace.workspace import Workspace

_settings = get_settings()


async def _ok(coro):
    """Await a tool's workspace coroutine, returning its result.

    On error, return a descriptive string instead of letting the exception
    propagate. PydanticAI lets tool exceptions escape ``run_stream_events``,
    so without this a single validation/guard rejection — most importantly the
    deletion-ratio guard refusing a near-full-document wipe — would abort the
    whole agent turn with a fatal error. Surfacing it as the tool result lets
    the model read the reason and self-correct (narrow the range, split the
    edit, pick another tool, …). The Workspace layer still raises ValueError
    for its own callers/tests; this wrapper only changes what the agent sees.
    """
    try:
        return await coro
    except Exception as e:  # noqa: BLE001 — a tool error must not crash the run
        return f"[tool error] {type(e).__name__}: {e}"


class AgentService:
    """Assembles and runs a document-editing agent over a Workspace."""

    def __init__(
        self,
        workspace: Workspace,
        provider: str,
        model: str,
        api_key: str,
        base_url: str,
        stop_event: Optional[asyncio.Event] = None,
    ) -> None:
        self.workspace = workspace
        self.provider = provider
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        # External cancellation signal. When set, the run loop stops iterating
        # the agent stream and yields a terminal `stopped` event.
        self.stop_event: asyncio.Event = stop_event or asyncio.Event()
        self._agent: Agent[Workspace, str] | None = None

    def build_agent(self) -> Agent[Workspace, str]:
        """Build the PydanticAI agent with workspace tools registered."""
        ai_model = OpenAIChatModel(
            self.model,
            provider=OpenAIProvider(base_url=self.base_url, api_key=self.api_key),
        )
        agent: Agent[Workspace, str] = Agent(
            ai_model,
            deps_type=Workspace,
            system_prompt=_settings.agent_system_prompt,
            output_type=str,
        )
        self._register_tools(agent)
        self._agent = agent
        return agent

    def _register_tools(self, agent: Agent[Workspace, str]) -> None:
        """Register each Workspace operation as an @agent.tool."""

        @agent.tool
        async def get_document_outline(ctx: RunContext[Workspace]) -> str:
            """Return the document outline: list of headings with line ranges."""
            outline = await _ok(ctx.deps.get_document_outline())
            if isinstance(outline, str):  # error string from _ok
                return outline
            return "\n".join(
                f"{'#' * s['level']} {s['heading']} (lines {s['line_start']}-{s['line_end']})"
                for s in outline
            )

        @agent.tool
        async def get_section(ctx: RunContext[Workspace], heading: str) -> str:
            """Read the full content of a section identified by its heading."""
            return await _ok(ctx.deps.get_section(heading=heading))

        @agent.tool
        async def insert_text(
            ctx: RunContext[Workspace], text: str, after_heading: str | None = None
        ) -> str:
            """Insert text after a heading (or at end if after_heading is None)."""
            return await _ok(ctx.deps.insert_text(text=text, after_heading=after_heading))

        @agent.tool
        async def replace_section(ctx: RunContext[Workspace], heading: str, text: str) -> str:
            """Replace an entire section (identified by heading) with new text."""
            return await _ok(ctx.deps.replace_section(heading=heading, text=text))

        @agent.tool
        async def replace_document(ctx: RunContext[Workspace], text: str) -> str:
            """Replace the ENTIRE document body with the given Markdown ``text``.

            Use this when the user asks you to CREATE, GENERATE, or WRITE a
            brand-new document/article from scratch, or to fully rewrite the
            document. Pass the COMPLETE article in a single call. Do not append
            to placeholder content or split the content across many small edits.
            """
            return await _ok(ctx.deps.replace_document(text=text))

        @agent.tool
        async def find_replace(ctx: RunContext[Workspace], pattern: str, replacement: str) -> str:
            """Replace all occurrences of pattern with replacement throughout the document."""
            result = await _ok(ctx.deps.find_replace(pattern=pattern, replacement=replacement))
            if isinstance(result, str):  # error string from _ok
                return result
            return f"replaced {result} occurrence(s)"

        @agent.tool
        async def set_title(ctx: RunContext[Workspace], title: str) -> str:
            """Set the document title."""
            return await _ok(ctx.deps.set_title(title=title))

    async def _invoke_agent_run(
        self, agent: Agent[Workspace, str], message: str, message_history: list | None
    ) -> AsyncGenerator[dict, None]:
        """Run the agent's event stream. Overridable in tests.

        Implements reliable document_patch emission, thought aggregation, and
        cooperative cancellation — see class docstring for the guarantees.
        """
        usage_limits = UsageLimits(request_limit=_settings.agent_max_iterations)

        # Per-part-index buffer for streamed thought deltas. Flushed on
        # PartEndEvent or when a tool boundary is crossed.
        thought_buffers: dict[int, str] = {}
        # The last text part the model emitted is the user-facing summary.
        # Captured so the caller (API layer) can persist it into message_history.
        self.last_assistant_text = ""

        def flush_thought(idx: int) -> Optional[dict]:
            buf = thought_buffers.pop(idx, None)
            if buf:
                return make_thought_delta(buf)
            return None

        # Reliable patch queue: the workspace pushes the new version here on
        # every _commit (via a change listener). We drain the queue at each
        # event boundary. This captures every edit even when PydanticAI runs
        # multiple tool calls concurrently within one event-loop tick.
        pending_patches: list[int] = []
        remove_listener = self.workspace.add_change_listener(pending_patches.append)
        try:
            async with agent.run_stream_events(
                message,
                deps=self.workspace,
                usage_limits=usage_limits,
                message_history=message_history or [],
            ) as events:
                async for event in events:
                    # Cooperative cancellation: stop ASAP when /stop was called.
                    if self.stop_event.is_set():
                        yield {"type": "stopped", "content": ""}
                        return

                    kind = type(event).__name__

                    # On tool-result boundaries (and any part-end), flush buffered
                    # thought text first so it isn't interleaved with tool output.
                    if kind in (
                        "FunctionToolCallEvent",
                        "FunctionToolResultEvent",
                        "PartEndEvent",
                    ):
                        for idx in list(thought_buffers.keys()):
                            flushed = flush_thought(idx)
                            if flushed is not None:
                                yield flushed

                    # Drain any edits the workspace recorded since the last event.
                    while pending_patches:
                        yield make_document_patch(pending_patches.pop(0), "document edited")

                    if kind == "PartDeltaEvent":
                        # Buffer the delta; only the index for this delta carries
                        # new content, so we key by event.index.
                        idx = getattr(event, "index", 0)
                        delta = getattr(event, "delta", None)
                        content_delta = (
                            getattr(delta, "content_delta", None) if delta is not None else None
                        )
                        if content_delta:
                            thought_buffers[idx] = thought_buffers.get(idx, "") + content_delta
                        continue

                    if kind == "PartEndEvent":
                        # Flushed above. Capture user-facing text as the assistant's
                        # final answer (the last text part wins).
                        part = getattr(event, "part", None)
                        if getattr(part, "part_kind", None) == "text":
                            text = getattr(part, "content", "")
                            if text:
                                self.last_assistant_text = text
                        continue

                    translated = translate_event(event)
                    if translated is not None:
                        yield translated

                # Flush any trailing thought text after the stream ends.
                for idx in list(thought_buffers.keys()):
                    flushed = flush_thought(idx)
                    if flushed is not None:
                        yield flushed
                # Drain any final edits recorded after the last event.
                while pending_patches:
                    yield make_document_patch(pending_patches.pop(0), "document edited")
        finally:
            remove_listener()

    async def run(
        self, message: str, message_history: list | None = None
    ) -> AsyncGenerator[dict, None]:
        """Run the agent and yield SSE dicts. Always ends with {'type':'done'}.

        Emits a terminal event: ``final`` on success, ``stopped`` on external
        cancellation, or ``error`` on exception — followed by ``done``.
        """
        # Initialise here too so callers that monkeypatch _invoke_agent_run
        # (and thus skip its own initialisation) still see a defined attribute.
        self.last_assistant_text = ""
        agent = self._agent or self.build_agent()
        try:
            async for evt in self._invoke_agent_run(agent, message, message_history):
                yield evt
                if evt.get("type") == "stopped":
                    return
            # The model's user-facing answer was captured during the stream
            # (last text PartEndEvent). Surface it as the final event so the
            # frontend shows the actual summary rather than a placeholder.
            yield {"type": "final", "content": self.last_assistant_text or "done"}
        except UsageLimitExceeded as e:
            # Reached agent_max_iterations. Surface as an explicit, user-facing
            # error instead of letting the stream end silently.
            yield {
                "type": "error",
                "error": f"达到最大迭代次数（{_settings.agent_max_iterations}），任务未完成：{e}",
            }
        except Exception as e:  # noqa: BLE001 — surface to client
            yield {"type": "error", "error": str(e)}
        yield {"type": "done", "content": ""}
