---
tags: [phase-06, implementation, front-desk]
status: not-started
---
# Phase 06 — Walk-In Desk, Check-In/Out & Countdown

**Goal:** Real staff/front desk operation on same inventory; room-specific reliable countdown.

**Dependencies:** [[03-catalog-inventory-settings]], [[04-availability-and-holds]], [[05-online-booking-and-gcash]].

## Task sequence

### W01 — Walk-in booking and mixed ledger
- [ ] Staff creates category reservation/room items from current shared availability.
- [ ] Staff records multiple cash and staff-verified GCash payments against one reservation.
- [ ] Enforce 50% minimum of selected charges before normal check-in (separate extension minimum in Phase 07).
- [ ] Record payment method, amount, reference, staff and timestamps. Ledger balance = journal totals.

**Acceptance:** T11 passes for 50% cash + 50% GCash; arbitrary missing payment cannot admit guest.

### W02 — Room assignment and check-in
- [ ] Assign feasible physical Ready room to category booking, rechecking availability.
- [ ] On staff check-in, persist actual start timestamp; for walk-ins compute checkout from purchased duration.
- [ ] For online arrivals, do **not** shift original scheduled checkout by default; 1h grace flagged for staff.
- [ ] Enforce room status transition Ready → Occupied; prevent a second conflicting check-in.

**Acceptance:** T12/T13/T14/T21 pass.

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
