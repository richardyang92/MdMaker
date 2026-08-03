# Agent 主导编辑器改造 — 设计稿

- **日期**: 2026-07-30
- **分支**: `feature/agent-driven-editor`
- **状态**: 待用户审阅
- **主题**: 把 MdMaker 从「AI 只产聊天文本、用户手动应用」改造成「后端用 **PydanticAI** 跑自主 Agent 循环，Agent 用文档编辑工具直接改后端权威文档，改动经 SSE 实时推给前端画布」

---

## 0. 设计决定记录

| 决定 | 选择 | 依据 |
|---|---|---|---|
| Agent 范式 | Agent 拥有编辑工具，改动实时落到编辑器，编辑器是画布 | 用户选择 |
| Agent 循环位置 | **后端主导**，前端是渲染器 + 文档镜像 | 用户选择 |
| 工具调用驱动 | 抽象层兼容所有 provider | 用户选择 |
| 文档状态归属 | **后端持有权威状态**，补丁经 SSE 推前端 | 用户选择 |
| 持久化 | 内存会话状态，不引入数据库 | 用户选择（最小验证） |
| 自主边界 | 全自动执行 + 硬性安全上限 + Stop + 撤销栈兜底 | 用户选择 |
| 前端改造策略 | 渐进拆解 App.tsx，复用已存在但未接线的 hooks | 探索结论（脚手架干净但零引用） |
| **Agent 执行框架** | **PydanticAI**（不手搓循环/工具层） | 调研：FastAPI+Pydantic 栈零摩擦、线性 ReAct 场景最契合、流式事件单一清晰 |

---

## 1. 背景与现状（基于代码事实，非文档）

经探索确认（文档与代码已严重脱节，以代码为准）：

- **真正在跑的 AI 链路全在 `frontend/src/App.tsx`（1106 行 monolith）**：`handleAiSend`（:618–826）做发送/`@`语法替换/流式消费，`applyAiResponse`（:574–589）把 AI 文本应用回编辑器。
- **`hooks/useAIChat.ts`、`useAIConfig.ts`、`useDocument.ts` 写得干净但全仓库零引用**，是未接线的脚手架，可作为新链路起点。
- **AI 目前只产聊天文本**，写进编辑器靠用户手动点按钮（替换/追加/插入/替换选区 4 种模式）。Agent 不直接驱动编辑器 —— 这是本次改造要改变的核心。
- **后端无 Agent 循环、无持久化、无认证、无数据库**。`documents.py:18` 是内存 dict；`services/ai/factory.py` 硬编码 `deepseek`/`ollama` 两个 provider。
- **已有一套前端 CodeAct 风格 UI**（`components/codeact/*` + `useCodeActExecution` + `MessageItem` 解析 Thought/Action/Observation），是离 Agent 范式最近的现有资产，但纯前端文本解析、无后端 Agent 循环。
- **SSE 协议**：`/api/v1/ai/chat` 流式发 `{"type":"content"|"error"|"done", ...}`，前端 `parseSSEStream`（`services/api/aiApi.ts:9-51`）按 `data: {json}\n\n` 解析。
- **`@` 语法**：前端 `useTiptapAtSyntax` + `AtSyntaxParser.replaceAtMentions` 支持 `@selection/@cursor/@document`；后端 `base.py:102-139` 的 `_process_at_syntax` 也支持这 3 种，但不支持前端的 `#L4-7` 行号，语义不完全对齐。

## 2. 目标与非目标

**目标**
1. Agent 拥有文档编辑工具，改动实时落到编辑器，编辑器成为 Agent 的画布。
2. Agent 的「思考-调用工具-观察」循环在**后端**（由 PydanticAI 驱动），前端是渲染器 + 文档状态镜像。
3. 工具调用兼容所有 provider（利用 PydanticAI 的 provider 适配）。
4. 后端持有文档权威状态，Agent 在服务端调纯文本编辑工具，补丁经 SSE 推前端。
5. 内存会话状态，不引入数据库。
6. 全自动执行 + 硬性安全上限 + 随时 Stop + 撤销栈兜底。

