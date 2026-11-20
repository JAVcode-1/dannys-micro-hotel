# Function Hall Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans and superpowers:test-driven-development. Execute natively and obtain one final independent review before the development checkpoint.

**Goal:** Deliver staff-managed Function Hall reservations, verified payments, event operations and separate reports behind closed activation gates.

**Architecture:** React uses the existing Royal Horizon shells. Express authorizes and orchestrates hall commands, and PostgreSQL protects exclusive scheduling, financial integrity and immutable history. The only cross-module financial write dependency is the private GCash reference registry.

**Tech stack:** React, TypeScript, Tailwind, Express, pg and Supabase-managed PostgreSQL.

**Spec:** [Approved Function Hall specification](../specs/2026-11-20-function-hall-design.md).

## Execution rules

- Preserve all 13 decisions and nine safeguards in the approved spec. Use Manila calendar rules, UTC instants, AM/PM display, integer centavos and audited immutable revisions.
- Keep hall and accommodation reservations, claims, readiness, finances and reports separate. Reuse authorization, interface and transaction patterns.
- Use synthetic fixtures in disposable loopback PostgreSQL. Keep hosted Supabase untouched, candidate migrations unapplied there, and live transaction, H04 and hall activation gates closed. Preserve deployment blockers. Leave UI Refinement, hotel photographs and official GCash QR outside this work.
- In each stage, write focused failing tests, observe the intended failure, implement, and rerun the same tests. Run backend focused files after `npm run build -w backend`, frontend tests with `npm test -w frontend`, and PostgreSQL cases through `npm run test:db` with the existing isolated harness. Add new integration cases to `backend/test/zz-v02.integration.mjs`.
- Use separate hall migrations by write boundary in stages 1–3, with versions assigned from the next unused version when execution begins. Stage 4 starts with read queries. Treat any schema additions for reports as evidence-driven.

## Review focus

- Concurrent claims across both configurations, including overlap caused only by buffers.
- Cash committed before a stale or losing schedule action, and one GCash receipt attempted in both modules.
- Refund completion racing with event start, including refunds approved before start.
- Physical overrun or pending cleanup despite a free-looking scheduled interval.
- Revisions, configuration changes and reporting boundaries that could alter historical money or claims.

## Stage 1 — Scheduling and pricing

**Files:** Add the hall scheduling migration, `backend/src/hall-scheduling.ts`, `backend/test/hall-scheduling.test.mjs`, `backend/test/hall-scheduling-postgres.mjs`, and `packages/shared/src/function-hall.ts`. Export shared types from `packages/shared/src/index.ts`.

- [ ] Write quote fixtures for exact 5:00 PM, pre-8:00 AM, same-day and midnight boundaries, setup limits, three-hour minimum, and full-hour add-ons. Assert 4:00 PM–8:00 PM is 400,000 centavos and 5:00 PM–8:00 PM is 500,000 centavos. Cover the 90th Manila calendar day, the minimum-notice boundary, and an audited override for a future-day booking that still satisfies preparation.
- [ ] Implement `quoteHall(input, settings, now)`. Accept setup, attendee count, schedule and optional notice reason. Return event and protected instants, duration, integer-centavo line amounts and the rules used. Validate server-side against guest operating hours, a same-day event, and valid preparation. Opening before 8:00 AM does not add a priced window. Defaults are 8:00 AM–10:00 PM, three hours of notice, 90 calendar days and 30 minutes for each buffer.
- [ ] Add private hall resource, configuration revisions and active schedule claims. Test the GiST exclusion constraint using direct competing inserts for both setups. A 2:00 PM–5:00 PM event with 30-minute buffers protects 1:30 PM–5:30 PM. A next event at 5:59 PM conflicts and 6:00 PM touches the boundary. Assert overlapping protected intervals fail at the database independently of API validation.
- [ ] Add active-staff settings reads and audited updates behind the hall test gate. Verify invalid settings fail, policy revisions use database timestamps, and changes do not retroactively alter existing claim snapshots. Run focused quote and isolated scheduling tests.

## Stage 2 — Reservations and payments

**Files:** Add the hall reservation and payment migration, `backend/src/hall-reservations.ts`, `backend/src/hall-payments.ts`, `backend/src/hall-routes.ts`, `backend/test/hall-reservations.test.mjs` and `backend/test/hall-payments-postgres.mjs`. Update `backend/src/app.ts`, staff navigation in `frontend/src/StaffLogin.tsx` and routing in `frontend/src/App.tsx`. Add `frontend/src/HallReservations.tsx` and `frontend/src/HallInformation.tsx`.

