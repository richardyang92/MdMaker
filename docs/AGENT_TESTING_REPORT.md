# Agent 功能测试报告

> 测试日期：2026-08-05
> 测试方式：真实 DeepSeek API（`deepseek-chat`）端到端调用 + HTTP/SSE 层验证 + 单元测试
> 测试范围：`backend/app/services/agent/*`、`backend/app/api/v1/agent.py`、`frontend/src/hooks/useAgentChat.ts`、`frontend/src/components/agent/*`、`frontend/src/lib/documentSync.ts`

## 〇、修复状态（本轮已实施）

| 问题 | 状态 | 验证方式 |
|------|------|----------|
| P0-1 thought 碎片化 | ✅ 已修复 | 真实调用：40 事件/3字符 → 4 事件/199字符 |
| P0-2 document_patch 漏发 | ✅ 已修复 | 真实调用：多步编辑 `[1,2]` 两个 patch（之前只 1 个） |
| P0-3 stop 无法中断 | ✅ 已修复 | 真实调用：停止后无泄漏事件 |
| P0-4 静默失败 | ✅ 已修复 | UsageLimitExceeded → error 事件；工具失败可见 |
| P1-5 history 未持久化 | ✅ 已修复 | 多轮对话：轮2 准确回忆轮1 操作 |
| P1-6 UI 聚合 | ✅ 已修复 | thought 默认折叠；stopped 事件渲染 |
| P2-7 内存态会话 | ⏸ 已知限制（设计决策，本轮不改） | — |
| P2-8 无真实链路测试 | ✅ 已补充 | 新增 `tests/test_agent_reliability.py`（12 测试） |

修复后全量回归：**59 测试通过**（原 47 + 新 12），`ruff`/`black` 干净，前端 `npm run build` 成功，真实 DeepSeek 端到端验证全部通过。

## 一、测试结论

**核心编辑能力可用**：Agent 能正确理解指令、调用工具（`get_document_outline` → `get_section` → `replace_section` / `insert_text`）、完成文档编辑。在「补充章节内容」「新建文档」「修改标题」等场景下，最终文档结果是正确的。

**但存在 4 个高严重度问题**，直接影响真实可用性，需优先修复。>（注：以下问题均已在本轮修复，见上方「修复状态」。问题描述保留作为改进依据。）

## 二、问题清单

### 🔴 P0-1：`thought` 事件碎片化，UI 几乎不可读

**现象**：一次「补充三条计划」的请求，产生了 **112 个 `thought` 事件**，平均每个事件只有 **2.9 个字符**（HTTP 实测 40 个事件 / 平均 3.0 字符）。LLM 的思考流被切成 token 级别的碎片逐个下发。

**根因**：`translator.translate_event()` 把 PydanticAI 的 `PartDeltaEvent.delta.content_delta` 原样转发，没有做任何聚合。DeepSeek 的流式输出每个 token 一个 delta。

**影响**：
- 前端 `useAgentChat` 每收到一个事件就 `setTurns` 触发 React 重渲染 —— 112 次 token 级重渲染导致面板卡顿。
- `AgentEventItem` 把每个碎片渲染成独立的「思考:」卡片（带边框、内边距），一次回答出现上百个卡片，完全无法阅读。

**证据**（HTTP 实测）：
```
event type counts: {'thought': 40, 'tool_call': 3, 'tool_result': 3, ...}
thought 事件数=40, 总字符=118, 平均每事件=3.0字符
```

---

### 🔴 P0-2：`document_patch` 事件漏发（多步编辑丢失中间同步）

**现象**：一次请求中 Agent 连续做了 `set_title` + `insert_text` + `insert_text` 三次编辑，workspace 版本 `0 → 1 → 2 → 3`，但后端**只发出了 1 个 `document_patch`**（应至少发出 3 个，或保证最终一致）。

**根因**：`AgentService._invoke_agent_run()` 用「收到下一个流事件时检查 version 是否变化」来探测编辑：

```python
async for event in events:
    if self.workspace.version != version_before:   # 只有事件到来才检测
        yield make_document_patch(...)
        version_before = self.workspace.version
```

但 PydanticAI 的事件粒度与工具执行粒度不对齐 —— 多个工具调用可能在同一批事件中完成，version 连续跳变，只在下一次事件到来时被合并检测，中间状态被吞掉。

**影响**：前端 `handleAgentPatch` 依赖 `document_patch` 事件拉取权威文档。漏发意味着**前端编辑器不会刷新**，用户看不到 Agent 的编辑结果（除非碰巧最后一个 patch 触发）。这是「Agent 改了但界面没变」的直接原因。

---

### 🔴 P0-3：`stop`（停止）无法真正中断 Agent，且存在状态死锁

**现象**：用户点「停止」按钮后：
1. 后端 `/stop` 只把 `sess.status` 设为 `"stopped"`，**没有任何机制取消正在运行的 Agent 协程** —— LLM 调用继续在后台烧 token，直到自然结束。
2. `event_gen` 的 `finally` 把 status 设回 `"done"`，覆盖了 `"stopped"`。
3. 没有任何代码读取 `"stopped"` 状态来主动中止。

**根因**：

