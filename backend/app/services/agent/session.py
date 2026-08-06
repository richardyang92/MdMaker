"""In-memory AgentSession management.

No persistence — sessions live in a process-local dict. Restart loses state.
This matches the design decision (内存会话状态, no DB).
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from typing import Literal, Optional

from app.services.workspace.workspace import Workspace

SessionStatus = Literal["idle", "running", "stopped", "done", "failed"]


@dataclass
class AgentSession:
    session_id: str
    workspace: Workspace
    status: SessionStatus = "idle"
    message_history: list = field(default_factory=list)
    # Cancellation signal shared with the running AgentService. Set by
    # `stop()` so the agent loop can terminate cooperatively instead of
    # running to completion in the background.
    stop_event: asyncio.Event = field(default_factory=asyncio.Event)

    @classmethod
    def create(cls, document: str = "", title: str = "Untitled") -> "AgentSession":
        return cls(
            session_id=str(uuid.uuid4()),
            workspace=Workspace(content=document, title=title),
        )

    def stop(self) -> None:
        """Signal the running agent (if any) to cancel as soon as possible."""
        self.stop_event.set()


class SessionManager:
    """Process-local registry of AgentSessions."""

    def __init__(self) -> None:
        self._sessions: dict[str, AgentSession] = {}

    def create(self, document: str = "", title: str = "Untitled") -> AgentSession:
        sess = AgentSession.create(document=document, title=title)
        self._sessions[sess.session_id] = sess
        return sess

    def get(self, session_id: str) -> Optional[AgentSession]:
        return self._sessions.get(session_id)

    def delete(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)


# Module-level singleton (in-memory, per process)
_sessions = SessionManager()


def get_session_manager() -> SessionManager:
    return _sessions
