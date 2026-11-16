---
tags: [roadmap, build-order]
status: planned
---
# 13 — Phase-by-Phase Development Roadmap

> [!important] BUILD ORDER
> **Start with [[21-before-coding-checklist]] to prepare the workstation and repo; then choose a single unchecked task from the current phase.** Finish the task's acceptance tests and document outcome; then continue. All phases below are **not started** in this docs-only handoff.

## Project milestones

| Phase | Deliverable | Depends on | Exit gate |
|---|---|---|---|
| 01 | Repository + dev environment | Spec baseline | API/web boot, test DB migration, CI smoke check |
| 02 | Staff identity and guest OTP | 01 | Individual staff credentials + authorization tests |
| 03 | Hotel catalog and operational inventory | 01, 02 | 15 real room entities and allowed package catalog; settings audited |
| 04 | Transactional availability and holds | 03 | High-concurrency and interval/maintenance tests green |
| 05 | Online guest booking + GCash proof workflow | 02, 04 | No booking before manual approval; hold/proof deadlines correct |
| 06 | Walk-in, room assignment, stay monitoring | 03–05 | Deposit, actual check-in, checkout alerts, readiness tests |
| 07 | Reschedule, cancel, refund, extensions | 05–06 | Independent item changes and financial ledger invariant tests |
| 08 | Housekeeping, maintenance, reports; **optional verified guest reviews + private feedback** | 03–07 | Operational queues and reports verified; reviews have a **separate activation gate** with security, fairness and checkout-based eligibility tests |
| 09 | Hardening, pilot, production release | 01–08 | Security signoff, restore/reconciliation drill, end-to-end UAT |

### Suggested priority

- **First demonstrable milestone:** staff login + catalog of the actual seven supported packages + 15 rooms.
- **First technically critical milestone:** real inventory allocation/holds with double-booking protection (Phase 04). Build this *before* online payment UI.
- **First usable guest booking:** Phase 05, after payment review is implemented.
- **First usable front desk:** Phase 06, after payment ledger and physical assignment.
- **Guest reviews are a later enhancement:** Phase 08 after real checkout and verified guest/contact access exist; public visitors may read reviews without booking. Do not let this postpone Phase 01/F01 or invent completion dates. See [[24-verified-guest-reviews]].

## Step 0 — Pre-coding readiness

Complete required PC-01 to PC-04 checks in [[21-before-coding-checklist]]. Owner-only information can remain pending until the matching phase or pilot (see [[18-backlog]]). **Theme Royal Horizon is approved**, but no application code is claimed by this documentation package.

## Standard workflow for one task

1. Open its phase page and check prerequisites.
2. Write expected behavior, boundary conditions and tests (references to [[15-testing-plan]]).
3. Implement one vertical slice; run DB migration and unit/integration/E2E tests as applicable.
4. Test concurrency/failure paths, not only happy path.
5. Update progress in [[14-milestones]], adjust [[17-decisions]] if the approved behavior changes, and save an ICM memory after docs are updated.
6. Commit only after tests and documentation match behavior. Begin the next task.

## Versioning and change control

- Business decisions in [[17-decisions]] are stable but not frozen against explicit owner revision. Changing one requires an ADR and downstream impact review.
- Unverified items in [[18-backlog]] must be resolved or deliberately feature-gated before exposing their workflows to paying customers.
- Documentation and code are **separate truth types**: approved behaviors in docs, implemented behavior verified by tests.

## Detailed phase pages

[[phases/00-phase-gates]] · [[phases/01-foundation-and-tooling]] · [[phases/02-auth-and-authorization]] · [[phases/03-catalog-inventory-settings]] · [[phases/04-availability-and-holds]] · [[phases/05-online-booking-and-gcash]] · [[phases/06-walkins-and-stay-monitoring]] · [[phases/07-changes-refunds-and-ledger]] · [[phases/08-housekeeping-maintenance-and-reporting]] · [[phases/09-hardening-pilot-and-release]]

## Supabase integration gate (D-035)

- **Phase 01 F01:** React + Express foundation only; Supabase project not required for F01.
- **Phase 01 F02:** Supabase development project or local stack, CLI SQL migrations, safe backend Postgres connectivity.
- **Phase 02:** Recommended Supabase Auth sign-in, guest OTP and real server-side staff authorization.
- **Phase 03–05:** Category inventory then private proof Storage; availability remains a SQL-transaction problem, never a browser-side read/insert sequence.
- **Phase 09:** Deploy React and Express independently; validate Supabase region, quotas, security, backups and restore before production.

Detailed step-by-step instructions: [[22-supabase-setup]].
