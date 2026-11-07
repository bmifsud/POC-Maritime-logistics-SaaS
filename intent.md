# Project Intent: ADLC Supervision Portal ("Progress")

## 1. Problem Statement & Modality Triage
Solo developers orchestrating autonomous coding agents need real-time, verifiable visibility from specification (`intent.md`) to production release without manual Kanban board maintenance or state drift.
- **Modality Triage:** 100% deterministic web application (Python FastAPI backend + SQLite in WAL mode + React/TypeScript/Tailwind CSS UI). Zero LLM API inference is required to render or operate the portal.
- **Data & Privacy Policy:** Read-only ingestion of repository metadata, git commit states, and sanitized verification logs inside `.adlc/evidence/`. Never ingest, store, or display `.env` files, raw credentials, or production PII.

## 2. Bounded Scope & Directory Layout
- `backend/`: FastAPI application, SQLite state index, `intent.md` parser, dynamic verification gate evaluator, and local/webhook sync endpoints.
- `frontend/`: Dark-mode single-page supervision dashboard ("From intent to verified release") featuring the 5-stage task matrix and bottom Evidence Inspector panel.
- `.adlc/evidence/`: Standard artifact directory containing `manifest.json` and plain-text check logs (`*.log`).
- **Out of Scope:** Modifying source code from the browser, storing cloud deployment secrets, or multi-tenant billing.

## 3. Functional Requirements & Acceptance Criteria
- **REQ-01 (Header & Sync Telemetry):**
  - Display workspace brand (`Progress`), connection status pill (`GitHub connected` or `Local repo synced`), `intent.md current` hash match indicator, and relative footer sync timestamp (`Synced X min ago`).
- **REQ-02 (5-Stage Deterministic Pipeline Matrix):**
  - Render each task defined in a monitored repository across five columns (`INTENT`, `PLAN`, `BUILD`, `VERIFY`, `RELEASE`):
    1. `INTENT`: `Ready` (`From intent.md`) when task metadata and required checks are valid; otherwise `Invalid`.
    2. `PLAN`: `Planned` (`Design complete`) when a linked ADR or failing TDD test stub exists; otherwise `Pending` (`Not started`).
    3. `BUILD`: `Built` (`Commit merged` or `Build successful`) on exit code `0`; `Failed` on non-zero build exit; otherwise `Pending` (`Not started`).
    4. `VERIFY`: Dynamically calculated by the backend—**never** self-reported by an agent status flag:
       - `Passed` (`All checks green`) ONLY when `BUILD` is `Built` AND every required check has `"status": "passed"` AND a valid, non-empty log file exists at `log_path`.
       - `Blocked` (`Missing evidence` or `Check failed`) when `BUILD` is `Built` but one or more required checks are missing, failed, or lack a valid log artifact.
       - `Pending` (`Not started`) when `BUILD` has not yet completed.
    5. `RELEASE`: `Released` when promoted via release tag; otherwise `Pending` (`Awaiting release` once built, or `Not started`).
- **REQ-03 (Evidence Inspector Drawer):**
  - Clicking a task row highlights the row and populates the bottom Evidence Inspector card showing:
    - Task title eyebrow, overall verification headline (e.g., `Verification blocked` or `Verification passed`), explanatory subtitle, and an `Inspect <task> evidence` action button.
    - An itemized `Evidence` table with columns `CHECK`, `STATUS`, `DETAILS`, and `LOG` (`Open log ->` when `log_path` exists, or `—` when null/missing).
- **REQ-04 (Safe Log Viewer):**
  - Clicking `Open log ->` fetches and displays the sanitized plain-text log strictly from `.adlc/evidence/` via a path-traversal-safe API endpoint.

## 4. Edge Cases & Security Boundaries
- **Missing Verification Output:** If `BUILD` succeeded (`Built`) but a required check did not run or produced no log file, `VERIFY` must evaluate to `Blocked` (`Missing evidence`), display `"No verification output found. <Check name> did not run or did not produce expected evidence."`, and render `—` in the `LOG` column.
- **Malformed Manifest or Markdown:** Retain the last known valid snapshot, return structured validation diagnostics, and surface a non-crashing sync warning banner in the UI.
- **Path Traversal Prevention:** Reject any `log_path` containing `..`, absolute paths, symlinks escaping `.adlc/evidence/`, or non-log file extensions with HTTP `400`/`403`.

