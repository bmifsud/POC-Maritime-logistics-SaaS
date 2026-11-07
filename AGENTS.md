# Agent Instructions & Repository Context (`AGENTS.md`)

## 1. Quick Reference Commands
### Backend (`backend/`)
- **Install / Sync**: `cd backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt`
- **Run Dev Server**: `cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000`
- **Test Suite**: `cd backend && .venv/bin/pytest -q`
- **Lint & Type Check**: `cd backend && .venv/bin/ruff check . && .venv/bin/mypy app`

### Frontend (`frontend/`)
- **Install**: `cd frontend && npm ci`
- **Run Dev Server**: `cd frontend && npm run dev`
- **Build & Type Check**: `cd frontend && npm run build && npm run type-check`
- **Lint & E2E Tests**: `cd frontend && npm run lint && npx playwright test`

### Full-Stack Container Preview
- **Spin Up Preview**: `docker compose up --build -d`
- **Smoke Check**: `curl -fsS http://localhost:8000/api/v1/health`

## 2. Tech Stack & Architectural Boundaries
- **Backend Stack**: Python 3.11+, FastAPI, Pydantic v2, SQLite3 (WAL mode enabled), Pytest, Ruff, Mypy.
- **Frontend Stack**: React 18+, Vite, TypeScript (strict mode), Tailwind CSS (dark slate palette), Lucide icons, Playwright.
- **Optional AI Gateway Compatibility**: If future evaluation scripts invoke LLMs, route requests exclusively via `OMNIROUTE_BASE_URL` (OpenAI-compatible local gateway) configured via environment variables—never hardcode provider URLs or keys.
- **Separation of Concerns**:
  - Keep pure gate-evaluation domain logic (`backend/app/evaluator.py`) strictly decoupled from FastAPI HTTP routes and SQLite persistence.
  - Keep `.adlc/evidence/` file resolution isolated inside a dedicated path-sanitizing reader utility.

## 3. Security & Forbidden Patterns
- **Zero Secrets**: Never commit `.env` files, API tokens, SSH keys, or live credentials. Provide `.env.example` with safe placeholders only.
- **Dependency Firewall**: Pin exact versions in `requirements.txt` and `package-lock.json`. Do not install unapproved packages without explicit human confirmation.
- **Strict File Containment**: Serve evidence logs exclusively as `text/plain; charset=utf-8` after verifying `Path.resolve()` remains strictly inside the `.adlc/evidence/` directory.
- **No Tautological Verification**: Never allow an API payload or manifest field to override `stages.verify` directly; `VERIFY` must always be computed from `required_checks` and verified log presence.

## 4. Autonomous Agent Workflow & Completion Criteria
1. **Explore & Plan First**: Inspect `intent.md` and affected files before editing. State assumptions clearly rather than inventing policy.
2. **TDD First**: Commit or run failing tests covering new behavior and edge cases prior to writing implementation code.
3. **Small Batches**: Keep diffs narrowly scoped to a single task or vertical slice.
4. **Evidence Emission**: Update `.adlc/evidence/manifest.json` and write check outputs to `.adlc/evidence/<check_id>.log` during verification runs.
5. **Handoff Summary**: Before declaring any task complete, provide:
   - Files created or modified.
   - Exact lint, type-check, and test commands executed with pass/fail output.
   - Residual risks or follow-up items for human review.