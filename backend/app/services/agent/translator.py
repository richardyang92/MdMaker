"""Translate PydanticAI AgentStreamEvents into frontend SSE dicts.

PydanticAI event reference (verified against pydantic_ai 2.22):
- PartDeltaEvent: .delta (.content_delta for TextPartDelta / ThinkingPartDelta,
  .args_delta for ToolCallPartDelta). Token-level — must be aggregated downstream.
- PartEndEvent: .part, .next_part_kind — marks end of a streamed part; useful as
  a flush boundary for aggregated thought text.
- FunctionToolCallEvent: .part (ToolCallPart: .tool_name, .args, .tool_call_id)
- FunctionToolResultEvent: .part (ToolReturnPart: .tool_name, .outcome,
  .content) or RetryPromptPart. Carries the authoritative tool_name + outcome.
- FinalResultEvent: .tool_name, .tool_call_id — agent produced its final answer.
"""

from __future__ import annotations

from typing import Any

# Workspace write tools — calling one of these may have changed the document.
# Used to decide whether to emit a document_patch after a tool result.
WRITE_TOOLS: frozenset[str] = frozenset(
    {
        "insert_text",
        "replace_section",
        "replace_range",
        "delete_range",
        "find_replace",
        "replace_document",
        "set_title",
    }
)


def make_document_patch(version: int, summary: str) -> dict:
    """Construct a document_patch SSE event."""
    return {"type": "document_patch", "version": version, "summary": summary}


def make_thought_delta(text: str) -> dict:
    """Construct a thought (streaming delta) SSE event."""
    return {"type": "thought", "content": text}


def make_tool_call(name: str, args: Any) -> dict:
    return {"type": "tool_call", "name": name, "args": args or {}}


def make_tool_result(name: str, ok: bool, summary: str) -> dict:
    return {"type": "tool_result", "name": name, "ok": ok, "summary": summary}


def translate_event(event: Any) -> dict | None:
    """Translate one PydanticAI stream event into an SSE dict, or None to skip.

    Uses duck typing (getattr / class name) so the module does not hard-depend
    on importing every PydanticAI event class at module load.
    """
    kind = type(event).__name__

    if kind == "PartDeltaEvent":
        delta = getattr(event, "delta", None)
        content_delta = getattr(delta, "content_delta", None) if delta is not None else None
        if content_delta:
            return make_thought_delta(content_delta)
        return None

    if kind == "FunctionToolCallEvent":
        part = getattr(event, "part", None)
        name = getattr(part, "tool_name", "") or ""
        args = getattr(part, "args", None)
        return make_tool_call(name, args)

    if kind == "FunctionToolResultEvent":
        part = getattr(event, "part", None)
        name = getattr(part, "tool_name", "") or ""
        # PydanticAI ToolReturnPart carries an authoritative outcome field.
        outcome = getattr(part, "outcome", None)
        if outcome is not None:
            ok = outcome == "success"
        else:  # Fallback heuristic for older/non-conforming parts
            content = getattr(part, "content", "") or ""
            text = content if isinstance(content, str) else str(content)
            ok = not (text.lower().startswith("error") or "not found" in text.lower())
        content = getattr(event, "content", "") or getattr(part, "content", "") or ""
        summary = content if isinstance(content, str) else str(content)
        return make_tool_result(name, bool(ok), summary)

    if kind == "PartStartEvent":
        return None  # rely on deltas; part starts are too noisy

    # PartEndEvent is intentionally not translated to an SSE event here — the
    # service layer uses it as a flush signal for aggregated thought text.

    return None