**非目标（本期不做，保持范围聚焦）**
- 不新增 AI provider（GLM/OpenAI-OSS 等留作后续）。
- 不引入数据库/认证/多会话持久化（内存会话即可）。
- 不做行级 diff 补丁（整文替换 + version 足够，diff 留作优化）。
- 不引入 WebSocket（复用现有 SSE 通道）。
- 不废弃旧的 `/api/v1/ai/chat` 简单聊天端点（暂留，与 Agent 链路并存）。

## 3. 整体架构

四个边界清晰的单元：

| 单元 | 位置 | 单一职责 | 来源 |
|---|---|---|---|---|
| **Agent 引擎** | PydanticAI（库，不手搓） | ReAct 循环、工具调度、流式事件、多 provider 适配、防死循环 | **引入依赖** |
| **后端文档工作区** | `backend/app/services/workspace/` | 后端权威文档状态 + 纯文本编辑工具实现，线程安全、可单测 | **自建（重点）** |
| **Agent 服务层（胶水）** | `backend/app/services/agent/` | 用 PydanticAI 搭 Agent、注册工具、把 PydanticAI 事件翻译成 SSE 事件、会话管理 | **自建（胶水）** |
| **前端 Agent 渲染层** | `frontend/src/hooks/useAgentChat.ts` + `components/agent/` | 消费 Agent SSE、渲染事件流、应用补丁 | **自建** |

**关键**：Agent 循环/工具调度/流式/多 provider 适配**全部交给 PydanticAI**；自建精力集中在**本项目独有的 Workspace（后端权威文档状态 + 纯文本编辑工具）**和一层薄薄的胶水（把 PydanticAI 事件翻译成前端 SSE 协议）。

**数据流**：用户输入 → 后端 `AgentService.run()` → PydanticAI `agent.run_stream_events()` → 事件流 → 胶水层翻译成 SSE → 前端渲染 + 应用补丁 → 编辑器刷新。

**边界规则**：前端→后端只走 HTTP（发消息/同步/停止），后端→前端只走 SSE（事件流）。Workspace 与 Agent 服务层互不直接依赖 HTTP。

### 为何选 PydanticAI（简述）
- **栈零摩擦**：与现有 FastAPI + Pydantic schemas 同源（同一团队），思维模型一致。
- **线性 ReAct 场景最契合**：本项目是「线性 ReAct 循环 + 文档编辑工具」，不需要 LangGraph 那套图编排（node/edge/state/channel/checkpointer），概念负担更小。
- **流式事件单一清晰**：`agent.run_stream_events()` 一个 API 产出 `FunctionToolCallEvent` / `FunctionToolResultEvent` / `PartDeltaEvent`，直接映射前端协议。
- **成熟稳定**：PyPI 稳定版 2.21.0（2.x 线，2026 年活跃迭代），约 1.875 亿下载。
- **能力覆盖**：ReAct 循环、防死循环（`UsageLimits`）、流式结构化事件、Python 函数即工具（`@agent.tool`）、OpenAI-兼容 provider（`OpenAIChatModel` + `OpenAIProvider(base_url=)`）全部内建。

## 4. 后端 Agent 服务层（胶水）

**`AgentService`**（`backend/app/services/agent/service.py`）：用 PydanticAI 组装一个 Document Editor Agent。

**Agent 构建**（`service.py`）：
```python
from pydantic_ai import Agent, RunContext, UsageLimits
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

def build_agent(workspace: Workspace, model_cfg: ModelConfig) -> Agent:
    model = OpenAIChatModel(
        model_cfg.model_name,
        provider=OpenAIProvider(base_url=model_cfg.base_url, api_key=model_cfg.api_key),
    )
    agent = Agent(model, system_prompt=SYSTEM_PROMPT, deps_type=Workspace)
    register_tools(agent)   # 把 Workspace 的编辑操作注册成 @agent.tool
    return agent
```

