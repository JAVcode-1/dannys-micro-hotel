---
tags: [phase-05, implementation, payments]
status: o01-development-checkpoint
---
# Phase 05 — Online Booking & Manual GCash Verification

**Goal:** Guest portal that takes secure room holds and payment proof; Staff/Admin, not the upload, confirms receipt and reservation.

**Dependencies:** [[02-auth-and-authorization]], [[04-availability-and-holds]], [[04-feature-specification]].

## Task sequence

### O01 — Guest multi-room booking
- [ ] Select category-specific duration blocks, independent arrival times and occupancy per room item.
- [ ] Optional Family extra bed itemized once per continuous stay.
- [ ] Server quote and new hold are transactional, including full amount due.
- [ ] Email OTP covers no-account guest reservation lookup.

**Acceptance:** mixed category + differing room schedule quote correct (T28).

#### O01 development checkpoint — 2026-11-18

Owner authorized O01 despite the incomplete Phase 03/04 formal gates. Those gates remain incomplete. O02/O03 have not started.

Implemented scope:
- `/book` planner: add/remove independent room items, category-specific explicit consecutive package blocks, Manila date and AM/PM time, adults/children, and one optional Family extra bed. Uses shared Royal Horizon tokens; no physical room selection. Single-bed option is development-only pending approved stock/quantity.
- `POST /guest/quote`: current active database catalog, server-calculated integer-centavo package and extra-bed lines/full amount. Rejects Family 3h, Standard bed, unsupported blocks, invalid/past dates and invalid occupants. Public quotes do **not** check or reserve capacity. Client-supplied prices are ignored. Technical request bounds: 1–15 room items, 1–30 explicit blocks per item; these are not legal occupancy or stock limits. No invented cheapest-combination/tie-break policy.
- Internal `createGuestHold`: one retryable PostgreSQL transaction obtains a locked server quote and configured (non-null) cleaning buffer, calls the existing V01/V02 allocator/claims, and saves one reservation with independent room items and immutable package/version/unit-price snapshots. Idempotency is scoped to the verified identity; replay retains the saved amount. V03's original 30m deadlines and proof protection are unchanged. No external channel or real reservation integration is claimed.
- Existing email OTP now opens `GET /guest/reservations` after Express identity verification; server ownership requires **both** verified Auth UUID and the reservation's verified email. No public-reference access, browser-chosen email/owner, physical room ID, or payment proof is returned. Lookup fails closed until its migration exists.
- `POST /guest/reservations` is unconditionally disabled (503). There is no environment switch to open real booking, no payment endpoint, and no confirmed booking UI. Room-booking workflow status is separate from claim state; O01 only creates pending items internally. Countdown/check-in/change operations are future tasks.

Changed files: `backend/src/{app,booking-quote,guest-booking,inventory-claims}.ts`; `frontend/src/{App,Catalog,GuestAccess,BookingPlanner,GuestReservations}.tsx`; shared booking DTOs; O01 quote/API/component tests; extended existing isolated V02/V03 database fixture; candidate migration below; milestone/decision/context notes. No dependency added. Unrelated editor/Obsidian configuration and nested project files are excluded from the checkpoint.

Migration candidate: `supabase/migrations/20261118000500_guest_multi_room_booking.sql` adds private RLS-enabled reservations/room bookings and immutable snapshot triggers. No rooms/identities/payments are seeded. **Unapplied; owner approval required.** The five previously applied versions remain unchanged. Shared booking DTOs describe the candidate; hosted generated database types are not claimed synchronized with it.

Verification evidence:
- Root build, typecheck, lint and application tests run for this checkpoint; final counts/results recorded in [[14-milestones]]. Vite/Node child processes require execution outside the restricted process sandbox.
- Live **read-only catalog/quote** preview via local Vite proxy: one Standard 3h item plus independently scheduled Family 24h + 24h with one bed returned 270000 centavos (₱2,700), separate UTC start/end values and only one 10000-centavo bed line. `/book` HTTP returned 200 at `http://localhost:5173/book`; `/health` returned ok. No booking/payment write occurred.
- Focused tests cover mixed schedules, repeated blocks, one-time bed, rejection paths, browser-price tampering, quote invalidation after edits, AM/PM conversion and disabled creation/unauthenticated lookup. Independent read-only review found an added-room inactive-package edge case; initialization now uses active catalog rates with a regression test. No perfect score/full greploop gate is claimed.
- Scoped Semgrep: four pinned local rules, 11 changed source files, zero findings; limited starter coverage. Staged secret review/scan recorded in milestones. No dependency/lockfile changes, so no new OSV pass or resolution of historical advisories is claimed.

Deferred acceptance (not passed): isolated PostgreSQL execution of the extended `zz-v02.integration.mjs` (no local `TEST_DATABASE_URL`), candidate migration/RLS/trigger execution, mixed-room durable claims/rollback and stored-price retention after catalog revision, T28 countdown/status lifecycle and cross-channel concurrency, real OTP delivery/expiry/shared throttling/T24, real room inventory, maintenance coordination and deployed expiry schedule. Fixture covers ownership isolation, all-or-none failure, immutable price snapshots/replay and existing V02/V03 tests, but CI results must be observed separately. Browser visual review stopped because Computer Use could not identify the Windows browser URL; real mobile hardware/accessibility acceptance is pending. Full major-milestone quality gate remains unrun.

Checklist boxes remain open pending the dependent database/hosted acceptance. Stop after O01. Next action is owner review and isolated O01 acceptance, **not O02 implementation**.

