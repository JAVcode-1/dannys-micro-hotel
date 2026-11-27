# Unified Online Booking - implementation and requirements synchronization

Owner request: 2026-11-21. Final targeted verification: 2026-11-22 (Asia/Manila). **Implemented for local development review; comprehensive acceptance and production gates remain open.** This replaces the earlier requirements-only report. UB-01 through UB-06 resolve its mixed-payment, hold, confirmation, cancellation and change questions. The owner explicitly requested no commit or push before inspection.

## Approved policies

| Decision | Approved behavior |
|---|---|
| UB-01 | 100% upfront for every online reservation. Staff-managed Hall minimum 50% deposit remains. |
| UB-02 | One full GCash transaction and private receipt screenshot. Staff verify the transaction and record its unique ledger reference. Item allocations separate room and Hall finances. |
| UB-03 | All selected services must be available; claim all inventory atomically. One 30-minute proof deadline. Timely proof protects every item until staff resolution; otherwise expire all holds together. Paid-late reconciliation remains manual. |
| UB-04 | Staff verify actual full payment and atomically confirm every item. Persist directly in staff management, protect inventory, generate one itemized confirmation and enqueue email. Review target 15 minutes; escalation 30/60 minutes. |
| UB-05 | Independent item cancellation before confirmation plus one hour and before actual room check-in/Hall event start. Release only cancelled capacity. Eligible GCash refunds are manual, itemized, idempotent and capped. |
| UB-06 | Independent staff-approved rescheduling/extensions with availability protection. Room extensions retain at least 50% upfront; Hall additional cost requires 100%. Preserve siblings and financial history. |

## Workflow and architecture

Select rooms, one Hall or both -> independent schedules, attendees/occupants and requests -> server quote and availability -> verified guest ownership/contact/policy review -> atomic common hold -> full GCash payment and private receipt upload -> protected staff review -> actual ledger verification and atomic confirmation -> staff room/Hall operations and one itemized notification.

The Hall has Theater Type (70 attendees) or Room Type (50), alternative configurations of one exclusive resource. Bedroom capacity remains 10 Double Standard and 5 Family Executive. Existing Hall hours, notice, buffers, full-hour pricing and staff operations remain separate from room inventory/readiness. Prices and UTC instants are server-authoritative. Ordinary financial inputs use pesos and convert exactly to integer centavos; schedules display Manila AM/PM.

Reuse reservations, payment_submissions, verified_online_payments and the global GCash reference registry. Add online_hall_items linking an existing Hall reservation to the parent and online_payment_allocations referencing the single verified original payment. Do not copy the original transaction into Hall receipts. Additional Hall receipts remain separate verified collections. Parent statements include Hall additions/cancellation/refunds; room analytics and Hall reports consume their respective shares. Unified operations lock the exclusive Hall resource before shared reservation/category/claim work; room-only hold creation preserves its existing category path, while proof/review coordination takes the Hall lock when the unified schema is installed.

Candidate migrations, **unapplied to hosted Supabase**:

- 20261121002700_unified_online_booking.sql: association, allocations and shared hold/payment invariants.
- 20261121002800_unified_financial_projections.sql: combined financial statement without duplicate original collections.

The approved design and execution plan are [design](superpowers/specs/2026-11-21-unified-online-booking-design.md) and [plan](superpowers/plans/2026-11-21-unified-online-booking.md). Implementation limitations remain explicit below; policy approval alone is not acceptance.

## Pages and affected files

No package dependency was added. Existing lockfile, editor/Obsidian settings, prototype/nested-workspace and asset changes from before this task are preserved and excluded from the task manifest below.

Guest: planner, reservation history/details, payment/proof, room rates, landing Hall section, Hall information/setup entry and shared navigation. Staff: composition badges/details, payment review, Hall calendar/operations, existing independent room assignment/check-in/cancellation/change flows, peso inputs and AM/PM controls. The existing capability-gated Hall sidebar is reused.

Backend: guest booking/quote/availability registration, unified transaction coordinator, proof/session handling, staff confirmation, hold expiration/reminders, reservation workspace, Hall operations, analytics data and Hall reporting. Shared contracts expose optional Hall selections/items, service composition and payment allocations while preserving existing callers.

Documentation: requirements, feature workflow, architecture, schema, API plan, navigation, roadmap, Phase 05/07 notes, Hall specification, decisions, backlog, milestones, project context and isolated-development instructions. Historical dated checkpoints remain historical; current UB policies supersede their staff-only/pending-policy statements.

