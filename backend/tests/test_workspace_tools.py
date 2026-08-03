"""Tests for workspace document-editing tools."""
import pytest

from app.services.workspace.workspace import Workspace


@pytest.fixture
def ws():
    return Workspace(content="# Hello\n\nSome intro text.\n\n## Section A\n\nbody A\n")


@pytest.mark.asyncio
async def test_get_outline(ws):
    outline = await ws.get_document_outline()
    titles = [s["heading"] for s in outline]
    assert "Hello" in titles
    assert "Section A" in titles


@pytest.mark.asyncio
async def test_insert_text_at_position(ws):
    await ws.insert_text("INSERTED", position=0)
    assert ws.content.startswith("INSERTED")


@pytest.mark.asyncio
async def test_insert_text_after_heading(ws):
    await ws.insert_text("NEW BODY", after_heading="Section A")
    # NEW BODY appears somewhere after the Section A heading
    assert "NEW BODY" in ws.content
    assert ws.content.index("NEW BODY") > ws.content.index("## Section A")


@pytest.mark.asyncio
async def test_replace_range(ws):
    original_len = len(ws.content)
    await ws.replace_range(0, 7, "# Planet Earth")
    assert ws.content.startswith("# Planet Earth")
    assert len(ws.content) != original_len


@pytest.mark.asyncio
async def test_replace_section(ws):
    await ws.replace_section("Section A", "## Section A\n\nREPLACED BODY\n")
    assert "REPLACED BODY" in ws.content
    assert "body A" not in ws.content


@pytest.mark.asyncio
async def test_delete_range(ws):
    before = len(ws.content)
    await ws.delete_range(0, 7)
    assert len(ws.content) == before - 7
    assert not ws.content.startswith("# Hello")


@pytest.mark.asyncio
async def test_find_replace(ws):
    count = await ws.find_replace("Section", "Part")
    assert count >= 1
    assert "Part A" in ws.content
    assert "Section" not in ws.content


@pytest.mark.asyncio
async def test_set_title(ws):
    await ws.set_title("Doc Title")
    assert ws.title == "Doc Title"


@pytest.mark.asyncio
async def test_get_section(ws):
    section = await ws.get_section("Section A")
    assert "body A" in section


@pytest.mark.asyncio
async def test_replace_range_out_of_bounds_raises(ws):
    with pytest.raises(ValueError, match="out of bounds"):
        await ws.replace_range(0, 99999, "x")


@pytest.mark.asyncio
async def test_replace_section_not_found_raises(ws):
    with pytest.raises(ValueError, match="heading not found"):
        await ws.replace_section("Nonexistent", "x")


@pytest.mark.asyncio
async def test_find_replace_empty_pattern_raises(ws):
    with pytest.raises(ValueError, match="pattern must be non-empty"):
        await ws.find_replace("", "x")


@pytest.mark.asyncio
async def test_deletion_ratio_rejects_massive_delete():
    big = Workspace(content="x" * 1000)
    # Trying to replace 1000 chars with 1 char deletes >50%
    with pytest.raises(ValueError, match="rejected"):
        await big.replace_range(0, 1000, "y")


@pytest.mark.asyncio
async def test_undo_restores_previous_state(ws):
    original = ws.content
    await ws.insert_text("TEMP")
    assert ws.content != original
    snap = await ws.undo()
    assert snap is not None
    assert ws.content == original


@pytest.mark.asyncio
async def test_undo_at_initial_state_returns_none():
    fresh = Workspace(content="only")
    assert await fresh.undo() is None


@pytest.mark.asyncio
async def test_apply_client_edit_ok(ws):
    v = ws.version
    res = await ws.apply_client_edit(v, "# Edited\n")
    assert res["status"] == "ok"
    assert res["version"] == v + 1
    assert res["content"] == "# Edited\n"


@pytest.mark.asyncio
async def test_apply_client_edit_conflict_returns_authoritative(ws):
    v0 = ws.version
    # Agent edits first
    await ws.insert_text("AGENT")
    # Client now edits based on stale version
    res = await ws.apply_client_edit(v0, "# stale\n")
    assert res["status"] == "conflict"
    assert "AGENT" in res["content"]


@pytest.mark.asyncio
async def test_version_increments_on_each_write(ws):
    v0 = ws.version
    await ws.insert_text("a")
    await ws.insert_text("b")
    assert ws.version == v0 + 2
