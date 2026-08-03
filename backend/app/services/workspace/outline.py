"""Document outline parsing — heading tree with line/char ranges."""
from __future__ import annotations

import re
from dataclasses import dataclass

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$", re.MULTILINE)


@dataclass
class OutlineSection:
    """A heading and the content range it governs."""

    heading: str
    level: int
    line_start: int
    line_end: int
    char_start: int
    char_end: int


def parse_outline(document: str) -> list[OutlineSection]:
    """Parse Markdown headings into sections with line/char ranges.

    Each section's range runs from its heading to the start of the next
    heading of the same or higher level (or end of document).
    """
    matches = list(_HEADING_RE.finditer(document))
    if not matches:
        return []

    sections: list[OutlineSection] = []
    for i, m in enumerate(matches):
        level = len(m.group(1))
        heading = m.group(2).strip()
        line_start = document.count("\n", 0, m.start())
        char_start = m.start()

        # find next heading at same or higher level (default: end of document)
        end_char = len(document)
        for nxt in matches[i + 1:]:
            nxt_level = len(nxt.group(1))
            if nxt_level <= level:
                end_char = nxt.start()
                break

        # line_end is the line index where end_char points. Compute it
        # uniformly from end_char so both the heading-terminated and EOF
        # branches stay consistent with char_end.
        end_line = document.count("\n", 0, end_char)

        sections.append(
            OutlineSection(
                heading=heading,
                level=level,
                line_start=line_start,
                line_end=end_line,
                char_start=char_start,
                char_end=end_char,
            )
        )
    return sections
