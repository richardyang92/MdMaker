"""AgentService — assembles a PydanticAI Agent with document-editing tools.

The agent loop, tool dispatch, streaming, and multi-provider handling are
all delegated to PydanticAI. This class is the thin glue that:
  1. builds the Agent (model + system prompt + deps = Workspace),
  2. registers Workspace operations as @agent.tool,
  3. runs the agent and translates the event stream into SSE dicts.
"""
from __future__ import annotations

from typing import AsyncGenerator

from pydantic_ai import Agent, RunContext, UsageLimits
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.core.config import get_settings
from app.services.agent.translator import make_document_patch, translate_event
from app.services.workspace.workspace import Workspace

_settings = get_settings()


class AgentService:
    """Assembles and runs a document-editing agent over a Workspace."""

    def __init__(
        self,
        workspace: Workspace,
        provider: str,
        model: str,
        api_key: str,
        base_url: str,
    ) -> None:
        self.workspace = workspace
        self.provider = provider
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
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
            outline = await ctx.deps.get_document_outline()
            return "\n".join(
                f"{'#' * s['level']} {s['heading']} (lines {s['line_start']}-{s['line_end']})"
                for s in outline
            )

        @agent.tool
        async def get_section(ctx: RunContext[Workspace], heading: str) -> str:
            """Read the full content of a section identified by its heading."""
            return await ctx.deps.get_section(heading=heading)

        @agent.tool
        async def insert_text(
            ctx: RunContext[Workspace], text: str, after_heading: str | None = None
        ) -> str:
            """Insert text after a heading (or at end if after_heading is None)."""
            return await ctx.deps.insert_text(text=text, after_heading=after_heading)

        @agent.tool
        async def replace_section(ctx: RunContext[Workspace], heading: str, text: str) -> str:
            """Replace an entire section (identified by heading) with new text."""
            return await ctx.deps.replace_section(heading=heading, text=text)

        @agent.tool
        async def find_replace(
            ctx: RunContext[Workspace], pattern: str, replacement: str
        ) -> str:
            """Replace all occurrences of pattern with replacement throughout the document."""
            n = await ctx.deps.find_replace(pattern=pattern, replacement=replacement)
            return f"replaced {n} occurrence(s)"

        @agent.tool
        async def set_title(ctx: RunContext[Workspace], title: str) -> str:
            """Set the document title."""
            return await ctx.deps.set_title(title=title)

    async def _invoke_agent_run(
        self, agent: Agent[Workspace, str], message: str, message_history: list | None
    ) -> AsyncGenerator[dict, None]:
        """Run the agent's event stream. Overridable in tests.

        Uses run_stream_events (async context manager yielding events).
        Tracks workspace version to emit document_patch on edits.
        """
        version_before = self.workspace.version
        usage_limits = UsageLimits(request_limit=_settings.agent_max_iterations)

        async with agent.run_stream_events(
            message,
            deps=self.workspace,
            usage_limits=usage_limits,
            message_history=message_history or [],
        ) as events:
            async for event in events:
                # If workspace changed since last check, emit a document_patch
                if self.workspace.version != version_before:
                    yield make_document_patch(self.workspace.version, summary="document edited")
                    version_before = self.workspace.version
                translated = translate_event(event)
                if translated is not None:
                    yield translated
            # Catch a version bump on the final event (no subsequent iteration)
            if self.workspace.version != version_before:
                yield make_document_patch(self.workspace.version, summary="document edited")

    async def run(
        self, message: str, message_history: list | None = None
    ) -> AsyncGenerator[dict, None]:
        """Run the agent and yield SSE dicts. Always ends with {'type':'done'}.

        On exception, yields an error event then done.
        """
        agent = self._agent or self.build_agent()
        try:
            async for evt in self._invoke_agent_run(
                agent, message, message_history
            ):
                yield evt
            yield {"type": "final", "content": "done"}
        except Exception as e:  # noqa: BLE001 — surface to client
            yield {"type": "error", "error": str(e)}
        yield {"type": "done", "content": ""}
