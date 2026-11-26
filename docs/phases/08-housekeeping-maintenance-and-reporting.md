---
tags: [phase-08, implementation, operations]
status: h03-a-development-checkpoint-acceptance-pending
---
# Phase 08 — Housekeeping, Maintenance, Incidents & Reporting

## Confirmed Ready ends checkout turnover (2026-11-24)

Explicit staff Mark Ready ends the checkout cleaning block after confirmed cleaning and preserves its originally scheduled end for audit. The existing availability and check-in checks use the effective end. Maintenance, active claims and readiness evidence continue to apply. The new migration also releases outstanding blocks with a recorded Ready event. The owner-approved migration was applied to the linked Supabase development project and released one outstanding turnover block. API and Vite startup were verified. Manual acceptance remains pending.


## H03-A development checkpoint - 2026-11-20

The owner authorized the incident and audit slice only. The X03 staff incident desk, policy/disclosure enforcement, charge and waiver writes, and immutable ledger remain the source of truth. H03-A adds T23 evidence for the recorded actor, reason and time, waiver and approved-charge retries, immutable history, and payment and sibling-item preservation.

Authenticated active staff can search the **Staff audit** page or `GET /staff/audit` by actor, action, Manila date range and recorded subject. The query reads an allowlisted projection of existing audit, room, housekeeping, maintenance, payment review and booking/financial event records. It prefers authoritative subject-bearing events over their duplicate generic audit entries. Historical rows without durable subject evidence remain subjectless. Results omit free-form notes, guest/payer data, credentials, GCash proof and payment references. Pages are bounded and ordered by the full database timestamp and a source-qualified event ID.

No schema migration or new dependency was needed. H01 and H02 remain unapplied to hosted Supabase, with the legacy Ready-room reconciliation and other hosted inventory conditions pending. Live mutation gates remain closed. The room-board `pending_review` versus `proof_pending_review` badge defect is tracked separately. Analytics & Reports still requires owner approval of revenue recognition and allocation rules. H04 and Function Hall remain outside this checkpoint. Formal Phase 08 acceptance remains open.

Build, typecheck, lint and formatting passed. All 128 application tests (87 backend and 41 frontend) and 21 isolated PostgreSQL tests passed with no failures or skips. The isolated suite included H01 and H02, T23 policy and disclosure enforcement, charge and waiver retry evidence, exact Manila date boundaries, stable pagination across tied timestamps, subject filters and masking. Hosted acceptance and the full milestone quality gate remain pending.

## H02 development checkpoint - 2026-11-20

The owner approved H02 only. H02 uses existing room states and room blocks. Express checks staff identity and PostgreSQL rechecks active membership, then serializes changes in category, block-table and room order. Opening rejects occupied rooms and open stays. Opening, progress and clearance append immutable events with server timestamps and commit with the staff audit. Exact actor and payload retries return the recorded event.

The board shows maintenance history and overlapping room items, with a staff resolution flag when the reservation has a recorded payment. Opening preserves all existing claims and bookings. It blocks new allocation to the room, and the existing allocator can conservatively reject new availability when it cannot satisfy all protected claims during maintenance. Clearance ends only its own block. Rooms with outstanding H01 requirements return to cleaning, and previously unverified rooms remain unverified. Returning a previously Ready room to service requires explicit staff confirmation, any required H01 event and elapsed turnover protection.

Candidate `20261120001500_room_maintenance.sql` depends on H01 and remains unapplied to hosted Supabase. Normal API registration keeps maintenance writes closed. **Deployment blocker**: H01 can show a legacy Ready room with checkout history as available while refusing check-in because the latest checkout lacks a Ready event. H02 does not change the legacy records or resolve hosted reconciliation. H01 and H02 require separate hosted reviews and authorization. Staff and device acceptance and formal Phase 08 checkboxes remain pending.

Verification: build, typecheck, lint and format checks passed, along with 125 application tests and 20 isolated PostgreSQL tests with H01 and H02 applied locally. Coverage includes T20 allocation against the persisted maintenance block, T22 paid reservation alerts, duplicate actions, check-in contention, active-staff enforcement, rollback, immutable events, explicit clearance, H01 continuation and sibling protection. No Phase 08 formal acceptance or full milestone quality gate is claimed.