```python
# agent.py — stop 只改标志位，无法中断
async def stop_session(...):
    sess.status = "stopped"   # ← 仅此而已
    return StopResponse(stopped=True)

# agent.py — send_message 的协程持有 service.run()，stop 无法触及
async def event_gen():
    try:
        async for evt in service.run(...): yield evt   # ← 这个循环无法被外部取消
    finally:
        sess.status = "done"
```

**影响**：用户「停止」是假停止；网络断开后行为依赖 ASGI 对断流的 GC，不可靠。

---

### 🔴 P0-4：`translator` 静默忽略关键事件，失败对用户不可见

**现象**：`translate_event()` 只处理 `PartDeltaEvent` / `FunctionToolCallEvent` / `FunctionToolResultEvent`，对其余所有事件（包括 `FinalResultEvent`、`UsageLimitExceeded`）返回 `None` 静默丢弃。

**影响**：
- 当 Agent 达到 `agent_max_iterations`（默认 15）上限抛出 `UsageLimitExceeded` 时，**前端收不到任何提示**，只看到流突然结束，不知道为什么任务没完成。
- 工具调用失败（如引用不存在的章节）时，Agent 能自我纠正不再操作，但**从不向用户输出「未找到章节，因此未做修改」的总结**，用户以为 Agent 偷懒/卡住。

**证据**（实测「删除不存在章节」）：
```
CASE: 不存在的章节(应优雅报错)
  [tool_call] get_document_outline
  [tool_result] # 文档 (lines 0-3)
  [tool_call] get_section "文档"
  counts={'thought': 323, 'tool_call': 2, 'tool_result': 2, 'final': 1, 'done': 1}
  final version=0   ← 文档没变，但用户没收到任何「为什么没变」的反馈
```

---

### 🟡 P1-5：`message_history` 多轮对话未真正贯通

**现象**：`send_message` 把 `sess.message_history` 传给 Agent，但 **`sess.message_history` 从未被写入**（全代码搜索：只有定义，无 append）。多轮上下文实际为空。

**影响**：用户第二句话时，Agent 看不到第一轮的对话，无法基于上文连续编辑（每次都是无记忆的）。

---

### 🟡 P1-6：前端 `AgentEventItem` 缺少可折叠/聚合的展示

**现象**：每个 `thought` 碎片、每个 `tool_call`/`tool_result` 都渲染成独立卡片，一次复杂编辑会产生几十张卡片堆叠，信息密度极低，无法快速看清「Agent 到底做了什么」。

（与 P0-1 相关，但即便修了碎片化，仍需折叠/分组 UI。）

---

### 🟢 P2-7：会话仅内存态，重启即丢

**说明**：`SessionManager` 是进程内 dict，服务重启丢失所有会话。`AGENTS.md` 已明确这是设计决策（无 DB），故**记为已知限制，本轮不修**，但需在文档中标注。

---

### 🟢 P2-8：单元测试全部基于 mock，无真实 LLM 回归

**说明**：现有 47 个测试全过，但 `_invoke_agent_run` 全部被 monkeypatch 成假生成器，**没有任何测试覆盖真实 LLM → 工具调用 → patch 的完整链路**。本次报告中的 P0-1/P0-2/P0-4 都是 mock 测试无法发现的。

## 三、改进计划（实施顺序）

| 优先级 | 问题 | 方案 | 影响文件 |
|--------|------|------|----------|
| P0 | 碎片化 thought | 后端按消息边界聚合 `thought` 增量；前端把一个 turn 的 thought 流式拼接成单个气泡 | `service.py`、`useAgentChat.ts`、`AgentEventItem.tsx` |
| P0 | patch 漏发 | 用「工具执行钩子」而非「事件轮询」捕获版本变更，保证每次写工具调用都发 patch | `service.py` |
| P0 | stop 无法中断 | 引入 `asyncio.Event` 停止信号，在事件循环中检查并优雅中断；清理 status 状态机 | `session.py`、`agent.py`、`service.py` |
| P0 | 静默失败 | translator 识别 `UsageLimitExceeded` 等事件转成 `error` 事件；系统提示词要求失败时说明原因 | `translator.py`、`config.py` |
| P1 | history 未持久化 | `run` 结束时把本轮消息追加到 `sess.message_history` | `agent.py`、`service.py` |
| P1 | UI 聚合 | 一个 turn 内同类事件分组折叠（思考流、工具调用序列） | `AgentEventItem.tsx`、`AgentPanel.tsx` |
| P2 | 补真实链路测试 | 新增不依赖网络的集成测试（mock LLM 层但走真实 workspace/translator） | `tests/` |

## 四、附录：测试复现方法

```bash
cd backend && source .venv/bin/activate

# 真实端到端（需配置 DEEPSEEK_API_KEY）
python - <<'PY'
import asyncio, json
from app.services.workspace.workspace import Workspace
from app.services.agent.service import AgentService
from app.core.config import get_settings
s = get_settings()
async def main():
    ws = Workspace(content="# 文档\n\n正文。\n", title="t")
    svc = AgentService(workspace=ws, provider="deepseek", model="deepseek-chat",
                       api_key=s.deepseek_api_key, base_url=s.deepseek_base_url)
    counts = {}
    async for evt in svc.run("在正文后加一句总结。"):
        t = evt.get("type"); counts[t] = counts.get(t,0)+1
    print("counts:", counts)  # 观察 thought 数量 → 复现 P0-1
asyncio.run(main())
PY
```
