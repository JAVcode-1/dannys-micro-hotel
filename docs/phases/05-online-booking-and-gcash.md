---
tags: [phase-05, implementation, payments]
status: not-started
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
