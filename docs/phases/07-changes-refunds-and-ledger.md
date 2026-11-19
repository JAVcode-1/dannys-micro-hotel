---
tags: [phase-07, implementation, changes]
status: x01-development-checkpoint-acceptance-pending
---
# Phase 07 — Cancellations, Rescheduling, Extensions & Refunds

**X01 current development status - 2026-11-19:** Implementation `c4cc21b` and test follow-up `586e5c7` are pushed. [CI run 44459769726](https://github.com/JAVcode-1/dannys-micro-hotel/actions/runs/44459769726) on `586e5c7a46de2f04bcf117813dba2d58f9e320b6` passed build/typecheck/lint/format, **100 application tests (70 backend + 30 frontend) and 12 isolated PostgreSQL tests, zero failures/skips**, explicitly including X01 T17/T18/T19/T27, production timing boundaries, item/capacity protection, retries, audit rollback, refund claimant authorization and financial integrity. This supersedes pending-CI and first-run fixture failure notes. No production safeguard was weakened.

**X01 hosted migration applied - owner-confirmed 2026-11-19:** The owner confirms `20261119001100_item_cancellation_manual_refund.sql` successfully applied to Supabase project `pgbierfxeviouyjsmjnh`. **The owner also confirms all 12 local and hosted migrations are synchronized.** This records owner evidence, not a fresh remote-history query, successful CLI dry run or independent hosted verification; the preceding review encountered CLI login-role HTTP 403. It supersedes historical X01 unapplied/readiness-blocked statements below. Documented tested candidate SHA-256: `6BE85B3F431AD085A1ED5EDF074B1AED669BD1962DB664A63368400AAC215D99`. Live transactions, cancellation/refund writes and automatic transfers remain disabled. Synthetic preview: http://127.0.0.1:5175/staff/cancellation-preview (HTTP 200, component interaction passed; manual visual/device acceptance unclaimed). No dependencies added.

X01 remains a verified development checkpoint, not formal acceptance. Pending: authorized synthetic guest/staff/payer/refund reconciliation acceptance, unresolved walk-in and partial extra-bed policy, privacy/retention/receipt and full milestone security/device checks. Phase 03-06 formal gates remain FAIL/acceptance pending. No checkbox is marked Done. **Next officially documented task: X02 - Staff-approved rescheduling**, acceptance T20/T28 and no capacity overlap under competing approvals. The owner approved the X02 architectural direction and requested the written specification and implementation plan together. Both artifacts are now prepared for final owner review; implementation has not started, and X03 remains unstarted. Dependencies are the existing verified identities, shared transactional capacity engine, immutable confirmation/price/payment history and X01 financial safeguards. No new business policy is approved by this status update. This session changes documentation only; no dependency, application code, migration, database write, seed/reset or live activation. Existing CI evidence (100 application + 12 isolated PostgreSQL tests) is reused; application/database tests are not rerun for this documentation-only update. Historical checkpoint notes below retain their original context and are superseded by this current status.

**X02 written-design handoff - 2026-11-19:** [Specification](../superpowers/specs/2026-11-19-x02-staff-approved-rescheduling-design.md) and [implementation plan](../superpowers/plans/2026-11-19-x02-staff-approved-rescheduling-plan.md) await final approval and execution-method selection. Preserve item/claim identity; append history; staff approval revalidates shared capacity and atomically updates the current schedule. The written proposal permits preserved-package/price schedule moves; duration-changing quotes are separate policy-pending financial proposals, never posted charges/refunds. Walk-in and paid extra-bed approvals remain blocked. This safe financial boundary is proposed for explicit owner approval; it is not a newly approved hotel policy. T20/T28, real concurrency, actor/ownership, maintenance, original cancellation deadline and rollback checks are specified, not executed. No X02 SQL/code or dependency was created, no acceptance box completed, and no hosted or live action performed. Documentation diff/link/scope checks only; existing CI is reused without rerunning application/database suites. Earlier acceptance requirements remain open.



**Goal:** Handle individual room-item changes and money correctly without harming other booked rooms.

**Dependencies:** [[05-online-booking-and-gcash]], [[06-walkins-and-stay-monitoring]].

## Task sequence

### X01 — Individual cancellation and manual refund
- [ ] Guest requests cancellation for specific room booking item; unrelated items remain active.
- [ ] Determine online free-cancel eligibility: <60m after reservation staff confirmation AND this item not checked in.
- [ ] Rescheduling does not restart deadline. Record eligible amount itemized; GCash refund requires staff manual transfer and verified destination/reference.
- [ ] Adjust/release capacity only at correct stage; record audit and financial entries.

**Acceptance:** T17/T18/T19/T27.

### X02 — Staff-approved rescheduling
- [ ] Guest requests new start/end per room item; staff approves/rejects after transactional availability check.
- [ ] Preserve other room items and original cancellation clock; capture old/new schedule and staff reason.
- [ ] Price changes use explicit charge/refund adjustment, not overwrite previous payment.

**Acceptance:** T20/T28; no capacity overlap under competing approvals.

### X03 — Extensions, overtime and incident charges
- [ ] Extension can only be approved with sufficient inventory and ≥50% of extension amount paid.
- [ ] Purchased extension starts at **old scheduled checkout**, even when customer asks later; revise end and countdown atomically.
- [ ] Permit staff overtime charge OR waiver with required reason, staff ID, minutes and timestamp.
- [ ] No-smoking penalty applied only after staff review, or waived with reason, disclosed before booking.
- [ ] One-time Family extra bed fee not reapplied per extension in same continuous stay.

**Acceptance:** T03/T16/T23; ledger remains balanced on partial cancellation/extension.

## Exit gate

- [ ] Staff proof of manual refunds recorded, no automatic GCash transfer implied.
- [ ] Shared reservation financial totals reconcile and other room-items unaffected.
- [ ] Update [[14-milestones]].

**Next:** [[08-housekeeping-maintenance-and-reporting]].


## X01 development checkpoint - 2026-11-19

Owner approved the seven-point bounded design and implementation of X01 only despite incomplete Phase 03-06 formal gates. Dependencies: applied eleven migrations, existing verified guest ownership, staff identity/manual payment confirmation, immutable room prices, transactional claims and W03 checkout. No X02/rescheduling/extension or automatic transfer is implemented.

Implemented: verified guest room-item requests (including existing no-account OTP identity), staff request/review desk, item-specific approval/rejection and manual GCash refund tracking. A trusted PostgreSQL request instant is captured before item-lock waits and retained in full precision; eligibility uses the immutable original confirmation and strict <60m boundary, before the item's check-in. Eligible pending requests retain capacity and block Express/database check-in. Unconfirmed submissions fail without permanently occupying a request slot. Walk-in and extra-bed refund policies remain explicitly pending and financial approval is blocked; no invented entitlement or nonrefund rule. Outside-window/checked-in requests are reviewable but cannot receive this free-cancellation approval.

Approval records an immutable item credit/refund obligation, exact claim release and actor audit together. No original price, payment, reservation confirmation or sibling schedule is rewritten. A private security-invoker financial view derives original charges, credits, net charges, verified receipts, completed refunds, remaining refund debt and account balance; W03 uses it when installed and preserves its pre-X01 fallback. Cancellation and payout are separate: cancellation does not falsely mark money refunded. Subsequent debt/refund records retain their history.

Manual refunds require actual receiving-ledger/source-payer verification, verified original GCash name/account, evidence note, staff actor and an exclusive durable processing claim tied to the original verified payment. The hotel payee or guest contact is not treated as payer proof. Processing never expires/reassigns automatically; uncertain transfers remain for reconciliation and must not be sent again. Only the claiming active staff member records the completed external transfer, exact item amount, unique normalized reference, zoned actual time, server recording time and PHP currency. Retry actor/body/key must match. Database locks/constraints prohibit duplicates, unsafe amounts, wrong payment source, premature/future transfer timestamps and over-refunding. Product review/confirmation dialogs precede staff release/refund actions; payer forms are isolated per item. Guest history excludes private payer/account/payment identifiers. Lists paginate and prioritize unresolved work. No money-transfer API exists.

Candidate migration: `supabase/migrations/20261119001100_item_cancellation_manual_refund.sql` adds private RLS/client-denied immutable request/decision/claim/transfer tables, guards, atomic staff audit and derived financial view. Trigger functions use empty search paths and revoked browser execution. It requires the prior eleven migrations and is prepared only for separate owner approval; no hosted apply/reset/seed/live enablement. No new dependency or lockfile change.

Changed files: backend cancellations/actions/routes, app registration/throttling, check-in cancellation guard and W03 financial read; shared cancellation contracts/export; guest reservations/staff navigation and CancellationDesk; focused API/input/UI tests and isolated x01-postgres fixture wired after existing V02-O03/W01-W03 tests; candidate SQL; Phase 07/milestone/decision/context notes. Unrelated Obsidian/editor/nested-workspace changes are excluded.

Verification: root build/typecheck/lint/format checks pass and 100 application tests pass (70 backend + 30 frontend), zero failures/skips. Focused read-only review identified and fixes addressed lock-time eligibility/precision, claim protection, preconfirmation request lifecycle, per-item forms, confirmations and queue pagination. Not a full milestone scanloop/greploop gate. PostgreSQL was attempted locally and stopped before connection because TEST_DATABASE_URL is absent; no hosted fallback. New CI fixture covers production SQL 40m/exact60m/past-window/trusted predeadline timestamp eligibility, T17/T18/T19/T27, owner isolation, pending-vs-checkin, same-request/decision/refund retries, audit rollback, immutable history, payer/refund constraints, overpayment rejection, item/financial independence and unresolved extra-bed gating. W03's deliberately conflicting labelled future fixture is ended only after its assertions so later allocator scenarios remain valid. CI execution is pending; no PostgreSQL pass is claimed yet.

Preview: http://127.0.0.1:5175/staff/cancellation-preview returned HTTP 200; synthetic fixture items/accounts only, no real hotel identifiers or payment writes. Component interaction checks passed. Manual browser/real-device acceptance is not claimed. Existing >500 kB bundle warning remains nonblocking.

Formal X01/Phase 07 boxes stay unchecked. Outstanding: candidate owner review/application after isolated CI evidence, hosted synthetic authorized staff/guest sessions/payer verification and manual-refund reconciliation drills, policy P07/walk-in terms, financial/privacy/retention/receipt and prior Phase 03-06 inventory/channel/maintenance/expiry/device/full-gate acceptance. Live cancellation/refund routes are unconditionally closed in normal app registration; no environment switch opens them. One immutable request/decision per item and non-reassignable refund claims are intentional conservative limits: rejected decisions or unavailable processing staff require separately reviewed reconciliation rather than history rewrites. Stop after X01; X02 is not started.

Staged secret inspection: Gitleaks ran and reported three generic-key matches, all inspected synthetic X01 test idempotency labels (decision-fixture/refund-claim/other-claim); no credential was present. No scanner rule was weakened or suppression added. No .env, payment proof, actual guest/payer record or unrelated workspace file is staged. Semgrep/OSV/full executable milestone gate was not run for this development checkpoint.

X01 CI follow-up (2026-11-19): checkpoint c4cc21b is pushed. CI run 44458462537 passed static checks and all 100 application tests; PostgreSQL reached X01 but its injected audit-failure assertion expected an unmasked P0001 message. Production intentionally maps business-rule errors to a safe conflict. The test injection now uses distinct infrastructure error XX000 so it verifies the intended audit rollback without changing production error handling. Added non-claimant transfer denial and refund-audit rollback/debt-retention assertions. No SQL guard, authorization check or assertion was weakened. Local required checks pass; isolated CI rerun remains pending.
