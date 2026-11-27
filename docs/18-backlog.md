---
tags: [backlog, pending, owner-input]
status: triaged
---
# 18 — Open Questions & Prioritized Backlog

## Unified Online Booking - UB-01 through UB-06, 2026-11-21

The owner's implementation request resolves the earlier mixed-booking policy questions. This section supersedes older statements below that describe these decisions as pending or restrict customer Hall bookings to staff inquiries. Implementation and acceptance evidence are recorded separately in [[unified-online-booking-requirements-sync]].

- **UB-01:** All online accommodation, Hall-only and combined reservations require 100% upfront verified payment. Staff-managed Hall reservations retain their existing minimum 50% deposit.
- **UB-02:** Guests upload one private GCash receipt screenshot for the online reservation. Staff record the reference from the verified GCash ledger entry. Keep one authoritative payment and item allocations, separate room/Hall reporting and global reference uniqueness.
- **UB-03:** Check every selected resource and obtain all room/Hall claims atomically. One 30-minute proof deadline applies. Timely proof protects every selected item until staff resolves verification; otherwise expire all initial holds together. Preserve paid-late reconciliation and manual refund safeguards.
- **UB-04:** Staff verify the full amount and confirm all items atomically. The same persisted reservation appears in staff management without re-entry. Generate one itemized confirmation and enqueue its email; retain 15-minute review target and 30/60-minute escalation. Assignment, check-in and actual event start remain staff actions.
- **UB-05:** Free online cancellation ends at one hour after staff confirmation or that item's actual room check-in/Hall start, whichever is earlier. Cancel/refund independently, release only the cancelled capacity and preserve siblings. GCash refunds are manual, itemized, idempotent and bounded by attributable verified payments.
- **UB-06:** Independent rescheduling/extensions require staff approval and availability checks. Accommodation extensions retain at least 50% upfront; Hall extensions require 100% of additional cost. Preserve immutable prices, financial safeguards and unaffected items.

Theater Type (70 attendees) and Room Type (50) are configurations of **one exclusive physical Hall**, not separate inventory. Preserve existing configured operating hours, notice, buffers and approved start-time pricing. Provisional operational defaults are not new owner-approved facts. No hosted access/application, real payment/email, production gate, commit or push is authorized by this implementation task.
## Function Hall online booking update — 2026-11-21

Owner confirmed customer self-service online booking, public availability with unavailable/in-use slots blocked, and full verified payment before confirmation. Staff inquiry is no longer a prerequisite. Payment method/provider, payment window, failed-payment reconciliation and all other hall-specific open policies remain pending; do not import accommodation terms. See [[future-function-hall-requirements]] and [[17-decisions]].


## Final Analytics scope revision - 2026-11-20

Owner-approved Analytics scope is **only Revenue Analytics, Room Category Performance and Package Popularity**, with date-range filtering and staff-only on-screen access; see [[future-analytics-and-reports]]. This supersedes the earlier six-feature proposal and related historical scope statements. Payment & Outstanding Balance Reports, Room Occupancy Analytics, Booking Analytics and Peak Hours & Demand Analytics are excluded as dedicated analytics/dashboard features and must not return under alternate labels. Existing operational availability, check-in/out, payments, balances, manual refunds, booking management and stay-duration monitoring remain unchanged.

Order: finish remaining core features, implement the three approved Analytics features, implement Function Hall Reservation & Management, then complete integration, testing, acceptance and deployment preparation. Preserve all confirmed [[future-function-hall-requirements|Function Hall requirements]] and pending owner decisions. X01-X03 checkpoints remain implemented; all 14 Supabase migrations remain owner-confirmed synchronized. Existing acceptance gaps stay open, live transactions stay disabled and both future modules remain unimplemented. Documentation only; no next implementation task begins.


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

## Owner-confirmed future modules - 2026-11-20

Approved future Analytics scope: [[future-analytics-and-reports]]. The hotel also offers a separate Function Hall resource with Theater Type maximum 70 persons / Room Type maximum 50 persons; approved start-time-based pricing and inclusions are in [[future-function-hall-requirements]]. Neither software module is implemented. Hall inventory is not bedroom inventory; all existing accommodation counts/rates remain unchanged.

Hall resource count/exclusivity, fractional excess-hour treatment, latest ending time/cross-midnight use, deposit, payment methods, cancellation/rescheduling/refunds, preparation/cleaning buffer, equipment/service charges and mineral-water quantities remain owner questions required before hall implementation. Starts before 8:00 AM are unsupported until clarified. Do not import accommodation policies. Analytics revenue recognition and contribution definitions also require review before their acceptance. No new official backlog/task IDs are assigned here. Approved sequence is recorded in [[13-development-roadmap]].
