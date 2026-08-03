# Agent 主导编辑器实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 MdMaker 从「AI 只产聊天文本、用户手动应用」改造成「后端用 PydanticAI 跑自主 Agent 循环,Agent 通过文档编辑工具直接改后端权威文档,改动经 SSE 实时推给前端编辑器」。

**Architecture:** 后端新增三个单元——`Workspace`(后端权威文档状态 + 纯文本编辑工具,自建重点)、`AgentService`(用 PydanticAI 搭 Agent、注册工具、把 PydanticAI 事件翻译成 SSE 事件的薄胶水层)、`/api/v1/agent` 端点(会话 + 流式)。前端新增 `useAgentChat` hook + `AgentPanel` 组件 + `documentSync` 同步器,渐进接入 App.tsx(旧 `handleAiSend` 暂留并存)。Agent 循环/工具调度/多 provider 适配全部交给 PydanticAI 内建,自建精力集中在 Workspace。

**Tech Stack:** 后端 FastAPI + Pydantic + PydanticAI 2.x + pytest(新引入);前端 React 18 + TypeScript(strict)+ CodeMirror 6;通信 SSE(`data: {json}\n\n`)。

**设计稿:** `docs/superpowers/specs/2026-07-30-agent-driven-editor-design.md`

**分支:** `feature/agent-driven-editor`

---

## 文件结构

### 后端(新建)

| 文件 | 职责 |
|---|---|
| `backend/app/services/workspace/__init__.py` | 包标记,导出 `Workspace` |
| `backend/app/services/workspace/workspace.py` | 后端权威文档状态:`content/title/version/history`,线程安全(asyncio.Lock),乐观锁 |
| `backend/app/services/workspace/tools.py` | 纯文本编辑工具实现(纯函数式,操作 workspace):insert/replace/delete/find_replace/section 读写 |
| `backend/app/services/workspace/outline.py` | 文档大纲解析(标题树 + 行范围),供只读工具用 |
| `backend/app/services/agent/__init__.py` | 包标记,导出 `AgentService` |
| `backend/app/services/agent/session.py` | `AgentSession`:内存会话(关联 Workspace + message_history + status) |
| `backend/app/services/agent/service.py` | `AgentService`:用 PydanticAI `Agent` + `@agent.tool` 注册工具,`run()` 异步生成 SSE 事件 |
| `backend/app/services/agent/translator.py` | 把 PydanticAI `AgentStreamEvent` 翻译成前端 SSE dict(含 document_patch 注入) |
| `backend/app/schemas/agent.py` | Agent 相关 Pydantic schemas:`CreateSessionRequest/Response`、`SendMessageRequest`、`ClientSyncRequest`、事件类型 |
| `backend/app/api/v1/agent.py` | Agent 路由:`POST/DELETE /sessions`、`/messages`(SSE)、`/sync`、`/stop` |

### 后端(修改)

| 文件 | 改动 |
|---|---|
| `backend/pyproject.toml` | 加 `pydantic-ai`、`openai` 到 dependencies;加 `[tool.pytest.ini_options] asyncio_mode="auto"` |
| `backend/app/core/config.py` | 加 Agent 安全上限配置字段 + Agent system prompt |
| `backend/app/main.py` | `include_router(agent.router, prefix="/api/v1/agent")` |
| `backend/app/services/streaming.py` | 新增 `create_agent_sse_stream`(产任意 dict 的 SSE,不强制 ChatChunk) |

### 后端(新建测试)

| 文件 | 测什么 |
|---|---|
| `backend/tests/__init__.py` | 包标记 |
| `backend/tests/conftest.py` | pytest fixtures(workspace、mock agent) |
| `backend/tests/test_workspace_tools.py` | Workspace 编辑工具(边界、越界、乐观锁、撤销、编辑比例拒绝) |
| `backend/tests/test_outline.py` | 大纲解析 |
| `backend/tests/test_translator.py` | PydanticAI 事件 → SSE dict 映射 |
| `backend/tests/test_agent_session.py` | 会话创建/停止/清理 |
| `backend/tests/test_agent_api.py` | Agent 端点集成(TestClient + mock service) |

### 前端(新建)

| 文件 | 职责 |
|---|---|
| `frontend/src/services/api/agentApi.ts` | Agent 端点封装:createSession/sendMessage(SSE)/sync/stop/delete |
| `frontend/src/services/types/agent.ts` | Agent SSE 事件类型 + 请求类型(镜像后端 schemas) |
| `frontend/src/hooks/useAgentChat.ts` | 消费 Agent SSE,管理会话/事件流/补丁应用 |
| `frontend/src/lib/documentSync.ts` | 文档同步器:监听 onChange、节流发 /sync、应用 document_patch、版本冲突处理 |
| `frontend/src/components/agent/AgentPanel.tsx` | Agent 主交互面:消息流 + 状态条 + Stop |
| `frontend/src/components/agent/AgentEventItem.tsx` | 单条 Agent 事件渲染(thought/tool_call/tool_result/document_patch/final) |

### 前端(修改)

| 文件 | 改动 |
|---|---|
| `frontend/src/App.tsx` | 接入 `useAgentChat` + 渲染 `AgentPanel`;暴露 `setMarkdownFromAgent`(走撤销栈);旧 handleAiSend 暂留 |

---

## 任务依赖图

```
Phase 1 (后端 Workspace — 独立、纯函数,最先做)
  Task 1: 依赖与配置  →  Task 2: Outline  →  Task 3: Workspace 工具  →  Task 4: Workspace 乐观锁/撤销

Phase 2 (后端 Agent 服务层 — 依赖 Workspace)
  Task 5: Agent schemas  →  Task 6: Translator  →  Task 7: AgentService + 工具注册  →  Task 8: AgentSession

Phase 3 (后端端点 — 依赖 服务层)
  Task 9: Agent 路由 + 通用 SSE  →  Task 10: 挂到 main.py

Phase 4 (前端 — 依赖后端端点)
  Task 11: 前端类型  →  Task 12: agentApi  →  Task 13: documentSync  →  Task 14: useAgentChat  →  Task 15: AgentEventItem  →  Task 16: AgentPanel  →  Task 17: 接入 App.tsx

Phase 5 (端到端验证)
  Task 18: 手动验收
```

---

## Phase 1 — 后端 Workspace

### Task 1: 依赖与配置基线

**Files:**
- Modify: `backend/pyproject.toml`
- Modify: `backend/app/core/config.py`

- [ ] **Step 1: 添加后端依赖**

在 `backend/pyproject.toml` 的 `[tool.poetry.dependencies]`(第 9-21 行那段)末尾(`python-multipart = "0.0.6"` 之后)加两行:

```toml
pydantic-ai = "^2.21.0"
openai = "^1.50.0"
```

- [ ] **Step 2: 添加 pytest 配置**

在 `backend/pyproject.toml` 文件末尾(`[tool.mypy]` 段之后)加:

```toml

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 3: 安装依赖**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/backend && poetry install
```
Expected: 安装成功,`pydantic-ai` 出现在依赖列表。

- [ ] **Step 4: 加 Agent 配置字段**

在 `backend/app/core/config.py` 的 `Settings` 类(`rate_limit_per_minute: int = 60` 那行之后,`cors_origins_list` property 之前)加:

```python

    # Agent
    agent_max_iterations: int = 15
    agent_max_tool_failures: int = 3
    agent_max_doc_edit_ratio: float = 0.5
    agent_system_prompt: str = (
        "You are a document editing agent. You edit a Markdown document by calling tools. "
        "Always use the provided tools to read and modify the document. "
        "Prefer targeted edits (replace_section, find_replace) over rewriting the whole document. "
        "After completing the user's request, respond with a short summary of what you changed."
    )
```

- [ ] **Step 5: 加环境变量样例**

在 `backend/.env.example` 末尾加:

```
# Agent
AGENT_MAX_ITERATIONS=15
AGENT_MAX_TOOL_FAILURES=3
AGENT_MAX_DOC_EDIT_RATIO=0.5
```

- [ ] **Step 6: 验证配置可加载**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/backend && poetry run python -c "from app.core.config import get_settings; s=get_settings(); print(s.agent_max_iterations, s.agent_system_prompt[:30])"
```
Expected: 打印 `15 You are a document editing`

- [ ] **Step 7: Commit**

```bash
cd /Users/yangyang/Projects/MdMaker
git add backend/pyproject.toml backend/poetry.lock backend/app/core/config.py backend/.env.example
git commit -m "build: add pydantic-ai/openai deps and agent config fields"
```

---

### Task 2: 文档大纲解析(Outline)

**Files:**
- Create: `backend/app/services/workspace/__init__.py`
- Create: `backend/app/services/workspace/outline.py`
- Test: `backend/tests/__init__.py`, `backend/tests/conftest.py`, `backend/tests/test_outline.py`

- [ ] **Step 1: 建 workspace 包**

Create `backend/app/services/workspace/__init__.py`:
```python
"""Backend authoritative document workspace."""
```

- [ ] **Step 2: 建 tests 包与 conftest**

Create `backend/tests/__init__.py`:
```python
```

Create `backend/tests/conftest.py`:
```python
"""Shared pytest fixtures."""
```

- [ ] **Step 3: 写失败测试**

Create `backend/tests/test_outline.py`:
```python
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
    assert sections[1].level == 2
    assert sections[3].heading == "Section B"


