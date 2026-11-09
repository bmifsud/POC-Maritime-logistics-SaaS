# Five-minute maritime engineering interview demo

**Purpose:** demonstrate domain-aware engineering and test discipline, not assert production readiness. The booking and provider are synthetic.

## Before the interview (separate from the five minutes)

Use a supported Linux machine, not the retired Andronix/Debian tablet environment. Pin and install repository lockfile dependencies in advance. From `frontend/`, execute `npm ci`, `npx playwright install --with-deps chromium`, `npm run demo:preflight`, then `npm run test:maritime:demo`. Verify exit status and inspect the generated report. Repeat on the exact commit and hardware planned for the interview. Do not assume tests pass based on prior documentation.

For an Android-controlled live run, start `npm run demo:controller` on Linux and establish a **key-authenticated, host-key-verified** SSH tunnel to port 4400 (local Android forward 14400). See [the full runbook](maritime-demo.md). Test physical-device portrait/landscape, tunnel loss/reconnect and shutdown before claiming Android support. The controller is not a remote public service.

Prepare a **clearly labelled prerecorded walkthrough** or screenshots, plus the latest test-report output, in case the live browser/tunnel fails. Keep credentials, cookies, and raw traces private.

## Live narrative — target five minutes

| Time | Demonstrate | Suggested explanation |
| --- | --- | --- |
| 0:00–0:40 | Introduce the **Maritime Booking Console** and a sample vessel/port | “A port-side operator can lose connectivity mid-booking. My test asks what survives and how we detect success or duplication.” |
| 0:40–1:35 | Run the offline booking scenario and observe **Pending sync** | “The request is retained locally during the controlled outage. This is a prototype using localStorage, not production offline storage.” |
| 1:35–2:30 | Reconnect and select **Retry synchronization**; check **Synced**, reload, and single-record assertion | “I test recovery explicitly, including no duplicate result in the mocked API. In production I would require server-enforced idempotency keys and durable transactional storage.” |
| 2:30–3:20 | Point to the 650 ms simulated sync delay and mocked provider boundary | “The delay is reproducible and the provider is fully mocked. It models a slow response, **not** satellite bandwidth, loss or a real carrier integration.” |
| 3:20–4:00 | Show fixed UTC time rendered as **Sunday, 8 November 2026** at Auckland | “Port-local dates need explicit time-zone handling; a UTC date alone can be misleading for operators.” |
| 4:00–5:00 | Open Playwright results and summarize failure modes/next steps | “Automated evidence makes failures reviewable. Before production, I'd add realistic fault models, encrypted durable storage, auth, idempotency, monitoring and field validation.” |

The controller's **Run maritime demo** executes a fixed suite; for a concise walkthrough, narrate the test evidence or recorded scenario rather than implying that Android Chrome itself executes Playwright. Browser execution occurs on the Linux host.

## Interview questions to be ready for

**Why Playwright?** Browser-level acceptance tests exercise user-visible state and requests together. Smaller component and unit tests complement—not replace—the end-to-end scenario.

**What stops duplicate bookings?** The current mock returns one record in a deterministic test. A real system needs unique operation identifiers, API idempotency and server-side transactions; the current demonstration does **not** prove that.

**What if the app closes or the device is lost?** localStorage is only a prototype-level persistence mechanism. A production design needs a durable/encrypted queue and recovery policy, plus explicit synchronization/conflict rules.

**How realistic is the satellite simulation?** It imposes a 650 ms response delay. It does not reproduce jitter, packet loss, asymmetric bandwidth or extended offline windows. Those need a network-fault test layer and real operational validation.

**How do you demonstrate business value?** Fewer lost requests and fewer accidental duplicates are desirable hypotheses; no real customer metrics or quantified savings are established by this proof of concept.

**What else is in the repo?** The evidence/portal components show a broader approach to supervised automation and verification, but are distinct from the maritime booking demo.

## Honest go/no-go checklist

- [ ] Exact commit's Python, TypeScript and browser test gates pass on interview host.
- [ ] Playwright Chromium launch and demo preflight pass.
- [ ] Controller starts, exits and cleans up reliably on supported Linux.
- [ ] Offline/pending/retry/single-record assertions are visibly reproduced.
- [ ] Date/time and provider mock are accurately explained.
- [ ] Physical Android + SSH tunnel validated **if** used.
- [ ] Docker validation completed **if** claimed.
- [ ] Security dependency findings reviewed.
- [ ] Fallback demo prepared, explicitly labelled as a recording.
- [ ] No live credentials, customer data or misleading production claims.

See [maritime operator runbook](maritime-demo.md) for the existing historical test evidence and unresolved limitations.
