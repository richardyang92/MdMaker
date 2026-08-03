"""Translate PydanticAI AgentStreamEvents into frontend SSE dicts.

PydanticAI event attribute reference (verified against docs):
- PartDeltaEvent: .delta (.content_delta for TextPartDelta / ThinkingPartDelta,
  .args_delta for ToolCallPartDelta)
- FunctionToolCallEvent: .part (.tool_name, .args, .tool_call_id)
- FunctionToolResultEvent: .part (.content), .tool_call_id
"""
from __future__ import annotations

from typing import Any


def make_document_patch(version: int, summary: str) -> dict:
    """Construct a document_patch SSE event."""
    return {"type": "document_patch", "version": version, "summary": summary}


def translate_event(event: Any) -> dict | None:
    """Translate one PydanticAI stream event into an SSE dict, or None to skip.

    Uses duck typing (getattr) rather than isinstance so the module does not
    hard-depend on importing every PydanticAI event class at module load.
    """
    # Duck-type the event kind by class name (PydanticAI events are dataclasses/pydantic)
    kind = type(event).__name__

    if kind == "PartDeltaEvent":
        delta = getattr(event, "delta", None)
        content_delta = getattr(delta, "content_delta", None) if delta is not None else None
        if content_delta:
            return {"type": "thought", "content": content_delta}
        return None

    if kind == "FunctionToolCallEvent":
        part = getattr(event, "part", None)
        name = getattr(part, "tool_name", "") or ""
        args = getattr(part, "args", None)
        return {"type": "tool_call", "name": name, "args": args or {}}

    if kind == "FunctionToolResultEvent":
        part = getattr(event, "part", None)
        content = getattr(part, "content", "") or ""
        # Heuristic: a tool result mentioning "Error" or "not found" is a failure.
        ok = not (content.lower().startswith("error") or "not found" in content.lower())
        return {"type": "tool_result", "name": "", "ok": ok, "summary": content}

    if kind == "PartStartEvent":
        return None  # we rely on deltas; part starts are too noisy

    return None
