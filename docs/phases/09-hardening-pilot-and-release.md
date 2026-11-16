---
tags: [phase-09, implementation, release]
status: not-started
---
# Phase 09 — Security Hardening, Pilot & Production Release

**Goal:** Safely release to real hotel staff and guests only after test and owner signoff.

**Dependencies:** All prior phases; [[08-security-and-risks]], [[15-testing-plan]], [[16-deployment]].

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