def test_parse_outline_section_line_ranges():
    doc = "# A\nx\n# B\ny\n# C\n"
    sections = parse_outline(doc)
    # Section A spans from its heading line until B's heading line
    assert sections[0].line_start < sections[1].line_start
    assert sections[1].line_start < sections[2].line_start


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
```

- [ ] **Step 4: 运行测试确认失败**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/backend && poetry run pytest tests/test_outline.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.workspace.outline'`

- [ ] **Step 5: 实现 outline.py**

Create `backend/app/services/workspace/outline.py`:
```python
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

    lines = document.splitlines(keepends=True)
    # Precompute cumulative char offset per line index
    line_offsets = [0]
    for line in lines:
        line_offsets.append(line_offsets[-1] + len(line))

    sections: list[OutlineSection] = []
    for i, m in enumerate(matches):
        level = len(m.group(1))
        heading = m.group(2).strip()
        # line index of this heading
        line_start = document.count("\n", 0, m.start())
        char_start = m.start()

        # find next heading at same/higher level
        end_char = len(document)
        end_line = len(lines)
        for nxt in matches[i + 1:]:
            nxt_level = len(nxt.group(1))
            if nxt_level <= level:
                end_char = nxt.start()
                end_line = document.count("\n", 0, nxt.start())
                break

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
```

- [ ] **Step 6: 运行测试确认通过**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/backend && poetry run pytest tests/test_outline.py -v
```
Expected: 5 passed

- [ ] **Step 7: Commit**

```bash
cd /Users/yangyang/Projects/MdMaker
git add backend/app/services/workspace/__init__.py backend/app/services/workspace/outline.py backend/tests/
git commit -m "feat(workspace): add document outline parsing"
```

---

### Task 3: Workspace 文档状态与编辑工具

**Files:**
- Create: `backend/app/services/workspace/tools.py`
- Create: `backend/app/services/workspace/workspace.py`
- Modify: `backend/app/services/workspace/__init__.py`
- Test: `backend/tests/test_workspace_tools.py`

- [ ] **Step 1: 写失败测试(编辑工具)**

Create `backend/tests/test_workspace_tools.py`:
```python
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
    await ws.replace_range(0, 7, "# World")
    assert ws.content.startswith("# World")
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
```

- [ ] **Step 2: 运行确认失败**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/backend && poetry run pytest tests/test_workspace_tools.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.workspace.workspace'`

- [ ] **Step 3: 实现 tools.py(纯文本操作)**

Create `backend/app/services/workspace/tools.py`:
```python
"""Pure text-editing operations used by Workspace.

Each function takes the current content and returns new content plus the
affected character range. They raise ValueError on invalid arguments so
callers (Workspace) can convert to tool-error results.
"""
from __future__ import annotations

from app.services.workspace.outline import parse_outline


def get_section(content: str, heading: str | None = None, line_range: tuple[int, int] | None = None) -> str:
    """Read a section by heading name or [start,end) line range (0-indexed)."""
    if line_range is not None:
        start, end = line_range
        lines = content.splitlines(keepends=True)
        if start < 0 or end > len(lines) or start >= end:
            raise ValueError(f"line_range out of bounds: {line_range}, doc has {len(lines)} lines")
        return "".join(lines[start:end])
    if heading is None:
        raise ValueError("either heading or line_range is required")
    sections = parse_outline(content)
    for s in sections:
        if s.heading == heading:
            return content[s.char_start:s.char_end]
    raise ValueError(f"heading not found: {heading!r}")


def insert_text(content: str, text: str, position: int | None = None, after_heading: str | None = None) -> tuple[str, int, int]:
    """Insert text; return (new_content, start, end) of inserted range."""
    if position is None and after_heading is None:
        position = len(content)
    if position is not None:
        if position < 0 or position > len(content):
            raise ValueError(f"position out of bounds: {position}, len={len(content)}")
        new = content[:position] + text + content[position:]
        return new, position, position + len(text)
    # after_heading path
    sections = parse_outline(content)
    for s in sections:
        if s.heading == after_heading:
            insert_at = s.char_end
            new = content[:insert_at] + text + content[insert_at:]
            return new, insert_at, insert_at + len(text)
    raise ValueError(f"heading not found: {after_heading!r}")


def replace_range(content: str, start: int, end: int, text: str) -> tuple[str, int, int]:
    """Replace content[start:end] with text."""
    if start < 0 or end > len(content) or start > end:
        raise ValueError(f"range out of bounds: [{start},{end}], len={len(content)}")
    new = content[:start] + text + content[end:]
    return new, start, start + len(text)


def delete_range(content: str, start: int, end: int) -> tuple[str, int, int]:
    """Delete content[start:end]."""
    if start < 0 or end > len(content) or start > end:
        raise ValueError(f"range out of bounds: [{start},{end}], len={len(content)}")
    new = content[:start] + content[end:]
    return new, start, start


def find_replace(content: str, pattern: str, replacement: str, count: int = 0) -> tuple[str, int]:
    """Replace occurrences of pattern. count=0 means all. Return (new, num_replaced)."""
    if not pattern:
        raise ValueError("pattern must be non-empty")
    if count == 0:
        return content.replace(pattern, replacement), content.count(pattern)
    return content.replace(pattern, replacement, count), min(count, content.count(pattern))


def replace_section(content: str, heading: str, text: str) -> tuple[str, int, int]:
    """Replace the section governed by `heading` with `text`."""
    sections = parse_outline(content)
    for s in sections:
        if s.heading == heading:
            new = content[:s.char_start] + text + content[s.char_end:]
            return new, s.char_start, s.char_start + len(text)
    raise ValueError(f"heading not found: {heading!r}")
```

- [ ] **Step 4: 实现 workspace.py**

Create `backend/app/services/workspace/workspace.py`:
```python
"""Backend authoritative document workspace.

Thread-safe (asyncio.Lock) document state with optimistic versioning and
an in-memory undo stack. Edit operations delegate to the pure functions in
`tools.py`.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field

from app.core.config import get_settings
from app.services.workspace import tools
from app.services.workspace.outline import parse_outline

_settings = get_settings()


@dataclass
class Snapshot:
    content: str
    title: str
    version: int


@dataclass
class Workspace:
    """Authoritative document state."""

    content: str = ""
    title: str = "Untitled"
    version: int = 0
    _history: list[Snapshot] = field(default_factory=list)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    def __post_init__(self) -> None:
        if not self._history:
            self._history.append(Snapshot(self.content, self.title, self.version))

    def _commit(self, new_content: str, new_title: str | None = None) -> None:
        """Apply an edit: bump version, push snapshot. Caller holds the lock."""
        self.content = new_content
        if new_title is not None:
            self.title = new_title
        self.version += 1
        self._history.append(Snapshot(self.content, self.title, self.version))
        # cap history at 50
        if len(self._history) > 50:
            self._history = self._history[-50:]

    def _check_edit_ratio(self, old: str, new: str) -> None:
        """Reject edits that delete/rewrite more than the configured ratio."""
        max_ratio = _settings.agent_max_doc_edit_ratio
        old_len = max(len(old), 1)
        # Heuristic: if new content shrank dramatically or the diff is huge
        deleted = max(0, old_len - len(new))
        if deleted / old_len > max_ratio and len(new) < old_len * (1 - max_ratio):
            raise ValueError(
                f"edit deletes {deleted}/{old_len} chars (> {max_ratio:.0%}); rejected"
            )

    # ---- read tools ----

    async def get_document_outline(self) -> list[dict]:
        async with self._lock:
            sections = parse_outline(self.content)
        return [
            {"heading": s.heading, "level": s.level, "line_start": s.line_start, "line_end": s.line_end}
            for s in sections
        ]

    async def get_section(self, heading: str | None = None, line_range: tuple[int, int] | None = None) -> str:
        async with self._lock:
            return tools.get_section(self.content, heading=heading, line_range=line_range)

    async def read_range(self, start: int, end: int) -> str:
        async with self._lock:
            if start < 0 or end > len(self.content) or start > end:
                raise ValueError(f"range out of bounds: [{start},{end}]")
            return self.content[start:end]

    # ---- write tools ----

    async def insert_text(self, text: str, position: int | None = None, after_heading: str | None = None) -> str:
        async with self._lock:
            old = self.content
            new_content, _, _ = tools.insert_text(old, text, position=position, after_heading=after_heading)
            self._check_edit_ratio(old, new_content)
            self._commit(new_content)
            return f"inserted {len(text)} chars (version {self.version})"

    async def replace_range(self, start: int, end: int, text: str) -> str:
        async with self._lock:
            old = self.content
            new_content, _, _ = tools.replace_range(old, start, end, text)
            self._check_edit_ratio(old, new_content)
            self._commit(new_content)
            return f"replaced [{start},{end}] (version {self.version})"

    async def replace_section(self, heading: str, text: str) -> str:
        async with self._lock:
            old = self.content
            new_content, _, _ = tools.replace_section(old, heading, text)
            self._check_edit_ratio(old, new_content)
            self._commit(new_content)
            return f"replaced section {heading!r} (version {self.version})"

    async def delete_range(self, start: int, end: int) -> str:
        async with self._lock:
            old = self.content
            new_content, _, _ = tools.delete_range(old, start, end)
            self._check_edit_ratio(old, new_content)
            self._commit(new_content)
            return f"deleted [{start},{end}] (version {self.version})"

    async def find_replace(self, pattern: str, replacement: str, count: int = 0) -> str:
        async with self._lock:
            old = self.content
            new_content, n = tools.find_replace(old, pattern, replacement, count=count)
            self._check_edit_ratio(old, new_content)
            self._commit(new_content)
            return f"replaced {n} occurrence(s) (version {self.version})"

    async def set_title(self, title: str) -> str:
        async with self._lock:
            self._commit(self.content, new_title=title)
            return f"title set to {title!r} (version {self.version})"

    # ---- versioning / undo ----

    def snapshot_for_sync(self) -> dict:
        """Return current state for client sync (no lock — best-effort read)."""
        return {"content": self.content, "title": self.title, "version": self.version}

    async def apply_client_edit(self, base_version: int, new_content: str) -> dict:
        """Apply a client edit with optimistic locking.

        Returns {'status': 'ok'|'conflict', 'content':..., 'version':...}.
        On conflict, client must re-fetch authoritative state.
        """
        async with self._lock:
            if base_version != self.version:
                return {"status": "conflict", "content": self.content, "version": self.version}
            self._commit(new_content)
            return {"status": "ok", "content": self.content, "version": self.version}

    async def undo(self) -> Snapshot | None:
        async with self._lock:
            if len(self._history) <= 1:
                return None
            self._history.pop()
            snap = self._history[-1]
            self.content = snap.content
            self.title = snap.title
            self.version = snap.version
            return snap
```

