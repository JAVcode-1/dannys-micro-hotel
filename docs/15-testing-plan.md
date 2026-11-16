---
tags: [tests, acceptance]
status: planned
---
# 15 — Testing Plan

## Test layers

- Unit: package configuration, pricing, ledger arithmetic, state transitions, eligibility/clock functions.
- API+DB integration with real PostgreSQL: atomic holds, exclusions, status changes and rollback on failure.
- E2E: guest and staff flows, 12h/AM-PM date rendering, secure access, proof submission and manual approval.
- Performance/failure: parallel booking conflicts, network retries, duplicate requests, email send failures and outage reconciliation.

## Acceptance matrix

| ID | Scenario | Expected |
|---|---|---|
| T01 | Request Family Executive 3-hour package | Backend rejects; no price/hold issued |
| T02 | Double Standard 3/6/12/24 and Family 6/12/24 quotes | Exact configured PHP prices/snapshot |
| T03 | Book Family with extra bed, later extend existing stay | ₱100 added only once per continuing stay |
| T04 | Standard occupancy exceeded | Advisory/no per-person fee; safety rules handled per approved compliance settings |
| T05 | 30 simultaneous requests for one remaining overlapping capacity unit | At most one capacity claim granted |
| T06 | Overlap ends at exactly next start before cleaning | Buffer respected; no early availability |
| T07 | 30-minute hold deadline passes with no proof | Hold expires; capacity released; possible paid-late-proof path supported |
| T08 | Proof submitted at minute 29, review at minute 90 | Capacity still protected; overdue alert; no auto-release |
| T09 | Duplicate or fabricated GCash ref | Staff cannot verify twice; requires actual account review |
| T10 | Staff approves correct full payment | Confirmation occurs only after authorized transaction and capacity check |
| T11 | Walk-in pays 50% cash then 50% GCash | Two payment entries, correct balance and audit |
| T12 | Walk-in pays at 2:05 PM, staff checks in 2:10 PM for 3h | Checkout at 5:10 PM; survives refresh |
| T13 | Online guest arrives 45 minutes late | Original scheduled checkout remains unchanged |
| T14 | Online guest absent 1h past arrival | Flag for staff; no auto-cancel/release |
| T15 | Room countdown hits 0 | Overdue alert; room remains occupied until staff action |
| T16 | Extension requested 15m after original end, 3h purchased | New end = original end + 3h if available/approved |
| T17 | Online cancellation 40m after confirmation, before item check-in | Eligible item full-refund request, staff manual GCash action logged |
| T18 | Cancellation >1h after confirmation, or already checked in | No automatic full-refund eligibility |
| T19 | Cancel just 1 of 2 independent room items | Other item schedule/status/countdown unchanged |
| T20 | Reschedule one room while overlapping maintenance block | Reject/unavailable; untouched reservation state |
| T21 | Dirty room past buffer | Not Ready; check-in refused until staff marks Ready |
| T22 | Maintenance opened on reserved physical room | Staff sees reassignment alert, conflict cannot be silently hidden |
| T23 | Fee waived for smoking/overtime | Staff actor/reason/time and zero or adjustment recorded |
| T24 | Guess another guest's reservation ID | Denied without ownership or valid OTP verification |
| T25 | Internet outage manual walk-in collides with cloud online booking | Reconciliation detects collision; no silent overwrite |
| T26 | Backup restored into staging | Data and ledger balances consistent; recovery documented |
| T27 | Cancel one room and record refund from shared online payment | Correct item-specific refunds and reservation ledger totals |
| T28 | Multi-room reservation with distinct arrival and package times | Each item has independent holds, countdown and status |
| T29 | Reused booking idempotency key | No duplicate reservation or payment entry |
| T30 | Two physical room assignments to same time interval | DB/API prevents conflict |
| T31 | Anonymous site visitor submits a 1-star or 5-star rating | Rejected; visitor can only read published reviews |
| T32 | Booking confirmed but no staff check-in/checkout recorded | Review denied even if paid; cancelled or no-show booking also denied |
| T33 | Verified primary online guest completes check-in+checkout | Eligible for one rating (1–5) with optional comment, with or without registered account |
| T34 | No-account guest reuses verified booking email link | Expiring one-use review link works once; replay, forged token, expiry and unverified email fail |
| T35 | Walk-in completes stay | Verified-contact primary guest can review; unverified-contact/unauthorized person cannot |
| T36 | Multi-room checked-out reservation submits concurrent rating requests | At most one public rating per parent reservation; duplicate/replay cannot race through |
| T37 | Legitimate verified 1-star review | Publishes and counts toward public average; negative sentiment alone never justifies removal |
| T38 | Private feedback and moderation | Public endpoint cannot expose feedback/contact; staff hide/restore needs documented policy reason, staff actor and audit; cannot change guest rating/text |

## Phase exit gates

- Phase 04: T01, T02, T05–T09, T28–T30 must pass with real DB transaction tests.
- Phase 05: T07–T10, T17 preconditions and T24 OTP access pass.
- Phase 06: T11–T15, T21 pass.
- Phase 07: T03, T16–T20, T23, T27 pass.
- Phase 09: Full regression, T25/T26 drill, owner walkthrough and no critical security issues.
- **Phase 08 reviews (feature-specific gate):** T31–T38 must pass in a real DB/API environment **before enabling public reviews**, even if core hotel operations are already releasable. An unfinished review module stays disabled, not claimed complete.

Document tests with command, environment, evidence and coverage limitations. **Do not fabricate a passing test**.

## Royal Horizon UI acceptance tests (added 2026-11-12)

- [ ] Shared Royal Horizon tokens imported by both guest and Staff/Admin UI, without stray hard-coded legacy blue/orange values.
- [ ] White text on Royal Blue and navy text on Sunset Orange tested for normal-label contrast; white text on orange explicitly disallowed.
- [ ] Selected navigation, focused forms, disabled buttons, badge/icon/text statuses keyboard- and screen-reader-accessible.
- [ ] Actual 10/5 room inventory and verified package/prices used in screens (no Family 3-hour package).
- [ ] Layouts tested mobile/tablet/desktop, 44px practical touch targets, and `prefers-reduced-motion`.
- [ ] Real-photo usage rights, image compression/alt text and no stale signage prices approved before public launch.

See [[09-ui-ux-design-system]] and [[21-before-coding-checklist]].
