"""Tests for in-memory AgentSession management."""
from app.services.agent.session import SessionManager, AgentSession


def test_create_session_returns_session_id():
    mgr = SessionManager()
    sess = mgr.create(document="# Hi\n", title="Doc")
    assert sess.session_id
    assert sess.workspace.content == "# Hi\n"
    assert sess.workspace.title == "Doc"
    assert sess.status == "idle"


def test_get_session():
    mgr = SessionManager()
    sess = mgr.create(document="x", title="t")
    got = mgr.get(sess.session_id)
    assert got is sess


def test_get_unknown_session_returns_none():
    mgr = SessionManager()
    assert mgr.get("nope") is None


def test_delete_session():
    mgr = SessionManager()
    sess = mgr.create(document="x", title="t")
    mgr.delete(sess.session_id)
    assert mgr.get(sess.session_id) is None


def test_agent_session_message_history_starts_empty():
    sess = AgentSession.create(document="x", title="t")
    assert sess.message_history == []


def test_agent_session_status_transitions():
    sess = AgentSession.create(document="x", title="t")
    assert sess.status == "idle"
    sess.status = "running"
    assert sess.status == "running"
