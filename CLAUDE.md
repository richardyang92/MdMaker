# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MdMaker is an AI-powered Markdown editor with a front-end/back-end separated architecture. The backend provides AI chat services via FastAPI, while the frontend is a React + Vite application using CodeMirror for editing.

**Key Architecture:** AI API keys are stored server-side only. The frontend never directly calls AI provider APIs - all AI requests go through the backend which manages credentials.

## Development Commands

### Backend (Python 3.11+)

```bash
cd backend

# Install dependencies (Poetry recommended)
poetry install

# Or with pip
pip install -e .

# Configure environment
cp .env.example .env
# Edit .env with your AI provider credentials

# Start development server
poetry run uvicorn app.main:app --reload --port 8000
# Or: uvicorn app.main:app --reload --port 8000

# Lint and format
poetry run black app/
poetry run ruff check app/

# Type check
poetry run mypy app/

# Run tests
poetry run pytest
```

Backend API docs: http://localhost:8000/docs

### Frontend (Node.js 18+)

```bash
cd frontend

# Install dependencies
npm install

# Configure API URL
echo "VITE_API_BASE_URL=http://localhost:8000" > .env

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Frontend dev server: http://localhost:5173

## Architecture

### Backend Structure

```
backend/app/
├── api/v1/           # API routes (ai, config, documents)
├── core/             # Configuration, exceptions
├── schemas/          # Pydantic models for request/response
├── services/ai/      # AI provider implementations
├── middleware/       # Custom middleware (error handling, logging)
└── main.py           # FastAPI app entry point
```

**AI Service Factory Pattern:**
- Base class `AIService` ([services/ai/base.py](backend/app/services/ai/base.py)) defines the interface
- Providers (DeepSeek, Ollama) inherit and implement `chat()` async generator
- `get_ai_service(provider)` factory returns configured instances
- New providers: Register via `register_ai_service()` and implement the base class

**Streaming:** Uses Server-Sent Events (SSE). The `/api/v1/ai/chat` endpoint yields JSON chunks:
```json
{"type": "content", "content": "text chunk"}
{"type": "done", "content": ""}
```

### Frontend Structure

```
frontend/src/
├── components/
│   ├── ai-assistant/    # AI-related UI components
│   └── editor/          # CodeMirror editor wrapper
├── hooks/               # React hooks (useAIChat, useAIConfig, useDocument)
├── services/
│   ├── api/             # API clients (aiApi, configApi, documentApi)
│   └── types/           # TypeScript types matching backend schemas
├── App.tsx              # Main application component
```

**API Layer Pattern:**
- `aiApi.ts` provides typed client functions
- `parseSSEStream()` handles SSE responses
- Hooks like `useAIChat` wrap the API layer with React state management

### @Syntax Context Injection

The app supports special `@` mentions in AI prompts that inject document context:

- `@selection` - Selected text from the editor
- `@document` - Full document content
- `@cursor` - Context around cursor position

Processing happens in `base.py:_process_at_syntax()` on the backend. The frontend can use `useAtSyntax` hook or `TiptapAtMenu` component for user-friendly selection.

### AI Provider Configuration

**Backend (.env):**
```env
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_API_KEY=your_key_here
OLLAMA_BASE_URL=http://localhost:11434/v1
DEFAULT_AI_PROVIDER=ollama
```

**Frontend:** Uses the `useAIConfig` hook to fetch available providers and models from `/api/v1/ai/providers`. The frontend selects provider/model per request.

## Key Integration Points

1. **Adding a new AI provider:**
   - Create `backend/app/services/ai/newprovider.py` extending `AIService`
   - Implement `chat()` async generator and `get_models()`
   - Register in `factory.py:register_ai_service()`
   - Add environment variables to `.env.example`

2. **Frontend uses AI:**
   - Import `useAIChat` from `hooks/useAIChat.ts`
   - Call `sendMessage(content, context?)` where context includes optional document/selection/cursorPosition
   - The hook handles streaming response updates to the messages array

3. **Document context flow:**
   - Frontend `ChatContext` type → backend `ChatContext` schema
   - Backend injects context into messages via `@syntax` processing
   - AI receives expanded prompts with document context

## Migration Notes

The codebase is currently transitioning from a pure frontend (API keys in localStorage) to the proper backend-separated architecture. Some legacy code may exist in `App.tsx`. Use the new services layer and hooks for any new features.