## H01 development checkpoint - 2026-11-20

The owner explicitly approved the bounded H01 design and implementation. This supersedes the historical development pause for **H01 only**. H02/H03/H04 and Function Hall are not implemented or authorized by this checkpoint. Phase 07/08 formal acceptance remains pending; all formal checkboxes below stay open.

Dependencies: existing W03 checkout/immutable turnover blocks, W02 Ready-only check-in, shared category/table/room transaction locking and individual active staff. The prior **14 migrations remain owner-confirmed synchronized**, not independently rechecked here. Candidate `supabase/migrations/20261120001400_housekeeping_ready.sql` is local and **unapplied to hosted Supabase**. No hosted query/write, reset, seed or live activation was performed. No dependency or dev-command change.

Implemented: preserve `cleaning`/`ready`/`occupied`/`maintenance` states; add private immutable start, finish and explicit Ready events associated with the latest checkout, actor, request key, database timestamp and Ready-check confirmation. SQL enforces ordering, active staff, current room/checkout and maintenance checks, and atomically audits/marks Ready. Category-before-block-before-room locking coordinates operations; exact retries return the existing event and competing actions cannot duplicate transitions. Direct room-state updates cannot bypass required Ready evidence or an active turnover block. Existing checkout, reservations, claims, financial and sibling histories remain intact.

Express adds `POST /staff/rooms/:id/housekeeping`; normal registration unconditionally leaves it closed. The existing staff room board shows authoritative physical state, current provisional held/reserved claims, maintenance, availability, turnover-until and cleaning actor/time history; it provides Start cleaning, Finish cleaning and checkbox-confirmed Mark Ready controls. Physical Ready never removes/shortens the protected buffer. Buffer expiry never writes Ready. Before migration application, the existing room-list fallback remains read-only and conservatively reports no immediate availability. Times render in Asia/Manila with AM/PM. No H02 maintenance creation/release UI exists.

Verification: root `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` and `npm run format:check` passed; **123 application tests (84 backend + 39 frontend)** and **19 isolated PostgreSQL 17 tests**, zero failures/skips. The existing ignored portable PostgreSQL tooling ran the complete integration suite on loopback `staytrack_test`, including migration apply/rollback, RLS/client ACLs, T21 expired dirty-room denial and later Ready-only access, exact SQL buffer boundaries, Ready-before-expiry denial, transition/stale-checkout validation, active-staff rejection, duplicate/competing actions, observed-lock concurrent maintenance, immutable events, audit failure rollback and sibling snapshots. A historical fixture uses one precise SQL instant; no protected history was edited to simulate expiry. UI tests cover action sequence, explicit checks, closed/maintenance controls, stable retry keys and clearing the board on session change. The X03 concurrency observer now clears its transaction statistics snapshot per poll; no production assertion or lock protection was weakened.

One independent read-only native review found no critical/major defect; strict action validation and session-switch display fixes address its minor findings. Gitleaks scanned the explicitly staged H01 diff with redaction and reported no leaks; the staged file list excludes credentials, guest/payment data and unrelated Obsidian/editor/nested-vault changes. Semgrep, OSV and the executable full scanloop/greploop milestone gate were not run for this ordinary checkpoint. Existing >500 kB frontend bundle warning remains. Hosted acceptance, real staff/device walkthrough, real room inventory/configuration and P08 operational checks, earlier phase gaps and the full predeployment quality gate remain open. Review the candidate migration separately before any owner-authorized hosted application. Stop after H01; H02 requires a new instruction.

## Final Analytics scope revision - 2026-11-20

Owner-approved Analytics scope is **only Revenue Analytics, Room Category Performance and Package Popularity**, with date-range filtering and staff-only on-screen access; see [[future-analytics-and-reports]]. This supersedes the earlier six-feature proposal and related historical scope statements. Payment & Outstanding Balance Reports, Room Occupancy Analytics, Booking Analytics and Peak Hours & Demand Analytics are excluded as dedicated analytics/dashboard features and must not return under alternate labels. Existing operational availability, check-in/out, payments, balances, manual refunds, booking management and stay-duration monitoring remain unchanged.

