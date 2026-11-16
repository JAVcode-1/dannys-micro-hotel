---
tags: [backlog, pending, owner-input]
status: triaged
---
# 18 — Open Questions & Prioritized Backlog

> Do not turn a blank into a fictional fact. Unresolved owner answers should be **configurable, explicitly pending, or feature-gated**. Core architecture work can proceed without pretending these are settled.

## Blocking before relevant production feature

| ID | Question / dependency | When needed | Safe interim action |
|---|---|---|---|
| P01 | Actual identifiers/numbers for 15 physical rooms | Phase 03/pilot | Use clearly labelled fake room IDs in development only |
| P02 | Cleaning/turnover buffer default minutes | Phase 03/pilot | Configurable; no claimed correct default, require staff entry |
| P03 | Verified legal/safety occupancy max and minors registration/eligibility rules | Public booking pilot | Show advisory only, require staff review; obtain qualified compliance advice |
| P04 | Real hotel GCash QR and verified recipient/payee identity | Real online payments | Test fixture only; no real paid-booking launch |
| P05 | Government-compliant receipt/tax/document procedures for hotel | Production checkout and finance | Offer internal transaction statement clearly **not official receipt** |
| P06 | How many extra beds can be rented concurrently and whether ₱100 is per bed | Family extra bed UI | Single-bed option only in development, final inventory/quantity pending |
| P07 | Extra-bed policy for split room-item cancellations or transfer between item bookings | Phase 07 | Itemize charge; manual staff review until documented |
| P08 | Owner's actual room number/cleaning and maintenance readiness workflow | Pilot | Draft process only, validate with front desk |
| P09 | Legal approval of disclosed smoking/cancellation/no-show terms and data retention | Public booking | No automatic fees/refunds; compliance review |
| P10 | Reusable hotel logo file and photo usage permission for actual exterior and rooms | Public site publishing | Use clearly sourced owner-supplied photo reference only in project docs; publish after approval |
| P11 | Verified contact procedure for walk-in review invitation (email vs alternative), consent for invitation email | Before review rollout in Phase 08 | No invitation without verified contact/guest authorization; disabled until confirmed |
| P12 | Written review moderation policy, guest-visible pseudonym/consent, retention and appeal process | Before reviews are visible publicly | Develop policy with owner/privacy review; never filter by star count |
| P13 | Whether public reviews may be edited by author and how edited reviews are rechecked | Phase 08 implementation | Initially one immutable rating per reservation; propose support for authorized edit in a separate ADR |

## Technical decisions to resolve during early coding (not new hotel interviews)

| ID | Decision | Proposed default |
|---|---|---|
| T01 | ORM and migrations | Choose one for Phase 01 ADR, with raw transactional SQL allowed for availability |
| T02 | Staff session implementation | Secure server-backed or well-configured rotating session; no JWT in localStorage |
| T03 | Email/SMS provider | Email first for v1; SMS optional later |
| T04 | Provisional room-slot assignment algorithm | Transactionally feasible interval allocation with tests and audit |
| T05 | Payment review queue execution | Durable DB state + background job/outbox |
| T06 | Cloud provider and budget | Choose after staging and test strategy |
| T07 | Long-stay package combination optimization | Display transparent combination, owner confirmation for ties/discounts |

## Version 2 / optional backlog

- More granular roles beyond unified Staff/Admin.
- Live offline-first local app and automatic conflict resolution.
- Payment gateway/webhooks, auto-refund API if legally and commercially supported.
- Branch expansion, richer preventive maintenance, third-party travel channel sync, SMS provider and advanced forecasting.

## Done definition for a pending item

Write owner-verified answer + date to [[17-decisions]], change [[02-requirements]] and associated phase tests, and update ICM if active. Never silently replace the earlier rule.

## Supabase platform follow-ups (added 2026-11-12)

- [ ] **Dev onboarding (F02):** create accessible isolated Supabase development project/CLI stack; choose nearby region and confirm billing/quotas.
- [ ] **Database access (F02):** choose direct IPv6 vs session-mode pooler (IPv4) appropriate for Express host; protect credentials and implement safe SQL migrations.
- [ ] **Supabase Auth (Phase 02, recommended):** configure staff logins, invitation/recovery and OTP mail sender, throttling, role checks and RLS tests.
- [ ] **Supabase Storage (Phase 05, recommended):** private proof uploads and signed-download checks; public hotel media only if owner approves use.
- [ ] **Deployment (Phase 09):** choose web and independent Express hosts, confirm Supabase tier/cost and recoverable backups. Supabase doesn't automatically host Express.

See [[22-supabase-setup]].
