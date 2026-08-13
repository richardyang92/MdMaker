"""Agent API routes — sessions, streaming messages, sync, stop."""

from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.core.config import get_settings
from app.schemas.agent import (
    ClientSyncRequest,
    ClientSyncResponse,
    ContextItem,
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


def _safe_fence(content: str) -> str:
    """Return a backtick fence at least one tick longer than any run in content.

    Snippet content is itself Markdown and may contain fenced code blocks;
    a fixed ``` wrapper would close early on such content. Use a fence that
    cannot collide with anything inside.
    """
    longest = max((len(m.group(0)) for m in re.finditer(r"`+", content)), default=0)
    return "`" * max(3, longest + 1)


def _context_block(ref: str, label: str, content: str) -> str:
    """Render one context snippet as a labeled fenced Markdown block."""
    header = f"[上下文 @{ref} · {label}]" if label else f"[上下文 @{ref}]"
    fence = _safe_fence(content)
    return f"{header}\n{fence}\n{content}\n{fence}"


def expand_context_references(
    message: str,
    contexts: list[ContextItem] | None,
    document: str,
) -> tuple[str, list[ContextItem]]:
    """Expand ``@<ref>`` mentions in ``message`` into fenced Markdown blocks.

    - Each ``@<ref>`` occurrence (matching an attached context) is replaced by a
      labeled fenced block containing that snippet's raw Markdown.
    - ``@document`` is replaced by the full current document.
    - Attached contexts that are *not* referenced anywhere in the message are
      appended after it, preserving the legacy behavior where adding a snippet
      without mentioning it still sends it.

    When ``contexts`` is ``None`` (legacy clients), the message is returned
    unchanged. An explicitly empty list still expands ``@document``.

    Returns the expanded message and the list of contexts that were referenced
    inline (so callers can distinguish appended vs. inline usage).
    """
    if contexts is None:
        return message, []

    referenced: list[ContextItem] = []
    for item in contexts:
        pattern = rf"(?<![\w@-])@{re.escape(item.ref)}\b"
        if re.search(pattern, message):
            message = re.sub(
                pattern, lambda _m: _context_block(item.ref, item.label, item.content), message
            )
            referenced.append(item)

    message = re.sub(
        r"(?<![\w@-])@document\b",
        lambda _m: _context_block("document", "文档全文", document),
        message,
    )

    unreferenced = [c for c in contexts if all(r.ref != c.ref for r in referenced)]
    if unreferenced:
        appended = "\n\n".join(_context_block(c.ref, c.label, c.content) for c in unreferenced)
        message = f"{message}\n\n{appended}"

    return message, referenced


def _append_history(sess, user_message: str, assistant_text: str) -> None:
    """Append this turn to message_history for multi-turn continuity.

    We store a lightweight (user, assistant) ModelMessage pair rather than the
    full tool-call transcript — enough context for the model to remember prior
    turns while keeping memory bounded. Imported lazily so the module remains
    importable if pydantic_ai's message API shifts.
    """
    if not assistant_text:
        return
    from pydantic_ai.messages import ModelRequest, ModelResponse, TextPart, UserPromptPart

    sess.message_history.append(ModelRequest(parts=[UserPromptPart(content=user_message)]))
    sess.message_history.append(ModelResponse(parts=[TextPart(content=assistant_text)]))


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
        # Share the session's stop event so /stop can interrupt this run.
        stop_event=sess.stop_event,
    )

    # Build the user message: expand @<ref> mentions and @document, append any
    # unreferenced attached contexts (legacy selection kept for compatibility).
    user_message = req.message
    if req.contexts is not None:
        user_message, _referenced = expand_context_references(
            req.message, req.contexts, sess.workspace.content
        )
    elif req.selection:
        user_message = f"{user_message}\n\n[Selected text context]\n```\n{req.selection}\n```"

    # Reset the stop flag from any previous run on this session, then mark running.
    sess.stop_event.clear()
    sess.status = "running"

    async def event_gen():
        was_stopped = False
        try:
            async for evt in service.run(user_message, message_history=sess.message_history):
                if evt.get("type") == "stopped":
                    was_stopped = True
                yield evt
            # Persist this turn into history for multi-turn continuity.
            # (Only when not cancelled, so we don't remember half-finished turns.)
            if not was_stopped:
                _append_history(sess, user_message, service.last_assistant_text)
        finally:
            sess.status = "stopped" if was_stopped else "done"

    return StreamingResponse(
        create_agent_sse_stream(event_gen()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
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
    """Interrupt a running agent as soon as possible.

    Sets the session's stop event so the running AgentService loop terminates
    cooperatively at the next event boundary (rather than running to completion
    in the background). The SSE stream then emits a `stopped` terminal event.
    """
    mgr = get_session_manager()
    sess = mgr.get(session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="session not found")
    sess.stop()
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
