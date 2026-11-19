---
tags: [phase-06, implementation, front-desk]
status: w01-development-checkpoint
---
# Phase 06 — Walk-In Desk, Check-In/Out & Countdown

**W01 hosted migration verified (2026-11-19).** The owner applied `20261119000800_walkin_booking_ledger.sql` to `pgbierfxeviouyjsmjnh`. A read-only PostgreSQL history query verified that all nine local and hosted migration versions match with none pending. The linked CLI returned 403 during login-role initialization. This supersedes earlier W01 unapplied notes. Live transactions remain disabled. Real hotel inventory, hosted acceptance, and prior exit gates remain open.

**W01 final CI evidence (2026-11-19):** [Run 44432132249](https://github.com/JAVcode-1/dannys-micro-hotel/actions/runs/44432132249) on `307e580` passed build/typecheck/lint/format, **89 application tests and nine isolated PostgreSQL tests, zero failures/skips**. This supersedes W01 pending-CI statements below. The named W01 database fixture includes exactly two receipts (50% cash + 50% verified GCash), additional partial splits, reference races, retries and rollback. Implementation commit `7193d1b` and test follow-up `307e580` are pushed to main. The candidate ninth migration ran only in disposable CI PostgreSQL and remains **unapplied on hosted Supabase**, pending separate owner review/approval. No formal W01/phase checkbox is completed; hosted acceptance and Phase 03–05 dependencies remain open, live writes stay closed, and W02 is not started.

**Goal:** Real staff/front desk operation on same inventory; room-specific reliable countdown.

**Dependencies:** [[03-catalog-inventory-settings]], [[04-availability-and-holds]], [[05-online-booking-and-gcash]].

## Task sequence

### W01 — Walk-in booking and mixed ledger
- [ ] Staff creates category reservation/room items from current shared availability.
- [ ] Staff records multiple cash and staff-verified GCash payments against one reservation.
- [ ] Enforce 50% minimum of selected charges before normal check-in (separate extension minimum in Phase 07).
- [ ] Record payment method, amount, reference, staff and timestamps. Ledger balance = journal totals.

**Acceptance:** T11 passes for 50% cash + 50% GCash; arbitrary missing payment cannot admit guest.

#### W01 development checkpoint — 2026-11-19

Owner approved the six-condition W01 design and gated development despite the **FAILED Phase 03–05 formal gates**. Those acceptance gaps remain open. Implemented W01 only; no W02 final assignment, Ready→Occupied transition, check-in, stay clock or room access. Eight earlier Supabase migrations remain owner-confirmed applied/synchronized. The ninth migration below is **unapplied**.

Implemented:
- Staff-only `/staff/walkins` planner/list/detail, protected quote/create/payment endpoints and Royal Horizon UI. Category-specific allowed package blocks, separate AM/PM Manila arrivals/occupants per item and one optional Family-only ₱100 bed use the existing server quote and V01/V02 transaction allocator. There is no Family 3h option or browser-authoritative price. Planned arrival must be future; it is not an actual check-in timestamp. Existing room identities are read only for labelled provisional capacity; no real hotel identifiers are invented.
- Walk-in reservations have an explicit `walk_in` channel and creating staff UUID, primary guest name and **null Auth owner/verified email**. Online identity requirements remain enforced by a channel constraint. No Auth account, verified contact or ID-photo record is fabricated. Existing online guest ownership queries cannot expose these unowned walk-in records.
- Creation atomically rechecks active staff, locks retry/category/price/settings data, allocates against shared claims/maintenance/cleaning buffers, persists immutable independent item prices/schedules, posts one immutable charge journal entry per item and audits the actor. Shared item-insert mechanics are extracted into `booked-items.ts` and reused by O01 without changing pricing semantics. Same request replays; a changed request with the same key conflicts.
- New `walkin_reserved` is **durable provisional capacity**, distinct from online proof states, paid status, final room assignment and check-in. Existing exclusion constraints include it; the online held/no-proof expiry job does not expire it. Online payment reminders are not created for walk-ins. Existing V02 revalidation cannot silently convert this state. No new automatic walk-in TTL, capacity-release/refund or unpaid admission policy is invented; future explicit cancellation/reconciliation remains pending. Production writes are gated, so no real provisional reservations are created here.
- Append-only journal records room charges and multiple positive cash or **manually verified GCash** receipts. Entries record server time, responsible staff, amount/method/reference and receiving-account evidence/time where applicable. Unverified GCash is rejected and never counted. Balances and `ceil(total/2)` minimum are computed from journal sums; incomplete charges, overpayments, unsafe amounts and unavailable capacity fail closed. Booking/claim locks serialize competing payments; same actor/key/body replays while conflicting retries return 409. Payment eligibility is authoritative server output, not room access; W02 must still enforce all final capacity/Ready/check-in checks. No normal-deposit waiver was documented, so no bypass is added.
- A private global GCash reference registry backfills only existing verified online references and is maintained by insert triggers for O03 and W01. Unique canonical references prevent reuse and concurrent double collection across channels. Registry, journal and staff audit commit/rollback together; immutable records retain actor UUIDs after employee deletion. O03 warnings use the registry after installation and fall back to the existing online table on the current eight-migration schema. Existing payment proof Storage remains private and unchanged.
- Normal Express registration keeps **walk-in creation and payment writes closed**, without an environment toggle. Only isolated test dependency injection opens them. The real staff page requires active sessions and approved migration. Synthetic preview `http://127.0.0.1:5173/staff/walkin-preview` performs local fixture operations only, labels all slots/prices synthetic, and never makes a booking/payment network write. Successful creation clears its quote to prevent an accidental second booking; uncertain requests retain their retry key. GCash receipt input starts at the current minute rather than a future arrival time.

Migration: `supabase/migrations/20261119000800_walkin_booking_ledger.sql` adds channel-aware identity checks, provisional state, channel-scoped reminder scheduling, private append-only charge/payment journal, cross-channel reference registry/backfill and guards/triggers. New tables use RLS and deny browser roles; trigger functions use empty search paths and revoked client execution. It preserves O01 snapshot triggers, V02/V03 exclusion/expiry safeguards and O02 Storage policy. No rooms, guest identities, media or new payment are seeded. **Prepare only; separate owner approval required before hosted application.** Hosted generated DB types are not claimed regenerated.

Changed files/dependencies: backend `walkins.ts`, `walkin-routes.ts`, `booked-items.ts`, app registration/rate limiting, shared insert extraction in `guest-booking.ts`, provisional revalidation guard and backward-compatible O03 duplicate warning; shared walk-in DTO/export; frontend `WalkInDesk.tsx`, App/StaffLogin routes/navigation; focused W01 API/core/UI tests, `w01-postgres.mjs` invoked after O01–O03 in the existing isolated fixture, small O03 query-binding assertion update and CI step label; candidate migration; milestone/decision/context notes. **No dependency or lockfile change.** Unrelated editor/Obsidian configuration and nested workspace files are excluded.

Verification: root build/typecheck/lint/format check and **89 application tests passed (63 backend + 26 frontend), zero failures/skips**. Route/preview and duplicate-creation regressions were observed failing before implementation/fix. Independent read-only review found the successful-creation retry issue; fixed and targeted re-review confirmed resolution, along with receipt-time/default-schema fixes. No full milestone quality gate/perfect score is claimed. Existing >500 kB bundle warning remains nonblocking; code splitting is deferred.

`npm run test:db` was attempted locally and **did not pass**: all five parent fixtures stopped before connection because `TEST_DATABASE_URL` is absent. No Docker/native DB installation, reset or hosted fallback occurred. The new named W01 CI fixture covers candidate migration/RLS, identity separation, journal-derived balances and the 50% threshold, mixed collection/replay/overpayment races, both cross-channel reference directions/concurrency, old online reminders/confirmation and guest ownership, immutable journal/registry, audit-failure rollback of payment/booking/capacity/registry, revoked staff, expiry retention and maintenance rejection. CI cleans only O03's explicitly labelled deliberately conflicting test blocks **after O03's assertions** in the disposable loopback fixture; it does not touch hosted data or weaken that test. Final CI passed all nine isolated PostgreSQL tests, including the named W01 subtest and exact two-receipt T11 scenario; see evidence above.

Preview HTTP returned **200**; component tests demonstrate local mixed collection, unverified-GCash rejection, a fresh-quote requirement after creation, independent AM/PM schedules, one-time Family bed and disabled W02 check-in. Manual browser visual/real-device acceptance is not claimed.

Reviewed all 24 staged in-scope files; staged Gitleaks found no leaks. No new Semgrep/OSV or full scanloop/greploop milestone gate is claimed for this ordinary development checkpoint. Prior security-gate debt remains open.

Remaining acceptance: owner review/application of candidate, approved isolated/hosted synthetic staff sessions and cross-channel operations, real 10 Standard + 5 Family room identities, maintenance-write/expiry/channel integration, receipt/payee/policy/retention/shared throttling/notification/device checks and the outstanding Phase 03–05/full-quality gates. W01 task/phase boxes remain open for dependent acceptance. Live online and walk-in writes remain disabled. **Stop after W01; W02 is the next documented task, not started.**

### W02 — Room assignment and check-in
- [ ] Assign feasible physical Ready room to category booking, rechecking availability.
- [ ] On staff check-in, persist actual start timestamp; for walk-ins compute checkout from purchased duration.
- [ ] For online arrivals, do **not** shift original scheduled checkout by default; 1h grace flagged for staff.
- [ ] Enforce room status transition Ready → Occupied; prevent a second conflicting check-in.

**Acceptance:** T12/T13/T14/T21 pass.

**W02 development checkpoint (2026-11-19).** The staff check-in desk lists Ready candidates and flags online arrivals at one hour without altering capacity. Check-in rechecks staff, payment eligibility, room readiness, maintenance and the buffered claim in one transaction. The room becomes Occupied with an immutable check-in record and staff audit. Walk-ins use actual check-in plus purchased duration. Online stays retain their scheduled checkout. The synthetic preview is available at http://127.0.0.1:5174/staff/check-in-preview.

Build, typecheck, lint, formatting, 90 application tests, and 10 isolated PostgreSQL tests passed on `8ea19a5`. The W02 fixture covers T12/T13/T14/T21 and concurrent check-in. The local database command stopped because `TEST_DATABASE_URL` was absent. Migration `20261119000900_room_check_in.sql` ran in isolated CI and awaits separate owner approval for hosted application. Live check-in remains disabled. Formal acceptance, real inventory, and prior exit gates remain open. [GitHub Actions run 44447042367](https://github.com/JAVcode-1/dannys-micro-hotel/actions/runs/44447042367)

### W03 — Countdown, overdue and checkout
- [ ] Dashboard computes from persisted server timestamps; reload/reopen no drift.
- [ ] Configurable warning thresholds (e.g. 30/15/5m) and checkout overdue states.
- [ ] Timer zero never auto-checks out; staff records real checkout.
- [ ] Remaining balance must normally be settled; allow documented exception to complete departure.
- [ ] After checkout mark Needs cleaning, not instantly Ready.

**Acceptance:** T12/T15/T21 pass, test on two devices and browser sleep.

## Exit gate

- [ ] Demonstrate walk-in through checkout while online reservation remains protected.
- [ ] Staff can correctly see room-by-room countdown and unpaid balances.
- [ ] Update [[14-milestones]].

**Next:** [[07-changes-refunds-and-ledger]].