**工具注册**（`tools.py`）—— 工具是 `@agent.tool` 注册的普通 async 函数，实际操作由 `Workspace` 执行：
```python
def register_tools(agent: Agent) -> None:
    @agent.tool
    async def replace_section(ctx: RunContext[Workspace], heading: str, text: str) -> str:
        result = await ctx.deps.replace_section(heading, text)
        return f"已替换 '{heading}' 一节（{len(text)} 字符）"   # 给 LLM 看的回执

    @agent.tool
    async def insert_text(ctx: RunContext[Workspace], text: str, after_heading: str | None = None) -> str:
        ...
    # 其余工具见第 5 节工具表
```

**ReAct 循环**：由 PydanticAI 内建——调用方只管 `agent.run_stream_events(user_prompt, usage_limits=...)`，框架自动跑「思考→调工具→观察→…」直到模型不再调用工具或触限。

**安全上限**：用 PydanticAI 的 `UsageLimits`（库内建，无需手搓）：
```python
usage_limits = UsageLimits(request_limit=15, tool_calls_limit=20)
```
（额外在 `Workspace` 层加业务级安全上限，见第 5 节）。

**事件翻译**（`translator.py`）：把 PydanticAI 的事件翻译成前端 SSE 协议（第 7 节）：
| PydanticAI 事件 | 前端 SSE 事件 |
|---|---|
| `PartDeltaEvent`（assistant 文本增量） | `{"type":"thought","content":...}` |
| `FunctionToolCallEvent` | `{"type":"tool_call","name":...,"args":...}` |
| `FunctionToolResultEvent` | `{"type":"tool_result","name":...,"ok":...,"summary":...}` |
| （Workspace 编辑后） | `{"type":"document_patch","version":...,"summary":...}` |
| Run 结束 | `{"type":"final","content":...}` + `{"type":"done"}` |

**会话管理**（`session.py`）：内存 dict 存 `{session_id: AgentSession}`，`AgentSession` 持 `session_id`、关联的 `Workspace`、`message_history`（PydanticAI 的 `ModelMessage` 列表）、`status`。`status(running/stopped/done/failed)`。用户 Stop → 前端断开 SSE → 后端 `CancelledError` 触发清理，`status=stopped`。

**与旧链路关系**：旧的 `/api/v1/ai/chat` + `services/ai/` 自建 provider 层**暂留不动**，不在本期废弃。Agent 链路独立于旧链路。

## 5. Workspace（后端文档状态 + 编辑工具）

**`Workspace`**（`backend/app/services/workspace/workspace.py`）：后端权威文档，线程安全（`asyncio.Lock`）。字段：`content: str`、`title: str`、`version: int`（乐观锁，每次编辑 +1）、`history: list[Snapshot]`（运行时撤销栈，内存）。

**文档编辑工具（纯文本语义，前端无关）**：

| 工具 | 参数 | 行为 | 读/写 |
|---|---|---|---|
| `get_document_outline` | — | 返回标题树 + 各节行范围 | 读 |
| `get_section` | `heading \| line_range` | 读取一节内容 | 读 |
| `read_range` | `start, end` | 读取字符范围 | 读 |
| `insert_text` | `text, position \| after_heading` | 插入 | 写 |
| `replace_range` | `start, end, text` | 替换字符范围 | 写 |
| `replace_section` | `heading, text` | 整节替换 | 写 |
| `delete_range` | `start, end` | 删除 | 写 |
| `find_replace` | `pattern, replacement, count?` | 查找替换 | 写 |
| `set_title` | `title` | 改标题 | 写 |

每个写工具：① 校验参数（防越界）② 执行 ③ `version += 1` ④ 推入 `history` ⑤ 生成 `DocumentPatch`（整文 + version + summary）。返回结构化结果（ok + 受影响范围）。工具是纯函数式、可独立单测。

**业务级安全上限（Workspace 层）**：
- `MAX_DOC_EDIT_RATIO = 0.5`：单次写工具调用删除/重写超过文档 50% 时**拒绝执行**，返回错误给 LLM（让它自我修正或放弃），靠撤销栈兜底已落地的改动。
- 参数越界校验：`start/end` 越界拒绝执行。