#### O01 migration readiness review — 2026-11-18

**NOT SAFE TO APPLY: actual O01 CI/PostgreSQL result not verified.** Reviewed checkpoint `2fbbf9ff4146b2864225262364f16acdf841f1fb`. The migration and application code are unchanged; candidate SHA-256 is `AD665EE6906863A3790090A955C4B4629AF0E6AEE9931C7984815989363D5332`.

- CI coverage is present, not missing: `.github/workflows/ci.yml` runs `npm run test:db` against disposable loopback PostgreSQL 17. `backend/test/zz-v02.integration.mjs` includes O01 migration execution, distinct room schedules, mixed-package total, saved-price retention after a catalog change, immutable-price rejection, identity/email ownership isolation, idempotent replay, capacity failure, insert-failure rollback and RLS/client privilege checks, alongside V02/V03 assertions. No coverage fix was needed. The private Actions API returned 404 and no stored noninteractive API credential was available; **latest run status and SQL test pass are unverified**, not failed or passed by inference.
- Reused the checkpoint's 64 passing application tests; reran 11 focused pricing, guest authorization, disabled-creation, claim-retry and V03 lifecycle tests: all passed, zero skipped. No isolated database was run locally or against the hosted project.
- Source review found no blocking migration defect. New tables have primary/foreign/unique keys, interval/count/money checks, pending-only item status, RLS with no client policies/grants, and immutable pricing triggers with an empty function search path. Package selection/category duration validation remains in the trusted server path and existing package catalog constraints; the JSON snapshot is not independently validated against every package rule by a SQL trigger. Guest HTTP access verifies Auth and confirmed email, then requires both saved Auth UUID and verified email; a reference alone cannot authorize lookup.
- Pricing uses integer centavos and locked active package rows. Reservation/items/claims are written in one transaction with rollback, deterministic category locking and bounded serialization/deadlock retries. Per-item schedule/snapshot columns remain independent. Family bed is 10000 centavos once per room item outside the consecutive-block loop, and SQL disallows a Standard bed. Extensions/bed stock/real OTP acceptance remain deferred. O01 adds tables/triggers without changing V01–V03 claim constraints or proof states.
- Remote `migration list --remote` returned login-role **403** once. No repeated login-role authentication was attempted. A read-only SQL query through the existing backend connection verified versions `20261117000100`, `20261118000100`, `20261118000200`, `20261118000300`, `20261118000400`.
- A password-based `db push --remote --dry-run` then exited **0**, using the existing password only in child-process memory. It reported **only `20261118000500_guest_multi_room_booking.sql` pending**, with no seeds or role changes. Target reference matched `pgbierfxeviouyjsmjnh`; CLI labels its base branch `production`, consistent with the existing D-040 target-label note. Dry run did not execute or validate the candidate SQL by applying it.

Actual blocker: obtain the successful CI run/log for the reviewed commit, including the isolated O01 PostgreSQL assertions. Then reassess migration readiness for separate owner approval. No migration, seed, reset, live booking/payment enablement or O02 work occurred. Phase 03/04 formal gates and O01 acceptance boxes remain open.

**O01 CI reporting fix — 2026-11-18:** The O01 assertions were included by `test/*.integration.mjs`, but nested as ordinary statements inside the V02-named top-level test. Five passing test names therefore did not identify O01 separately. The existing O01 block is now an awaited, explicitly named `O01 PostgreSQL: guest multi-room migration, schedules, snapshots, ownership, rollback and Family extra bed` subtest. Added exact per-item start/end and stored base/bed/total assertions: Family 48h has 240000 base + one 10000 bed = 250000 centavos. All existing migration, immutable-price, ownership, rollback, RLS, concurrency and V03 assertions are retained. `test:db` uses explicit TAP output, and the CI database step names V02/V03 and O01. The loopback-only target and PostgreSQL 17 service are unchanged; no Supabase migration or reset is involved. Build/typecheck/lint/format and 64 application tests pass locally. No local isolated database URL is configured; the new CI's explicit O01 result must still be observed before claiming PostgreSQL acceptance. Expected passing count is six including the named subtest, not an observed result yet.

### O02 — Static GCash QR and upload proof
- [ ] Staff configures QR image from secured administrative settings; validate media and access.
- [ ] Guest gets QR, full amount, 30m deadline and reminder UI/email schedule.
- [ ] Require screenshot AND transaction reference; file size/type validation, private storage.
- [ ] Display `Payment submitted — awaiting staff verification`, never `Confirmed`.

**Acceptance:** missing proof/ref rejected, expired hold handled, protected submitted proof remains (T07/T08).

### O03 — Staff payment review and confirmation
- [ ] Staff sees 15/30/60m aging; checks actual GCash account against amount, recipient, time/ref.
- [ ] Prevent verified duplicate transaction reference and double approval with idempotency.
- [ ] Atomically convert protected claims to confirmed bookings; snapshot cancellation terms and `online_confirmation_at`.
- [ ] Reject/dispute proof with safe customer recovery/refund process and audit.
- [ ] Notification/email via durable outbox; failures must not make booking inconsistent.

**Acceptance:** T09/T10/T24 and security tests pass, no screenshot-only confirmation.

## Exit gate

- [ ] Demonstrate two independent room items under one online reservation.
- [ ] Staff must approve actual payment for reservation confirmation.
- [ ] Late proof / review aging reconciliation path tested.
- [ ] Update [[14-milestones]].

**Next:** [[06-walkins-and-stay-monitoring]].
