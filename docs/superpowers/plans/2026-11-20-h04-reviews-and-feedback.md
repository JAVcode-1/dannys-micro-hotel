# H04 Reviews and Feedback Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for native execution and superpowers:test-driven-development for each code task. Obtain one final independent review.

**Goal:** Deliver verified public reviews and confidential feedback behind closed H04 feature gates.

**Architecture:** Express reuses Supabase guest OTP and active-staff identity. Private PostgreSQL records enforce reservation ownership, deadlines, uniqueness, and audited state changes. React uses the existing guest and staff shells.

**Tech stack:** React, TypeScript, Tailwind, Express, pg, Supabase Auth, and PostgreSQL.

**Spec:** [Approved H04 written specification](../specs/2026-11-20-h04-reviews-and-feedback-design.md).

## Global constraints

- One public rating per parent reservation, including after withdrawal. Eligibility starts at the first same-item recorded check-in and completed checkout. Public submission closes after 30 elapsed days.
- Invitations are single-use and expire after 24 hours. Replace within the public submission window only, with rate limiting and atomic revocation of superseded unused invitations.
- Fresh OTP against the existing verified reservation contact may authorize feedback or withdrawal independently of the public submission window. It grants neither public submission nor duplicate-rating rights.
- Publish eligible compliant reviews of every star value. Preserve the original guest rating and comment. Require public-content consent and separate optional private follow-up consent.
- Keep H04 closed, use simulated delivery and a disposable loopback PostgreSQL database, and keep the candidate migration unapplied to hosted Supabase. Preserve existing live gates and reconciliation blockers. Function Hall, UI Refinement and real hotel assets are outside scope.

## Review focus

- OTP challenge substitution across reservations, emails, and purposes.
- Invite replacement versus redemption, and duplicate ratings during concurrent withdrawals or submissions.
- Deadline boundaries measured from the first qualifying room checkout, including sibling-room changes.
- Contact enumeration including different responses for known, unknown, or throttled reservations.
- Leakage through HTTP projections, browser credentials, delivery errors, moderation history and staff replies.

## File map

| Files | Responsibility |
|---|---|
| `supabase/migrations/20261120001600_verified_guest_reviews.sql` | Private tables, constraints, privileges and immutable history. Confirm the next unused migration version at execution. |
| `packages/shared/src/reviews.ts`, `packages/shared/src/index.ts` | Public, verified guest and staff API contracts |
| `backend/src/review-access.ts`, `backend/src/review-routes.ts`, `backend/src/app.ts` | Eligibility, OTP and invitation access, and gated route registration |
| `backend/src/reviews.ts`, `backend/src/review-staff.ts` | Public and private write transactions, published projections, and staff actions |
| `backend/test/h04-reviews-postgres.mjs`, `backend/test/zz-v02.integration.mjs`, `backend/test/review-routes.test.mjs` | Isolated PostgreSQL fixtures and Express contracts |
| `frontend/src/GuestReviews.tsx`, `frontend/src/GuestReviewAccess.tsx`, `frontend/src/StaffReviewDesk.tsx`, `frontend/src/App.tsx`, `frontend/src/StaffLogin.tsx`, `frontend/test/reviews.test.mjs` | Public reviews, verified forms, and staff moderation and feedback |
| `docs/14-milestones.md`, `docs/17-decisions.md`, `docs/icm/PROJECT-CONTEXT.md`, `docs/phases/08-housekeeping-maintenance-and-reporting.md` | Checkpoint evidence and outstanding activation conditions |

### 1. Establish the private model and authoritative eligibility

- [ ] Add failing PostgreSQL tests through `zz-v02.integration.mjs` using recorded check-in and checkout rows. Cover check-in-only, paid/no-show, different-room evidence, out-of-order checkout, cancelled siblings, two completed items and the exact deadline. Assert that one qualifying room yields the first recorded qualifying timestamp, and the deadline is exclusive.
- [ ] Add the candidate migration. Make review reservation identity unique across all lifecycle statuses, constrain integer stars and bounded text, and separate public review, contact binding, invitation, short-lived grant, private feedback, reply and action records. Enable RLS and revoke browser-role privileges on all private records. Use foreign keys for identity links and enforce immutable guest content and action history. Keep private inbox status and moderation state changes transactionally coordinated with their audit inserts.
- [ ] Implement `loadReviewEligibility(client, reservationId)` in `review-access.ts`. Select `MIN(checked_out_at)` from checkout joined to the same reservation's check-in and room item, requiring checkout after check-in. Obtain authoritative current time at submission and compare against the first timestamp plus 720 hours. For registered access, reuse the verified user ID and normalized-email ownership predicate. Neither a client-reported outcome nor a booking reference can authorize access.
- [ ] Run the new subtests with the existing loopback PostgreSQL harness. Verify no hosted connection and inspect direct grants for `anon` and `authenticated`.

### 2. Implement consented contact enrollment and scoped access

