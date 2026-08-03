"""Tests for PydanticAI event → SSE dict translation."""


def test_translator_returns_none_for_irrelevant_event():
    from app.services.agent.translator import translate_event
    assert translate_event({"unknown": "event"}) is None


def test_make_document_patch_shape():
    from app.services.agent.translator import make_document_patch
    patch = make_document_patch(version=5, summary="edited section A")
    assert patch == {"type": "document_patch", "version": 5, "summary": "edited section A"}


class _FakeEvent:
    """Minimal stand-in matching PydanticAI AgentStreamEvent shape used by translator."""
    def __init__(self, event_kind: str, part=None, delta=None, tool_call_id=None, index=0):
        self.event_kind = event_kind
        self.part = part
        self.delta = delta
        self.tool_call_id = tool_call_id
        self.index = index


def test_translate_text_delta():
    from app.services.agent.translator import translate_event
    delta = type("D", (), {"content_delta": "hello"})()
    evt = _FakeEvent("PartDeltaEvent", delta=delta)
    # _FakeEvent's class name is _FakeEvent, not PartDeltaEvent. The translator
    # dispatches on type(event).__name__, so to test the delta path we need the
    # event class name to match. Override via a subclass.
    class PartDeltaEvent(_FakeEvent):
        pass
    evt = PartDeltaEvent("PartDeltaEvent", delta=delta)
    out = translate_event(evt)
    assert out == {"type": "thought", "content": "hello"}


def test_translate_tool_call_event():
    from app.services.agent.translator import translate_event
    part = type("P", (), {"tool_name": "replace_section", "args": {"heading": "A"}})()
    class FunctionToolCallEvent(_FakeEvent):
        pass
    evt = FunctionToolCallEvent("FunctionToolCallEvent", part=part)
    out = translate_event(evt)
    assert out["type"] == "tool_call"
    assert out["name"] == "replace_section"
    assert out["args"] == {"heading": "A"}


def test_translate_tool_result_event_success():
    from app.services.agent.translator import translate_event
    part = type("P", (), {"content": "replaced section A (version 3)"})()
    class FunctionToolResultEvent(_FakeEvent):
        pass
    evt = FunctionToolResultEvent("FunctionToolResultEvent", part=part, tool_call_id="c1")
    out = translate_event(evt)
    assert out["type"] == "tool_result"
    assert out["ok"] is True


def test_translate_tool_result_event_failure():
    from app.services.agent.translator import translate_event
    part = type("P", (), {"content": "Error: heading not found"})()
    class FunctionToolResultEvent(_FakeEvent):
        pass
    evt = FunctionToolResultEvent("FunctionToolResultEvent", part=part)
    out = translate_event(evt)
    assert out["type"] == "tool_result"
    assert out["ok"] is False