## 5. Initial Monitored Tasks (Seed / Fixture Baseline)
- **Task 1 (`bridge-reconnect`):** Bridge reconnect — Re-establish lost service connection with automatic recovery. Required checks: `connection-retry-test`, `backoff-bounds-check`.
- **Task 2 (`backup-restore`):** Backup restore — Restore data from encrypted backup and validate integrity. Required checks: `encrypted-upload`, `restore-test`.
- **Task 3 (`task-dashboard`):** Task dashboard — Developer dashboard for autonomous task supervision. Required checks: `gate-evaluator-unit`, `portal-ui-e2e`.

## 6. Evidence Manifest Contract (`.adlc/evidence/manifest.json`)
```json
{
  "schema_version": "1.0",
  "repo": "solo-dev/adlc-portal",
  "commit_sha": "a4f892c",
  "intent_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "synced_at": "2026-11-02T08:00:00Z",
  "tasks": [
    {
      "task_id": "backup-restore",
      "title": "Backup restore",
      "summary": "Restore data from encrypted backup and validate integrity.",
      "stages": {
        "intent": { "state": "ready", "subtext": "From intent.md" },
        "plan": { "state": "planned", "subtext": "Design complete", "ref": "backend/tests/test_gate_evaluator.py" },
        "build": { "state": "built", "subtext": "Build successful", "commit": "a4f892c" },
        "release": { "state": "pending", "subtext": "Awaiting release" }
      },
      "required_checks": [
        {
          "check_id": "encrypted-upload",
          "name": "Encrypted upload",
          "description": "Upload encrypted backup to storage",
          "status": "passed",
          "details": "Encrypted file uploaded successfully.",
          "log_path": ".adlc/evidence/encrypted-upload.log"
        },
        {
          "check_id": "restore-test",
          "name": "Restore test",
          "description": "Restore from backup and verify data",
          "status": "missing_evidence",
          "details": "No verification output found. Restore test did not run or did not produce expected evidence.",
          "log_path": null
        }
      ]
    }
  ]
}
```

## 7. Specification Validation Addendum

The existing backend/, frontend/, tests/, scripts/, docs/, and .github/workflows/
boundaries remain authoritative. Root configuration changes are allowed only for
build, dependency, container, and CI integration. No /src, /portal, or /workflows
migration is part of these slices.

### Machine-testable acceptance criteria
- Built tasks pass verification only when every intent-defined check has a passed
  record and a nonempty contained log. Missing records or null logs block verification.
- Unsafe log paths return HTTP 400/403; unknown checks return 404. Successful logs
  return text/plain; charset=utf-8. API failures return JSON with a detail field.
- Invalid manifest/intent input retains a last-valid snapshot with a diagnostics
  array; without a snapshot, missing manifests return 404 and malformed input 422.
- SQLite journal_mode is wal. Cached snapshots never bypass current log validation.
- Playwright tests cover five stage columns, blocked-row selection, evidence details,
  null-log dashes, log opening/closing, refresh, diagnostics, and mobile overflow.
- Every configured gate must exit zero. A failed gate makes the emitter exit nonzero.
- Container build and health/API/frontend smoke checks must pass before release.
  Full test execution inside isolated containers remains an additional acceptance
  target; host test success does not satisfy it.

### Data and environment contract
Task/check identifiers are strings; stages contain state and subtext strings.
required_checks is an array; log_path is a relative string or null. The manifest
contract above remains authoritative. diagnostics is an array of code/message
objects. intent_current is boolean; connection is a display string derived from
the actual data source. No authenticated GitHub connection is assumed.
ADLC_ROOT optionally selects the repository root; ADLC_STATE_DIR optionally selects
SQLite storage. ADLC_PREVIEW_PORT defaults to 8000 for Compose. No secret is required.

### Edge cases and scope
The portal makes no upstream agent calls; exponential agent-call retry and upstream
rate-limit handling are out of scope. Browser request failures retain visible prior
data and present a retryable error. An explicit browser request timeout is not yet
implemented and remains a follow-up acceptance gap. Filesystem/subprocess work runs
in synchronous FastAPI handlers or CLI processes, not asynchronous route handlers.
Do not claim exhaustive absence of unhandled rejections without dedicated tests.

### Progress tracking
- [x] **Intent:** Scope and executable acceptance criteria defined; refinements recorded.
- [x] **Plan:** Architecture and dependency boundaries mapped in AGENTS.md and README.md.
- [x] **Build:** First three slices implemented; container verification remains outstanding.
- [ ] **Verify:** All final gates, container checks, and required remote CI confirmed.
- [ ] **Release:** Reviewed and promoted artifacts; no release has been performed.

References: [AGENTS.md](AGENTS.md), [handoff](docs/HANDOFF.md),
[backend acceptance tests](tests/test_gate_evaluator.py),
[frontend component integration tests](frontend/tests/portal.spec.ts).
