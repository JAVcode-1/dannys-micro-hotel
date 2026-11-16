---
tags: [phases, workflow]
status: planned
---
# Phase 00 — Definition of Ready / Done

This page governs each phase in [[13-development-roadmap]]. **No code has been implemented as part of this ZIP.**

Before Phase 01 F01, review **[[21-before-coding-checklist]]** and record evidence for required local workstation/setup prerequisites. Design choice: [[09-ui-ux-design-system]] is approved.

## Definition of Ready (DoR)

- [ ] Business decision(s) for this work item clearly documented and no contradicting rules.
- [ ] Dependencies from prior phases are implemented and tested, or explicit safe mock/feature flag planned.
- [ ] Endpoint/data schema impact written and reviewed.
- [ ] Happy, negative, concurrent and idempotent test cases chosen.
- [ ] Owner-dependent details either verified or blocked behind configuration/feature flag.

## Definition of Done (DoD)

- [ ] Source written and reviewed in correct application area.
- [ ] Schema migration checked and rollback/recovery understood.
- [ ] Automated relevant tests green with **evidence**.
- [ ] Authorization, logs, money/time integrity reviewed.
- [ ] Demo scenario run against seeded staging/test data.
- [ ] Documentation, decision log, milestone table updated.
- [ ] Explicit list of anything unfinished (do not quietly call MVP complete).

## Task template

```markdown
### Task ID — Short title
Status: Not started / In progress / Blocked / Done
Dependencies: ...
- [ ] Implementation step
- [ ] Integration/unit/E2E test
- [ ] Documentation + decision update
Acceptance: Given ..., when ..., then ...
Evidence: PR/commit + test command/output + screenshot or log
```

## Phase review questions

Can a new developer reproduce it? Can it survive concurrent users, retry, page refresh, a failed email and a role mismatch? Would a hotel guest or front desk employee see a misleading 'Confirmed' or 'Paid' label? Is recovery documented?
