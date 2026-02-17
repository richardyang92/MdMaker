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
