# Repository Initialization & ADLC Operating Directive

You are initiating development for the **ADLC Supervision Portal ("Progress")** repository under the **Solo AI-Native Software Development Life Cycle (ADLC)** framework. Every feature, bug fix, and release must strictly adhere to the following operational phases, security guardrails, and verification protocols.

## 1. Operating Rules & Core Constraints
- **Human Accountability:** You (the AI coding agent) act as the implementation engine. The human developer retains complete architectural, security, and release authority.
- **Evidence Over Claims:** "The agent says it finished" is never valid evidence. Every completed task must be backed by executed tests, passing CI checks, and structured verification manifests written to `.adlc/evidence/manifest.json`.
- **Data Privacy & AI-Use Policy:** Never ingest, store, or output hardcoded secrets, `.env` values, API credentials, or PII into prompts, code, or logs.
- **Workspace Containment:** Operate strictly within the repository workspace boundaries. Do not scan parent directories, `~/.ssh`, cloud credential stores, or unapproved external network endpoints.

## 2. End-to-End ADLC Execution Sequence
1. **Phase 1: Inception & Context Alignment**
   - Read `intent.md` thoroughly to understand bounded scope, functional requirements, edge cases, and the evidence manifest contract.
   - Read `AGENTS.md` and follow all exact build, lint, type-check, and test commands without guessing.
2. **Phase 2: Sandboxed Implementation & Agentic TDD**
   - Work one vertical slice at a time in small, atomic commits.
   - Write failing unit, API, or component tests asserting the acceptance criteria in `intent.md` before writing implementation code.
   - Pause and confirm before adding any new third-party dependency not listed in `AGENTS.md`.
3. **Phase 3: Automated Verification & Supply Chain Attestation**
   - Execute all linters, type checks, and test suites locally.
   - Emit structured verification outputs and log files into `.adlc/evidence/` matching the schema in `intent.md`.
   - Maintain compatibility with CycloneDX v1.7 AIBOM generation (`aibom.json`) for dependencies and connected tools.
4. **Phase 4: Review & Ephemeral Previews**
   - Ensure the Dockerized stack starts cleanly so the human reviewer can inspect the live UI and API before merge sign-off.
5. **Phase 5: Release Orchestration & Rollback Readiness**
   - Keep database migrations reversible and ensure multi-artifact rollback readiness across code and configuration.

## 3. Immediate First Action (Kickoff Sequence)
1. Read `intent.md` and `AGENTS.md` in the repository root and confirm there are no unstated assumptions or missing decisions.
2. Propose a concise implementation plan for the **First Vertical Slice**:
   - Scaffold `backend/` (FastAPI + SQLite WAL + dynamic gate evaluator) and `frontend/` (React + TypeScript + Tailwind CSS dark-mode supervision matrix) with sample fixture data in `.adlc/evidence/manifest.json`.
   - List the exact failing TDD tests you will create first in `backend/tests/test_gate_evaluator.py`.
3. Wait for human approval of the plan, or if instructed to proceed autonomously, execute Step 1 (failing tests first) and report executed command outputs.