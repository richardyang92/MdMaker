# MdMaker Backend API

FastAPI 后端服务，为 MdMaker AI 驱动的 Markdown 编辑器提供 API 支持。

## 功能特性

- **AI 聊天服务**: 支持 DeepSeek 和 Ollama 提供商
- **流式响应**: 使用 Server-Sent Events (SSE) 实现实时流式输出
- **文档管理**: 支持文档的 CRUD 操作
- **配置管理**: AI 提供商配置和验证
- **安全性**: API 密钥存储在服务端，不暴露给前端

## 快速开始

### 1. 安装依赖

使用 Poetry (推荐):

```bash
cd backend
poetry install
```

或使用 pip:

```bash
cd backend
pip install -e .
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env`:

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置 AI 提供商:

```env
# Server
PORT=8000
ENVIRONMENT=development

# AI Providers
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_API_KEY=your_deepseek_api_key_here
OLLAMA_BASE_URL=http://localhost:11434/v1

# Default Configuration
DEFAULT_AI_PROVIDER=ollama

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### 3. 启动服务

```bash
# 使用 Poetry
poetry run uvicorn app.main:app --reload --port 8000

# 或直接使用 uvicorn
uvicorn app.main:app --reload --port 8000
```

服务将在 `http://localhost:8000` 启动。

### 4. 访问 API 文档

打开浏览器访问:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## API 端点

### AI 聊天

#### POST /api/v1/ai/chat

发送消息到 AI 并获取流式响应。

```json
{
  "provider": "ollama",
  "model": "qwen2.5:7b",
  "messages": [
    { "role": "user", "content": "你好" }
  ],
  "context": {
    "document": "完整的文档内容...",
    "selection": { "text": "选中的文字", "start": 10, "end": 50 }
  },
  "options": {
    "temperature": 0.7,
    "maxTokens": 4000,
    "thinkingMode": false
  }
}
```

响应: SSE 流

```
data: {"type":"content","content":"你好"}
data: {"type":"done","content":""}
```

#### GET /api/v1/ai/providers

获取可用的 AI 提供商和模型列表。

#### GET /api/v1/ai/status

获取当前配置状态。

### 配置管理

#### POST /api/v1/config/validate

验证 AI 提供商配置。

### 文档管理

#### POST /api/v1/documents

创建新文档。

#### GET /api/v1/documents

获取文档列表。

#### GET /api/v1/documents/{id}

获取单个文档。

#### PUT /api/v1/documents/{id}

更新文档。

#### DELETE /api/v1/documents/{id}

删除文档。

## 项目结构

```
backend/
├── app/
│   ├── api/              # API 路由
│   │   └── v1/           # v1 版本 API
│   ├── core/             # 核心配置
│   ├── models/           # 数据库模型
│   ├── schemas/          # Pydantic 模型
│   ├── services/         # 业务逻辑
│   │   └── ai/           # AI 服务
│   ├── repositories/     # 数据访问层
│   ├── middleware/       # 中间件
│   └── utils/            # 工具函数
├── tests/                # 测试
├── alembic/              # 数据库迁移
└── pyproject.toml        # 项目配置
```

## 支持的 AI 提供商

### DeepSeek

- **Base URL**: `https://api.deepseek.com/v1`
- **需要 API Key**: 是
- **支持 Thinking Mode**: 是
- **可用模型**: `deepseek-chat`, `deepseek-reasoner`, `deepseek-coder`

### Ollama

- **Base URL**: `http://localhost:11434/v1`
- **需要 API Key**: 否
- **支持 Thinking Mode**: 否
- **可用模型**: `qwen2.5:7b`, `llama3.1:8b`, `gemma2:9b`, `mistral:7b`

## 开发

### 运行测试

```bash
poetry run pytest
```

### 代码格式化

```bash
poetry run black app/
poetry run ruff check app/
```

### 类型检查

```bash
poetry run mypy app/
```

## 安全性

- 所有 AI API 密钥存储在服务端环境变量中
- 前端无法访问敏感的 API 密钥
- CORS 配置限制允许的来源
- 输入验证使用 Pydantic 模型
- 速率限制防止滥用

## 待完成功能

- [ ] 数据库集成 (PostgreSQL/MySQL)
- [ ] 用户认证和授权
- [ ] 消息历史持久化
- [ ] 文档版本控制
- [ ] 更多 AI 提供商支持
