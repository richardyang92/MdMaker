# AGENTS.md

Project-specific guidance for ZCode agents working in this repository.
This complements `CLAUDE.md`, `README.md`, and `MIGRATION_GUIDE.md` — read those for full detail. The notes below are facts and gotchas that those docs do not state clearly.

## Repository Purpose

MdMaker is an AI-powered Markdown editor with a **frontend/backend separation**.

- `backend/` — FastAPI app (Python 3.11+). Holds all AI provider credentials server-side; the frontend never touches AI keys directly.
- `frontend/` — React 18 + TypeScript + Vite app. CodeMirror 6 for editing, KaTeX for math, Tailwind for styling, Tiptap for rich input/`@`-mention menu.
- `CLAUDE.md`, `README.md`, `MIGRATION_GUIDE.md`, `backend/README.md` — existing docs (in mixed Chinese/English).

## Commands

### Backend (`cd backend`)
```bash
poetry install
poetry run uvicorn app.main:app --reload --port 8000   # API docs: http://localhost:8000/docs
poetry run black app/      # format
poetry run ruff check app/ # lint (line-length 100, py311, rules E/F/I/N/W, E501 ignored)
poetry run mypy app/       # strict (disallow_untyped_defs, warn_return_any)
poetry run pytest          # NOTE: no tests currently exist in the repo
```

### Frontend (`cd frontend`)
```bash
npm install
npm run dev      # dev server http://localhost:5173
npm run build    # runs `tsc && vite build` — type errors fail the build
npm run preview
```

## Architecture Boundaries

- **Frontend → Backend only.** AI calls must go through `frontend/src/services/api/aiApi.ts` → backend `/api/v1/ai/chat`. Never call AI provider APIs from the frontend.
- **Streaming contract:** `/api/v1/ai/chat` is SSE emitting JSON chunks:
  `{"type":"content","content":"..."}` and a terminal `{"type":"done","content":""}`. Frontend `parseSSEStream()` parses these. Keep both sides in sync if you change the shape.
- **Layering (frontend):** `components/*` → `hooks/*` (`useAIChat`, `useAIConfig`, `useDocument`) → `services/api/*` → backend. `services/types/*` mirrors backend Pydantic schemas in `backend/app/schemas/`.
- **AI providers:** Each provider extends `AIService` (`backend/app/services/ai/base.py`), implements `chat()` (async generator) + `get_models()`, and calls `register_ai_service()` at import time. The `services/ai/__init__.py` imports each provider module so its registration runs.

## Important Gotchas

1. **Docs drift behind code.** `CLAUDE.md`, commit messages, and the migration guide mention GLM-4.5 and OpenAI-OSS providers and a `@smart` mention. As of HEAD the **backend `factory.py` only ships DeepSeek and Ollama**, and `_process_at_syntax()` only handles `@selection`/`@document`/`@cursor`. Do not assume other providers are wired up — verify in `backend/app/services/ai/` and `factory.py` before editing.

2. **`factory.py` provider config is hardcoded.** `get_ai_service()` switches on `if provider == "deepseek"/"ollama"` rather than reading from the registry. If you add a provider, you must also extend `get_ai_service()`, `get_available_providers[_sync]()`, `is_provider_configured()`, and `services/ai/__init__.py` — registration alone is not enough.

3. **`openai` dependency is missing from `pyproject.toml`.** It is listed in `backend/requirements.txt` (DeepSeek uses the OpenAI SDK), but **not** in `pyproject.toml`. `poetry install` will not install it; pip users following `requirements.txt` will. Add it to `pyproject.toml` if touching Poetry-managed deps.

4. **Frontend npm scripts reference a non-existent `server.js`.** `package.json` defines `dev:server`/`dev:all` via `concurrently` running `node server.js`, but `frontend/server.js` does not exist. Use `npm run dev` (plain Vite) — do not invoke `dev:server`/`dev:all`.

5. **MIGRATION_GUIDE.md "pending work" is outdated.** The migration to frontend/backend separation was completed (commit `bcce920`); the guide's checklist no longer reflects current state. Prefer the current code over the guide.

6. **`App.tsx` is the legacy monolith.** New features should use the hooks/services layers (`hooks/useAIChat.ts`, `services/api/aiApi.ts`, etc.), not add direct fetches or key handling to `App.tsx`.

7. **Python tooling config** lives in `backend/pyproject.toml`: ruff + black use line-length 100 / py311; mypy is strict. Frontend has no linter configured — `tsc` (via `npm run build`) is the type gate.

## Sensitive Areas — Read Before Changing
- `backend/app/services/ai/factory.py` — central provider dispatch and config.
- `backend/app/services/ai/base.py` — `AIService` interface and `@`-syntax expansion in `_process_at_syntax()`.
- `backend/app/api/v1/ai.py` — SSE chat endpoint shape (must match frontend parser).
- `frontend/src/services/api/aiApi.ts` + `frontend/src/hooks/useAIChat.ts` — frontend streaming consumer.
- `backend/app/core/config.py` — Pydantic settings (env vars, CORS, rate limit).
