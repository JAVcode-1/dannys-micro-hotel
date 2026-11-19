---
tags: [phase-04, implementation, critical]
status: in-progress
---
# Phase 04 — Conflict-Safe Availability & Payment Holds

**Cross-phase status reconciliation - 2026-11-19 (after W03):** V01-V03 are development checkpoints. Later gated online/walk-in flows now call the allocator/transactional claims and have isolated concurrency, buffer, protected-proof and retry evidence; older missing-application-path statements are historical. Actual room inventory, authorized hosted all-channel acceptance, coordinated maintenance writes, deployed expiry schedule and full milestone quality gate remain outstanding. The formal Phase 04 exit remains FAIL. This documentation review reuses W03 CI (96 application + 11 isolated PostgreSQL tests); no new tests or hosted operations are claimed. Phase 06 also fails formal acceptance; Phase 07 X01 is identified only, not started. See [[06-walkins-and-stay-monitoring]].


**Goal:** Implement **the core technical invariant**: shared room inventory cannot be sold to overlapping stays, regardless of channel, payment state, buffers or maintenance.

**Dependencies:** [[03-catalog-inventory-settings]], [[06-architecture]], [[07-database-schema]].

## Task sequence

### V01 — Time interval/room feasibility
- [ ] Define half-open occupied time ranges and configurable cleaning buffer for every room booking.
- [ ] Model physical room blocks and overlapping provisional allocations for category bookings.
- [ ] Ensure feasibility across **all relevant existing reservations and room-specific maintenance**, not just count at single time.
- [ ] Provide item-specific availability for varied arrival times and packages in the same cart.

**Acceptance:** T05/T06/T20/T28/T30 prove intervals and physical feasibility.

### V02 — Atomic capacity claims
- [ ] Use per-category transaction/advisory lock or equivalent serializable conflict-safe algorithm.
- [ ] Create/release claims atomically in DB transaction; include retry + idempotency.
- [ ] Revalidate at confirmation/reschedule/extension/physical assignment.
- [ ] Test parallel staff and guest requests (including same millisecond and retries).

**Acceptance:** under 30 concurrent contenders for one remaining capacity, no double booking (T05, T29).

### V03 — 30m hold and proof-protected review state
- [ ] At hold creation set 30m proof deadline.
- [ ] Mark no-proof holds expired/released after deadline with idempotent job.
- [ ] On-time proof moves claim to protected `proof_pending_review` without 30m auto-release.
- [ ] Make overdue review flags 15/30/60m **from proof submission**.
- [ ] Design paid-but-late-proof exception as reconciliation, not silent confirmation.

**Acceptance:** T07/T08 pass with deterministic fake clock and repeated cleanup jobs.

## Exit gate — do not skip

- [ ] High-concurrency integration tests against real PostgreSQL pass.
- [ ] Business logic and DB constraints jointly prevent overlaps.
- [ ] No guest-facing 'confirmed' states exist yet.
- [ ] Update [[14-milestones]].

**Next:** [[05-online-booking-and-gcash]].

**V01 development checkpoint (2026-11-18):** Added an internal UTC-instant feasibility allocator using half-open ranges, per-item cleaning buffers, fixed or category-only provisional allocations, room-specific maintenance blocks, immediate Ready checks, and joint assignments for cart items with distinct schedules. Focused tests cover buffer boundaries, roomless prior claims, maintenance, fixed-room conflicts and mixed schedules. This does not create or confirm bookings, read live reservation/hold/maintenance rows, persist claims, or provide V02 transaction locking. V01 acceptance and Phase 04 exit checkboxes remain open until those database-backed paths and T05/T06/T20/T28/T30 integration evidence exist. No V01 migration was prepared or applied; no real room identifiers were seeded.

**V02 development checkpoint (2026-11-18):** Prepared unapplied `20261118000300_inventory_claims.sql` with private claim/request/block tables, RLS/role revocations, category-room integrity, and an active-room interval exclusion constraint. Backend-only transactions lock idempotency keys and categories in a fixed order, recheck V01 feasibility against active rooms, claims and blocks, then create, release or revalidate claims. The isolated PostgreSQL test fixture exercises 30 same-time contenders, idempotent replay, release, confirmation/revision and denied client roles; its CI outcome must be recorded separately after execution. There is no guest/staff claim route, no hold expiration or proof-review state (V03), and no hosted migration apply. V01 and V02 acceptance checkboxes stay open pending the isolated test result, integration with real booking flows, and owner approval of the migration.

