"""Tests for AgentService — assembling PydanticAI agent & running stream.

These tests avoid real LLM calls by monkeypatching the run loop.
"""
import pytest

from app.services.workspace.workspace import Workspace
from app.services.agent.service import AgentService


@pytest.fixture
def workspace():
    return Workspace(content="# Doc\n\nHello world.\n")


def test_build_agent_creates_agent(workspace):
    svc = AgentService(
        workspace=workspace,
        provider="deepseek",
        model="deepseek-chat",
        api_key="sk-test",
        base_url="https://api.deepseek.com/v1",
    )
    agent = svc.build_agent()
    assert agent is not None


def test_workspace_tools_are_registered(workspace):
    svc = AgentService(
        workspace=workspace,
        provider="deepseek",
        model="deepseek-chat",
        api_key="sk-test",
        base_url="https://api.deepseek.com/v1",
    )
    agent = svc.build_agent()
    # PydanticAI stores registered tools in agent._function_toolset.tools (a dict)
    toolset = getattr(agent, "_function_toolset", None)
    assert toolset is not None, "expected _function_toolset on Agent"
    tools_dict = getattr(toolset, "tools", None)
    assert tools_dict is not None, "expected .tools dict on function toolset"
    registered = set(tools_dict.keys())
    expected = {
        "get_document_outline",
        "get_section",
        "insert_text",
        "replace_section",
        "replace_document",
        "find_replace",
        "set_title",
    }
    assert expected.issubset(registered), f"missing tools: {expected - registered}"


@pytest.mark.asyncio
async def test_run_yields_done_event_always(workspace):
    """run() must always end with a done event, even when the agent loop is a no-op."""
    svc = AgentService(
        workspace=workspace,
        provider="deepseek",
        model="deepseek-chat",
        api_key="sk-test",
        base_url="https://api.deepseek.com/v1",
    )

    # Monkeypatch the internal run invoker to an empty async generator
    async def fake_invoke(agent, message, message_history):
        if False:  # never yields
            yield {}

    svc._invoke_agent_run = fake_invoke
    events = [e async for e in svc.run("hello")]
    assert events[-1] == {"type": "done", "content": ""}
    # final event should also be present before done
    assert any(e["type"] == "final" for e in events)


@pytest.mark.asyncio
async def test_run_translates_events_from_invoke(workspace):
    """Events yielded by _invoke_agent_run are passed through to run() output."""
    svc = AgentService(
        workspace=workspace,
        provider="deepseek",
        model="deepseek-chat",
        api_key="sk-test",
        base_url="https://api.deepseek.com/v1",
    )

    async def fake_invoke(agent, message, message_history):
        yield {"type": "thought", "content": "thinking"}
        yield {"type": "tool_call", "name": "find_replace", "args": {}}

    svc._invoke_agent_run = fake_invoke
    events = [e async for e in svc.run("hi")]
    assert {"type": "thought", "content": "thinking"} in events
    assert {"type": "tool_call", "name": "find_replace", "args": {}} in events
    assert events[-1] == {"type": "done", "content": ""}


@pytest.mark.asyncio
async def test_run_catches_errors_and_emits_error_event(workspace):
    svc = AgentService(
        workspace=workspace,
        provider="deepseek",
        model="deepseek-chat",
        api_key="sk-test",
        base_url="https://api.deepseek.com/v1",
    )

    async def fake_invoke(agent, message, message_history):
        raise RuntimeError("boom")
        yield {}  # noqa  — makes this an async generator

    svc._invoke_agent_run = fake_invoke
    events = [e async for e in svc.run("hi")]
    assert any(e.get("type") == "error" and "boom" in e.get("error", "") for e in events)
    assert events[-1] == {"type": "done", "content": ""}