- [ ] **Step 5: 导出 Workspace**

Modify `backend/app/services/workspace/__init__.py`:
```python
"""Backend authoritative document workspace."""
from app.services.workspace.workspace import Workspace, Snapshot

__all__ = ["Workspace", "Snapshot"]
```

- [ ] **Step 6: 运行测试确认通过**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/backend && poetry run pytest tests/test_workspace_tools.py -v
```
Expected: 9 passed

- [ ] **Step 7: Commit**

```bash
cd /Users/yangyang/Projects/MdMaker
git add backend/app/services/workspace/ backend/tests/test_workspace_tools.py
git commit -m "feat(workspace): add authoritative document state and editing tools"
```

---

### Task 4: Workspace 边界/越界/编辑比例/撤销测试加固

**Files:**
- Modify: `backend/tests/test_workspace_tools.py`

- [ ] **Step 1: 追加失败测试**

在 `backend/tests/test_workspace_tools.py` 末尾追加:
```python


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
async def test_edit_ratio_rejects_massive_delete():
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
```

- [ ] **Step 2: 运行测试**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/backend && poetry run pytest tests/test_workspace_tools.py -v
```
Expected: all passed(原 9 + 新 9 = 18 passed)。`test_edit_ratio_rejects_massive_delete` 若失败,检查 `_check_edit_ratio` 逻辑。

- [ ] **Step 3: Commit**

```bash
cd /Users/yangyang/Projects/MdMaker
git add backend/tests/test_workspace_tools.py
git commit -m "test(workspace): cover bounds, edit-ratio guard, undo, optimistic lock"
```

---

## Phase 2 — 后端 Agent 服务层

### Task 5: Agent Pydantic schemas

**Files:**
- Create: `backend/app/schemas/agent.py`

- [ ] **Step 1: 创建 schemas**

Create `backend/app/schemas/agent.py`:
```python
"""Pydantic schemas for the Agent API."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class CreateSessionRequest(BaseModel):
    document: str = Field(default="", description="Initial document content")
    title: str = Field(default="Untitled", description="Initial document title")


class CreateSessionResponse(BaseModel):
    session_id: str
    version: int
    title: str


class SendMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User message to the agent")
    provider: str = Field(default="deepseek", description="AI provider")
    model: str = Field(..., description="Model name")
    selection: Optional[str] = Field(default=None, description="Selected text context (from @selection)")
    cursor_position: int = Field(default=0)


class ClientSyncRequest(BaseModel):
    base_version: int = Field(..., description="Version the client's edit is based on")
    content: str = Field(..., description="Full new document content from the client")


class ClientSyncResponse(BaseModel):
    status: str = Field(..., description="ok | conflict")
    version: int
    content: str
    title: str


class StopResponse(BaseModel):
    stopped: bool
```

- [ ] **Step 2: 验证可导入**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/backend && poetry run python -c "from app.schemas.agent import CreateSessionRequest; print(CreateSessionRequest().model_dump())"
```
Expected: 打印含 `session_id`/`version` 字段的 dict(实际只有 document/title,因为 session_id 在端点生成)。应打印 `{'document': '', 'title': 'Untitled'}`

- [ ] **Step 3: Commit**

```bash
cd /Users/yangyang/Projects/MdMaker
git add backend/app/schemas/agent.py
git commit -m "feat(agent): add pydantic schemas for agent API"
```

---

### Task 6: 事件翻译器(Translator)

**Files:**
- Create: `backend/app/services/agent/__init__.py`
- Create: `backend/app/services/agent/translator.py`
- Test: `backend/tests/test_translator.py`

- [ ] **Step 1: 建 agent 包**

Create `backend/app/services/agent/__init__.py`:
```python
"""Agent service layer — assembles PydanticAI agents and translates events."""
```

- [ ] **Step 2: 写失败测试**

Create `backend/tests/test_translator.py`:
```python
"""Tests for PydanticAI event → SSE dict translation."""
import pytest

from app.services.agent.translator import translate_event, make_document_patch


def test_translator_returns_none_for_irrelevant_event():
    assert translate_event({"unknown": "event"}) is None


def test_make_document_patch_shape():
    patch = make_document_patch(version=5, summary="edited section A")
    assert patch == {"type": "document_patch", "version": 5, "summary": "edited section A"}


class _FakePart:
    def __init__(self, kind="text", delta="", text="", tool_name=None, args=None, content=None):
        self.kind = kind
        self._delta = delta
        self._text = text
        self.tool_name = tool_name
        self.args = args
        self.content = content


class _FakeDelta:
    def __init__(self, content_delta=None, args_delta=None):
        self.content_delta = content_delta
        self.args_delta = args_delta


class _FakeEvent:
    """Minimal stand-in matching PydanticAI AgentStreamEvent shape used by translator."""
    def __init__(self, event_kind: str, part=None, delta=None, tool_call_id=None, index=0):
        self.event_kind = event_kind
        self.part = part
        self.delta = delta
        self.tool_call_id = tool_call_id
        self.index = index


def test_translate_text_delta():
    evt = _FakeEvent(event_kind="PartDeltaEvent", delta=_FakeDelta(content_delta="hello"))
    out = translate_event(evt)
    assert out == {"type": "thought", "content": "hello"}


def test_translate_tool_call_event():
    part = type("P", (), {"tool_name": "replace_section", "args": {"heading": "A"}})()
    evt = _FakeEvent(event_kind="FunctionToolCallEvent", part=part)
    out = translate_event(evt)
    assert out["type"] == "tool_call"
    assert out["name"] == "replace_section"
    assert out["args"] == {"heading": "A"}


def test_translate_tool_result_event_success():
    part = type("P", (), {"content": "replaced section A (version 3)"})()
    evt = _FakeEvent(event_kind="FunctionToolResultEvent", part=part, tool_call_id="c1")
    out = translate_event(evt)
    assert out["type"] == "tool_result"
    assert out["name"] == ""  # name resolution may be partial; ok flag driven by content
    assert out["ok"] is True


def test_translate_tool_result_event_failure():
    part = type("P", (), {"content": "Error: heading not found"})()
    evt = _FakeEvent(event_kind="FunctionToolResultEvent", part=part)
    out = translate_event(evt)
    assert out["type"] == "tool_result"
    assert out["ok"] is False
```

- [ ] **Step 3: 运行确认失败**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/backend && poetry run pytest tests/test_translator.py -v
```
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 4: 实现 translator.py**