Order: finish remaining core features, implement the three approved Analytics features, implement Function Hall Reservation & Management, then complete integration, testing, acceptance and deployment preparation. Preserve all confirmed [[future-function-hall-requirements|Function Hall requirements]] and pending owner decisions. X01-X03 checkpoints remain implemented; all 14 Supabase migrations remain owner-confirmed synchronized. Existing acceptance gaps stay open, live transactions stay disabled and both future modules remain unimplemented. Documentation only; no next implementation task begins.


**Goal:** Match physical hotel operation to digital booking state and provide trustworthy reports.

**Dependencies:** [[03-catalog-inventory-settings]], [[06-walkins-and-stay-monitoring]], [[07-changes-refunds-and-ledger]].

## Owner-approved scope update - 2026-11-20

Development is paused; Analytics & Reports remains planned, not implemented. Finish remaining approved core features first, then expand reporting under existing **H03**, then implement future Function Hall management before Phase 09 final readiness. No new task IDs or phase renumbering are introduced. Existing incident/audit work remains core. See [[13-development-roadmap]] and [[future-function-hall-requirements]].

## Task sequence

### H01 — Housekeeping & Ready workflow
- [ ] Checkout leads to Needs cleaning; record cleaning start/finish and staff identity.
- [ ] Staff explicitly marks Ready; buffer time also must elapse for next conflicting stay.
- [ ] Show currently available/held/occupied/cleaning/maintenance rooms in room board.

**Acceptance:** T21 and category availability unaffected by a dirty physical unit.

### H02 — Maintenance and booking protection
- [ ] Staff opens maintenance block with reason and progress/repair notes.
- [ ] Remove affected room from allocation feasibility and surface impacted future reservations for reassignment.
- [ ] Staff-controlled release from maintenance, explicitly Ready after check.
- [ ] Require staff resolution for affected paid bookings; no silent cancellation/refund.

**Acceptance:** T20/T22 and maintenance concurrency test.

### H03 — Incidents, reports, audit
- [ ] Record no-smoking incident and staff-approved fee/waiver reason.
- [ ] Analytics & Reports: only Revenue Analytics (daily/weekly/monthly trends), Room Category Performance (dynamic category revenue, future hall revenue separately identifiable) and Package Popularity (frequency and revenue contribution respecting category-specific packages); see [[future-analytics-and-reports]].
- [ ] Date-range filters, on-screen reports, staff-only access and Asia/Manila reporting; use trustworthy financial records and prevent revenue/contribution double counting of partial payments, extensions, refunds and multi-room bookings.
- [ ] Preserve core operational views for pending GCash, cleaning/maintenance and audit. Future hall reporting belongs to the later Function Hall module. No occupancy, booking, payment/balance or peak-demand analytics, AI forecasting or complex customer profiling in this Analytics scope.
- [ ] Derive approved revenue/category/package reporting from authoritative transaction and financial records; pending proof is not verified money.
- [ ] Searchable audit by actor/action/date/subject, with sensitive masking.

**Acceptance:** T23 + ledger reconciling against report totals on multi-room mixed payments.

### H04 — Verified public reviews and private feedback (optional enhancement, D-038)
- [ ] Implement server-side eligibility: confirmed primary guest + **recorded check-in and completed checkout**, never reservation-only or public-visitor access; both online and walk-in supported.
- [ ] Support registered guest ownership and no-account guest's existing verified booking email through single-use expiring invitation. Walk-in verified-contact method must be defined and tested.
- [ ] Enforce at most **one public 1–5-star rating per completed reservation**, not per room, with unique DB constraint; optional public comment. Anonymous visitors may list ratings, **not submit**.
- [ ] Add **separate private feedback** collection and staff inbox; never expose it publicly or use it in the public average.
- [ ] Implement fair publication of eligible positive and negative reviews. Staff may reply, or hide/restore content only for documented policy reasons; log operator, reason and time. Never edit a guest's stars/comment or reject merely for low ratings.
- [ ] Add public reviews page and staff moderation UI, ownership/RLS/access tests, token abuse protections, accessible 1–5 rating UI, and aggregate tests.

**Activation acceptance:** pass **T31–T38** in [[15-testing-plan]], complete P11–P13 owner/privacy decisions in [[18-backlog]], and pilot moderation policy. **Until then the review module stays disabled.** See [[24-verified-guest-reviews]]. This enhancement is not required for completing the original core-room/ledger Phase 08 exit gate unless explicitly included in a release scope.

