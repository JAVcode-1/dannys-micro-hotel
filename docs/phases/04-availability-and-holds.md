---
tags: [phase-04, implementation, critical]
status: not-started
---
# Phase 04 — Conflict-Safe Availability & Payment Holds

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