- [ ] Test walk-in, telephone and Messenger intake against the same resource. Record organizer data privately and keep the public information page read-only. Show both setups, confirmed prices and inclusions, and approved inquiry channels. Record extra requests for manual follow-up with no automatic charge or guarantee.
- [ ] Add inquiries, immutable receipts and pricing revisions, receipt verification metadata, resolution flags, and actor-scoped idempotency records. The shared registry gains a unique hall receipt foreign key while preserving its global normalized reference key and exactly-one-source constraint. Register hall GCash receipts in the same transaction as the receipt. Preserve existing accommodation registry paths. Test normalized duplicate references in both module directions, concurrent inserts, and rollback of the losing receipt. Cash records use their own receipt IDs and idempotency keys.
- [ ] Implement `recordHallReceipt` independently of `confirmHallReservation`. Store actual cash or verified GCash and immutable evidence fields. Confirmation locks and revalidates the hall claim and reservation, checks at least half the quoted total in verified net payments, and commits the confirmed state, claim, revision and audit together. Use a consistent hall-resource-before-reservation lock order when both are needed. An expected conflict or failed validation keeps the receipt and records a resolution flag. Use a savepoint for a caught claim-constraint conflict before recording the flag.
- [ ] Prove a 500,000-centavo event stays unconfirmed at 249,999 centavos and can confirm at 250,000. Test mixed tender, competing fully funded inquiries, idempotent replay, changed-payload conflicts and unauthorized writes. The losing funded inquiry retains its receipts and has no claim. Wire the staff calendar, reservation and payment screens through gated Express routes and run focused API and UI tests.

## Stage 3 — Event operations

**Files:** Add the lifecycle, readiness and refund migration, `backend/src/hall-operations.ts`, `backend/src/hall-refunds.ts`, `backend/test/hall-operations-postgres.mjs`, `backend/test/hall-operations.test.mjs` and `frontend/src/HallEventDesk.tsx`. Extend the shared contract and hall route registration.

- [ ] Write transition tests from the spec. Cover cancelled and no-show starts, completed extensions, concurrent starts, partial payment, a completed refund reducing net payment, and an occupied, unclean or unready hall. Verify the start check runs in Express and the same transaction as the lifecycle and occupancy writes.
- [ ] Implement `startHallEvent`, `completeHallEvent`, `markHallReady` and audited no-show actions. Serialize occupancy, readiness and starts at the resource. Keep the countdown anchored to the scheduled end, add configurable reminders and overdue alerts, and flag an overrun during the next preparation window. Preserve booked claims on early completion or a no-show. Require reason, grace-period evidence and staff confirmation for no-show, with a separate audited early release conditional on readiness.
- [ ] Test rescheduling and extension failures with received money and an existing claim. Implement `rescheduleHallEvent` before both scheduled and actual start. Validate the new slot, record the reason, reprice, require 50% net funding and atomically replace the claim. Implement `extendHallEvent` before the current scheduled end for confirmed or in-progress events. Add whole hours to the scheduled end, retain the booked base, require full revised net payment and validate the revised cleanup interval. Test a 4:00 PM to 5:00 PM move across the price boundary and an extension blocked solely by the next preparation buffer. Failed moves preserve history, payments and the original claim.
- [ ] Test cancellation and manual refund approval, including simultaneous approvals and completion racing with start. Implement `cancelHallReservation`, `approveHallRefund` and `completeHallRefund` with mandatory audit reasons and verified transfer evidence. Completed refunds plus remaining approved amounts cannot exceed verified collections. A completed refund immediately affects net funding. An approval does not create a cash outflow. Keep no-refund resolutions and original receipts. Add manual overtime review with an audited charge where approved, without automatic partial-hour pricing or claim changes.
- [ ] Wire the event desk with the signed-in staff shell. Show total, verified net payment, balance, lifecycle, readiness and countdown. Run focused tests for status and stale revisions, API authorization, failed-schedule preservation, refund races and countdown expiry without completion.

## Stage 4 — Reporting and acceptance

**Files:** Add `backend/src/hall-reports.ts`, `backend/test/hall-reports.test.mjs`, `backend/test/hall-reports-postgres.mjs` and `frontend/src/HallReports.tsx`. Update `docs/14-milestones.md`, `docs/17-decisions.md`, `docs/icm/PROJECT-CONTEXT.md` and the Function Hall requirements with actual evidence.

- [ ] Write hand-calculated fixtures for previous-period deposits, completed refunds in a later Manila period, unresolved payments, and overruns without approved extensions. For 500,000 centavos collected on one day and 150,000 refunded on the next, assert each day's cash events and combined Net Collections of 350,000. Assert that event time, preparation and cleanup are separately represented and that hall transactions produce no change in H03-B totals or room availability.
- [ ] Implement a staff-authorized, read-only hall report projection from hall tables in one consistent database snapshot. Apply Manila date filters. Report gross verified collections, completed refunds and Net Collections, with booking and utilization projections derived from their corresponding facts. Reuse existing date range and report UI patterns where applicable. Omit guest and payment identifiers from aggregate views. Verify report reconciliation against independent SQL totals and ensure ordinary registration leaves all hall writes disabled.
- [ ] Run build, typecheck, lint, formatting, complete application and isolated PostgreSQL suites. Verify live gates stayed closed and the isolated database ran every hall migration and test. Test through the normal Express and React entry points using synthetic data. Record provisional defaults, staff access, owner signoff and pilot requirements as pending where applicable.
- [ ] Obtain one independent read-only review covering scheduling races, global receipt identity, payment preservation, refund/start concurrency, staff authorization and accommodation isolation. Fix confirmed critical or major findings and rerun checks. Apply the repository's executable full milestone gate before marking a major milestone or predeployment gate Done.
- [ ] Update canonical notes, review the in-scope diff and explicit staged paths, and run the staged secret scan. After implementation approval and successful checkpoint verification, commit to current `main`, push to existing `origin`, and verify the remote ref. Stop at the Function Hall development checkpoint with production activation closed.
