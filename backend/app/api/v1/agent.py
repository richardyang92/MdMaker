"""Agent API routes — sessions, streaming messages, sync, stop."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.core.config import get_settings
from app.schemas.agent import (
    ClientSyncRequest,
    ClientSyncResponse,
    CreateSessionRequest,
    CreateSessionResponse,
    SendMessageRequest,
    StopResponse,
)
from app.services.agent.service import AgentService
from app.services.agent.session import get_session_manager
from app.services.streaming import create_agent_sse_stream

router = APIRouter()
_settings = get_settings()


def _provider_credentials(provider: str) -> tuple[str, str]:
    """Resolve (api_key, base_url) for a provider from settings.

    Ollama does not require an API key, but the OpenAI SDK used by PydanticAI
    rejects an empty api_key. We pass a non-empty placeholder for Ollama; the
    Ollama server ignores it.
    """
    provider = provider.lower()
    if provider == "deepseek":
        return _settings.deepseek_api_key, _settings.deepseek_base_url
    if provider == "ollama":
        return "ollama-placeholder", _settings.ollama_base_url
    raise HTTPException(status_code=400, detail=f"unsupported provider: {provider}")


@router.post("/sessions", response_model=CreateSessionResponse)
async def create_session(req: CreateSessionRequest) -> CreateSessionResponse:
    """Create a new agent session with initial document content."""
    mgr = get_session_manager()
    sess = mgr.create(document=req.document, title=req.title)
    return CreateSessionResponse(
        session_id=sess.session_id,
        version=sess.workspace.version,
        title=sess.workspace.title,
    )


@router.post("/sessions/{session_id}/messages")
async def send_message(session_id: str, req: SendMessageRequest) -> StreamingResponse:
    """Send a user message and stream agent events back via SSE."""
    mgr = get_session_manager()
    sess = mgr.get(session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="session not found")
    if sess.status == "running":
        raise HTTPException(status_code=409, detail="session already running")

    api_key, base_url = _provider_credentials(req.provider)
    if req.provider.lower() == "deepseek" and not api_key:
        raise HTTPException(status_code=400, detail="DeepSeek API key not configured")

    service = AgentService(
        workspace=sess.workspace,
        provider=req.provider,
        model=req.model,
        api_key=api_key,
        base_url=base_url,
    )

    # Build the user message with optional selection context
    user_message = req.message
    if req.selection:
        user_message = f"{user_message}\n\n[Selected text context]\n```\n{req.selection}\n```"

    sess.status = "running"

    async def event_gen():
        try:
            async for evt in service.run(user_message, message_history=sess.message_history):
                yield evt
        finally:
            sess.status = "done"

    return StreamingResponse(
        create_agent_sse_stream(event_gen()),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@router.post("/sessions/{session_id}/sync", response_model=ClientSyncResponse)
async def sync_document(session_id: str, req: ClientSyncRequest) -> ClientSyncResponse:
    """Apply a client-side edit with optimistic locking."""
    mgr = get_session_manager()
    sess = mgr.get(session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="session not found")
    if sess.status == "running":
        raise HTTPException(status_code=409, detail="cannot sync while agent is running")
    result = await sess.workspace.apply_client_edit(req.base_version, req.content)
    return ClientSyncResponse(
        status=result["status"],
        version=result["version"],
        content=result["content"],
        title=sess.workspace.title,
    )


@router.post("/sessions/{session_id}/stop", response_model=StopResponse)
async def stop_session(session_id: str) -> StopResponse:
    """Mark a session as stopped (the streaming connection is closed client-side)."""
    mgr = get_session_manager()
    sess = mgr.get(session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="session not found")
    sess.status = "stopped"
    return StopResponse(stopped=True)


@router.get("/sessions/{session_id}/document")
async def get_session_document(session_id: str) -> dict:
    """Return the authoritative document content + version."""
    mgr = get_session_manager()
    sess = mgr.get(session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="session not found")
    return {
        "content": sess.workspace.content,
        "title": sess.workspace.title,
        "version": sess.workspace.version,
    }


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str) -> dict:
    """Delete a session."""
    mgr = get_session_manager()
    if mgr.get(session_id) is None:
        raise HTTPException(status_code=404, detail="session not found")
    mgr.delete(session_id)
    return {"deleted": True}