**文档状态同步（方案 A 的核心难点）**：
- **原则**：Agent 跑期间后端 Workspace 是权威；用户手动编辑通过「抢占 + 乐观锁」同步。
- 前端编辑器 `onChange` 把用户改动以 `ClientEdit{base_version, patch}` 发到 `POST /agent/sessions/{id}/sync`。
- 后端用 `base_version` 做乐观锁：
  - `base_version == 当前 version`（Agent 没动过）→ 直接应用，version+1。
  - 冲突（Agent 已改）→ 后端尝试三方合并；合并失败 → 前端重新拉取后端权威状态（用户最近手动编辑可能丢，靠本地撤销栈恢复）。
- Agent 运行时前端编辑器进「跟随模式」（补丁自动应用、光标尽量保持），用户可继续打字但顶部提示「Agent 正在编辑」。

## 6. （已由 PydanticAI 取代 —— 此节保留为说明）

原设计稿的手搓 `AgentLoop`、`ToolRegistry`、`ToolCallAdapter`、给 `AIService` 加 `chat_with_tools()` 等单元**全部删除**，由 PydanticAI 内建能力取代：
- ReAct 循环 → PydanticAI `agent.run_stream_events()`
- 工具注册 → `@agent.tool` 装饰器
- 多 provider 适配 → `OpenAIChatModel` + `OpenAIProvider(base_url=)`
- 防死循环 → `UsageLimits`

唯一保留的自建部分是 **Workspace（文档状态 + 编辑工具）**，因为这是本项目独有的逻辑，PydanticAI 不提供。

## 7. Agent SSE 协议 + 端点

