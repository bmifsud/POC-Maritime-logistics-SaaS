# ADLC Supervision Portal

## Current state and capabilities

Reviewed 2026-11-02 against the default branch `main` (source tree `231b14b13bcd51f235ba6f04c488ec4bcfaab9b9`). This is a source/documentation review; no application, device, external API or test suite was executed for this README update.

Reusable starting repository based on the ADLC supervision portal.

Includes the deterministic FastAPI/SQLite evaluator, React UI, intent/evidence scaffolding, emitter, tests and container/CI configuration.

Source entry points: [intent.md](intent.md) · [scripts/emit_evidence.py](scripts/emit_evidence.py).

**Verification:** Latest workflow observed: [success](https://github.com/bmifsud/ADLC-template/actions/runs/41443529586) at commit `231b14b13bcd51f235ba6f04c488ec4bcfaab9b9` on `main`. This result applies to that run's scope, not all capabilities.

**Limitations / pending validation:** Template adoption still requires repository-specific intent, evidence, configuration and branch protection. Inherited portal examples do not prove another project's acceptance gates.

FastAPI/Pydantic, SQLite WAL, React/TypeScript/Vite/Tailwind, and deterministic
execution evidence for the first three vertical slices. Original AGENTS.md,
PROMPT.md and intent.md are preserved. The supplied screenshot is stored at
`docs/portal-mockup.png`.

## Run and verify

```sh
python -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.lock
npm --prefix frontend ci
cd frontend
npx playwright install --with-deps chromium
cd ..
backend/.venv/bin/python scripts/emit_evidence.py
```

The emitter runs Ruff, mypy, pytest, frontend lint/type-check, Playwright component
integration tests, production build, and source secret scanning. Its exit code is
nonzero when any check fails. It records sanitized logs, commands, exit codes, log
hashes, full commit SHA when available, and the intent hash. Unique run directories
avoid stale-log reuse; atomic manifest replacement avoids partial reads. Historical
runs are retained for diagnosis. Only the emitter writes repository evidence.

Backend development: `cd backend && .venv/bin/uvicorn app.main:app --port 8001`.
Frontend development: `npm --prefix frontend run dev -- --port 4173` (API proxy: 8001).
Tests: `backend/.venv/bin/pytest -q`; `npm --prefix frontend run test:components`.
The latter starts its own isolated Vite server on port 4180 and mocks the API.

For the session's custom Chromium location, prefix Playwright/emitter commands with
`PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright`. Standard installations
use Playwright's normal browser directory.

## Container preview

```sh
docker compose up --build -d --wait
curl --fail http://localhost:8000/api/v1/health
```

FastAPI serves the built frontend and API together. Evidence is a read-only bind
mount; SQLite uses a separate writable volume with WAL enabled. The service runs as
UID 10001 with a read-only root filesystem and no added capabilities. Set
`ADLC_PREVIEW_PORT=8002` if port 8000 is already used.

Base images are pinned to immutable digests. Python direct/transitive versions are
pinned in `backend/requirements.lock`; npm uses package-lock.json. On a managed
proxy requiring custom CA trust, build with:

```sh
BUILDX_CONFIG=/tmp/adlc-buildx docker build \
  --secret id=proxy_ca,src=/etc/ssl/certs/ca-certificates.crt -t adlc-portal:local .
ADLC_PREVIEW_PORT=8002 docker compose up --no-build -d --wait
```

The CA is mounted only during dependency installation and is not copied into layers.
TLS verification stays enabled. Do not use session-specific paths in ordinary CI.

## Architecture and API

- `intent_parser.py`: strict explicit task/check definitions from intent Markdown.
- `evidence_reader.py`: dedicated containment and extension validation; rejects `..`,
  absolute paths and escaping symlinks before serving logs.
- `evaluator.py`: pure task policy, independent of HTTP and SQLite. Expected checks
  come from intent, so missing manifest records cannot manufacture a pass. All disk
  logs are rechecked, including when using a last-valid snapshot.
- `store.py`: persistent WAL snapshot index. Invalid manifest/Markdown responses
  retain the last valid snapshot and include structured diagnostics.
- `/api/v1/portal/status`: computed task stages; `/api/v1/portal/logs/{check_id}`:
  sanitized `text/plain; charset=utf-8`; `/api/v1/health`: process health.

Only the portal task's real verification checks are implemented. Bridge reconnect
and backup/restore remain pending; no execution or success is fabricated for them.
The UI renders GitHub connected only if the API reports it; the local backend
reports Local repo synced. Screenshot tests inject fixture telemetry deliberately.

## CI and merge protection

`.github/workflows/ci.yml` uses `contents: read`, pinned action commits, source secret
scanning, the emitter, and a container smoke check. Any failed command fails the job.
It never uses pull_request_target or exposes write tokens to pull request code.

A maintainer must enable a GitHub branch ruleset requiring **Required verification**
before merging, and prevent bypasses/workflow changes without independent review.
The workflow alone cannot enforce branch protection; that repository setting has
not been changed by this work. The local scanner is pattern-based and best effort,
not a complete secret-detection service. Local hashes and AGENTS.md do not prevent
an actor who can edit the verifier and all artifacts from forging evidence. Protected,
independently controlled CI is required for adversarial-agent assurance.

## Handoff

See `docs/HANDOFF.md` for commands, TDD evidence, changed paths and residual risks.

## CI tests and dependency inventory

From frontend/, run `npm run test:ci` (Playwright with focused tests forbidden).
Run `npm run bom` to generate the repository-root `.adlc/evidence/aibom.json`
using the pinned CycloneDX npm generator, JSON format, specification version 1.7.
Equivalent command from frontend/:

```sh
npx --no-install @cyclonedx/cyclonedx-npm --spec-version 1.7 --output-file ../.adlc/evidence/aibom.json
```

Both commands are executed by the evidence emitter in local verification and CI.
CI uploads the BOM with the evidence artifact; generated evidence is not committed.
The file inventories npm dependencies, including development dependencies, and does
not inventory Python packages, models, training data, or AI services. Its filename
does not make it a complete AI bill of materials.

Render review services may set `ADLC_PREVIEW_MODE=1` to show intent-defined pending
tasks when no evidence manifest has been supplied. This read-only empty state does
not write a manifest or claim checks passed. Normal mode retains HTTP 404 for a
missing manifest. SQLite state on a free review instance is ephemeral.

## Maritime resilience interview demo

An additive local Playwright demonstration now covers persistent offline bookings, explicit reconnect/retry with 650 ms satellite-style latency, deterministic provider mocking and port-local dates. Android Chrome controls a loopback Linux dashboard through an independently established SSH tunnel; GitHub Actions is not required. See [the operator runbook](docs/maritime-demo.md) for startup, verified results, limitations and acceptance checks. This reference harness is not a production maritime integration.
