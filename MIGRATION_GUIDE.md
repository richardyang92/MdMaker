# 前后端分离迁移指南

本文档说明如何将 MdMaker 从当前架构迁移到新的前后端分离架构。

## 概述

当前架构问题：
- AI API 密钥直接存储在前端 localStorage
- App.tsx (1220行) 混合了 UI、业务逻辑和 API 调用
- 直接从前端调用 AI API

新架构优势：
- API 密钥安全存储在服务端
- 业务逻辑分离到自定义 Hooks
- 统一的 API 服务层
- 清晰的关注点分离

## 已完成的后端工作

### 后端结构

```
backend/
├── app/
│   ├── api/v1/              # API 路由
│   │   ├── ai.py           # AI 聊天接口
│   │   ├── config.py       # 配置管理接口
│   │   └── documents.py    # 文档管理接口
│   ├── core/               # 核心配置
│   ├── schemas/            # Pydantic 模型
│   ├── services/ai/        # AI 服务
│   │   ├── base.py         # 基类
│   │   ├── deepseek.py     # DeepSeek 实现
│   │   ├── ollama.py       # Ollama 实现
│   │   └── factory.py      # 服务工厂
│   └── middleware/         # 中间件
└── pyproject.toml          # Python 依赖
```

### 后端 API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| /api/v1/ai/chat | POST | AI 聊天 (SSE流) |
| /api/v1/ai/providers | GET | 获取提供商列表 |
| /api/v1/ai/status | GET | 获取配置状态 |
| /api/v1/config/validate | POST | 验证配置 |
| /api/v1/documents | POST/GET | 创建/获取文档 |
| /api/v1/documents/{id} | GET/PUT/DELETE | 文档操作 |

## 已完成的前端工作

### 前端新增文件

```
src/
├── services/              # 新增 API 服务层
│   ├── api/
│   │   ├── aiApi.ts       # AI API 客户端
│   │   ├── configApi.ts   # 配置 API 客户端
│   │   ├── documentApi.ts # 文档 API 客户端
│   │   └── config.ts      # API 配置
│   └── types/
│       ├── ai.ts          # AI 类型定义
│       └── document.ts    # 文档类型定义
├── hooks/
│   ├── useAIChat.ts       # 新增: AI 聊天 Hook
│   ├── useAIConfig.ts     # 新增: AI 配置 Hook
│   └── useDocument.ts     # 新增: 文档操作 Hook
└── .env.backend           # 前端环境变量
```

### 新增 API 客户端使用示例

```typescript
// AI API
import { aiApi } from './services/api/aiApi';

// 流式聊天
async function* streamChat() {
  for await (const chunk of aiApi.chat({
    provider: 'ollama',
    model: 'qwen2.5:7b',
    messages: [{ role: 'user', content: '你好' }],
  })) {
    if (chunk.type === 'content') {
      console.log(chunk.content);
    }
  }
}

// 获取提供商列表
const providers = await aiApi.getProviders();

// 获取配置状态
const status = await aiApi.getStatus();
```

```typescript
// 使用 useAIChat Hook
import { useAIChat } from './hooks/useAIChat';

function MyComponent() {
  const { messages, isStreaming, sendMessage } = useAIChat({
    provider: 'ollama',
    model: 'qwen2.5:7b',
  });

  const handleSend = () => {
    sendMessage('帮我写一段代码');
  };

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
      <button onClick={handleSend} disabled={isStreaming}>
        发送
      </button>
    </div>
  );
}
```

```typescript
// 使用 useAIConfig Hook
import { useAIConfig } from './hooks/useAIConfig';

function ConfigComponent() {
  const { config, setConfig, providers, status } = useAIConfig();

  return (
    <div>
      <select
        value={config.provider}
        onChange={(e) => setConfig({ provider: e.target.value })}
      >
        {Object.entries(providers).map(([key, info]) => (
          <option key={key} value={key}>{info.name}</option>
        ))}
      </select>
    </div>
  );
}
```

## 迁移步骤

### 第一步：启动后端服务

```bash
cd backend

# 安装依赖
poetry install

# 复制并配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 启动服务
poetry run uvicorn app.main:app --reload --port 8000
```

### 第二步：配置前端环境变量

在前端项目根目录创建或更新 `.env` 文件:

```env
VITE_API_BASE_URL=http://localhost:8000
```

### 第三步：更新 App.tsx 使用新 Hooks

在 `src/App.tsx` 中:

1. 导入新的 Hooks:
```typescript
import { useAIChat } from './hooks/useAIChat';
import { useAIConfig } from './hooks/useAIConfig';
```

2. 替换直接 API 调用:

```typescript
// 旧代码 (直接 fetch)
const response = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(requestBody)
});

// 新代码 (使用 Hook)
const { sendMessage } = useAIChat({
  provider: aiConfig.provider,
  model: aiConfig.model,
});

await sendMessage(userMessage, {
  document: markdown,
  selection: selectedText ? { text: selectedText, start, end } : undefined,
  cursorPosition: getSelectionPosition().start,
});
```

### 第四步：更新 SettingsPanel 组件

修改 `src/components/ai-assistant/SettingsPanel.tsx`:

1. 使用 `useAIConfig` Hook
2. 移除本地 API 密钥存储
3. 从后端获取提供商列表

### 第五步：测试

1. 启动后端: `poetry run uvicorn app.main:app --reload`
2. 启动前端: `npm run dev`
3. 测试 AI 聊天功能
4. 验证流式响应
5. 检查浏览器开发者工具，确认 API 调用指向后端

## 关键变化

### API 密钥管理

**旧方式** (不安全):
```typescript
// 前端存储 API 密钥
const apiKey = localStorage.getItem('ai-api-key');
const response = await fetch(url, {
  headers: { 'Authorization': `Bearer ${apiKey}` }
});
```

**新方式** (安全):
```typescript
// 后端管理 API 密钥
// 前端只发送请求，不接触密钥
await aiApi.chat({ provider: 'deepseek', model: 'deepseek-chat', messages });
```

### 聊天请求格式

**旧格式**:
```typescript
{
  messages: [...],
  model: "qwen2.5:7b",
  temperature: 0.7,
  stream: true
}
```

**新格式** (更结构化):
```typescript
{
  provider: "ollama",
  model: "qwen2.5:7b",
  messages: [...],
  context: {
    document: "...",
    selection: { text: "...", start: 10, end: 50 },
    cursorPosition: 25
  },
  options: {
    temperature: 0.7,
    maxTokens: 4000,
    thinkingMode: false
  }
}
```

## 待完成工作

- [ ] 重构 App.tsx 使用新的 Hooks
- [ ] 更新 SettingsPanel 组件
- [ ] 更新 AIAssistantDrawer 组件
- [ ] 移除旧的 API 调用代码
- [ ] 添加错误处理和用户反馈
- [ ] 更新测试用例
- [ ] 数据库集成 (文档持久化)

## 故障排除

### 后端无法启动

1. 检查 Python 版本 (需要 3.11+)
2. 确保依赖已安装: `poetry install`
3. 检查端口 8000 是否被占用

### 前端无法连接后端

1. 确认后端服务已启动
2. 检查 `.env` 文件中的 `VITE_API_BASE_URL`
3. 检查后端 CORS 配置

### AI 聊天无响应

1. 检查后端 `.env` 文件中的 AI 配置
2. 确认 Ollama 服务已启动 (如果使用 Ollama)
3. 查看 API 文档: `http://localhost:8000/docs`

## 联系方式

如有问题，请参考后端 README.md 或提交 Issue。