**新增端点（与现有 `/api/v1/ai/chat` 并存，不动旧的）**：

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/api/v1/agent/sessions` | 创建会话，返回 `session_id` + 初始文档版本 |
| POST | `/api/v1/agent/sessions/{id}/messages` | 发送用户消息，SSE 流回 Agent 事件 |
| POST | `/api/v1/agent/sessions/{id}/sync` | 用户手动编辑同步（乐观锁） |
| POST | `/api/v1/agent/sessions/{id}/stop` | 停止当前 run |
| DELETE | `/api/v1/agent/sessions/{id}` | 清理会话 |

**Agent SSE 事件类型**（JSON chunks，复用前端 `parseSSEStream` 解析格式，沿用 `data: {json}\n\n`）：

```json
{"type":"thought","content":"..."}
{"type":"tool_call","name":"replace_section","args":{...}}
{"type":"tool_result","name":"replace_section","ok":true,"summary":"..."}
{"type":"document_patch","version":12,"summary":"替换了'架构'一节"}
{"type":"final","content":"已完成，共编辑 3 处"}
{"type":"error","error":"..."}
{"type":"done","content":""}
```

前端 `parseSSEStream` 已能按 `data: {json}\n\n` 解析，只需扩展对新增 `type` 的处理。`document_patch` 是关键新事件。

**`document_patch` 格式**：本期用「整文替换 + version」（最简单可靠，前端 `setMarkdownWithHistory` 已支持）+ `summary` 供 Agent 面板显示「改了什么」。行级 diff 留作后续优化，不在本期。

**事件来源**：这些 SSE 事件由第 4 节的「事件翻译」从 PydanticAI 事件流转换而来。其中 `document_patch` 不是 PydanticAI 原生事件——当 Workspace 在某次工具调用中被修改时，胶水层主动补发（基于 Workspace 的 version 变化）。

## 8. 前端改造（渐进拆解 App.tsx）

**新建**：
- `hooks/useAgentChat.ts` — 消费 Agent SSE，管理会话/事件流/补丁应用，暴露 `{messages, isRunning, stop, sendMessage, applyClientEdit}`。复用 `useAIConfig` 的 provider/model 配置。
- `components/agent/AgentPanel.tsx` — Agent 主交互面：消息流（复用现有 `components/codeact/*` 的 Thought/Action/Observation 卡片样式），「Agent 正在编辑」状态条，Stop 按钮。
- `lib/documentSync.ts` — 文档状态同步器：监听编辑器 `onChange`、节流发 `/sync`、应用 `document_patch`、处理版本冲突。

**App.tsx 瘦身（渐进、可对照）**：
1. 先接入 `useAgentChat`，让 Agent 面板跑通（旧 `handleAiSend` 暂留，新旧并存可对照）。
2. Agent 面板验证 OK 后，迁出/删除旧 AI 聊天链路（`handleAiSend` :618–826、`applyAiResponse` :574–589）。
3. App.tsx 最终只保留：编辑器 + 预览 + 主题 + 文档 state 容器。

**编辑器接入**：`document_patch` → `setMarkdownWithHistory(新全文)`（复用现有撤销栈，Agent 每次改动进栈，用户可 Ctrl+Z 回退单步 —— 满足「靠撤销栈兜底」）。Agent 运行时编辑器顶部显示「Agent 正在编辑」横幅。

**`@` 语法**：现有 `@selection/@document/@cursor` 保留语义，作为首轮 context 附在用户消息里发给 Agent（后端 `AgentService` 用它构造初始文档上下文，而非每轮重发）。

## 9. 错误处理

- **provider 超时/网络错** → `error` 事件 + 自动重试 1 次。
- **工具参数非法 / 越界 / 超编辑比例** → 工具返回错误字符串给 LLM（`ok:false` 的 `tool_result`），让 Agent 自我修正（PydanticAI 的循环会让模型看到失败结果后调整）。
- **乐观锁冲突合并失败** → 前端拉取权威状态 + 本地撤销栈兜底。
- **Agent 死循环** → PydanticAI `UsageLimits` 终止 + `final` 提示。
- **用户 Stop** → 前端断开 SSE → 后端 `CancelledError` → `status=stopped`。

## 10. 测试策略

仓库当前零测试。本期补关键路径测试，不追求全覆盖：

| 层 | 测什么 | 类型 |
|---|---|---|
| **Workspace 工具** | 边界、越界、乐观锁、撤销、编辑比例拒绝 | 纯函数单测（重点） |
| **AgentService 事件翻译** | mock PydanticAI 事件 → SSE 事件映射 | 单测 |
| **SSE 端点** | 事件流形状（FastAPI `TestClient`） | 集成测试 |
| **前端 `useAgentChat`** | 用 mock SSE 测补丁应用 + 状态 | 单测 |

核心覆盖三条路径：**Workspace 工具 + 事件翻译 + 补丁应用**。PydanticAI 自身的循环/工具调度不需要我们测试（库已测试）。

## 11. 风险与权衡

| 风险 | 影响 | 缓解 |
|---|---|---|
| 并发冲突（Agent 改 vs 用户打字）合并失败丢编辑 | 中 | 本地撤销栈兜底；Agent 运行时提示「Agent 正在编辑」降低并发打字概率 |
| PydanticAI 2.x 版本快速迭代可能 breaking change | 低 | 锁定版本（`pyproject.toml` 钉 `pydantic-ai~=2.21`）；胶水层薄，升级成本低 |
| 整文替换补丁在大文档下抖动 | 低 | 本期可接受；后续优化行级 diff |
| App.tsx 渐进改造期间新旧并存 | 低 | 分阶段，每阶段可独立验证 |
| 自建 provider 层与 PydanticAI 冗余 | 低 | 本期暂留旧的；未来可视情况废弃 |

## 12. 开放问题（实现阶段再定）

- 文档摘要注入 prompt 的具体策略（按文档大小截断 vs 分段）。
- 三方合并的具体算法（先用最朴素的「以 Agent 版本为准」策略，观察实际冲突频率再优化）。
- Agent 面板是否取代现有 AIAssistantDrawer，还是并存（渐进阶段先并存）。
- PydanticAI 的 `message_history` 持续追加，长会话如何控制 context（截断 vs 摘要）。
