---
tags: [security, roles]
status: baseline
---
# 03 — User Roles and Permissions

## Role matrix

| Action | Guest owner | Guest without account (OTP verified) | Staff/Admin |
|---|:---:|:---:|:---:|
| View catalog and calculate availability | ✓ | ✓ | ✓ |
| Place online booking and submit proof | ✓ | ✓ | On behalf if authorized |
| View own reservation(s) | ✓ | ✓ limited by verified email + token | ✓ all |
| Request room-item cancellation/reschedule | ✓ own | ✓ own verified | ✓ review/manage |
| Confirm GCash transfer received | — | — | ✓ manual against actual account |
| Accept cash / record mixed payments | — | — | ✓ |
| Assign/reassign room number | — | — | ✓ |
| Check-in/out, extensions and overtime | — | — | ✓ |
| Change room packages/prices/settings | — | — | ✓ |
| Manage cleaning, maintenance and incidents | — | — | ✓ |
| Read published public ratings/reviews | ✓ | ✓ | ✓ |
| Submit review after verified own checkout | ✓ own completed stay | ✓ verified link + completed stay | On own stay only; never fabricate guest reviews |
| Submit private stay feedback | ✓ own eligible stay | ✓ verified link + completed stay | ✓ view and respond within dashboard |
| Public review moderation / hide / restore | — | — | ✓ with reason + audit |
| Access financial reports and audit | — | — | ✓ |

**Staff/Admin = a single access tier**, not a shared staff credential. Each staff member owns an identity and audit trail. Future separation into manager/cashier is not part of v1.

## Identity requirements

- Staff authentication: password hashing (Argon2id suggested), secure sessions, session revocation and lockout/rate limiting; optional MFA later.
- Registered guests: verified ownership of email; may view only own reservations.
- Guest bookings without an account: email OTP with expiry, attempt limits, one-time use and protected reservation access; never expose a booking solely because an ID can be guessed.
- Authorization enforced in backend on every route, never based only on hidden frontend buttons.
- Sensitive actions require audit and some actions require confirmation dialog (refund/waiver/no-show/reassign/maintenance-release).

## Approval vs audit

No owner-only second approval role is required. Staff/Admin can approve operational decisions, while a distinct **audit record** captures actor, timestamp, subject, before/after, reason and monetary delta.

See [[08-security-and-risks]] and [[12-api-and-service-layer]].
