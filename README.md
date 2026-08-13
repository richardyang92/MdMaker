# MdMaker - AI 智能 Markdown 编辑器

一个功能强大的 AI 驱动的 Markdown 编辑器，支持实时预览、LaTeX 公式编辑和智能 AI 助手。

## 架构

```
MdMaker/
├── frontend/          # React + Vite 前端应用
├── backend/           # FastAPI 后端服务
└── README.md          # 本文件
```

## 功能特性

- 📝 **Markdown 编辑**: 实时预览，支持完整 Markdown 语法
- 🧮 **LaTeX 公式**: 支持行内和块级数学公式渲染
- 🤖 **AI 助手**: 集成 DeepSeek 和 Ollama AI 模型
- 💬 **流式响应**: 实时流式 AI 响应输出
- 🎨 **多主题**: 支持浅色、深色和护眼主题
- ⚡ **快捷操作**: 支持撤销/重做，快捷键操作
- 📎 **选区即源码**: 在渲染稿中框选文字「加入上下文」，得到的是选区对应的**原始 Markdown 源文本**（标题带 `#`、列表带 `-`、表格带 `|`、公式带 `$...$`），而不是渲染后的网页文本
- 🧩 **多上下文 + @引用**: 可同时附加多个文档片段（自动编号 `@ctx-1`、`@ctx-2`…），在聊天框输入 `@` 弹出引用菜单，支持键盘/鼠标选择插入；内建 `@document` 引用全文

## 使用上下文引用

1. 在左栏渲染稿中用鼠标框选文字，点击浮出的「＋ 加入上下文」按钮 —— 片段以原始 Markdown 源文本附加到右栏（自动分配 `@ctx-N` 引用名，可逐个 ✕ 移除）。
2. 在聊天输入框中输入 `@`，从弹出菜单选择要引用的片段（`↑/↓` 选择、`Enter`/`Tab` 或鼠标点击插入），例如：
   ```
   把 @ctx-1 改写成列表，并参考 @document 的结语风格
   ```
3. 发送后，后端把 `@ctx-N` 展开为带标签的代码块注入消息；未显式引用的已附加片段也会附在消息末尾（保持旧的单选区行为）。
4. 历史消息气泡下方会回显该轮携带的片段标签（只读）。

注意：消息里的 `@` 引用不会被原样发给模型 —— 后端在进入 Agent 之前完成展开；`@ctx-N` 必须在侧栏已附加才能展开，未知引用会原样保留。

## 一键启动（推荐）

```bash
./dev.sh          # 启动前端 + 后端（首次运行自动安装缺失依赖）
./dev.sh stop     # 一次性关闭所有服务
./dev.sh restart  # 重启所有服务
./dev.sh status   # 查看运行状态
./dev.sh logs     # 实时查看日志
```

启动成功后：

- 前端: http://localhost:5173
- 后端 API: http://localhost:8000（API 文档 http://localhost:8000/docs）
- 前端 `/api` 请求会自动代理到后端 8000 端口

日志与 PID 文件保存在 `.dev/` 目录（已加入 .gitignore）。

## 快速开始

### 前置要求

- Node.js 18+
- Python 3.11+
- Poetry (可选，用于后端依赖管理)

### 1. 克隆项目

```bash
git clone <repository-url>
cd MdMaker
```

### 2. 启动后端服务

```bash
cd backend

# 安装依赖
pip install -e .
# 或使用 Poetry
poetry install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置 AI 提供商

# 启动服务
uvicorn app.main:app --reload --port 8000
```

后端 API 文档: http://localhost:8000/docs

### 3. 启动前端应用

```bash
cd frontend

# 安装依赖
npm install

# 配置环境变量（如需要）
echo "VITE_API_BASE_URL=http://localhost:8000" > .env

# 启动开发服务器
npm run dev
```

前端应用: http://localhost:5173

## 配置 AI 提供商

### Ollama (本地模型)

1. 安装 Ollama: https://ollama.com
2. 启动 Ollama 服务
3. 在 `backend/.env` 中配置:

```env
OLLAMA_BASE_URL=http://localhost:11434/v1
DEFAULT_AI_PROVIDER=ollama
```

### DeepSeek

1. 获取 API Key: https://platform.deepseek.com
2. 在 `backend/.env` 中配置:

```env
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_API_KEY=your_api_key_here
DEFAULT_AI_PROVIDER=deepseek
```

## 项目结构

### Frontend

```
frontend/
├── src/
│   ├── components/      # React 组件
│   ├── hooks/           # 自定义 Hooks
│   ├── services/        # API 服务层
│   └── App.tsx          # 主应用组件
├── public/              # 静态资源
└── package.json         # 依赖配置
```

### Backend

```
backend/
├── app/
│   ├── api/             # API 路由
│   ├── core/            # 核心配置
│   ├── models/          # 数据模型
│   ├── schemas/         # Pydantic 模型
│   └── services/        # 业务逻辑
└── pyproject.toml       # 依赖配置
```

## 开发

### 前端开发

```bash
cd frontend
npm run dev     # 启动开发服务器
npm run build   # 构建生产版本
npm run preview # 预览生产构建
```

### 后端开发

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

## 文档

- [后端 API 文档](backend/README.md)
- [迁移指南](MIGRATION_GUIDE.md)

## 技术栈

### 前端
- React 18
- TypeScript
- Vite
- CodeMirror 6
- KaTeX
- Tailwind CSS

### 后端
- FastAPI
- Python 3.11+
- SQLAlchemy
- Pydantic
- httpx

## 许可证

Apache 2.0 License - 详见 [LICENSE](LICENSE)
