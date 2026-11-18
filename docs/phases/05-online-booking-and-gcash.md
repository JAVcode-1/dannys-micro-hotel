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
