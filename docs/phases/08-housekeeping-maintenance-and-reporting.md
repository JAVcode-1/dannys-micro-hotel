---
tags: [phase-08, implementation, operations]
status: not-started
---
# Phase 08 — Housekeeping, Maintenance, Incidents & Reporting


## Final Analytics scope revision - 2026-11-20

Owner-approved Analytics scope is **only Revenue Analytics, Room Category Performance and Package Popularity**, with date-range filtering, staff authorization and CSV/Excel exports; see [[future-analytics-and-reports]]. This supersedes the earlier six-feature proposal and related historical scope statements. Payment & Outstanding Balance Reports, Room Occupancy Analytics, Booking Analytics and Peak Hours & Demand Analytics are excluded as dedicated analytics/dashboard features and must not return under alternate labels. Existing operational availability, check-in/out, payments, balances, manual refunds, booking management and stay-duration monitoring remain unchanged.

Order: finish remaining core features, implement the three approved Analytics features, implement Function Hall Reservation & Management, then complete integration, testing, acceptance and deployment preparation. Preserve all confirmed [[future-function-hall-requirements|Function Hall requirements]] and pending owner decisions. X01-X03 checkpoints remain implemented; all 14 Supabase migrations remain owner-confirmed synchronized. Existing acceptance gaps stay open, live transactions stay disabled and both future modules remain unimplemented. Documentation only; no next implementation task begins.


**Goal:** Match physical hotel operation to digital booking state and provide trustworthy reports.

**Dependencies:** [[03-catalog-inventory-settings]], [[06-walkins-and-stay-monitoring]], [[07-changes-refunds-and-ledger]].

## Owner-approved scope update - 2026-11-20

Development is paused; Analytics & Reports remains planned, not implemented. Finish remaining approved core features first, then expand reporting under existing **H03**, then implement future Function Hall management before Phase 09 final readiness. No new task IDs or phase renumbering are introduced. Existing incident/audit work remains core. See [[13-development-roadmap]] and [[future-function-hall-requirements]].

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
- [ ] Analytics & Reports: only Revenue Analytics (daily/weekly/monthly trends), Room Category Performance (dynamic category revenue, future hall revenue separately identifiable) and Package Popularity (frequency and revenue contribution respecting category-specific packages); see [[future-analytics-and-reports]].
- [ ] Date-range filters, CSV/Excel exports, staff-only access and Asia/Manila reporting; use trustworthy financial records and prevent revenue/contribution double counting of partial payments, extensions, refunds and multi-room bookings.
- [ ] Preserve core operational views for pending GCash, cleaning/maintenance and audit. Future hall reporting belongs to the later Function Hall module. No occupancy, booking, payment/balance or peak-demand analytics, AI forecasting or complex customer profiling in this Analytics scope.
- [ ] Derive approved revenue/category/package reporting from authoritative transaction and financial records; pending proof is not verified money.
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

- [ ] Room board and the three approved Analytics features demonstrably reflect authoritative DB states.
- [ ] Every maintenance/waiver action has traceable actor and reason.
- [ ] Update [[14-milestones]].

**Next in approved order:** after remaining core work and Analytics, future [[future-function-hall-requirements|Function Hall Reservation & Management]], then [[09-hardening-pilot-and-release]]. Detailed hall task mapping remains pending; do not begin it automatically.
