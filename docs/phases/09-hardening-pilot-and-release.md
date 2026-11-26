---
tags: [phase-09, implementation, release]
status: not-started
---
# Phase 09 — Security Hardening, Pilot & Production Release


## Final Analytics scope revision - 2026-11-20

Owner-approved Analytics scope is **only Revenue Analytics, Room Category Performance and Package Popularity**, with date-range filtering and staff-only on-screen access; see [[future-analytics-and-reports]]. This supersedes the earlier six-feature proposal and related historical scope statements. Payment & Outstanding Balance Reports, Room Occupancy Analytics, Booking Analytics and Peak Hours & Demand Analytics are excluded as dedicated analytics/dashboard features and must not return under alternate labels. Existing operational availability, check-in/out, payments, balances, manual refunds, booking management and stay-duration monitoring remain unchanged.

Order: finish remaining core features, implement the three approved Analytics features, implement Function Hall Reservation & Management, then complete integration, testing, acceptance and deployment preparation. Preserve all confirmed [[future-function-hall-requirements|Function Hall requirements]] and pending owner decisions. X01-X03 checkpoints remain implemented; all 14 Supabase migrations remain owner-confirmed synchronized. Existing acceptance gaps stay open, live transactions stay disabled and both future modules remain unimplemented. Documentation only; no next implementation task begins.


**Goal:** Safely release to real hotel staff and guests only after test and owner signoff.

**Dependencies:** All prior phases; [[08-security-and-risks]], [[15-testing-plan]], [[16-deployment]].

## Owner-approved sequencing - 2026-11-20

Final integration, comprehensive testing, business acceptance, UI/UX refinement and deployment readiness follow remaining approved core StayTrack features, then [[future-analytics-and-reports|Analytics & Reports]], then [[future-function-hall-requirements|Function Hall Reservation & Management]]. Preserve R01-R03 and existing phase IDs. Earlier acceptance/security checks remain required during development; this sequence does not postpone essential safeguards. Both future modules are unimplemented and live transactions remain disabled.

Before final release, demonstrate report reconciliation and staff authorization, approved hall pricing and capacity/overlap rules, facility-versus-room reporting isolation and owner-approved hall policies. These extend the scope of existing R01/R02/R03 validation; they are not new official task IDs or completed checks.

## Task sequence

### R01 — Security, privacy, money & concurrency audit
- [ ] Run complete T01–T30 regression + API authorization, OTP abuse, image access tests.
- [ ] Review proof storage retention/privacy, cash+GCash ledger accuracy and financial adjustments.
- [ ] Stress test simultaneous booking, time extension, hold expiry and maintenance blocking.
- [ ] Verify laws/policies around minor registration, room safety, fees, receipts, data privacy with the appropriate persons.
- [ ] **If reviews enabled:** verify T31–T38, consent/invitation rules, honest one-star publication, privacy/retention, staff moderation audit and review feature rollback. Otherwise keep reviews disabled and document the deferred release.

**Acceptance:** no unresolved critical risks; documented legal/compliance review or feature gate.

### R02 — Staging pilot and operational training
- [ ] Walk hotel staff through online booking, paid proof approval, walk-in cash/GCash, check-in/out, cleaning, maintenance, cancellations and manual refund.
- [ ] Practice proof queue overload and overdue checkouts.
- [ ] Simulate hotel's internet outage: manual records + connected online booking + reconciliation.
- [ ] Verify physical room labels, owner-approved QR, price defaults, cleaning buffer and staff accounts.

**Acceptance:** recorded hotel signoff and incident remediation; T25 outage drill passes.

### R03 — Production deployment/rollback
- [ ] Prepare HTTPS, domain, production staff identities, backup/restore and migration rollback.
- [ ] Restore production backup to staging; reconcile balances (T26).
- [ ] Deploy behind feature flags with monitoring and on-call procedure.
- [ ] Enable guest booking only after staff confirms operations are ready.

**Acceptance:** operational runbook, recovery drill, pilot acceptance and release evidence stored.

## Final readiness test

**Question:** Could the hotel accept a live GCash payment, suffer an internet outage, have a room go under maintenance, and still keep customer funds and bookings accounted for without a double-booking? If not, production is **not ready**.
