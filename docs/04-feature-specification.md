---
tags: [features, acceptance]
status: baseline
---
# 04 — Feature Specifications and Acceptance Examples

## Unified Online Booking workflow - 2026-11-21

UB-01 through UB-06 in [[unified-online-booking-requirements-sync]] supersede historical accommodation-only/staff-inquiry restrictions. Guests select rooms, the Hall, or both. Each has an independent schedule, availability and immutable server-priced item. Verify the primary guest's email and ownership, review the itemized total, policy and contact details, and hold all selections atomically for one 30-minute receipt deadline. The guest submits one private screenshot for the full GCash payment. Timely proof protects every selected item. Staff verify the actual transaction and record its ledger reference before atomic confirmation, staff-dashboard registration and one itemized confirmation message. Late-paid cases require reconciliation.

Cancellation and approved changes operate per item; free cancellation ends at the earlier of confirmation plus one hour and actual item start. Manual refunds use item allocations and cumulative caps. Accommodation extensions require at least 50% upfront, Hall extensions 100% of additional cost. Countdown never performs checkout/event completion. Local implementation evidence and remaining gaps are separate from acceptance; production remains closed.


**Implementation acceptance is tracked per phase**, not assumed from this document. Feature IDs are stable links for tickets/tests.

| ID | Feature | Acceptance behavior |
|---|---|---|
| CAT-01 | Package catalog | Double 3/6/12/24, Family 6/12/24; no Family 3h in UI or API; price snapshots on confirmation |
| CAT-02 | One-time extra bed | Available only for Family; ₱100 once per continuous stay; no per-person charge |
| INV-01 | Shared availability | Category inventory used by online and staff; no overbooking under simultaneous attempts |
| INV-02 | Time-aware conflicts | Start/end, cleaning buffer, maintenance and prior holds respected |
| RES-01 | Multi-room booking | One reservation, independent room-item package, schedule, status and occupancy |
| RES-02 | Staff room assignment | Guest never chooses room number; staff assigns Ready feasible physical room |
| PAY-01 | Online payment pending | QR and guest receipt screenshot, followed by staff ledger verification before `confirmed` |
| PAY-02 | Holds and proof | 30m proof deadline, pending-proof protections and escalations at 15/30/60m |
| PAY-03 | Cash/GCash ledger | Mixed walk-in payments, 50% min deposit, payment and refund audit |
| STAY-01 | Countdown | Walk-in starts at staff check-in; online uses confirmed scheduled end; never auto checkout |
| STAY-02 | Extensions/overtime | Availability safe; extension duration anchored at old end; 50% extension down; waiver reasons |
| CHG-01 | Partial cancellation | Cancel one room only, adjust reservation financial totals; other rooms unchanged |
| CHG-02 | Rescheduling | Staff approved, no silent booking shift; cancellation clock not reset |
| CHG-03 | Free cancellation | 1h from online confirmation; only for not-yet-checked-in room; manual GCash refund |
| NOS-01 | Late/no-show review | 1h grace at original start; staff flag and decide; no automated capacity release |
| OPS-01 | Housekeeping | Buffer + manual physical Ready separate from departure |
| OPS-02 | Maintenance | Block physical room and alert for existing booking impact |
| OPS-03 | Smoking policy | Disclosed/acknowledged; penalty staff applied or waived with reason |
| AUTH-01 | Individual staff | Same staff role, distinct identities; full audit |
| GUEST-01 | Guest/OTP | Registered and no-account booking; secure email verification |
| OPS-04 | Outage reconciliation | Manual log template, explicit replay process and conflict workflow |
| REV-01 | Review eligibility | Authenticated/verified primary guest, recorded check-in AND checkout; one public review per completed reservation |
| REV-02 | Public reviews + ratings | Public visitors may read; only eligible guests can submit 1–5 stars plus optional comment; fair publication includes negative ratings |
| REV-03 | Private feedback | Eligible guests may submit feedback visible only to authorized Staff/Admin; excluded from public average |
| REV-04 | Fair moderation | Staff may reply, hide and restore policy-violating public reviews with reason/audit; cannot edit stars/text or hide criticism merely for being negative |

## Critical workflow examples

### Online booking

1. Guest selects category, supported duration(s), room count and occupant counts.
2. Backend checks actual feasible capacity and creates payment hold in one transaction.
3. The guest reviews the stored base price, extra-bed fee, full amount and QR, then uploads a screenshot of the GCash receipt before expiry.
4. Backend transitions hold to `proof_pending_review` without releasing capacity at the 30m mark.
5. Staff confirms the GCash transaction actually exists, matches amount, payee and unused reference; then confirms safely.
6. Confirmation email contains original scheduled start/end and policy snapshot.

### Walk-in booking

1. Staff checks category availability, selects allowed package, records guest.
2. Staff records cash/GCash/mixed initial payment totaling **at least 50%**.
3. Staff selects physical Ready room and performs official check-in; stay starts **now**, not at payment creation.
4. Countdown and checkout warnings use persisted start/end. Any remaining balance due before normal checkout.

### Partial cancellation

- Locate a single `room_booking_id`, not just the reservation. Validate item's check-in status and online confirmation timestamp; compute itemized refundable portion and financial adjustments. Staff processes manual GCash refund if eligible; other items retain schedules/countdowns.

### Offline outage

- Staff logs room, occupant, actual start/end, payment method, payer reference, and operator. Once connected, reconcile against **current** cloud allocations before entering; conflicting activities need explicit staff exception handling, not silent insertion.

### Verified stay rating and private feedback (Phase 08)

- A public visitor can browse and see only published eligible reviews, but cannot rate without a verified checked-in-and-checked-out reservation. A cancelled booking or unarrived/no-show never earns an entitlement.
- The reservation's primary guest can leave **one** public 1–5 rating (comment optional) after a completed stay; multi-room reservations do not create additional review slots. Simultaneous/replayed requests cannot bypass the unique constraint.
- Logged-in guests use ownership authorization. Online no-account guests reuse the verified booking email via a short-lived, single-use invitation. Walk-in invitation delivery requires verified contact details, with fallback process pending approval.
- Review moderation cannot rewrite customer content. Legitimate 1-star feedback stays eligible; any hide/restore requires a policy reason, identified staff member and immutable audit. Private messages are never served by public review endpoints.
- Before feature activation complete REV test cases in [[15-testing-plan]] and confirm privacy/retention policy in [[18-backlog]]. See [[24-verified-guest-reviews]].

## Non-functional acceptance

- Deterministic money arithmetic (integer centavos); DB-level constraints and transactions.
- Secure audit records, protected upload storage, no trust in browser-submitted price.
- Reliable time calculations across browser refresh and multiple staff devices.
- Accessible readable UI with clear error, pending, expired and overdue states.
- Backup/restore test and documented release rollback.

See [[15-testing-plan]] for test IDs.
