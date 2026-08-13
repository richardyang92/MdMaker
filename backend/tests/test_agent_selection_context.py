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


def test_at_ref_is_expanded_inline_to_labeled_fenced_block(client):
    captured: dict = {}
    _stub_agent_to_capture_message(captured)

    sid = client.post("/api/v1/agent/sessions", json={"document": "# Doc\n", "title": "T"}).json()[
        "session_id"
    ]

    resp = client.post(
        f"/api/v1/agent/sessions/{sid}/messages",
        json={
            "message": "把 @ctx-1 改写成列表",
            "provider": "deepseek",
            "model": "deepseek-chat",
            "contexts": [{"ref": "ctx-1", "label": "引言", "content": "## 引言\n一段文字"}],
        },
    )

    assert resp.status_code == 200
    assert captured["message"] == (
        "把 [上下文 @ctx-1 · 引言]\n```\n## 引言\n一段文字\n``` 改写成列表"
    )


def test_unreferenced_contexts_are_appended_after_message(client):
    captured: dict = {}
    _stub_agent_to_capture_message(captured)

    sid = client.post("/api/v1/agent/sessions", json={"document": "# Doc\n", "title": "T"}).json()[
        "session_id"
    ]

    resp = client.post(
        f"/api/v1/agent/sessions/{sid}/messages",
        json={
            "message": "重写这段",
            "provider": "deepseek",
            "model": "deepseek-chat",
            "contexts": [
                {"ref": "ctx-1", "label": "A", "content": "aaa"},
                {"ref": "ctx-2", "label": "B", "content": "bbb"},
            ],
        },
    )

    assert resp.status_code == 200
    assert captured["message"] == (
        "重写这段\n\n" "[上下文 @ctx-1 · A]\n```\naaa\n```\n\n" "[上下文 @ctx-2 · B]\n```\nbbb\n```"
    )


def test_referenced_context_is_not_duplicated_in_appendix(client):
    captured: dict = {}
    _stub_agent_to_capture_message(captured)

    sid = client.post("/api/v1/agent/sessions", json={"document": "# Doc\n", "title": "T"}).json()[
        "session_id"
    ]

    resp = client.post(
        f"/api/v1/agent/sessions/{sid}/messages",
        json={
            "message": "参考 @ctx-1 和 @ctx-2 各写一段",
            "provider": "deepseek",
            "model": "deepseek-chat",
            "contexts": [
                {"ref": "ctx-1", "label": "A", "content": "aaa"},
                {"ref": "ctx-2", "label": "B", "content": "bbb"},
                {"ref": "ctx-3", "label": "C", "content": "ccc"},
            ],
        },
    )

    assert resp.status_code == 200
    message = captured["message"]
    assert (
        "参考 [上下文 @ctx-1 · A]\n```\naaa\n``` 和 [上下文 @ctx-2 · B]\n```\nbbb\n``` 各写一段"
        in message
    )
    # ctx-3 was never mentioned, so it must appear exactly once — in the appendix.
    assert message.count("[上下文 @ctx-3 · C]") == 1
    assert message.endswith("[上下文 @ctx-3 · C]\n```\nccc\n```")
    # ctx-1/ctx-2 must not be duplicated in the appendix.
    assert message.count("[上下文 @ctx-1 · A]") == 1
    assert message.count("[上下文 @ctx-2 · B]") == 1


def test_at_document_expands_to_full_document(client):
    captured: dict = {}
    _stub_agent_to_capture_message(captured)

    sid = client.post(
        "/api/v1/agent/sessions", json={"document": "# Full\n\nBody.\n", "title": "T"}
    ).json()["session_id"]

    resp = client.post(
        f"/api/v1/agent/sessions/{sid}/messages",
        json={
            "message": "根据 @document 写个摘要",
            "provider": "deepseek",
            "model": "deepseek-chat",
            "contexts": [],
        },
    )

    assert resp.status_code == 200
    assert captured["message"] == (
        "根据 [上下文 @document · 文档全文]\n```\n# Full\n\nBody.\n\n``` 写个摘要"
    )


def test_at_document_without_contexts_field_is_left_literal(client):
    """Legacy clients (no contexts field) keep their message untouched."""
    captured: dict = {}
    _stub_agent_to_capture_message(captured)

    sid = client.post("/api/v1/agent/sessions", json={"document": "# Doc\n", "title": "T"}).json()[
        "session_id"
    ]

    resp = client.post(
        f"/api/v1/agent/sessions/{sid}/messages",
        json={
            "message": "根据 @document 写个摘要",
            "provider": "deepseek",
            "model": "deepseek-chat",
        },
    )

    assert resp.status_code == 200
    assert captured["message"] == "根据 @document 写个摘要"


def test_unknown_at_ref_is_left_as_is(client):
    captured: dict = {}
    _stub_agent_to_capture_message(captured)

    sid = client.post("/api/v1/agent/sessions", json={"document": "# Doc\n", "title": "T"}).json()[
        "session_id"
    ]

    resp = client.post(
        f"/api/v1/agent/sessions/{sid}/messages",
        json={
            "message": "参考 @ctx-9 改写",
            "provider": "deepseek",
            "model": "deepseek-chat",
            "contexts": [{"ref": "ctx-1", "label": "A", "content": "aaa"}],
        },
    )

    assert resp.status_code == 200
    assert captured["message"] == ("参考 @ctx-9 改写\n\n[上下文 @ctx-1 · A]\n```\naaa\n```")


def test_contexts_take_precedence_over_legacy_selection(client):
    captured: dict = {}
    _stub_agent_to_capture_message(captured)

    sid = client.post("/api/v1/agent/sessions", json={"document": "# Doc\n", "title": "T"}).json()[
        "session_id"
    ]

    resp = client.post(
        f"/api/v1/agent/sessions/{sid}/messages",
        json={
            "message": "重写这段",
            "provider": "deepseek",
            "model": "deepseek-chat",
            "selection": "legacy text",
            "contexts": [{"ref": "ctx-1", "label": "A", "content": "aaa"}],
        },
    )

    assert resp.status_code == 200
    assert captured["message"] == "重写这段\n\n[上下文 @ctx-1 · A]\n```\naaa\n```"
    assert "legacy text" not in captured["message"]


def test_context_containing_fences_uses_a_longer_fence(client):
    """A snippet that itself contains ``` fences must not close the wrapper."""
    captured: dict = {}
    _stub_agent_to_capture_message(captured)

    sid = client.post("/api/v1/agent/sessions", json={"document": "# Doc\n", "title": "T"}).json()[
        "session_id"
    ]

    resp = client.post(
        f"/api/v1/agent/sessions/{sid}/messages",
        json={
            "message": "改写 @ctx-1",
            "provider": "deepseek",
            "model": "deepseek-chat",
            "contexts": [{"ref": "ctx-1", "label": "代码", "content": "```js\nlet a = 1;\n```"}],
        },
    )

    assert resp.status_code == 200
    assert captured["message"] == (
        "改写 [上下文 @ctx-1 · 代码]\n````\n```js\nlet a = 1;\n```\n````"
    )
