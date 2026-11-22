# Unified Online Booking Implementation Plan

**Goal:** Implement UB-01–UB-06 in the existing local development composition without opening production transactions.

**Architecture:** Extend the existing online reservation/payment relationship with associated Hall inventory and item allocations. Keep room and Hall lifecycles separate; use one transactional coordinator for hold/proof/confirmation.

**Tech stack:** React/TypeScript/Tailwind, separate Express/TypeScript API, PostgreSQL candidate migrations.

**Spec:** [Unified Online Booking design](../specs/2026-11-21-unified-online-booking-design.md). Owner explicitly selected implementation with up to three subagents and no routine intermediate approvals. No commits or pushes.

## Task ownership and dependencies

1. Backend worker owns `backend/src`, `backend/test`, `packages/shared` and one additive `supabase/migrations` candidate. Define shared quote/hold/detail contracts first; reuse existing proof, confirmation, ledger, Hall operations and authorization. Write focused critical regressions before behavior changes, demonstrate failure, implement, and rerun them. Include atomic rollback, conflicting inventory, proof protection, reference uniqueness, exact allocations, bounded refunds and sibling independence.
2. Guest worker owns planner, guest reservation/payment views, catalog, landing Hall entry, App navigation and related frontend tests. Depends on backend contract. Preserve existing dirty UI, approved design, server pricing and verified ownership. Verify room-only, Hall-only and mixed selection and itemized totals with focused tests.
3. Staff worker owns staff screens, Hall operations, cancellation/change interfaces and related frontend tests. Depends on backend detail/allocation contracts. Show composition and preserve separate operations; use exact peso-to-centavo inputs and AM/PM presentation.
4. Main agent owns affected documentation, local launcher and integration verification. Synchronize UB policy into requirements, decisions, workflow, Hall specification, schema, navigation, technical plan, tracker and context. Check candidate migrations only against disposable local PostgreSQL. Record actual results and remaining gaps. Review in-scope diffs and preserve unrelated files.

## Review focus

- A Hall conflict must leave no room hold or partial reservation.
- Timely proof must protect Hall and rooms after the common deadline.
- Confirmation retries must not duplicate reference, allocations, revenue or notifications.
- Cancelling/starting/changing one item must preserve every sibling's schedule and money.
- Shared payments and item refunds must conserve centavos and avoid duplicate reporting.

## Verification boundary

Use targeted tests and affected type/lint/build checks only as needed. Do not run the formal production gate or repeatedly run comprehensive suites. Do not access hosted services or apply hosted migrations. Do not mark phase/milestone acceptance complete. Finish with a concise UB status/evidence report and local inspection instructions; leave all changes uncommitted.