**V02 CI evidence:** [GitHub Actions run #18](https://github.com/JAVcode-1/dannys-micro-hotel/actions/runs/44279578668) passed build, typecheck, lint, formatting, application tests and all five isolated PostgreSQL tests (0 failed), including 30 contenders for one room. The migration was applied only inside CI's disposable test database. V02 production integration and Phase 04 exit remain open; no hosted Supabase migration was applied.

**V02 retry follow-up:** Claim creation now retries PostgreSQL serialization failures (`40001`) and deadlocks (`40P01`) up to two additional transaction attempts; a focused regression test first failed without retry and then passed. The subsequent full verification and CI outcome are recorded with the final checkpoint.

**V02 final verification:** [GitHub Actions run #19](https://github.com/JAVcode-1/dannys-micro-hotel/actions/runs/44281199949) passed after the retry fix. Local build, typecheck, lint, format check and application tests also passed. The V02 candidate migration remains unapplied to Supabase; V02 is a development checkpoint, not a completed Phase 04 gate.

**V03 development checkpoint (2026-11-18):** The owner reports `20261118000300_inventory_claims.sql` applied to Supabase project `pgbierfxeviouyjsmjnh`, with all four local/remote migrations matching. V03 prepares an additional, unapplied `20261118000400_claim_hold_lifecycle.sql`: 30-minute proof deadlines, an `expired` claim state, and protected `proof_pending_review` state. Internal cleanup is idempotent; proof submission after expiry yields a reconciliation result without confirmation. Review age is measured from proof submission. The private proof upload/reference and staff-verified payment workflow remain Phase 05; no guest-facing confirmation or claim route exists. The V03 integration fixture is prepared, but isolated PostgreSQL execution and real scheduler deployment remain pending. V03 and Phase 04 acceptance checkboxes stay open.

**V03 migration readiness review (2026-11-18): NOT SAFE TO APPLY yet.** Owner reports GitHub Actions run #24 succeeded; CI configuration runs the isolated PostgreSQL integration suite, including the V03 expiry/repeated-cleanup/protected-proof assertions. The run log was not independently accessible in this session. A read-only PostgreSQL query verified hosted migration versions `20261117000100`, `20261118000100`, `20261118000200`, and `20261118000300`; comparison with local migration filenames shows only V03 pending. Both CLI `migration list --remote` and `db push --remote --dry-run` failed with login-role 403, so the required dry run is unverified. The CLI labels the linked project `production`; confirm the intended target and restore CLI access before approval. No migration was applied or database reset performed.

**Phase 04 exit-gate review (2026-11-18): FAIL for formal completion.** The owner confirms V03 migration `20261118000400_claim_hold_lifecycle.sql` was applied to Supabase ref `pgbierfxeviouyjsmjnh`, all five local/remote migrations match, and GitHub Actions run #24 succeeded. This supersedes the earlier V03 migration-readiness status; no migration was applied during this review. The CI workflow includes build, typecheck, lint, formatting, application tests and isolated PostgreSQL tests; the reported successful run supports the 30-contender single-winner claim test and V03 fake-clock/repeated-cleanup/protected-proof tests, although its log was not independently accessible here. V01 half-open intervals, per-item buffers, provisional allocation, mixed schedules, maintenance reads and Ready checks are covered by local tests. V02 category locks, idempotent retries and the exclusion constraint protect the isolated claim path. V03 stores a 30-minute deadline, expires held/no-proof claims, and retains on-time proof claims while aging review from submission. There is no guest-facing confirmed state.

**Critical exit blockers:** No live booking/reservation source or staff/guest path uses the allocator and claim transactions, so the Phase 04 requirement to cover all relevant existing reservations and channels is unproven. The 15 actual physical rooms are not present/verified, maintenance writes are not coordinated with claims, the expiry command has no deployed schedule, and the required major-milestone quality gate has no passing scanloop/greploop/scripted review evidence. Keep all V01–V03 and exit checkboxes open. **Deferred Phase 05 dependencies:** private proof Storage/upload and reference validation, actual staff GCash verification, availability-safe confirmation, and reservation price snapshots. First documented Phase 05 task is O01 — Guest multi-room booking; do not start it from this review.
