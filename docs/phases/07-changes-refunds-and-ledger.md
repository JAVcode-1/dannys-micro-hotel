---
tags: [phase-07, implementation, changes]
status: not-started
---
# Phase 07 — Cancellations, Rescheduling, Extensions & Refunds

**Goal:** Handle individual room-item changes and money correctly without harming other booked rooms.

**Dependencies:** [[05-online-booking-and-gcash]], [[06-walkins-and-stay-monitoring]].

## Task sequence

### X01 — Individual cancellation and manual refund
- [ ] Guest requests cancellation for specific room booking item; unrelated items remain active.
- [ ] Determine online free-cancel eligibility: <60m after reservation staff confirmation AND this item not checked in.
- [ ] Rescheduling does not restart deadline. Record eligible amount itemized; GCash refund requires staff manual transfer and verified destination/reference.
- [ ] Adjust/release capacity only at correct stage; record audit and financial entries.

**Acceptance:** T17/T18/T19/T27.

### X02 — Staff-approved rescheduling
- [ ] Guest requests new start/end per room item; staff approves/rejects after transactional availability check.
- [ ] Preserve other room items and original cancellation clock; capture old/new schedule and staff reason.
- [ ] Price changes use explicit charge/refund adjustment, not overwrite previous payment.

**Acceptance:** T20/T28; no capacity overlap under competing approvals.

### X03 — Extensions, overtime and incident charges
- [ ] Extension can only be approved with sufficient inventory and ≥50% of extension amount paid.
- [ ] Purchased extension starts at **old scheduled checkout**, even when customer asks later; revise end and countdown atomically.
- [ ] Permit staff overtime charge OR waiver with required reason, staff ID, minutes and timestamp.
- [ ] No-smoking penalty applied only after staff review, or waived with reason, disclosed before booking.
- [ ] One-time Family extra bed fee not reapplied per extension in same continuous stay.

**Acceptance:** T03/T16/T23; ledger remains balanced on partial cancellation/extension.

## Exit gate

- [ ] Staff proof of manual refunds recorded, no automatic GCash transfer implied.
- [ ] Shared reservation financial totals reconcile and other room-items unaffected.
- [ ] Update [[14-milestones]].

**Next:** [[08-housekeeping-maintenance-and-reporting]].