## Local inspection and essential evidence

Run npm run dev:isolated for a fresh loopback-only disposable database and fixture frontend/API. It never reads backend/.env; synthetic Auth, private in-memory images and fake mailbox prevent real payment/email/provider access. Configure a synthetic QR/payee in staff Settings, use guest OTP 123456 for guest@example.test, and staff staff@example.test / development-only. Keep rooms under explicit staff readiness inspection and use the Hall Ready operation before event start. Full instructions: [isolated development](isolated-development.md).

Targeted database runner: node scripts/verify-unified-booking.mjs after compiling backend/shared. It uses already-installed embedded PostgreSQL, applies candidates only to disposable loopback staytrack_test, and exercises unified regressions. Missing local tooling is an error; never fall back to hosted PostgreSQL. Its generated schema artifact is under ignored .quality/unified-booking/.

**Essential results observed:**

- Backend compilation, root npm run typecheck and npm run lint passed. The targeted runner script also passed ESLint.
- 32 focused backend tests passed with zero failures/skips: unified booking, payment review/storage/media/rollback, booking quote, guest routes, claim lifecycle, Hall payments, notifications, workspace and analytics.
- node scripts/verify-unified-booking.mjs passed against a new disposable PostgreSQL instance: all 28 local migrations, mixed/Hall-only holds, exclusivity contention, initial conflict/audit rollback, verified ownership/active staff/full amount, timely-proof protection, atomic/idempotent confirmation, one original receipt and allocation conservation, independent cancellation/manual refund, Hall-only expiry and independence from room cleaning configuration, Hall request/reschedule, 0%/50%/100% extension funding, reduced-price surplus approval caps/manual payout and subsequent eligible cancellation. Parent statements, separate revenue and local HTTP readiness/history/private allocation/authorization assertions passed.
- packages/shared/src/database.types.ts was regenerated from that successful disposable catalog, with 101 additive lines; no hosted type-generation command ran.
- Frontend production bundle passed after an initial sandbox EPERM was resolved with permission for the local esbuild subprocess. Existing bundle-size warning remains (about 729 kB uncompressed JavaScript); no deployment occurred.
- 44 distinct targeted frontend tests are verified across the affected guest planner/history/payment, Hall information/retry, staff workspace/review, exact peso parser, AM/PM controls, walk-in, cancellations, rescheduling, extensions and navigation files. The consolidated run passed 43/44; its only remaining failure was an obsolete room-only wording assertion. After correcting that assertion, the affected payment file passed 4/4, leaving the other 40 unchanged. Logs: ignored .quality/unified-booking/frontend-targeted.log and payment-final.log. This is targeted evidence, not a complete frontend suite.
- Final frontend bundle/typecheck and frontend lint pass after the last UI edits. Targeted Prettier checks pass. One test-only unqualified document reference was changed to the existing JSDOM document to satisfy lint.
- Read-only cross-review of financial projections and history found issues that were corrected; this is not the formal independent scanloop/greploop quality gate. No browser/device acceptance, complete suite, scanner consensus, formal gate or hosted migration application is claimed.

The passing final database run follows corrections found by earlier attempts (a test SQL alias, Hall-only null room items, signed Hall repricing and unpaid-hold utilization). These failed attempts are not described as passing evidence.

## UB implementation status

| Decision | Local status and evidence boundary |
|---|---|
| UB-01 | Implemented; full amount is required for Hall-only and mixed online confirmation. Existing staff Hall minimum deposit remains unchanged. |
| UB-02 | Implemented; one verified original payment, exact room/Hall shares, no duplicate Hall receipt, separated revenue and statement history. Real GCash and hosted media acceptance are deferred. |
| UB-03 | Implemented; atomic hold/conflict rollback, one deadline, timely proof protection, unpaid expiry and competing setup tests pass locally. Comprehensive all-channel contention is deferred. |
| UB-04 | Implemented; staff actual-ledger attestations, audit rollback, atomic confirmation, stable retries, persisted dashboard/detail and one itemized queued confirmation are covered. Real email delivery is not run. |
| UB-05 | Implemented; independent Hall cancellation/refund preserves room snapshots, applies original confirmation clock/actual-start guard and bounded manual GCash payouts. Reconciled current-price cancellation is supported. Existing unresolved accommodation extra-bed refund treatment remains gated; real/legal acceptance is deferred. |
| UB-06 | Implemented with existing independent room changes and new guest Hall requests/staff Hall changes. Hall full additional funding and price-change reconciliation are tested. Existing room 50% extension mechanics are retained; exhaustive mixed room-extension/device acceptance is deferred. |