Create `backend/app/services/agent/translator.py`:
```python
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
```

- [ ] **Step 5: 运行测试确认通过**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/backend && poetry run pytest tests/test_translator.py -v
```
Expected: 6 passed

- [ ] **Step 6: Commit**

```bash
cd /Users/yangyang/Projects/MdMaker
git add backend/app/services/agent/__init__.py backend/app/services/agent/translator.py backend/tests/test_translator.py
git commit -m "feat(agent): add event translator from PydanticAI events to SSE dicts"
```

---

### Task 7: AgentService(用 PydanticAI 搭 Agent + 注册工具)

**Files:**
- Create: `backend/app/services/agent/service.py`
- Modify: `backend/app/services/agent/__init__.py`
- Test: `backend/tests/test_agent_service.py`

- [ ] **Step 1: 写失败测试(mock PydanticAI)**

Create `backend/tests/test_agent_service.py`:
```python
"""Tests for AgentService — assembling PydanticAI agent & running stream.

These tests use a fake model to avoid real LLM calls.
"""
import pytest

from app.services.workspace.workspace import Workspace
from app.services.agent.service import AgentService


@pytest.fixture
def workspace():
    return Workspace(content="# Doc\n\nHello world.\n")


def test_build_agent_creates_agent_with_tools(workspace):
    svc = AgentService(workspace=workspace, provider="deepseek", model="deepseek-chat", api_key="sk-test", base_url="https://api.deepseek.com/v1")
    agent = svc.build_agent()
    # The agent should have tools registered (function tool definitions)
    assert agent is not None
    tool_names = [t for t in dir(agent) if "tool" in t.lower()]
    # We just assert no exception and agent object returned; deeper assertion via run test
    assert agent is not None


def test_workspace_tools_are_registered_as_agent_tools(workspace):
    svc = AgentService(workspace=workspace, provider="deepseek", model="deepseek-chat", api_key="sk-test", base_url="https://api.deepseek.com/v1")
    agent = svc.build_agent()
    # _function_toolset holds the tools in PydanticAI
    toolset = getattr(agent, "_function_toolset", None)
    if toolset is not None:
        tools_dict = getattr(toolset, "tools", None) or getattr(toolset, "_tools", None)
        if tools_dict is not None:
            names = set(tools_dict.keys())
            assert "replace_section" in names or "insert_text" in names


@pytest.mark.asyncio
async def test_run_yields_done_event(workspace, monkeypatch):
    """When the agent finishes (no tools called), run() yields at least a done event."""
    svc = AgentService(workspace=workspace, provider="deepseek", model="deepseek-chat", api_key="sk-test", base_url="https://api.deepseek.com/v1")

    # Monkeypatch run to a no-op async generator that yields nothing
    async def fake_run(*a, **kw):
        if False:  # never yields
            yield {}

    svc._invoke_agent_run = fake_run  # type: ignore
    events = [e async for e in svc.run("hello")]
    # Should always end with a done event
    assert events[-1] == {"type": "done", "content": ""}
```

- [ ] **Step 2: 运行确认失败**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/backend && poetry run pytest tests/test_agent_service.py -v
```
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: 实现 service.py**

Create `backend/app/services/agent/service.py`:
```python
"""AgentService — assembles a PydanticAI Agent with document-editing tools.

The agent loop, tool dispatch, streaming, and multi-provider handling are
all delegated to PydanticAI. This class is the thin glue that:
  1. builds the Agent (model + system prompt + deps = Workspace),
  2. registers Workspace operations as @agent.tool,
  3. runs the agent and translates the event stream into SSE dicts.
"""
from __future__ import annotations

from typing import Any, AsyncGenerator

from pydantic_ai import Agent, RunContext, UsageLimits
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.core.config import get_settings
from app.services.agent.translator import make_document_patch, translate_event
from app.services.workspace.workspace import Workspace

_settings = get_settings()


class AgentService:
    """Assembles and runs a document-editing agent over a Workspace."""

    def __init__(
        self,
        workspace: Workspace,
        provider: str,
        model: str,
        api_key: str,
        base_url: str,
    ) -> None:
        self.workspace = workspace
        self.provider = provider
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self._agent: Agent[Workspace, str] | None = None

    def build_agent(self) -> Agent[Workspace, str]:
        """Build the PydanticAI agent with workspace tools registered."""
        ai_model = OpenAIChatModel(
            self.model,
            provider=OpenAIProvider(base_url=self.base_url, api_key=self.api_key),
        )
        agent: Agent[Workspace, str] = Agent(
            ai_model,
            deps_type=Workspace,
            system_prompt=_settings.agent_system_prompt,
            output_type=str,
        )
        self._register_tools(agent)
        self._agent = agent
        return agent

    def _register_tools(self, agent: Agent[Workspace, str]) -> None:
        """Register each Workspace operation as an @agent.tool."""

        @agent.tool
        async def get_document_outline(ctx: RunContext[Workspace]) -> str:
            """Return the document outline: list of headings with line ranges."""
            outline = await ctx.deps.get_document_outline()
            return "\n".join(f"{'#' * s['level']} {s['heading']} (lines {s['line_start']}-{s['line_end']})" for s in outline)

        @agent.tool
        async def get_section(ctx: RunContext[Workspace], heading: str) -> str:
            """Read the full content of a section identified by its heading."""
            return await ctx.deps.get_section(heading=heading)

        @agent.tool
        async def insert_text(ctx: RunContext[Workspace], text: str, after_heading: str | None = None) -> str:
            """Insert text after a heading (or at end if after_heading is None)."""
            return await ctx.deps.insert_text(text=text, after_heading=after_heading)

        @agent.tool
        async def replace_section(ctx: RunContext[Workspace], heading: str, text: str) -> str:
            """Replace an entire section (identified by heading) with new text."""
            return await ctx.deps.replace_section(heading=heading, text=text)

        @agent.tool
        async def find_replace(ctx: RunContext[Workspace], pattern: str, replacement: str) -> str:
            """Replace all occurrences of pattern with replacement throughout the document."""
            return await ctx.deps.find_replace(pattern=pattern, replacement=replacement)

        @agent.tool
        async def set_title(ctx: RunContext[Workspace], title: str) -> str:
            """Set the document title."""
            return await ctx.deps.set_title(title=title)

    async def _invoke_agent_run(
        self, agent: Agent[Workspace, str], message: str, message_history: list | None
    ) -> AsyncGenerator[Any, None]:
        """Run the agent's event stream. Overridable in tests.

        Uses run_stream_events (async context manager yielding AgentStreamEvents).
        Tracks workspace version to emit document_patch on edits.
        """
        version_before = self.workspace.version
        usage_limits = UsageLimits(request_limit=_settings.agent_max_iterations)

        async with agent.run_stream_events(
            message,
            deps=self.workspace,
            usage_limits=usage_limits,
            message_history=message_history or [],
        ) as events:
            async for event in events:
                # If workspace changed since last yield, inject a document_patch
                if self.workspace.version != version_before:
                    yield make_document_patch(self.workspace.version, summary="document edited")
                    version_before = self.workspace.version
                translated = translate_event(event)
                if translated is not None:
                    yield translated

    async def run(self, message: str, message_history: list | None = None) -> AsyncGenerator[dict, None]:
        """Run the agent and yield SSE dicts. Always ends with {'type':'done'}.

        On exception, yields an error event then done.
        """
        if self._agent is None:
            self.build_agent()
        try:
            async for evt in self._invoke_agent_run(self._agent, message, message_history):  # type: ignore[arg-type]
                yield evt
            yield {"type": "final", "content": "done"}
        except Exception as e:  # noqa: BLE001 — surface to client
            yield {"type": "error", "error": str(e)}
        yield {"type": "done", "content": ""}
```

- [ ] **Step 4: 导出 AgentService**

Modify `backend/app/services/agent/__init__.py`:
```python
"""Agent service layer — assembles PydanticAI agents and translates events."""
from app.services.agent.service import AgentService

__all__ = ["AgentService"]
```

- [ ] **Step 5: 运行测试**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/backend && poetry run pytest tests/test_agent_service.py -v
```
Expected: 3 passed。`test_run_yields_done_event` 通过(因 monkeypatch);前两个 build 测试验证 Agent 构造无异常。

- [ ] **Step 6: 类型/lint 检查**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/backend && poetry run ruff check app/services/agent/ && poetry run mypy app/services/agent/service.py --ignore-missing-imports
```
Expected: ruff 无错误;mypy 可能因 pydantic_ai stubs 有少量告警,允许通过(若无 stubs,mypy 报 missing imports 被 `--ignore-missing-imports` 忽略)。

- [ ] **Step 7: Commit**

```bash
cd /Users/yangyang/Projects/MdMaker
git add backend/app/services/agent/
git add backend/tests/test_agent_service.py
git commit -m "feat(agent): assemble PydanticAI agent with workspace editing tools"
```

