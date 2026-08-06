"""Reliability tests for the agent improvements (see docs/AGENT_TESTING_REPORT.md).

Covers the P0/P1 fixes that the pre-existing mock-based tests could not catch:
  - document_patch emitted once per workspace edit (change-listener approach),
    including the parallel-tool-call case where version jumps twice between
    two stream events.
  - cooperative cancellation via stop_event.
  - UsageLimitExceeded surfaced as a user-facing error event.
  - translator respects the outcome field and carries the tool name.
  - message_history persisted with the assistant's final text.
  - workspace change listener.

These tests drive the REAL _invoke_agent_run loop with a fake agent so the
event-processing logic (patch queue, stop check, thought buffer) is exercised.
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from app.services.agent.service import AgentService
from app.services.agent.translator import translate_event
from app.services.workspace.workspace import Workspace


def _make_service(workspace: Workspace | None = None, stop_event=None) -> AgentService:
    return AgentService(
        workspace=workspace or Workspace(content="# Doc\n"),
        provider="deepseek",
        model="deepseek-chat",
        api_key="sk-test",
        base_url="https://api.deepseek.com/v1",
        stop_event=stop_event,
    )


class _FakePart:
    def __init__(self, **kw: Any) -> None:
        for k, v in kw.items():
            setattr(self, k, v)


class _FakeEvent:
    """Stand-in for a PydanticAI AgentStreamEvent. Subclass and name it to
    match the kind the translator dispatches on."""

    def __init__(self, part=None, delta=None, index=0) -> None:
        self.part = part
        self.delta = delta
        self.index = index


def _event(kind: str, **kw: Any) -> _FakeEvent:
    """Create a _FakeEvent whose class name equals `kind`."""
    cls = type(kind, (_FakeEvent,), {})
    return cls(**kw)


class _FakeEventStream:
    """Async context manager + async iterator mimicking agent.run_stream_events."""

    def __init__(self, events: list) -> None:
        self._events = events

    async def __aenter__(self):
        return self._iter()

    async def __aexit__(self, *exc) -> None:
        return None

    async def _iter(self):
        for e in self._events:
            yield e


class _FakeAgent:
    """Captures the call and returns the scripted event stream."""

    def __init__(self, events: list) -> None:
        self._events = events

    def run_stream_events(self, message, **kw):  # sync: returns an async ctx mgr
        return _FakeEventStream(self._events)


# ---------------------------------------------------------------------------
# document_patch: one per edit, even under parallel tool calls
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_patch_emitted_once_per_edit_parallel():
    """Two edits landing before a single stream event must produce two patches.

    Reproduces the original bug where version 0->1->2 only yielded one patch
    because the old logic polled version at event boundaries and missed the
    intermediate bump caused by parallel tool calls.
    """
    ws = Workspace(content="# Doc\n")
    svc = _make_service(ws)

    # Script: an event arrives, then two edits commit (simulating parallel
    # tools), then the next event arrives. The change listener must have queued
    # both versions.
    async def do_edits_after_first_event(evt):
        # Called as a side effect when we yield the first event.
        pass

    events: list = []

    # First, a read-only tool result event (no version change).
    events.append(
        _event(
            "FunctionToolResultEvent",
            part=_FakePart(tool_name="get_section", outcome="success", content="..."),
        )
    )

    # We interleave edits by wrapping the fake agent so that after it yields the
    # first event, we perform two edits before yielding the next.
    class _EditingAgent(_FakeAgent):
        def run_stream_events(self, message, **kw):  # sync: returns ctx mgr
            return _EditingStream(_FakeEventStream(self._events), ws)

    class _EditingStream:
        def __init__(self, inner, ws: Workspace) -> None:
            self._inner = inner
            self._ws = ws
            self._did_edits = False

        async def __aenter__(self):
            self._it = self._inner._iter()
            return self

        async def __aexit__(self, *exc):
            return None

        def __aiter__(self):
            return self

        async def __anext__(self):
            try:
                nxt = await self._it.__anext__()
            except StopAsyncIteration:
                raise
            if not self._did_edits:
                self._did_edits = True
                # Two edits commit between the first and second event.
                await self._ws.insert_text("first")  # 0 -> 1
                await self._ws.insert_text("second")  # 1 -> 2
            return nxt

    agent = _EditingAgent(events)
    collected: list = []
    async for e in svc._invoke_agent_run(agent, "hi", None):  # type: ignore[arg-type]
        collected.append(e)

    patches = [e for e in collected if e.get("type") == "document_patch"]
    assert [p["version"] for p in patches] == [1, 2], collected


@pytest.mark.asyncio
async def test_no_patch_when_document_unchanged():
    ws = Workspace(content="# Doc\n")
    svc = _make_service(ws)
    events = [
        _event(
            "FunctionToolResultEvent",
            part=_FakePart(tool_name="get_section", outcome="success", content="..."),
        )
    ]
    agent = _FakeAgent(events)
    collected = [e async for e in svc._invoke_agent_run(agent, "hi", None)]  # type: ignore[arg-type]
    assert not [e for e in collected if e.get("type") == "document_patch"]


# ---------------------------------------------------------------------------
# cooperative stop
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_stop_event_interrupts_run_loop():
    ws = Workspace(content="# Doc\n")
    stop_event = asyncio.Event()
    svc = _make_service(ws, stop_event=stop_event)

    # Script: first event is fine; before the second event the stop is set, so
    # the loop must bail out with a `stopped` event and skip the rest.
    class _StoppingAgent(_FakeAgent):
        def run_stream_events(self, message, **kw):  # sync: returns ctx mgr
            return _StoppingStream(_FakeEventStream(self._events), stop_event)

    class _StoppingStream:
        def __init__(self, inner, stop_event) -> None:
            self._inner = inner
            self._stop_event = stop_event
            self._i = 0

        async def __aenter__(self):
            self._it = self._inner._iter()
            return self

        async def __aexit__(self, *exc):
            return None

        def __aiter__(self):
            return self

        async def __anext__(self):
            nxt = await self._it.__anext__()
            self._i += 1
            if self._i == 1:
                self._stop_event.set()
            return nxt

    events = [
        _event(
            "FunctionToolResultEvent",
            part=_FakePart(tool_name="get_section", outcome="success", content="a"),
        ),
        _event(
            "FunctionToolResultEvent",
            part=_FakePart(tool_name="get_section", outcome="success", content="b"),
        ),
        _event(
            "FunctionToolResultEvent",
            part=_FakePart(tool_name="get_section", outcome="success", content="c"),
        ),
    ]
    agent = _StoppingAgent(events)
    collected = [e async for e in svc._invoke_agent_run(agent, "hi", None)]  # type: ignore[arg-type]
    assert {"type": "stopped", "content": ""} in collected
    stopped_idx = collected.index({"type": "stopped", "content": ""})
    after = collected[stopped_idx + 1 :]
    # The third scripted event must NOT have been processed into a tool_result.
    assert not [
        e for e in after if e.get("type") == "tool_result" and e.get("summary") == "c"
    ], after


# ---------------------------------------------------------------------------
# UsageLimitExceeded surfaced as error (run() wrapper)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_usage_limit_exceeded_becomes_error_event():
    from pydantic_ai.exceptions import UsageLimitExceeded

    ws = Workspace(content="# Doc\n")
    svc = _make_service(ws)

    async def fake_invoke(agent, message, message_history):
        raise UsageLimitExceeded("exceeded request_limit of 15")
        yield {}  # noqa — async generator marker

    svc._invoke_agent_run = fake_invoke  # type: ignore[assignment]
    events = [e async for e in svc.run("hi")]
    errs = [e for e in events if e.get("type") == "error"]
    assert len(errs) == 1
    assert "最大迭代次数" in errs[0]["error"]
    assert events[-1] == {"type": "done", "content": ""}


@pytest.mark.asyncio
async def test_run_always_ends_with_done():
    ws = Workspace(content="# Doc\n")
    svc = _make_service(ws)

    async def fake_invoke(agent, message, message_history):
        yield {"type": "tool_result", "name": "x", "ok": True, "summary": "y"}

    svc._invoke_agent_run = fake_invoke  # type: ignore[assignment]
    events = [e async for e in svc.run("hi")]
    assert events[-1] == {"type": "done", "content": ""}


# ---------------------------------------------------------------------------
# translator: outcome field respected, tool name carried
# ---------------------------------------------------------------------------


def test_translator_tool_result_uses_outcome_field():
    part = _FakePart(tool_name="replace_section", outcome="failed", content="boom")
    evt = _event("FunctionToolResultEvent", part=part)
    evt.content = "boom"
    out = translate_event(evt)
    assert out is not None
    assert out["type"] == "tool_result"
    assert out["name"] == "replace_section"
    assert out["ok"] is False


def test_translator_tool_result_carries_tool_name():
    part = _FakePart(tool_name="find_replace", outcome="success", content="replaced 3")
    evt = _event("FunctionToolResultEvent", part=part)
    evt.content = "replaced 3"
    out = translate_event(evt)
    assert out["name"] == "find_replace"
    assert out["ok"] is True


def test_translator_part_delta_yields_thought():
    delta = _FakePart(content_delta="hi")
    evt = _event("PartDeltaEvent", delta=delta, index=0)
    out = translate_event(evt)
    assert out == {"type": "thought", "content": "hi"}


# ---------------------------------------------------------------------------
# workspace change listener
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_workspace_change_listener_fires_on_each_edit():
    ws = Workspace(content="x")
    seen: list[int] = []
    ws.add_change_listener(seen.append)
    await ws.insert_text("y")
    await ws.set_title("new")
    await ws.find_replace("x", "z")
    assert seen == [1, 2, 3]


@pytest.mark.asyncio
async def test_workspace_change_listener_remove():
    ws = Workspace(content="x")
    seen: list[int] = []
    remove = ws.add_change_listener(seen.append)
    remove()
    await ws.insert_text("y")
    assert seen == []


# ---------------------------------------------------------------------------
# message_history persistence (API layer)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_append_history_stores_user_and_assistant_messages():
    from app.api.v1.agent import _append_history

    class _Sess:
        def __init__(self) -> None:
            self.message_history: list[Any] = []

    sess = _Sess()
    _append_history(sess, "请加一段总结", "已加好总结。")
    assert len(sess.message_history) == 2
    assert sess.message_history[0].parts[0].content == "请加一段总结"
    assert sess.message_history[1].parts[0].content == "已加好总结。"


def test_append_history_skips_empty_assistant_text():
    from app.api.v1.agent import _append_history

    class _Sess:
        def __init__(self) -> None:
            self.message_history: list[Any] = []

    sess = _Sess()
    _append_history(sess, "hi", "")
    assert sess.message_history == []