## Exit gate

- [ ] Room board and the three approved Analytics features demonstrably reflect authoritative DB states.
- [ ] Every maintenance/waiver action has traceable actor and reason.
- [ ] Update [[14-milestones]].

**Next in approved order:** after remaining core work and Analytics, future [[future-function-hall-requirements|Function Hall Reservation & Management]], then [[09-hardening-pilot-and-release]]. Detailed hall task mapping remains pending; do not begin it automatically.


## H03-B development checkpoint - 2026-11-20

The staff Analytics desk and staff-only dashboard and download routes provide Net Collections trends, room category performance and package popularity. The report reads authoritative receipts, verified GCash registry ownership, completed transfers and immutable snapshots through a read-only repeatable-read PostgreSQL transaction. The shared calculator uses centavo arithmetic, explicit allocation priority, historical balances, separate purchase eligibility and unclassified or unattributed buckets. An independent review identified three major cases that now have regression coverage: explicit allocations reserving charge balances, walk-in deposit dates preceding recorded check-in, and missing package snapshots retaining their known room balance.

The 366-day Manila date range, 10,000 candidate reservations, 50,000 input rows, five-second query budget and 10,000 export rows apply. Application fixtures exercise bounds and authorization. The backend-only MIT-licensed write-excel-file 4.1.1 resolves to MIT-licensed fflate 0.8.3. npm reported zero vulnerabilities at installation. Independent ZIP/XML and CSV parsing confirmed workbook structure, literal text, numeric cells and matching fixture values.

Explicit no-show cohort verification remains unavailable in the current schema. Distinct authoritative cash records count separately, and duplicate human entry across workflows has no shared external identifier. Formal staff/device acceptance and representative high-volume query profiling remain pending. Hosted Supabase was untouched, H01/H02 inventory reconciliation remains pending, live writes stay disabled, and no database migration or index accompanies this checkpoint.

Build, typecheck, lint and formatting passed. All 141 application tests (99 backend and 42 frontend) and 22 isolated PostgreSQL tests passed without failures or skips. Bounded analytics snapshot read in 14 ms on the isolated fixture set.


## H04 development checkpoint - 2026-11-20

H04 adds gated verified public reviews, private feedback, authenticated moderation and a staff feedback inbox. A same-item recorded check-in and checkout qualify the reservation. The first qualifying checkout opens a 30-day public submission window. Invitation tokens expire after 24 hours, are single-use and are replaced under a reservation quota. Walk-in enrollment is optional and uses a staff-issued pairing code and guest email proof. Fresh OTP against the stored verified contact creates a 15-minute grant scoped to feedback or withdrawal and cannot authorize a public rating. Withdrawal preserves the one-rating constraint.

Reviews use non-identifying aliases and explicit publication consent. Published ratings of every star value use one public list and aggregate projection. Private feedback and consented follow-up are staff-only. Staff holds, hides, restorations, replies, inbox status transitions and contact access are attributed to an active staff identity. Withdrawal is audited against the verified guest identity or grant. The independent review findings were addressed through challenge-bound OTP codes, background OTP delivery, separate pairing, cross-origin idempotency support and retaining a review grant when switching to private feedback.

Candidate migration `20261120001600_verified_guest_reviews.sql` was exercised on disposable loopback PostgreSQL only. No new dependency, hosted Supabase access or hosted migration application. Normal route registration and UI keep H04 closed. Hosted delivery, browser/device acceptance, the owner-approved reconsideration contact and final moderation, privacy and retention policies remain pending. Existing live transaction gates, inventory reconciliation blockers and the held-badge issue remain in scope for their existing tracks. Function Hall and UI Refinement were outside H04.

Build, typecheck, lint and formatting passed. All 146 application tests (103 backend and 43 frontend) and 25 isolated PostgreSQL tests passed with zero failures or skips. Isolated H04 coverage includes private table grants, completed checkout, the late public-rating boundary, later private feedback, invitation replacement and replay, OTP cross-purpose rejection, concurrent rating uniqueness, one-star publication, audited moderation and withdrawal, and public/private projection separation. Production email delivery and formal public activation remain pending.