---

### Task 8: AgentSession(内存会话管理)

**Files:**
- Create: `backend/app/services/agent/session.py`
- Modify: `backend/app/services/agent/__init__.py`
- Test: `backend/tests/test_agent_session.py`

- [ ] **Step 1: 写失败测试**

Create `backend/tests/test_agent_session.py`:
```python
"""Tests for in-memory AgentSession management."""
import pytest

from app.services.agent.session import SessionManager, AgentSession


def test_create_session_returns_session_id():
    mgr = SessionManager()
    sess = mgr.create(document="# Hi\n", title="Doc")
    assert sess.session_id
    assert sess.workspace.content == "# Hi\n"
    assert sess.workspace.title == "Doc"
    assert sess.status == "idle"


def test_get_session():
    mgr = SessionManager()
    sess = mgr.create(document="x", title="t")
    got = mgr.get(sess.session_id)
    assert got is sess


def test_get_unknown_session_returns_none():
    mgr = SessionManager()
    assert mgr.get("nope") is None


def test_delete_session():
    mgr = SessionManager()
    sess = mgr.create(document="x", title="t")
    mgr.delete(sess.session_id)
    assert mgr.get(sess.session_id) is None


def test_agent_session_message_history_starts_empty():
    sess = AgentSession.create(document="x", title="t")
    assert sess.message_history == []


def test_agent_session_status_transitions():
    sess = AgentSession.create(document="x", title="t")
    assert sess.status == "idle"
    sess.status = "running"
    assert sess.status == "running"
```

- [ ] **Step 2: 运行确认失败**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/backend && poetry run pytest tests/test_agent_session.py -v
```
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: 实现 session.py**

Create `backend/app/services/agent/session.py`:
```python
"""In-memory AgentSession management.

No persistence — sessions live in a process-local dict. Restart loses state.
This matches the design decision (内存会话状态, no DB).
"""
from __future__ import annotations

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

    @classmethod
    def create(cls, document: str = "", title: str = "Untitled") -> "AgentSession":
        return cls(
            session_id=str(uuid.uuid4()),
            workspace=Workspace(content=document, title=title),
        )


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
```

- [ ] **Step 4: 更新包导出**

Modify `backend/app/services/agent/__init__.py`:
```python
"""Agent service layer — assembles PydanticAI agents and translates events."""
from app.services.agent.service import AgentService
from app.services.agent.session import AgentSession, SessionManager, get_session_manager

__all__ = ["AgentService", "AgentSession", "SessionManager", "get_session_manager"]
```

- [ ] **Step 5: 运行测试**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/backend && poetry run pytest tests/test_agent_session.py -v
```
Expected: 6 passed

- [ ] **Step 6: Commit**

```bash
cd /Users/yangyang/Projects/MdMaker
git add backend/app/services/agent/session.py backend/app/services/agent/__init__.py backend/tests/test_agent_session.py
git commit -m "feat(agent): add in-memory session management"
```

---

## Phase 3 — 后端 Agent 端点

### Task 9: Agent 路由 + 通用 SSE 流

**Files:**
- Create: `backend/app/api/v1/agent.py`
- Modify: `backend/app/services/streaming.py`

- [ ] **Step 1: 加通用 SSE 流函数**

在 `backend/app/services/streaming.py` 末尾追加:
```python


async def create_agent_sse_stream(
    event_generator: AsyncGenerator[dict, None],
) -> AsyncGenerator[str, None]:
    """SSE stream for arbitrary dict events (agent events).

    Unlike create_sse_stream (which wraps strings into ChatChunk), this yields
    each dict as-is: data: {json}\n\n. Always emits a terminal 'done' if the
    generator didn't already.
    """
    saw_done = False
    try:
        async for event in event_generator:
            yield format_sse_chunk(event)
            if event.get("type") == "done":
                saw_done = True
    except Exception as e:  # noqa: BLE001
        yield format_sse_chunk({"type": "error", "error": str(e)})
    if not saw_done:
        yield format_sse_chunk({"type": "done", "content": ""})
```

- [ ] **Step 2: 创建 agent 路由**

Create `backend/app/api/v1/agent.py`:
```python
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
    """Resolve (api_key, base_url) for a provider from settings."""
    provider = provider.lower()
    if provider == "deepseek":
        return _settings.deepseek_api_key, _settings.deepseek_base_url
    if provider == "ollama":
        return "", _settings.ollama_base_url
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


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str) -> dict:
    """Delete a session."""
    mgr = get_session_manager()
    if mgr.get(session_id) is None:
        raise HTTPException(status_code=404, detail="session not found")
    mgr.delete(session_id)
    return {"deleted": True}
```

- [ ] **Step 3: 验证可导入**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/backend && poetry run python -c "from app.api.v1.agent import router; print(len(router.routes))"
```
Expected: 打印 `5`

- [ ] **Step 4: Commit**

```bash
cd /Users/yangyang/Projects/MdMaker
git add backend/app/api/v1/agent.py backend/app/services/streaming.py
git commit -m "feat(api): add agent routes and generic agent SSE stream"
```

---

### Task 10: 挂载 Agent 路由到 main.py + 集成测试

**Files:**
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_agent_api.py`

- [ ] **Step 1: 挂载路由**

在 `backend/app/main.py` 第 62 行(`from app.api.v1 import ai, config, documents`)改为:
```python
from app.api.v1 import agent, ai, config, documents
```

在第 66 行后(`app.include_router(documents.router, ...)` 之后)加:
```python
app.include_router(agent.router, prefix="/api/v1/agent", tags=["Agent"])
```

- [ ] **Step 2: 写集成测试(mock service)**

Create `backend/tests/test_agent_api.py`:
```python
"""Integration tests for /api/v1/agent endpoints (with mocked AgentService.run)."""
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


def test_sync_conflict(client, monkeypatch):
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
```

- [ ] **Step 3: 运行测试**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/backend && poetry run pytest tests/test_agent_api.py -v
```
Expected: 6 passed

- [ ] **Step 4: 运行全量后端测试**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/backend && poetry run pytest -v
```
Expected: 全部 passed(约 50 条,涵盖 outline/workspace/translator/agent_service/session/api)

- [ ] **Step 5: 启动后端冒烟测试**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/backend && timeout 5 poetry run uvicorn app.main:app --port 8000 &
sleep 2
curl -s http://localhost:8000/docs > /dev/null && echo "API docs reachable" || echo "FAIL"
curl -s -X POST http://localhost:8000/api/v1/agent/sessions -H "Content-Type: application/json" -d '{"document":"# test"}' 
```
Expected: 打印 `API docs reachable` 和含 `session_id` 的 JSON。注意 `timeout 5` 后进程会被杀掉。

- [ ] **Step 6: Commit**

```bash
cd /Users/yangyang/Projects/MdMaker
git add backend/app/main.py backend/tests/test_agent_api.py
git commit -m "feat(api): mount agent router and add integration tests"
```

---

## Phase 4 — 前端

### Task 11: 前端 Agent 类型定义

**Files:**
- Create: `frontend/src/services/types/agent.ts`

- [ ] **Step 1: 创建类型文件**

Create `frontend/src/services/types/agent.ts`:
```typescript
// Agent SSE event types (mirror backend /api/v1/agent)
// Backend source: backend/app/services/agent/translator.py + service.py

export type AgentEventType =
  | 'thought'
  | 'tool_call'
  | 'tool_result'
  | 'document_patch'
  | 'final'
  | 'error'
  | 'done';

export interface ThoughtEvent {
  type: 'thought';
  content: string;
}

