"""Integration tests for /api/v1/agent endpoints."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
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


def test_create_session(client):
    resp = client.post("/api/v1/agent/sessions", json={"document": "# Hi\n", "title": "T"})
    assert resp.status_code == 200
    data = resp.json()
    assert "session_id" in data
    assert data["version"] == 0
    assert data["title"] == "T"


def test_get_unknown_session_returns_404(client):
    resp = client.post(
        "/api/v1/agent/sessions/nope/messages",
        json={"message": "hi", "provider": "deepseek", "model": "deepseek-chat"},
    )
    assert resp.status_code == 404


def test_delete_session(client):
    sid = client.post("/api/v1/agent/sessions", json={}).json()["session_id"]
    resp = client.delete(f"/api/v1/agent/sessions/{sid}")
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True


def test_stop_session(client):
    sid = client.post("/api/v1/agent/sessions", json={}).json()["session_id"]
    resp = client.post(f"/api/v1/agent/sessions/{sid}/stop")
    assert resp.status_code == 200
    assert resp.json()["stopped"] is True


def test_sync_ok(client):
    sid = client.post("/api/v1/agent/sessions", json={"document": "x"}).json()["session_id"]
    resp = client.post(
        f"/api/v1/agent/sessions/{sid}/sync",
        json={"base_version": 0, "content": "new"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["version"] == 1
    assert data["content"] == "new"


def test_sync_conflict(client):
    sid = client.post("/api/v1/agent/sessions", json={"document": "x"}).json()["session_id"]
    # Simulate agent edit bumping version
    sess = session_mod._sessions.get(sid)
    sess.workspace.version = 5
    sess.workspace.content = "agent-changed"
    resp = client.post(
        f"/api/v1/agent/sessions/{sid}/sync",
        json={"base_version": 0, "content": "stale"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "conflict"
    assert data["content"] == "agent-changed"
