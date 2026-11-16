---
tags: [phase-08, implementation, operations]
status: not-started
---
# Phase 08 — Housekeeping, Maintenance, Incidents & Reporting

**Goal:** Match physical hotel operation to digital booking state and provide trustworthy reports.

**Dependencies:** [[03-catalog-inventory-settings]], [[06-walkins-and-stay-monitoring]], [[07-changes-refunds-and-ledger]].

## Task sequence

### H01 — Housekeeping & Ready workflow
- [ ] Checkout leads to Needs cleaning; record cleaning start/finish and staff identity.
- [ ] Staff explicitly marks Ready; buffer time also must elapse for next conflicting stay.
- [ ] Show currently available/held/occupied/cleaning/maintenance rooms in room board.

**Acceptance:** T21 and category availability unaffected by a dirty physical unit.

### H02 — Maintenance and booking protection
- [ ] Staff opens maintenance block with reason and progress/repair notes.
- [ ] Remove affected room from allocation feasibility and surface impacted future reservations for reassignment.
- [ ] Staff-controlled release from maintenance, explicitly Ready after check.
- [ ] Require staff resolution for affected paid bookings; no silent cancellation/refund.

**Acceptance:** T20/T22 and maintenance concurrency test.

### H03 — Incidents, reports, audit
- [ ] Record no-smoking incident and staff-approved fee/waiver reason.
- [ ] Reports: nightly/day revenue, method breakdown, unpaid balances, pending GCash, no-shows, cancellations/refunds, occupancy, cleaning/maintenance.
- [ ] Aggregate financial reports exclusively from verified ledger entries, label pending transactions separately.
- [ ] Searchable audit by actor/action/date/subject, with sensitive masking.

**Acceptance:** T23 + ledger reconciling against report totals on multi-room mixed payments.

### H04 — Verified public reviews and private feedback (optional enhancement, D-038)
- [ ] Implement server-side eligibility: confirmed primary guest + **recorded check-in and completed checkout**, never reservation-only or public-visitor access; both online and walk-in supported.
- [ ] Support registered guest ownership and no-account guest's existing verified booking email through single-use expiring invitation. Walk-in verified-contact method must be defined and tested.
- [ ] Enforce at most **one public 1–5-star rating per completed reservation**, not per room, with unique DB constraint; optional public comment. Anonymous visitors may list ratings, **not submit**.
- [ ] Add **separate private feedback** collection and staff inbox; never expose it publicly or use it in the public average.
- [ ] Implement fair publication of eligible positive and negative reviews. Staff may reply, or hide/restore content only for documented policy reasons; log operator, reason and time. Never edit a guest's stars/comment or reject merely for low ratings.
- [ ] Add public reviews page and staff moderation UI, ownership/RLS/access tests, token abuse protections, accessible 1–5 rating UI, and aggregate tests.

**Activation acceptance:** pass **T31–T38** in [[15-testing-plan]], complete P11–P13 owner/privacy decisions in [[18-backlog]], and pilot moderation policy. **Until then the review module stays disabled.** See [[24-verified-guest-reviews]]. This enhancement is not required for completing the original core-room/ledger Phase 08 exit gate unless explicitly included in a release scope.

## Exit gate

- [ ] Room board and payment reports demonstrably reflect authoritative DB states.
- [ ] Every maintenance/waiver action has traceable actor and reason.
- [ ] Update [[14-milestones]].

**Next:** [[09-hardening-pilot-and-release]].