- [ ] Write failing tests for OTP challenge substitution, delayed/replayed codes, forged enrollment, different email, absent consent, replacement/redeem races, issue quota, and a completed-stay request beyond day 30. Assert that an OTP grant for feedback or withdrawal is rejected by the public submission route even before its deadline.
- [ ] Implement staff-assisted walk-in enrollment. Active staff initiate a short-lived reservation-bound pairing, with the primary guest entering or confirming their email and separately opting into invitations. Bind the OTP challenge to the enrollment, normalized target email and reservation before verifying the code through the existing Supabase email OTP mechanism. Commit the verified binding only after matching a fresh successful provider verification. Preserve ordinary walk-in operation without enrollment or invitations. Never allow an email-change request to overwrite an established verified binding in this feature.
- [ ] Implement an access service that issues random opaque tokens, stores digests, and atomically locks the reservation when replacing or consuming credentials. Use the same transaction order for issue and redeem, including revoking superseded unused tokens. Use database time for expiry and record delivery outcome without storing plaintext tokens. A delivery failure can be retried by issuing a replacement within the rate budget. Inject a test delivery adapter. Keep production delivery closed until the approved contact and delivery setup is accepted.
- [ ] Add a fresh-OTP challenge flow for `feedback` or `withdrawal`. Resolve the target privately to the existing verified reservation contact, send only to that contact, and match the successful provider response to the challenge email, reservation and purpose. A pre-existing logged-in session alone cannot satisfy a fresh challenge. Issue a short-lived, digest-backed reservation grant with one purpose. Use a common outward response for unknown, mismatched and throttled initiation. Apply bounded per-source and per-reservation/contact rate limits, including across server instances for reservation-level issue quotas. Use POST bodies for secrets and reject stale or superseded challenges on consume.
- [ ] Test with synthetic emails and a simulated OTP adapter. Exercise public deadlines and one-rating uniqueness separately from grant expiry. Re-run isolated concurrency tests for reservation locking, replacement and redemption.

### 3. Implement guest writes and publication

- [ ] Write failing cases for public consent, stars outside 1–5, duplicate and conflicting retries, parallel multi-room writes, verified withdrawal after day 30, feedback independent of public rating, and published-only aggregates. Example acceptance assertion:

  ```js
  assert.equal(race.filter((response) => response.status === 201).length, 1);
  assert.equal((await readPublicSummary()).count, 1);
  ```

- [ ] Implement registered and invitation-based `POST /reviews`, plus verified `POST /reviews/withdrawal` and `POST /private-feedback`. In the transaction, bind actor or claim, owner, reservation, intent, and idempotency key to the normalized payload. Check deadline at public submission and enforce the unique reservation key even after withdrawal. Keep a withdrawal event and remove the review from published results. Require verified contact for consented follow-up and keep that consent separate from public review consent.
- [ ] Add paginated `GET /reviews` using a single snapshot for rows, count, distribution and average. Return an allowlist of random public review ID, generated alias, rating, optional text, publication date and public reply. Include no booking identifiers or private data. Verify that genuine one-star reviews are published and counted under the same policy as five-star reviews.
- [ ] Run focused Express tests and isolated PostgreSQL concurrency and ACL tests. Assert direct table access fails for browser roles and private feedback never appears in public JSON.

### 4. Add staff moderation, replies and private inbox

- [ ] Write failing tests for inactive staff, missing reason, low-rating-only moderation, invalid state transitions, withdrawal restoration, and audit rollback. Verify the original comment and stars remain identical before and after moderation.
- [ ] Use the existing active-staff middleware and recheck active membership in each mutation transaction. Implement paginated `/staff/reviews` and `/staff/private-feedback` and scoped action endpoints. Lock the subject row, validate policy reason and state, and atomically append actor, timestamp, reason, request identity and prior/new state. Prevent moderation restoration from reversing a guest withdrawal. Store public staff replies separately. Present only verified, consented follow-up contact to authorized staff and audit its access or use.
- [ ] Implement New, In Progress and Resolved in the staff inbox. Test valid transitions, repeats, unauthorized actions and audit failure rollback. Keep reconsideration routed through the eventual approved contact channel and retain data pending owner policy.

### 5. Integrate the React screens and feature gate

- [ ] Write failing UI coverage for accessible rating selection, public consent, expired links, withdrawal, private-only feedback, navigation and session change. Exercise sanitized text rendering and removal of invitation secrets from navigation after redemption.
- [ ] Wire `/reviews`, `/reviews/submit`, `/feedback/private`, `/staff/reviews` and `/staff/feedback` into the existing shells. Add the optional walk-in email enrollment entry only to the gated H04 workflow. Keep verify and submit calls in Express. Use loading, empty, expired, conflict and unavailable states. Avoid persistent browser storage for invitation grants.
- [ ] Verify normal registration leaves H04 public, guest and staff routes inert, including delivery. Enable only through isolated test injection. Run frontend tests and exercise keyboard and responsive layouts with synthetic data.

### 6. Verify and checkpoint

- [ ] Run T31–T38, all focused regression cases, `npm run build`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` and isolated `npm run test:db`. Verify H04 tests actually ran and report migrations applied only on the disposable test instance.
- [ ] Obtain one independent read-only review covering authorization, OTP scope, rating uniqueness, content privacy and audit atomicity. Fix confirmed critical or major findings and rerun affected and full checks. Follow the repository's full gate only if claiming major-milestone or predeployment acceptance.
- [ ] Update milestone, decision, phase and context notes with actual results and remaining owner policy, delivery and pilot acceptance. Review the full in-scope diff, explicitly stage only H04 paths, and run the staged secret scan with redaction.
- [ ] After implementation authorization and successful verification, commit a Conventional Commit on current `main`, push to existing `origin` and verify the remote ref. Stop at the H04 development checkpoint. Keep H04 gates closed pending hotel-owner signoff and acceptance.
