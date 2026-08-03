"""Tests for document outline parsing."""
from app.services.workspace.outline import parse_outline, OutlineSection


def test_parse_outline_extracts_headings():
    doc = "# Title\n\nIntro.\n\n## Section A\n\ntext\n\n### Sub\n\n## Section B\n"
    sections = parse_outline(doc)
    assert len(sections) == 4
    assert sections[0].heading == "Title"
    assert sections[0].level == 1
    assert sections[0].line_start == 0
    assert sections[1].heading == "Section A"
    assert sections[3].heading == "Section B"


def test_parse_outline_section_line_ranges():
    # Sections A, B, C each on their own line, each followed by one body line.
    doc = "# A\nx\n# B\ny\n# C\n"
    sections = parse_outline(doc)
    # line index: 0="# A", 1="x", 2="# B", 3="y", 4="# C", 5=EOF
    assert sections[0].line_start == 0
    assert sections[1].line_start == 2
    assert sections[2].line_start == 4

    # line_end == line index where char_end points.
    # Section A ends at "# B" (line 2); Section B ends at "# C" (line 4);
    # trailing section C ends at EOF which is after the final newline, so
    # line_end == count of newlines before char_end == 5.
    assert sections[0].line_end == 2
    assert sections[1].line_end == 4
    assert sections[2].line_end == 5


def test_outline_line_end_consistent_with_char_end():
    # Trailing section: ensure lines[line_start:line_end] does not include a
    # phantom extra line for the trailing newline, and matches the char-based
    # slice in content.
    doc = "# A\nbody1\nbody2\n# B\n"
    sections = parse_outline(doc)
    lines = doc.split("\n")
    trailing = sections[-1]  # section B, the trailing one

    # line_end points at the line index of char_end (EOF, just past the final
    # newline). char_end lands at len(doc) for the trailing section.
    assert trailing.char_end == len(doc)
    assert trailing.line_end == 4  # one past "# B" (line index 3)

    # The line-based slice must contain exactly the heading, with no phantom
    # empty line tacked on from the trailing newline.
    line_slice = lines[trailing.line_start:trailing.line_end]
    assert line_slice == ["# B"]

    # And it must agree in content with the char-based slice (the char slice's
    # single trailing newline is just the line separator, not extra content).
    char_slice = doc[trailing.char_start:trailing.char_end]
    assert "\n".join(line_slice) == char_slice.rstrip("\n")


def test_parse_outline_no_headings():
    sections = parse_outline("just plain text\nno headings\n")
    assert sections == []


def test_parse_outline_finds_heading_by_name():
    doc = "# Intro\n\n## Setup\n\n## Usage\n"
    sections = parse_outline(doc)
    setup = [s for s in sections if s.heading == "Setup"]
    assert len(setup) == 1
    assert setup[0].level == 2


def test_outline_section_char_range():
    doc = "# A\nbody1\n# B\nbody2\n"
    sections = parse_outline(doc)
    # First section content (excluding next heading) should be queryable
    s0 = sections[0]
    assert s0.line_start == 0
    assert doc[s0.char_start:s0.char_end].startswith("# A")
    assert "# B" not in doc[s0.char_start:s0.char_end]