## Remaining acceptance and risks

Comprehensive system testing, full production security/review gate, hosted migration review/application, real Storage/Auth/email delivery, real staff/device/UI walkthrough, management acceptance of provisional Hall configuration, hotel payee/QR, inventory readiness and legal/privacy/receipt acceptance remain pending. No automatic refunds, fiscal receipt claim, real payments/email, hosted access or production activation. Existing unrelated local changes are preserved. Next task: owner inspection, then separately authorized comprehensive integration/UI/UX acceptance.

## Task file manifest

These files contain this task's changes; several guest UI and documentation files already had owner edits before this task. Those edits were preserved. frontend/src/landing.css and preexisting asset/lockfile/editor changes were not edited for this implementation.

### API and critical tests

- `backend/src/analytics-data.ts`
- `backend/src/app.ts`
- `backend/src/claim-holds.ts`
- `backend/src/guest-booking.ts`
- `backend/src/hall-reports.ts`
- `backend/src/hall-reservations.ts`
- `backend/src/hall-routes.ts`
- `backend/src/notifications.ts`
- `backend/src/payment-proofs.ts`
- `backend/src/payment-review.ts`
- `backend/src/reservation-workspace.ts`
- `backend/src/unified-booking.ts`
- `backend/src/unified-hall-actions.ts`
- `backend/test/claim-holds.test.mjs`
- `backend/test/unified-booking-postgres.mjs`
- `backend/test/unified-booking.test.mjs`
- `backend/test/unified-finance-postgres.mjs`

### Guest and staff UI/tests

- `frontend/src/App.tsx`
- `frontend/src/BookingPlanner.tsx`
- `frontend/src/CancellationDesk.tsx`
- `frontend/src/Catalog.tsx`
- `frontend/src/GuestPayment.tsx`
- `frontend/src/GuestReservations.tsx`
- `frontend/src/HallDesk.tsx`
- `frontend/src/LandingPage.tsx`
- `frontend/src/ManilaDateTimeInput.tsx`
- `frontend/src/StaffCatalog.tsx`
- `frontend/src/StaffPaymentReviews.tsx`
- `frontend/src/StaffReservations.tsx`
- `frontend/src/StayChangesDesk.tsx`
- `frontend/src/WalkInDesk.tsx`
- `frontend/src/hall-command-state.ts`
- `frontend/src/peso-input.ts`
- `frontend/test/booking-planner.test.mjs`
- `frontend/test/function-hall.test.mjs`
- `frontend/test/guest-payment.test.mjs`
- `frontend/test/guest-reservations.test.mjs`
- `frontend/test/hall-recovery.test.mjs`
- `frontend/test/manila-date-time.test.mjs`
- `frontend/test/payment-review.test.mjs`
- `frontend/test/peso-input.test.mjs`
- `frontend/test/staff-workspace.test.mjs`

### Shared contracts and generated schema

- `packages/shared/src/booking.ts`
- `packages/shared/src/database.types.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/payment-review.ts`
- `packages/shared/src/payment.ts`

### Candidate database migrations

- `supabase/migrations/20261121002700_unified_online_booking.sql`
- `supabase/migrations/20261121002800_unified_financial_projections.sql`

### Local verification tooling

- `scripts/verify-unified-booking.mjs`

### Affected documentation

- `docs/02-requirements.md`
- `docs/04-feature-specification.md`
- `docs/06-architecture.md`
- `docs/07-database-schema.md`
- `docs/11-pages-and-navigation.md`
- `docs/12-api-and-service-layer.md`
- `docs/13-development-roadmap.md`
- `docs/14-milestones.md`
- `docs/17-decisions.md`
- `docs/18-backlog.md`
- `docs/functional-completion-tracker.md`
- `docs/future-function-hall-requirements.md`
- `docs/icm/PROJECT-CONTEXT.md`
- `docs/isolated-development.md`
- `docs/phases/05-online-booking-and-gcash.md`
- `docs/phases/07-changes-refunds-and-ledger.md`
- `docs/superpowers/plans/2026-11-21-unified-online-booking.md`
- `docs/superpowers/specs/2026-11-21-unified-online-booking-design.md`
- `docs/unified-online-booking-requirements-sync.md`

