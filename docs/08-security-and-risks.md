---
tags: [security, risk, privacy]
status: required-controls
---
# 08 — Security, Privacy & Risk Register

| ID | Risk | Control | Verification |
|---|---|---|---|
| R01 | Simultaneous online/walk-in double-booking | Serialized category-capacity transaction; provisional physical allocation; idempotency | Parallel API test with 15-room inventory |
| R02 | Fake/duplicate GCash screenshot | Staff verification against actual account, unique verified reference, proof review workflow | Duplicate reference & mismatched amount tests |
| R03 | Proof submitted but timed hold released | State machine separates proof-awaiting from protected review queue | Advance fake clock past 30m during submitted proof |
| R04 | Guest sees another reservation | Guest ownership + OTP scoped access; backend authz | Object-level authorization tests |
| R05 | Staff shared account untraceable | Individual Staff/Admin login; audit actor FK | Audit completeness test |
| R06 | Unauthorized file access | Private object storage, signed short-lived download, malware/type/size checks | Direct URL access denied |
| R07 | Incorrect GCash refund recipient | Verify recipient, human-approved transfer, logged reference | Refund workflow & identity review |
| R08 | Money rounding/pricing manipulation | Integer centavos, backend-generated prices/snapshots | Tampered price payload rejected |
| R09 | Room readiness bypass | Room state check + turnover + staff Ready action | Check-in rejected if still cleaning |
| R10 | Unlawful minors/occupancy processing | Owner/legal review; minimum needed guest info; no assumed ID-photo requirement | Compliance signoff before release |
| R11 | Manual outage double-booking | Mobile internet backup, outage log, reconnect reconciliation | Tabletop outage simulation |
| R12 | Email OTP brute force | Expiry, hashed code, per-IP/email throttling, one-use | Lockout/replay tests |
| R13 | Personal data leakage in audit | Mask guest identifiers; structured audit w/ restricted access | Log scan, permission audit |
| R14 | Cloud outage or data loss | Encrypted backup, tested restore, monitored errors | Recovery drill and rollback |
| R15 | Fake reviews by site visitors or non-staying bookings | Backend checks primary-guest ownership plus recorded check-in AND checkout; unique review per reservation | Visitor, paid-no-show and forged-reservation review requests denied |
| R16 | Rating inflation/deflation by duplicate/replayed invitation | Hashed single-use expiring tokens, email ownership, atomic unique constraint and rate limit | Link replay/concurrent double-submit tests |
| R17 | Selective deletion of legitimate negative feedback | Publish genuine positive and negative; staff policy-limited hide/restore with mandatory reason and immutable audit | Legitimate 1-star visible; unjustified removal rejected |
| R18 | Leak of private feedback or guest identities | Separate private feedback access, optional public alias, safe output fields, anti-enumeration and retention | Public API cannot return private text, email, token or booking ID |

## Minimum security checklist

- [ ] HTTPS, secure cookies/session controls, CORS restricted to expected origins.
- [ ] Parameterized queries/ORM; server-side schema validation and size limits.
- [ ] Secrets via environment/secret manager, **never committed to Git**.
- [ ] Signed access for private proofs; configurable retention and secure deletion.
- [ ] Human verification of GCash and explicit staff approvals for penalties, waivers, refunds and releases.
- [ ] Audit trail for critical edits, manual overrides and reconciliation; records not casually editable.
- [ ] Data Privacy Act/related local rules, hotel guest registration, child safeguarding, fire-safety/occupancy and receipt obligations reviewed with appropriate qualified people; requirements **not certified** by this planning package.
- [ ] **Before enabling reviews:** restrict eligibility server-side to recorded stayed-and-checked-out bookings, redact public profile data, store review link **hashes**, prevent duplicate ratings, audit moderation and apply an objective published moderation policy that does not suppress honest criticism.

## Non-negotiable safeguards before pilot

`R01`–`R07` and `R09`–`R12` must have passing tests and responsible-person review. If legal occupancy and minors policy are unresolved, disable unsafe booking combinations or require explicit manual compliance review; do not describe capacity as unlimited.

## Supabase-specific safeguards (approved platform, implementation requirements)

- The browser receives **only** `SUPABASE_URL` and **publishable key**. A publishable key is not an authorization rule: enable/test **RLS** on every browser-exposed table and Storage object policy.
- Supabase **secret key** and `DATABASE_URL` remain **server-only**; secret keys can bypass RLS, so API-level staff/guest authorization and complete audit logs are mandatory.
- Supabase Auth provides credential lifecycle and OTP; staff permissions live in controlled server-side records. Deny role escalation via public signup or client-supplied JWT metadata.
- Put payment screenshots in a **private** Storage bucket. Use short-lived signed access for verified staff, validate MIME/type/size, rate-limit uploads, define retention, and protect against cross-reservation object access.
- Use isolated Supabase projects or equivalent isolation for dev/staging/production; redact test data and verify backup/restore on the actual plan. Do not assume all restore features exist on every tier.
- Load and concurrency tests must exercise **real Supabase PostgreSQL transactions**, not browser-side availability reads.

See [[22-supabase-setup]] and [[05-tech-stack]].
