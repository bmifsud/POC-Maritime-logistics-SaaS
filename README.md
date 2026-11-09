# Maritime Logistics SaaS — Resilience & QA Proof of Concept

A small, reproducible engineering demonstration for **maritime booking workflows under unreliable connectivity**. It focuses on the operational consequences of offline work, delayed links, booking synchronization, and port-local dates—not on pretending to be a production shipping platform.

> **Scope:** interview portfolio / deterministic prototype. No live carrier or booking-provider integration, no production customer data, and no deployment or maritime certification claim.

## The operational problem

Maritime teams may work across ports, vessels, and remote connections. A transient network loss should not silently lose a booking request, and retries should not create duplicate operations. Time displayed to an operator also needs to match the relevant port's local calendar date.

This repository demonstrates how I approach such problems: define observable acceptance criteria, isolate external dependencies, automate failure scenarios, and preserve test evidence.

## What the demonstration covers

| Scenario | Behavior exercised | Automated evidence |
| --- | --- | --- |
| Offline booking | A synthetic booking remains pending in local browser storage while the test browser is offline | [Booking synchronization test](frontend/tests/maritime/booking-sync.spec.ts) |
| Reconnect and retry | Explicit retry synchronizes the pending record; the mock API returns a single booking after page reload | [Booking synchronization test](frontend/tests/maritime/booking-sync.spec.ts) |
| High-latency link | The sync route incurs a deterministic 650 ms delay; test asserts at least 600 ms | [Maritime fixture](frontend/fixtures/maritimeFixtures.ts) |
| Volatile third party | A provider endpoint is fulfilled with deterministic test data rather than a live network call | [Provider test](frontend/tests/maritime/booking-sync.spec.ts) |
| Port time zones | A fixed UTC instant resolves to the expected Auckland calendar date | [Timezone tests](frontend/tests/maritime/timezone.spec.ts) |
| Evidence and execution | A local, loopback-only dashboard triggers approved tests and makes reports available | [Controller](frontend/support/maritime/controller.mjs) and [operator runbook](docs/maritime-demo.md) |

**Important boundary:** The booking flow is a browser-based reference harness. Offline persistence uses localStorage, not a production-grade durable queue or cross-device synchronization system. Test mocks demonstrate testability, not a real logistics integration. The 650 ms delay does not model packet loss, bandwidth constraints, or full satellite behavior.

## Five-minute interview walkthrough

See **[Interview demo script and fallback plan](docs/interview-demo.md)** for a timed narrative, operator steps, what to say about trade-offs, and honest answers to expected questions.

1. State the problem: keeping booking intent intact through a connection loss.
2. Show a pending synthetic booking while the browser context is offline.
3. Reconnect and trigger explicit retry; verify the booking synchronizes without duplication.
4. Explain the controlled delay, deterministic provider mock, and port-local date.
5. Open the Playwright report, then discuss what would be required before production.

## Reproduce locally

Requirements: supported Linux machine, Python and Node.js/npm matching the project lockfiles, and Playwright Chromium. **Android can control the demonstration via a verified SSH local forward; it is not the required execution environment.** The old Andronix/Debian tablet setup is not required.

```bash
git clone https://github.com/bmifsud/POC-Maritime-logistics-SaaS.git
cd POC-Maritime-logistics-SaaS
npm --prefix frontend ci
cd frontend
npx playwright install --with-deps chromium
npm run demo:preflight
npm run test:maritime:demo
```

The controller dashboard can be run separately from `frontend/` using `npm run demo:controller` and is bound to `127.0.0.1:4400`. See [the operator runbook](docs/maritime-demo.md) for the report, Android tunnel, and shutdown instructions. Do not open the controller to the public internet.

For the underlying application and verification system, see [the original technical README](docs/technical-reference.md). The codebase also contains a separate **ADLC supervision portal** (FastAPI/SQLite, React, deterministic evidence gates). It is supporting engineering infrastructure, not the maritime product itself.

## Verification status and limits

Repository documentation records earlier local runs covering 43 backend tests, 6 portal browser tests, 15 maritime test executions, and controller tests. Those are **historical results**, not a claim that the current HEAD or a new interview machine has passed. Verify the exact revision and host again before presenting.

Still to validate: physical Android plus SSH tunnel, repeatable controller start/stop and checkout cleanup on supported Linux, Docker build, dependency advisory review, and the final automated suite. The [operator runbook](docs/maritime-demo.md) documents observed issues and acceptance gates.

## Engineering decisions

- **Test-first operational scenarios:** executable Playwright cases specify the expected behavior under offline/reconnect, latency and timezone conditions.
- **Reproducible integrations:** external provider responses are mocked, keeping examples safe and deterministic.
- **Transparent evidence:** reports and a deterministic verification system make failures inspectable instead of asserting success.
- **Constrained local control plane:** a loopback-only dashboard with session/CSRF checks invokes a fixed allowed test command; this is not a sandbox for untrusted code.
- **Honest scope:** production would need authenticated APIs, transactional/idempotent server semantics, durable encrypted queues, real network-fault simulation, observability, privacy controls and operational recovery tests.

## Repository map

- `frontend/support/maritime/` — demo page, controller, test selection and branch execution.
- `frontend/tests/maritime/` — booking resilience and timezone cases.
- `frontend/fixtures/maritimeFixtures.ts` — deterministic test setup.
- `docs/maritime-demo.md` — detailed operator runbook, verified history and known issues.
- `docs/interview-demo.md` — concise presentation script.
- `backend/`, `frontend/src/`, `tests/`, `scripts/` — independent ADLC portal and evidence infrastructure.

**Author's objective:** show how I reason about domain-specific reliability, automation, failure handling and verification. This is an engineering portfolio artifact, not a commercial maritime SaaS service.
