"""Regression tests for selection-context injection on the agent message path.

Contract under test: when the client POSTs a message with a non-empty
``selection``, the endpoint must append it to the user-facing message as a
``[Selected text context]`` fenced block *before* handing the string to the
agent. With ``selection=None`` the message must pass through unchanged.

This is the backend invariant that the new "add selection to context" UI relies
on. The injection happens at ``app/api/v1/agent.py`` (``send_message``) — the
``AgentService`` itself only ever sees a plain ``message`` string, so we assert
on the string that reaches the agent by monkeypatching ``_invoke_agent_run``.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.agent import service as service_mod
from app.services.agent import session as session_mod


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def reset_sessions():
    """Isolate tests: clear the module-level session registry before each test."""
    session_mod._sessions._sessions.clear()
    yield
    session_mod._sessions._sessions.clear()


def _stub_agent_to_capture_message(captured: dict) -> None:
    """Patch AgentService._invoke_agent_run so the endpoint's instance records
    the message it was called with, without contacting any LLM."""

    async def fake_invoke(self, agent, message, message_history):  # type: ignore[no-untyped-def]
        captured["message"] = message
        captured["history"] = message_history
        yield {"type": "final", "content": "ok"}

    service_mod.AgentService._invoke_agent_run = fake_invoke  # type: ignore[method-assign]


def test_selection_is_appended_to_user_message(client, monkeypatch):
    captured: dict = {}
    _stub_agent_to_capture_message(captured)

    sid = client.post(
        "/api/v1/agent/sessions", json={"document": "# Doc\n\nHello.\n", "title": "T"}
    ).json()["session_id"]

    resp = client.post(
        f"/api/v1/agent/sessions/{sid}/messages",
        json={
            "message": "Rewrite this",
            "provider": "deepseek",
            "model": "deepseek-chat",
            "selection": "selected paragraph",
        },
    )

    assert resp.status_code == 200
    assert captured["message"] == (
        "Rewrite this\n\n[Selected text context]\n```\nselected paragraph\n```"
    )


def test_no_selection_passes_message_through_unchanged(client):
    captured: dict = {}
    _stub_agent_to_capture_message(captured)

    sid = client.post("/api/v1/agent/sessions", json={"document": "# Doc\n", "title": "T"}).json()[
        "session_id"
    ]

    resp = client.post(
        f"/api/v1/agent/sessions/{sid}/messages",
        json={
            "message": "Just a question",
            "provider": "deepseek",
            "model": "deepseek-chat",
        },
    )

    assert resp.status_code == 200
    assert captured["message"] == "Just a question"
