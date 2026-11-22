---
tags: [api, design]
status: proposed-not-implemented
---
# 12 — REST API and Service Layer Contract (Draft)

## Unified Online Booking implementation contract - 2026-11-21

Use the existing Express guest quote/reservation/proof and staff verification surfaces with a shared room/Hall selection and reservation relationship. Server pricing and ownership are mandatory; never trust submitted totals, allocations, confirmation or actor IDs. All-or-nothing hold and confirmation coordination wraps the existing room and Hall inventory mechanics in one database transaction. One proof/reference covers the full total. Keep existing item-operation endpoints and separate operational state machines; bounded manual refund and change operations must resolve the correct parent/item allocation. See [[superpowers/specs/2026-11-21-unified-online-booking-design]] and [[unified-online-booking-requirements-sync]] for implemented routes and remaining checks. Production gates remain closed.


**API version:** `/api/v1`. All routes below are **proposed, not deployed**. Final endpoints documented from actual implementation by Phase 04.

| Method | Route | Primary rule |
|---|---|---|
| GET | `/catalog/categories` | Public packages by category (Family excludes 3h) |
| POST | `/availability/quote` | Server calculates feasible room schedule and price quote |
| POST | `/holds` | Atomic claim creation for online payment, 30m proof deadline |
| GET | `/holds/:reference` | Authorized status + deadline |
| POST | `/holds/:reference/proof` | Upload screenshot/ref, transition to protected review state |
| POST | `/guest/otp/send` | Optional API wrapper around **Supabase Auth email OTP**; throttle and never disclose account existence |
| POST | `/guest/otp/verify` | Optional API wrapper around Supabase Auth OTP verify; issue/validate scoped identity |
| POST | `/staff/auth/login` | Optional API wrapper; default login uses Supabase Auth client and Express verifies session/active staff membership |
| POST | `/staff/reservations/walkin` | Create walk-in reservation with initial payment |
| POST | `/staff/reservations/:id/payments` | Record cash/GCash (actual verification needed) |
| POST | `/staff/payment-reviews/:id/approve` | Staff actual GCash verification + safe final booking confirmation |
| POST | `/staff/payment-reviews/:id/reject` | Dispute/reconcile/release per policy, never blindly for actual paid case |
| POST | `/staff/room-bookings/:id/check-in` | Ready assigned room + 50% rule for walk-ins |
| POST | `/staff/room-bookings/:id/check-out` | Balance/exception + cleaning transition |
| POST | `/room-bookings/:id/cancellation-requests` | Guest request, ownership checked |
| POST | `/room-bookings/:id/reschedule-requests` | Guest request; no automatic schedule change |
| POST | `/staff/requests/:id/decide` | Staff approval, availability and financial adjustments |
| POST | `/staff/room-bookings/:id/extensions` | Staff approve; ≥50% extension prepayment |
| POST | `/staff/rooms/:id/maintenance` | Block and reassignment impact check |
| POST | `/staff/rooms/:id/ready` | Explicit housekeeping Ready transition |
| GET | `/staff/audit` | Restricted paginated audit |
| GET | `/reviews` | Public paginated **published verified** ratings/comments plus true aggregate, no visitor identity required |
| POST | `/review-invitations/:token/verify` | Short-lived single-use token validation, do not reveal reservation or email details |
| POST | `/reviews` | Authenticated primary guest OR verified invitation; recorded check-in+checkout and unique reservation rating required |
| POST | `/private-feedback` | Verified eligible stay; route response to staff-only records, never public list |
| GET | `/staff/reviews` | Staff-only review/moderation queue, flags and audit state |
| POST | `/staff/reviews/:id/hide` | Policy reason mandatory, audit actor; cannot remove merely due to 1-star rating |
| POST | `/staff/reviews/:id/restore` | Audit actor/reason and restore publishability |
| POST | `/staff/reviews/:id/reply` | Staff response stored separately; never modify original guest review |
| GET | `/staff/private-feedback` | Authorized staff-only private feedback listings |

## Service boundaries

- `CatalogService`: packages, extra beds and immutable quotes.
- `AvailabilityService`: feasible room allocations; transactions, no overlap.
- `HoldService`: TTL/proof-submitted distinction and expiration job.
- `ReservationService`: parent/child item transitions, policy snapshots.
- `PaymentService`: manual GCash review, mixed payments and cash ledger.
- `StayService`: server timestamps, check-in/out, countdown and extension.
- `OperationsService`: housekeeping, maintenance, incidents, staff settings.
- `NotificationService`: outbox-backed OTP and reminders.

## API contract invariants

- Staff writes are authenticated/authorized; guests cannot spoof `verified_by` or price.
- All financial/booking mutations support idempotency and return stable reference IDs.
- `409 Conflict` for changed availability, `422` for invalid package, `403` for insufficient access, `202` for proof awaiting review (not confirmed).
- Never return payment proof URLs publicly; use signed short-lived requests for approved staff access.
- Revalidate safe capacity **inside** the transaction for a hold, confirmation, reschedule or extension. UI `available` preview is never a promise.

See [[06-architecture]] · [[07-database-schema]].

## Supabase API trust boundary

The **Supabase Auth client** may manage email/password or OTP sign-in in React; after login React sends an authenticated request to the **Express `/api/v1`** business layer. Express validates the Supabase token/identity and performs **its own** staff/guest ownership checks. No client-supplied `verified_by`, `paid`, `is_admin`, quoted totals, or room allocations are authoritative. Sensitive bookings/payments are written in backend transactions using PostgreSQL; avoid front-end direct Table Editor/Data API mutations of these tables.

Supabase Storage proof uploads should use narrowly scoped upload tickets / server-mediated paths with private bucket policies; record object keys, not permanent public URLs. See [[22-supabase-setup]].

## Verified guest review service boundary (Phase 08 only)

- `ReviewEligibilityService`: query authoritative completed check-in **and** checkout event(s) for a reservation and bind review right to its primary guest. Auth status alone is insufficient.
- `ReviewInvitationService`: reuse verified online guest booking email, or verified walk-in contact; issue hashed expiring single-use links; throttle/expire/revoke; use transactional consumption.
- `GuestReviewService`: server validates one public 1–5 rating per reservation (multi-room counts once), optional comment, sanitization and abuse flags; publish eligible genuine feedback of any rating, aggregate only published reviews.
- `FeedbackService`: private guest messages remain staff-only and cannot leak through any public API/SQL view.
- `ReviewModerationService`: staff may respond, flag, hide or restore for **documented policy violation**, with reason and immutable audit; cannot rewrite ratings/comments, and negative sentiment is not a policy violation.
- **API response controls:** never disclose guest contact/identity, invitation secrets, reservation references, or sensitive moderation evidence in public ratings endpoints. See [[24-verified-guest-reviews]].