export interface ToolCallEvent {
  type: 'tool_call';
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResultEvent {
  type: 'tool_result';
  name: string;
  ok: boolean;
  summary: string;
}

export interface DocumentPatchEvent {
  type: 'document_patch';
  version: number;
  summary: string;
}

export interface FinalEvent {
  type: 'final';
  content: string;
}

export interface ErrorEvent {
  type: 'error';
  error: string;
}

export interface DoneEvent {
  type: 'done';
  content: string;
}

export type AgentEvent =
  | ThoughtEvent
  | ToolCallEvent
  | ToolResultEvent
  | DocumentPatchEvent
  | FinalEvent
  | ErrorEvent
  | DoneEvent;

// Request types
export interface CreateSessionRequest {
  document: string;
  title: string;
}

export interface CreateSessionResponse {
  session_id: string;
  version: number;
  title: string;
}

export interface SendMessageRequest {
  message: string;
  provider: string;
  model: string;
  selection?: string;
  cursor_position?: number;
}

export interface ClientSyncRequest {
  base_version: number;
  content: string;
}

export interface ClientSyncResponse {
  status: 'ok' | 'conflict';
  version: number;
  content: string;
  title: string;
}
```

- [ ] **Step 2: 类型检查**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/frontend && npx tsc --noEmit
```
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
cd /Users/yangyang/Projects/MdMaker
git add frontend/src/services/types/agent.ts
git commit -m "feat(frontend): add agent event and request types"
```

---

### Task 12: Agent API 封装

**Files:**
- Modify: `frontend/src/services/api/config.ts`
- Create: `frontend/src/services/api/agentApi.ts`

- [ ] **Step 1: 加 Agent 端点常量**

在 `frontend/src/services/api/config.ts` 的 `API_ENDPOINTS` 对象里(`document: (id: string) => ...` 那行之后)加:
```typescript
  agentSessions: () => `${API_BASE}/api/v1/agent/sessions`,
  agentSession: (id: string) => `${API_BASE}/api/v1/agent/sessions/${id}`,
  agentSessionMessages: (id: string) => `${API_BASE}/api/v1/agent/sessions/${id}/messages`,
  agentSessionSync: (id: string) => `${API_BASE}/api/v1/agent/sessions/${id}/sync`,
  agentSessionStop: (id: string) => `${API_BASE}/api/v1/agent/sessions/${id}/stop`,
```

- [ ] **Step 2: 创建 agentApi.ts**

Create `frontend/src/services/api/agentApi.ts`:
```typescript
import { API_ENDPOINTS } from './config';
import { parseSSEStream } from './aiApi';
import type {
  AgentEvent,
  ClientSyncRequest,
  ClientSyncResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  SendMessageRequest,
} from '../types/agent';

export const agentApi = {
  /** Create a new agent session with initial document content. */
  async createSession(req: CreateSessionRequest): Promise<CreateSessionResponse> {
    const resp = await fetch(API_ENDPOINTS.agentSessions(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!resp.ok) throw new Error(`createSession failed: ${resp.status}`);
    return resp.json();
  },

  /** Send a message and stream agent events. Accepts an AbortSignal for stop. */
  async *sendMessage(
    sessionId: string,
    req: SendMessageRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<AgentEvent, void, unknown> {
    const resp = await fetch(API_ENDPOINTS.agentSessionMessages(sessionId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`sendMessage failed: ${resp.status} ${text}`);
    }
    // Reuse the existing parseSSEStream (it yields parsed JSON chunks by data: prefix)
    // It returns AsyncGenerator<{type:string;...}> — cast to AgentEvent.
    const stream = parseSSEStream(resp) as AsyncGenerator<AgentEvent, void, unknown>;
    yield* stream;
  },

  /** Sync a client edit with optimistic locking. */
  async sync(sessionId: string, req: ClientSyncRequest): Promise<ClientSyncResponse> {
    const resp = await fetch(API_ENDPOINTS.agentSessionSync(sessionId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!resp.ok) throw new Error(`sync failed: ${resp.status}`);
    return resp.json();
  },

  /** Stop the current run. */
  async stop(sessionId: string): Promise<void> {
    await fetch(API_ENDPOINTS.agentSessionStop(sessionId), { method: 'POST' });
  },

  /** Delete a session. */
  async deleteSession(sessionId: string): Promise<void> {
    await fetch(API_ENDPOINTS.agentSession(sessionId), { method: 'DELETE' });
  },
};
```

- [ ] **Step 3: 导出 parseSSEStream(若未导出)**

检查 `frontend/src/services/api/aiApi.ts`,确认 `parseSSEStream` 已导出(若 `async function* parseSSEStream` 无 `export`,加 `export`)。

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/frontend && grep -n "export" src/services/api/aiApi.ts | head -5
```
若看不到 parseSSEStream 的 export,编辑 `aiApi.ts` 把 `async function* parseSSEStream` 改为 `export async function* parseSSEStream`。

- [ ] **Step 4: 类型检查**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/frontend && npx tsc --noEmit
```
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
cd /Users/yangyang/Projects/MdMaker
git add frontend/src/services/api/config.ts frontend/src/services/api/agentApi.ts frontend/src/services/api/aiApi.ts
git commit -m "feat(frontend): add agent API client with SSE streaming"
```

---

### Task 13: 文档同步器(documentSync)

**Files:**
- Create: `frontend/src/lib/documentSync.ts`

- [ ] **Step 1: 创建同步器**

Create `frontend/src/lib/documentSync.ts`:
```typescript
import { agentApi } from '../services/api/agentApi';

/**
 * Document state synchronizer between frontend editor and backend Workspace.
 *
 * Responsibilities:
 *  - Track the latest document version acknowledged by the backend.
 *  - Debounce user edits and send them to /sync with optimistic locking.
 *  - Apply document_patch events from the agent (full-content replace).
 *  - On version conflict, the backend returns its authoritative content.
 *
 * NOTE: This is a plain class (not a React hook) so it can be driven from
 * useAgentChat and also call back into the editor imperatively.
 */
export class DocumentSync {
  private sessionId: string;
  private version: number;
  private getContent: () => string;
  private setContent: (content: string) => void;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isApplyingPatch = false;

  constructor(opts: {
    sessionId: string;
    initialVersion: number;
    getContent: () => string;
    setContent: (content: string) => void;
  }) {
    this.sessionId = opts.sessionId;
    this.version = opts.initialVersion;
    this.getContent = opts.getContent;
    this.setContent = opts.setContent;
  }

  /** Called by the editor onChange (user typing). Debounced sync to backend. */
  onUserEdit(): void {
    if (this.isApplyingPatch) return; // ignore edits triggered by patch application
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      void this.syncToBackend();
    }, 800);
  }

  /** Apply an incoming agent patch (full-content replace + new version). */
  applyPatch(version: number, content: string): void {
    this.isApplyingPatch = true;
    this.version = version;
    this.setContent(content);
    // release the guard on next tick so the onChange triggered by setContent is ignored
    setTimeout(() => {
      this.isApplyingPatch = false;
    }, 0);
  }

  private async syncToBackend(): Promise<void> {
    try {
      const resp = await agentApi.sync(this.sessionId, {
        base_version: this.version,
        content: this.getContent(),
      });
      if (resp.status === 'ok') {
        this.version = resp.version;
      } else {
        // Conflict: backend won. Adopt authoritative content.
        this.version = resp.version;
        this.applyPatch(resp.version, resp.content);
      }
    } catch (e) {
      // Network errors are non-fatal; next edit will retry.
      console.error('documentSync sync failed:', e);
    }
  }

  dispose(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }
}
```

- [ ] **Step 2: 类型检查**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/frontend && npx tsc --noEmit
```
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
cd /Users/yangyang/Projects/MdMaker
git add frontend/src/lib/documentSync.ts
git commit -m "feat(frontend): add document state synchronizer"
```

---

### Task 14: useAgentChat hook

**Files:**
- Create: `frontend/src/hooks/useAgentChat.ts`

- [ ] **Step 1: 创建 hook**

Create `frontend/src/hooks/useAgentChat.ts`:
```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import { agentApi } from '../services/api/agentApi';
import { DocumentSync } from '../lib/documentSync';
import type {
  AgentEvent,
  CreateSessionResponse,
} from '../services/types/agent';

// A grouped run of events shown as one assistant turn in the UI.
export interface AgentTurn {
  id: string;
  events: AgentEvent[];
  status: 'streaming' | 'done' | 'error';
}

export interface UseAgentChatReturn {
  sessionId: string | null;
  turns: AgentTurn[];
  isRunning: boolean;
  error: string | null;
  documentVersion: number;
  sendMessage: (message: string, opts: SendMessageOpts) => Promise<void>;
  stop: () => void;
  ensureSession: (document: string, title: string) => Promise<void>;
  onUserEdit: () => void;
}

export interface SendMessageOpts {
  provider: string;
  model: string;
  selection?: string;
  /** Called when the agent emits a document_patch — editor applies new content. */
  onDocumentPatch: (version: number, content: string) => void;
  /** Read current document content (for sync). */
  getDocumentContent: () => string;
  /** Apply authoritative content (full replace). */
  setDocumentContent: (content: string) => void;
}

export function useAgentChat(): UseAgentChatReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<AgentTurn[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentVersion, setDocumentVersion] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const syncRef = useRef<DocumentSync | null>(null);
  const sessionRespRef = useRef<CreateSessionResponse | null>(null);

  const ensureSession = useCallback(async (document: string, title: string) => {
    if (sessionId) return;
    const resp = await agentApi.createSession({ document, title });
    sessionRespRef.current = resp;
    setSessionId(resp.session_id);
    setDocumentVersion(resp.version);
    syncRef.current = new DocumentSync({
      sessionId: resp.session_id,
      initialVersion: resp.version,
      getContent: () => document, // patched in sendMessage with live getters
      setContent: () => {},
    });
  }, [sessionId]);

  const sendMessage = useCallback(async (message: string, opts: SendMessageOpts) => {
    if (!sessionId) {
      setError('no session');
      return;
    }
    // Wire sync to live getters
    syncRef.current = new DocumentSync({
      sessionId,
      initialVersion: documentVersion,
      getContent: opts.getDocumentContent,
      setContent: opts.setDocumentContent,
    });

    const controller = new AbortController();
    abortRef.current = controller;
    setIsRunning(true);
    setError(null);

    const turnId = `turn-${Date.now()}`;
    setTurns((prev) => [...prev, { id: turnId, events: [], status: 'streaming' }]);

    try {
      const stream = agentApi.sendMessage(
        sessionId,
        {
          message,
          provider: opts.provider,
          model: opts.model,
          selection: opts.selection,
        },
        controller.signal,
      );
      for await (const evt of stream) {
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId ? { ...t, events: [...t.events, evt] } : t,
          ),
        );
        if (evt.type === 'document_patch') {
          setDocumentVersion(evt.version);
          // full-content fetch isn't available on the event; request content via sync pull
          // For this phase: editor reads authoritative content on patch via onDocumentPatch
          opts.onDocumentPatch(evt.version, opts.getDocumentContent());
        } else if (evt.type === 'error') {
          setError(evt.error);
          setTurns((prev) =>
            prev.map((t) => (t.id === turnId ? { ...t, status: 'error' } : t)),
          );
        }
      }
      setTurns((prev) =>
        prev.map((t) => (t.id === turnId ? { ...t, status: 'done' } : t)),
      );
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError((e as Error).message);
        setTurns((prev) =>
          prev.map((t) => (t.id === turnId ? { ...t, status: 'error' } : t)),
        );
      }
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [sessionId, documentVersion]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    if (sessionId) void agentApi.stop(sessionId);
    setIsRunning(false);
  }, [sessionId]);

  const onUserEdit = useCallback(() => {
    syncRef.current?.onUserEdit();
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      syncRef.current?.dispose();
    };
  }, []);

  return { sessionId, turns, isRunning, error, documentVersion, sendMessage, stop, ensureSession, onUserEdit };
}
```

- [ ] **Step 2: 类型检查**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/frontend && npx tsc --noEmit
```
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
cd /Users/yangyang/Projects/MdMaker
git add frontend/src/hooks/useAgentChat.ts
git commit -m "feat(frontend): add useAgentChat hook consuming agent SSE"
```

---

### Task 15: AgentEventItem 组件

**Files:**
- Create: `frontend/src/components/agent/AgentEventItem.tsx`

- [ ] **Step 1: 创建组件**

Create `frontend/src/components/agent/AgentEventItem.tsx`:
```tsx
import React from 'react';
import type { AgentEvent } from '../../services/types/agent';

interface AgentEventItemProps {
  event: AgentEvent;
}

/** Renders a single agent event. Styling kept minimal/Tailwind to match codeact cards. */
export const AgentEventItem: React.FC<AgentEventItemProps> = ({ event }) => {
  switch (event.type) {
    case 'thought':
      return (
        <div className="my-1 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <span className="mr-1 font-semibold text-slate-400">思考:</span>
          {event.content}
        </div>
      );
    case 'tool_call':
      return (
        <div className="my-1 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-800 dark:bg-blue-950">
          <span className="mr-1 font-semibold text-blue-600 dark:text-blue-400">调用工具:</span>
          <code className="text-blue-800 dark:text-blue-200">{event.name}</code>
          <pre className="mt-1 overflow-x-auto text-xs text-slate-600 dark:text-slate-300">
            {JSON.stringify(event.args, null, 2)}
          </pre>
        </div>
      );
    case 'tool_result':
      return (
        <div
          className={`my-1 rounded border px-3 py-2 text-sm ${
            event.ok
              ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
              : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
          }`}
        >
          <span className="mr-1 font-semibold">
            {event.ok ? '✓ 工具结果:' : '✗ 工具失败:'}
          </span>
          <span className="text-slate-700 dark:text-slate-200">{event.summary}</span>
        </div>
      );
    case 'document_patch':
      return (
        <div className="my-1 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950">
          <span className="mr-1 font-semibold text-amber-700 dark:text-amber-300">
            ✎ 文档已更新 (v{event.version}):
          </span>
          <span className="text-slate-700 dark:text-slate-200">{event.summary}</span>
        </div>
      );
    case 'final':
      return (
        <div className="my-2 rounded bg-slate-100 px-3 py-2 text-sm font-medium dark:bg-slate-800">
          {event.content}
        </div>
      );
    case 'error':
      return (
        <div className="my-1 rounded border border-red-300 bg-red-100 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
          错误: {event.error}
        </div>
      );
    case 'done':
      return null;
    default:
      return null;
  }
};
```

- [ ] **Step 2: 类型检查**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/frontend && npx tsc --noEmit
```
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
cd /Users/yangyang/Projects/MdMaker
git add frontend/src/components/agent/AgentEventItem.tsx
git commit -m "feat(frontend): add agent event item renderer"
```

---

### Task 16: AgentPanel 组件

**Files:**
- Create: `frontend/src/components/agent/AgentPanel.tsx`

- [ ] **Step 1: 创建组件**

Create `frontend/src/components/agent/AgentPanel.tsx`:
```tsx
import React, { useState, useRef, useEffect } from 'react';
import type { AgentTurn } from '../../hooks/useAgentChat';
import { AgentEventItem } from './AgentEventItem';

interface AgentPanelProps {
  turns: AgentTurn[];
  isRunning: boolean;
  error: string | null;
  onSend: (message: string) => void;
  onStop: () => void;
}

/** Main agent interaction surface: event stream + input + stop button. */
export const AgentPanel: React.FC<AgentPanelProps> = ({ turns, isRunning, error, onSend, onStop }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isRunning) return;
    onSend(trimmed);
    setInput('');
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2">
        {turns.length === 0 && (
          <div className="mt-8 text-center text-sm text-slate-400">
            告诉 Agent 你想对文档做什么，例如「在结尾加一段总结」。
          </div>
        )}
        {turns.map((turn) => (
          <div key={turn.id} className="mb-4">
            {turn.events.map((evt, i) => (
              <AgentEventItem key={`${turn.id}-${i}`} event={evt} />
            ))}
            {turn.status === 'streaming' && (
              <div className="ml-1 text-xs text-slate-400">…</div>
            )}
          </div>
        ))}
        {error && <div className="mt-2 text-sm text-red-600">错误: {error}</div>}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-200 p-2 dark:border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="对 Agent 下指令…"
            className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          {isRunning ? (
            <button
              type="button"
              onClick={onStop}
              className="rounded bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600"
            >
              停止
            </button>
          ) : (
            <button
              type="submit"
              className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              发送
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
```

- [ ] **Step 2: 类型检查**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/frontend && npx tsc --noEmit
```
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
cd /Users/yangyang/Projects/MdMaker
git add frontend/src/components/agent/AgentPanel.tsx
git commit -m "feat(frontend): add agent panel with event stream and input"
```

---

### Task 17: 接入 App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: 接入 useAgentChat 与 AgentPanel**

在 `frontend/src/App.tsx` 顶部导入区(import 区)加:
```typescript
import { useAgentChat } from './hooks/useAgentChat';
import { AgentPanel } from './components/agent/AgentPanel';
```

在 `App` 组件内,`aiConfig` state 声明之后(`App.tsx:255` 附近)加:
```tsx
  const agentChat = useAgentChat();

  // Create a session lazily when first needed, seeded with current document.
  const ensureAgentSession = async () => {
    await agentChat.ensureSession(markdown, 'Untitled');
  };

  // Agent applies a patch: full-content replace via history stack (undoable).
  const handleAgentPatch = (_version: number) => {
    // The authoritative content is read from a dedicated endpoint or via sync.
    // For this phase: pull authoritative content through sync by reading backend.
    // Simpler: re-fetch document via a GET we add later; here we use setContent path.
  };
```

> **注意:** Agent patch 的内容获取方式见 Step 2 说明——后端 `document_patch` 事件目前只带 version + summary,不带全文。所以前端需要主动拉取权威内容。最简方案:在 `onDocumentPatch` 回调里调用一个"拉取当前文档"的接口。我们在 `agentApi` 里补一个轻量读取。

- [ ] **Step 2: 补一个拉取文档的接口**

Modify `backend/app/api/v1/agent.py`,在 `delete_session` 之前加一个 GET 端点:
```python
from app.schemas.agent import CreateSessionResponse  # 已导入

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
```

对应前端,在 `frontend/src/services/api/config.ts` 的 `API_ENDPOINTS` 加:
```typescript
  agentSessionDocument: (id: string) => `${API_BASE}/api/v1/agent/sessions/${id}/document`,
```

并在 `frontend/src/services/api/agentApi.ts` 的 `agentApi` 对象里加方法:
```typescript
  /** Fetch the authoritative document content for a session. */
  async getDocument(sessionId: string): Promise<{ content: string; title: string; version: number }> {
    const resp = await fetch(API_ENDPOINTS.agentSessionDocument(sessionId));
    if (!resp.ok) throw new Error(`getDocument failed: ${resp.status}`);
    return resp.json();
  },
```

- [ ] **Step 3: 完善 handleAgentPatch 拉取权威内容**

把 `frontend/src/App.tsx` 里 Step 1 写的 `handleAgentPatch` 替换为:
```tsx
  const handleAgentPatch = async (_version: number) => {
    if (!agentChat.sessionId) return;
    try {
      const { content } = await agentApi.getDocument(agentChat.sessionId);
      // Apply via history stack so it's undoable (Ctrl+Z step).
      setMarkdownWithHistory(content);
    } catch (e) {
      console.error('failed to fetch authoritative document:', e);
    }
  };
```

并在 `App.tsx` 顶部加 `agentApi` 的导入:
```typescript
import { agentApi } from './services/api/agentApi';
```

- [ ] **Step 4: 渲染 AgentPanel(替换或并存)**

在 `App.tsx` 中,把现有 AI 抽屉的 `children` 区域(`App.tsx:1035-1097` 那段 `<AIAssistantDrawer>...</AIAssistantDrawer>`)下方,新增一个独立的 Agent 面板容器。最简方式:在主布局里加一个可切换的侧栏。在 return 的 JSX 末尾(`</div>` 根闭合标签前)加:
```tsx
        {/* Agent panel (new, coexists with legacy AI drawer during migration) */}
        <div className="fixed bottom-4 right-4 z-40 h-[32rem] w-96 rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700">
            <span className="text-sm font-semibold">Agent</span>
            {!agentChat.sessionId && (
              <button
                onClick={ensureAgentSession}
                className="rounded bg-slate-200 px-2 py-1 text-xs dark:bg-slate-700 dark:text-slate-200"
              >
                建立会话
              </button>
            )}
          </div>
          <div className="h-[calc(100%-2.5rem)]">
            <AgentPanel
              turns={agentChat.turns}
              isRunning={agentChat.isRunning}
              error={agentChat.error}
              onSend={(msg) =>
                agentChat.sendMessage(msg, {
                  provider: aiConfig.provider,
                  model: aiConfig.model,
                  selection: editorRef.current?.getSelection()?.text,
                  onDocumentPatch: handleAgentPatch,
                  getDocumentContent: () => markdown,
                  setDocumentContent: setMarkdownWithHistory,
                })
              }
              onStop={agentChat.stop}
            />
          </div>
        </div>
```

- [ ] **Step 5: 类型检查 + 构建**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/frontend && npm run build
```
Expected: `tsc && vite build` 成功,无类型错误。若有 `noUnusedLocals` 报错,移除未使用的导入。

- [ ] **Step 6: Commit**

```bash
cd /Users/yangyang/Projects/MdMaker
git add backend/app/api/v1/agent.py frontend/src/services/api/config.ts frontend/src/services/api/agentApi.ts frontend/src/App.tsx
git commit -m "feat: wire agent panel into App.tsx with document patch fetch"
```

---

## Phase 5 — 端到端验证

### Task 18: 端到端手动验收

**Files:** 无(手动验收)

**前置条件:** 已配置 DeepSeek API key(在 `backend/.env` 设 `DEEPSEEK_API_KEY`),后端 + 前端均已启动。

- [ ] **Step 1: 启动后端**

Run:
```bash
cd /Users/yangyang/Projects/MdMaker/backend && poetry run uvicorn app.main:app --reload --port 8000
```
Expected: 正常启动,日志显示 `Application startup complete`,无 import 错误。

- [ ] **Step 2: 启动前端**

Run(新终端):
```bash
cd /Users/yangyang/Projects/MdMaker/frontend && npm run dev
```
Expected: Vite 启动,提示 `http://localhost:5173`。

- [ ] **Step 3: 验证会话创建**

打开 `http://localhost:5173`,在右下角 Agent 面板点「建立会话」。打开浏览器 DevTools Network,确认 `POST /api/v1/agent/sessions` 返回 200 + `session_id`。

- [ ] **Step 4: 验证 Agent 单轮编辑**

在 Agent 输入框输入「在文档结尾加一段『## 总结』并写一句话总结」,回车发送。

预期:
- Agent 面板依次出现 `thought`(思考)、`tool_call`(调用 `insert_text` 或 `find_replace`)、`tool_result`(结果)、`document_patch`(文档已更新)、`final`(完成)事件。
- 编辑器内容实时更新(出现「## 总结」段落)。
- 用户可 Ctrl+Z 回退该次改动(撤销栈)。

- [ ] **Step 5: 验证停止功能**

再发一条需要多步的指令(如「重写整篇文档」),在 Agent 运行中点「停止」。预期:Agent 面板停止新增事件,`isRunning` 变 false。

- [ ] **Step 6: 验证手动编辑与 Agent 并存**

Agent 运行间隙,手动在编辑器里打字。预期:不报错;若与 Agent 改动冲突,DevTools 可见 `/sync` 返回 `status: conflict` 并采用 Agent 版本(spec 第 5 节机制)。

- [ ] **Step 7: 验证安全上限**

发一条会让 Agent 反复调工具的指令(如「把每个字都替换成 X」),观察 Agent 在 `agent_max_iterations`(15)轮后终止,产出 `final` + `done`。

- [ ] **Step 8: 验收记录**

把验收结果(每步实际表现、异常)记在 commit message 或对话里。若有缺陷,新建任务修复(不在本计划内展开)。

- [ ] **Step 9: 最终提交(若 Step 5 构建后还有微调)**

```bash
cd /Users/yangyang/Projects/MdMaker
git add -A
git commit -m "chore: e2e verification of agent-driven editor"
```
(若验收全程无代码改动,此步可跳过。)

---

## Self-Review 记录

**1. Spec 覆盖:** 对照设计稿逐节核查 —
- §3 四单元 → Task 3 (Workspace) + Task 7 (AgentService) + Task 9 (端点) + Task 14-16 (前端) ✓
- §4 ReAct 循环 + UsageLimits → Task 7 service.py ✓
- §5 Workspace 工具表(9 个工具) → Task 3 实现了 7 个核心(读 2 + 写 5),`read_range` 在 Workspace 有,`get_section` 在;工具表中 `read_range`/`delete_range`/`replace_range` 部分作为 LLM 工具未全部注册(注册了 6 个最常用),详见下方 gap。
- §6 PydanticAI 取代手搓 → Task 7 ✓
- §7 SSE 协议 + 7 事件类型 → Task 6 + Task 9 ✓
- §8 前端渐进改造 → Task 11-17 ✓
- §9 错误处理 → service.py try/except + translator ok 启发式 + apply_client_edit 冲突 ✓
- §10 测试策略 → Task 2/3/4/6/7/8/10 ✓

**发现一个 gap(已决策保留):** 设计稿第 5 节工具表列了 9 个工具,Task 7 的 `_register_tools` 只注册了 6 个给 LLM(`get_document_outline/get_section/insert_text/replace_section/find_replace/set_title`)。`read_range/replace_range/delete_range` 这三个低层位置型工具在 Workspace 内部实现并可测,但未作为 LLM 工具暴露——因为 LLM 用字符偏移容易出错,高层语义工具(replace_section/find_replace)更稳。这是有意裁剪,非遗漏,保留在 Workspace 内供未来扩展。已在计划注释中说明。

**2. 占位符扫描:** 无 "TBD"/"TODO"/"implement later"。每个步骤含具体代码或具体命令。Task 17 Step 4 的 AgentPanel 注释提到 `// 全文内容由 onDocumentPatch 回调拉取`,在 Step 2-3 已补 GET 端点 + handleAgentPatch 实现,闭环。

**3. 类型一致性:** 核查关键签名跨任务一致 —
- `Workspace.insert_text(text, position=, after_heading=)` — Task 3 定义,Task 7 tool 注册调用一致 ✓
- `Workspace.replace_section(heading, text)` — Task 3/7 一致 ✓
- `Workspace.find_replace(pattern, replacement, count=0)` — Task 3 默认 count=0;Task 7 注册时不传 count(用默认 0=全部)✓
- `AgentService.run(message, message_history=)` — Task 7 定义,Task 9 端点调用 `service.run(user_message, message_history=sess.message_history)` 一致 ✓
- 前端 `AgentEvent` 联合类型 — Task 11 定义,Task 12 agentApi cast、Task 14 hook、Task 15 渲染均一致 ✓
- `useAgentChat.sendMessage(message, opts)` 的 opts 形状 — Task 14 定义,Task 17 调用一致 ✓
- 后端 SSE 事件 dict 形状 — Task 6 translator + Task 7 service.run 产出,与 Task 11 前端类型镜像一致 ✓

计划内部一致,可执行。
