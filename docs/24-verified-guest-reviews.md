---
tags: [reviews, feedback, phase-08, approved-feature]
status: approved-for-planning-not-implemented
---
# 24 — Verified Guest Ratings, Reviews & Private Feedback

**Decision:** D-038 (2026-11-16). **Phase:** 08 optional enhancement; **do not start before checkout / guest ownership infrastructure exists**. This is a specification, not a production implementation or completed owner policy signoff. See [[02-requirements]], [[15-testing-plan]], [[phases/08-housekeeping-maintenance-and-reporting]], [[18-backlog]].

## Why this feature exists

Visitors should be able to assess the hotel through genuine customer experiences, while staff receive private constructive feedback. The system must prevent anonymous website spam and repeated ratings **without suppressing honest negative guest reviews**.

## User journeys and access

| Person | Browse site and public reviews | Write public 1–5-star rating/review | Submit private feedback |
|---|---|---|---|
| Anonymous website visitor (never stayed) | Yes, no login/email needed | **No** | No authenticated stay feedback; public contact channel may be designed separately |
| Registered online guest, reservation only | Yes | **No**, not until recorded check-in and checkout | Only after qualifying stay |
| Registered online guest, completed recorded stay | Yes | Yes, ownership checked | Yes |
| No-account online guest with verified booking email and completed recorded stay | Yes | Yes through expiring single-use review invitation | Yes with verified claim |
| Walk-in customer with completed recorded stay and verified contact | Yes | Yes via verified review access | Yes |
| Staff/Admin | Yes | No special capability to fabricate guest ratings | Read/respond to private feedback; moderate public content per policy |

## Binding eligibility to a real completed stay

1. A **primary guest** belongs to a real `reservation`, possibly containing multiple `room_bookings`.
2. At least one related room item must have a **staff-recorded check-in** and then **completed checkout**. A paid booking alone, cancelled-only booking or no-show is ineligible.
3. The backend validates the actor is the rightful guest: authenticated/verified account or reservation-scoped single-use link to a previously verified contact. Never grant eligibility based only on a public reservation code, typed name, screenshot or guessed email.
4. **One public review per parent reservation**, even for multiple booked rooms. A unique DB constraint and transactional endpoint must prevent parallel or repeated submissions.
5. Public rating: integer **1–5 stars**; written public comment optional; safe escaping/sanitization, size/rate limits, privacy-friendly display alias. A separate **private feedback** option routes text to staff only.
6. Do not submit for the guest on staff's behalf or allow staff to impersonate the reviewer. The review's verified-stay badge denotes a checked-out recorded stay, not an independent guarantee about the truth of opinions.

## Review invitation and contact verification

- **Account guest:** sign in, backend checks reservation ownership + checkout event.
- **No-account online guest:** guest already verified an email with OTP during booking. Following actual checkout, send a **short-lived, single-use, reservation-bound link** to that same verified address; store token hash, expiry, consumption and send attempt, not plain token.
- **Walk-in:** capture an optional email or other contact method and **verify control of it** before sending a review invitation. The exact safe alternative for walk-ins without a verifiable email is **P11 pending**; do not allow anonymous token-free reviews as a workaround.
- Staff cannot invite a different unverified address to impersonate the primary guest. Retry, revocation, bounce, rate-limit and link forwarding risks must be handled before rollout.

## Public publication and fairness

- Verified eligible ratings publish regardless of star count. Legitimate 1-star opinions are included in the public average; never build a filter like `stars >= 4`.
- Reviews may be held or flagged for **objective content policy violations** (spam, threats, harassment, personal details, fraud indicators). Moderation is not a general requirement for staff to approve positive sentiment.
- Staff may **reply** as hotel representative or **hide/restore** a review after specifying a concrete policy reason. The source rating/comment remain immutable to staff. Hide/restore operations record staff account, timestamp, action, reason and prior/new status, with a reviewable audit log.
- Public aggregate uses only valid **published** ratings; provide rating count and transparent labeling. Suspended policy-violating reviews are excluded only while validly hidden. Private feedback is never in public results.
- Publish a clear moderation/privacy policy and let a guest appeal an incorrect removal when practical (P12). Never disclose personal booking details in a staff public reply.

## Proposed data model (not an applied SQL migration)

- `guest_reviews`: unique `reservation_id`, `guest_id`, stars 1–5, optional comment, safe public alias, publication status, submitted timestamp.
- `review_invitations`: reservation binding, verified guest/contact, **hashed** one-time token, expiry/redeemed timestamps, delivery metadata.
- `private_feedback`: reservation/guest binding, message, staff-only visibility/status.
- `review_moderation_events`: review id, staff actor, action, reason, time and before/after status. Staff public replies should be separately stored/attributed.

Server-side authorization and Supabase policies must protect writes; anonymous readers get an explicitly redacted **published** view only. The React client must not be able to use a Supabase publishable key to insert unverified review rows directly.

## Frontend and service boundaries

- Public `/reviews`: review list, distribution and average; accessible without sign-in. No hidden guest contact or reservation reference.
- `/reviews/submit`: only after verified completed stay; 1–5 stars plus optional comment; clear success/duplicate/expired messages.
- `/feedback/private`: checked-out verified guest may send staff-only feedback.
- `/staff/reviews`: moderation queue, customer-safe public reply, hide/restore with mandatory reason, audit.
- `/staff/feedback`: private staff inbox; never public.
- API: validate from authoritative DB states, not client-reported `checked_out=true` or visible button state; see [[12-api-and-service-layer]].

## Required tests and launch gate

Before exposing this feature: T31–T38 in [[15-testing-plan]] must pass, including non-guest spam, paid-but-no-show, guest invitation reuse, walk-in verification, multi-room duplicate races, real 1-star publishing, public average accuracy and private data access. Confirm review consent, legal/privacy retention, moderation standards and owner policy decisions P11–P13. **Keep feature disabled until passed**; release of hotel core booking must not be blocked by an unfinished optional enhancement.

## Graphify

See [[graphify/review-lifecycle]] for the planned review life cycle. Index actual code only after implementation exists; Mermaid is a specification, not an extracted code graph.
