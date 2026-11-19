---
tags: [phase-07, x02, design, approval-pending]
status: owner-approved-gated-development
---
# X02 — Staff-Approved Rescheduling Design

Date: 2026-11-19 (Asia/Manila). Owner approved the written specification, implementation plan and native execution. The gated X02 development checkpoint now exists; see [[../../phases/07-changes-refunds-and-ledger]] for actual evidence and outstanding acceptance. These documents alone do not establish formal acceptance.

## Intent and evidence

A verified primary guest requests a different schedule for one confirmed, unoccupied online room item. Individual staff approve or reject it. A successful approval moves that item's capacity without recreating its identity, resetting cancellation eligibility, changing historical money, or touching sibling schedules.

Sources: [[../../phases/07-changes-refunds-and-ledger]], [[../../13-development-roadmap]], [[../../02-requirements]], [[../../15-testing-plan]], [[../../18-backlog]], AGENTS.md. Acceptance: T20/T28, capacity concurrency, authorization, maintenance and failure rollback.

The owner confirms all **12 local and hosted migrations synchronized** on `pgbierfxeviouyjsmjnh`, including `20261119001100_item_cancellation_manual_refund.sql`. This is owner evidence; this design session performs no hosted query or CLI dry run. Reuse X01 CI run 44459769726 on `586e5c7`: 100 application and 12 isolated PostgreSQL tests passed. This does not constitute X02 test evidence. X01 hosted reconciliation and earlier phase acceptance remain open.

## Scope and explicit safe financial boundary

The approved direction is retained. These implementation choices are **owner-approved for this gated development slice**, not new approved hotel policies:

1. An approvable X02 move changes start/end by the same offset, preserving category, occupants, purchased package sequence/duration, extra-bed selection and original booked price. The server derives the end from original purchased duration; a guest-supplied end must match. A later catalog rate does not automatically reprice an existing purchase.
2. A request to change purchased duration is recorded for staff review with a separately stored server quote and proposed signed financial adjustment. It cannot be approved financially in this slice. The existing catalog provides a comparison quote, not an invented entitlement to a refund or a new mandatory charge.
3. Walk-in requests and items with a paid extra bed can be recorded/rejected but are blocked from approval while the corresponding financial/continuity policies remain unresolved. No unsupported refund, waiver or second extra-bed charge is created, including when the calculated difference is zero.
4. No category/occupant/extra-bed changes, checked-in moves, extensions, automatic fee decisions, automatic transfers or new payment collection path. X03 remains separate.

Why the monetary restriction is necessary: X01 cancellation decisions calculate refund obligations from original `room_bookings.total_centavos`; `refund_claims` and `refund_transfers` have one row per cancelled item. Posting a reschedule credit/debit without redesigning cancellation entitlement, payment allocation and refund settlement would produce inconsistent balances or duplicate refunds. X02 records financial proposals distinctly and does not pretend they are posted adjustments or completed refunds. Nonzero proposals, and all duration-changing requests even at equal price, remain review-only until a separately approved settlement/policy design extends those safeguards.

This boundary permits a complete, testable schedule-only flow. It deliberately leaves money-changing rescheduling acceptance open; do not mark the entire X02 financial requirement Done from the schedule-only implementation. No environment variable bypasses this boundary.

## Alternatives considered

**Recommended:** keep room-item and claim identities; append requests/decisions; update only the current schedule projection and claim within the approval transaction. Existing guest/check-in readers already use `room_bookings.start_at/end_at`, so they continue to see the effective schedule.

**Alternative:** retain original schedule columns and introduce an effective-schedule view everywhere. It makes original schedule reads simpler, but requires migrating every existing schedule reader and risks mixing original and current times. The immutable first approved event already preserves the original schedule.

**Rejected:** replace the reservation or item. This would disconnect ownership, payment/refund references and original cancellation-clock history.

## Invariants and compatibility

- React + TypeScript + Tailwind frontend; separate Node.js + Express + TypeScript API; Supabase-managed PostgreSQL.
- Store UTC instants; render all guest/staff schedule times in Asia/Manila using 12-hour AM/PM.
- No new runtime dependency; reuse pg, Supabase Auth, existing allocator and transaction retry helper.
- Preserve reservation/item/claim UUID or numeric identity, immutable prices, original confirmation and cancellation terms, payment evidence, cancellation/refund records and sibling item fields.
- No Family Executive 3-hour package; no automatic per-person fee; no additional extra-bed charge.
- Live transaction routes remain unconditionally disabled in normal app registration.
- All new tables enable RLS and deny public/anon/authenticated privileges. Backend-only actions enforce actor rights; trigger functions use empty search paths and revoked browser execution.
- Existing twelve migration files remain byte-for-byte unchanged. A thirteenth candidate is created only during approved implementation and remains unapplied until separate owner approval.

No replacement or relaxation of X01 pending-cancellation protection, W02 checked-in-claim protection, W03 checkout/cleaning-buffer protection, exclusions, or original price/confirmation triggers. The X02 schedule guard is additive. Pending rescheduling alone neither reserves the proposed slot nor prevents a guest from checking in or requesting cancellation of the original booking.

## Records and state

New objects below are names for future implementation, not existing schema:

| Object | Required fields and constraints | Purpose |
|---|---|---|
| `reschedule_requests` | UUID id; room item FK; owner UUID/email OR active staff UUID; actor-scoped retry key and canonical body hash; requested start/end; original package blocks and requested blocks; expected item revision; old start/end/claim allocation snapshot; reason; server request time; server quote package/version snapshot; eligibility reason | Immutable guest consent and staff review input. One unresolved request per item, enforced by a locked current-request pointer, not a time-expiring hold. |
| `reschedule_decisions` | Request FK primary key; approved boolean; staff UUID; retry key/hash; reason; server decision time; old/new schedule and claim allocation; previous/new revision; server-derived eligibility | Append-only terminal decision. Unique approved revision per item. A rejected decision has identical old/new effective schedule and no capacity mutation. |
| `reschedule_adjustment_proposals` | Request FK primary key; item FK; original booked amount; comparison quote amount; signed delta = quote minus original amount; PHP; package/version evidence; status fixed to `policy_pending` | Separate immutable financial proposal for duration changes. Excluded from posted financial totals. Sign is positive for a proposed extra charge, negative for proposed credit. No payout/receipt/entitlement is inferred. |
| `room_bookings.schedule_revision` | bigint, initially 0, nonnegative | Concurrency version for current schedule. Increment only with an approved decision; item prices remain unchanged. |
| `room_bookings.pending_reschedule_id` | nullable unique FK to request, referencing this same item through a composite FK | Locked pointer permitting at most one unresolved request without mutating history. Set on request; cleared on terminal decision. |

Use 16–100 character `[A-Za-z0-9_-]` retry keys, UUID validation, nonblank reasons up to 1000 characters with no control characters, bounded package arrays (1–30), safe integer centavos and database bigint arithmetic. Require strict valid future minute-aligned timestamps, explicit Z or +08:00 timezone, end > start, and calendar round-trip validation; reuse existing booking parser mechanics. Reject unchanged schedules without creating an event. Do not accept browser amounts, actors, eligibility, timestamps or allocation choices.

Request ownership: online verified Auth UUID **and** verified email must match the reservation. Existing no-account OTP sessions use the same verified identity flow. Active staff may record a guest-assisted request with a reason. Guest unknown/not-owned IDs return 404 without data leakage. Requests can be rejected by active staff even when policy-blocked or stale. No request/decision/proposal update/delete/TRUNCATE rights are granted to client roles. Immutable triggers preserve event content; database-owner emergency repair remains an operational privilege, never an application feature.

## Request and decision flow

1. Authenticate, validate bounded input and capture trusted server request time. Enter `claimTransaction`; recheck actor/ownership and lock reservation then item. Check exact actor/key/body retry before stale-version validation so a successful replay still returns its original result.
2. Read the current schedule/claim/revision and enforce one open request. Save the old snapshot and guest-acknowledged requested schedule. Compute eligibility from confirmed status/payment, claim state, check-in/checkout/cancellation and policy. Confirmed online items only can be approvable. Record policy-blocked cases explicitly; unconfirmed or already terminal items return conflict without occupying a request slot.
3. Same-duration moves preserve original package price even when rates changed or a package is now inactive. They do not promise capacity: availability shown at request time is advisory. Duration-changing comparison quotes use the active catalog; unavailable packages return conflict, never guessed rates. Store a proposal but no financial posting. If an entire source-payer/refund reconciliation is unresolved on the item, approval is blocked.
4. Staff review shows original/current/requested times, original confirmation and unchanged cancellation deadline, policy blockers and exact server money classification. Staff submits approve/reject, expected request ID/revision, reason and retry key.
5. Rejection inserts immutable decision/audit and clears the pending pointer, leaving schedule/capacity/finances intact. A stale request can be rejected then replaced by a new request; never rewrite it. There is no automatic expiration.
6. Approval uses the atomic procedure below. Business conflicts roll back and leave the request pending with an actionable refresh/reject response. No failed attempt is misrepresented as an approved/rejected event. Audit failures roll back the complete database operation.

Repeated approved moves require a new request capturing the latest revision. The baseline purchased duration and price remain original. A denied cancellation can coexist with an X02 request, but an eligible unresolved or approved X01 cancellation blocks X02 approval. A pending X02 request does not change the cancellation clock and does not prevent X01 processing; it becomes stale/unapprovable if cancellation wins.

## Atomic approval and concurrency

Use one database transaction and one connection; never call the standalone `revalidateClaim`, which opens/commits a separate transaction. Reuse `allocateRooms` with explicit room/claim/block snapshots and `claimTransaction` for bounded deadlock/serialization retry.

Lock protocol: active staff membership FOR SHARE; reservation then item FOR UPDATE (same order as check-in/X01); relevant category advisory transaction lock; claim row FOR UPDATE; room-block table SHARE lock; selected physical room row lock. Re-read all authoritative state after locks. Catalog FOR SHARE is needed only when recording comparison quotes. Existing category-before-row workflows may deadlock with item-before-category paths; preserve bounded transaction retries (40001/40P01), no side effects outside the transaction, and test competing bookings rather than claiming deadlocks are impossible.

Approval must recheck:

- Request is current, undecided, still owned by the same verified reservation identity, and references the same item/claim/revision/old interval.
- Staff remains active; item and claim are confirmed online; original full verified payment exists; no room check-in/checkout; no eligible pending or approved cancellation; no pending refund settlement; no walk-in/extra-bed/duration/financial-policy block.
- Requested start is still future; duration unchanged; original package/price/confirmation/terms unchanged. Server derives target end and retains the existing claim buffer (no guessed turnover default).
- Shared allocator sees all other active held/proof-review/confirmed/walk-in claims, sibling claims, readiness and maintenance/cleaning blocks. Exclude **only this item's existing claim** from the candidate occupancy set. Keep other allocations fixed; an alternative provisional room may be selected for this claim, but no sibling or other guest allocation is moved.

Insert the approved decision and update the current schedule/revision/claim/pending pointer in a single guarded database operation. The decision trigger owns these mutations and actor audit so a caller cannot insert an approval while skipping its effects. An additive projection guard refuses schedule/revision/allocation edits without a matching approved event (item, old/new interval, claim allocation, exact +1 revision). Handle request-pointer updates separately without granting schedule changes. Existing claim exclusions remain the final capacity arbiter. A statement failure rolls back the decision and every projection change. No intermediate release/held state, replacement claim, proof deadline refresh, or new reservation is created.

Race outcomes:

| Competition | Required result |
|---|---|
| Two approvals for one request | Exact retry returns the original result; changed actor/key/body returns 409; one decision/move/audit |
| Two different requests for one item | At most one unresolved pointer; stale revision cannot overwrite a newer move |
| Two items compete for last destination room | Category lock and exclusion permit at most one; losing item retains its original slot |
| Check-in wins reservation/item lock | Approval fails after recheck; original check-in/claim stays intact |
| Reschedule wins | Check-in reads the newly committed schedule and applies existing readiness/time rules |
| X01 cancellation wins | X02 cannot move protected/released capacity |
| X02 wins | Cancellation uses the original confirmation deadline and original price; a predeadline request is still timed using X01's trusted request instant |
| New maintenance block | SHARE table lock serializes writes; approval must see committed blocks, or maintenance added afterward follows existing conflict/reassignment handling; no promise that X02 implements Phase 08 maintenance |

## Financial interpretation

Schedule-only approved decisions have monetary delta zero; they create no new charge/refund entry. `reservation_financials`, verified receipts, original item totals and X01 refund obligation arithmetic remain unchanged. Proposals are returned as `policy_pending`, separately from `balanceCentavos` and `refundDueCentavos`.

For example, original item PHP 400 plus a comparison package PHP 600 gives a +200 proposal, not a receipt or activated extra stay. A PHP 200 comparison gives a -200 proposal, not a payable refund. Repeated/rejected proposals never accumulate in the financial view. Current catalog price changes alone do not produce a proposal on a same-package schedule move.

To enable money-changing moves in future, owner approval must define repricing basis, guest consent to changed terms, collection timing/full online payment, item-level allocation, original-payer verification and settlement of cancellation after adjustments. A future migration must reconcile those obligations with X01's one-claim/one-transfer structure and globally unique verified incoming GCash references. This design does not grant that approval or secretly create a new payment channel.

## Express contracts and failure handling

All business mutations go through Express. New routes are registered with existing verified guest or catalog staff middleware, no-store responses, request throttling and default closed writes:

| Route | Contract |
|---|---|
| GET `/guest/reschedules?page=0` | Owned requests/history, current/proposed times, eligibility, revision, proposal amount/status; no private payment/payer/claim internals |
| POST `/guest/reschedules/:roomItemId` | `{requestKey, expectedRevision, startAt, endAt, blocks, reason}`; authoritative identity from verified token |
| GET `/staff/reschedules?page=0` | Active-staff queue/history, unresolved first, deterministic 100-row pages |
| POST `/staff/reschedules/:roomItemId/request` | Same body, staff actor from session; explicit assisted-request reason |
| POST `/staff/reschedules/:requestId/decision` | `{requestKey, expectedRevision, approved, reason}`; no guest decision route |

Return 400 invalid payload, 401 absent authentication, 403 inactive/non-staff, 404 unknown/not-owned item, 409 stale request/state/capacity/policy/retry conflict, and 503 missing candidate schema/closed writes/infrastructure failure. Business errors never expose raw SQL, payer details or claims belonging to others. Cancellation and check-in remain independently available in future accepted environments; X02 registration never enables their writes.

Missing X02 schema: existing guest reservations, check-in, cancellation and W03 monitoring continue unchanged. New reschedule reads report unavailable without breaking the surrounding page. Default production registration calls `registerReschedules` without enabling writes; only isolated tests pass enabled=true.

## Interface and accessibility

Guest reservation items open a reschedule form with current schedule, proposed start/end, unchanged package/duration/price explanation, request reason and explicit capacity-not-reserved notice. A duration-change quote appears as policy-pending and cannot be mistaken for a posted refund/charge. Display the original cancellation deadline alongside new times. Disable no controls solely based on browser eligibility; backend remains authoritative.

Staff Rescheduling desk uses the existing white-sidebar shell and Royal Horizon tokens. Separate per-item forms; no payer/account inputs. Approval confirmation lists old/new times, package, price, unchanged deadline and staff reason. Policy-blocked approvals have a clear explanation and rejection action. Preserve entered data on a conflict; refresh authoritative item state and require a fresh explicit review. Accessible labels, keyboard dialogs/focus return, error summaries, no duplicate submission on double click. Synthetic preview only, no real identifiers or money.

## Test and acceptance matrix

| ID | Test evidence required before claiming the behavior |
|---|---|
| T20 | Destination maintenance/cleaning including buffer blocks approval; no decision, schedule, financial or sibling mutation |
| T28 | Two independently scheduled items; move one; compare sibling full snapshot, claim, countdown/check-in fields and financial totals |
| X02-A | Anonymous/non-staff/revoked staff/wrong UUID or email/no-account unverified denial; client table/function ACL denial; guest cannot approve |
| X02-B | Same-duration server-derived end, invalid calendar/timezone/minute/overflow/no-op, forbidden Family 3h, changed duration/extra-bed/walk-in policy gating |
| X02-C | True independent connections and barriers: competing destination approvals, check-in versus approval, X01 request/decision versus approval, duplicate key/body/actor races; one winner and loser original capacity retained |
| X02-D | Inject failure at audit, decision, projection and claim updates; no partial schedule/claim/revision/pointer/financial changes; request remains actionable |
| X02-E | Exact retry returns original result even after revision increments; changed body/key conflicts; reject then new request works; approved revision history is immutable |
| X02-F | Repeated moves preserve original price/confirmation/terms and strict cancellation at 59:59.999 versus 60:00; no new deadline or extra-bed charge |
| X02-G | Rate changed/deactivated after purchase: same-package schedule keeps original price; duration proposal signed delta correct, never included in balances/refund due and never approvable |
| X02-H | Before/after candidate: existing twelve-migration fixtures pass; no-X02 read fallback; current schedules show consistently in guest, check-in and stay readers |
| X02-I | Long reasons, unknown fields, pagination bounds, stale browser tab and two independent item forms; no guest disclosure of staff-only/private payment data |

Use the existing disposable-loopback PostgreSQL suite and CI PostgreSQL 17, never hosted Supabase as test DB. Reuse X01's synthetic confirmed booking setup without disabling guards. Full build/typecheck/lint/tests plus isolated PostgreSQL are required at the future development checkpoint. Full scanloop/greploop executable gate is required at major milestone/predeployment, not falsely claimed from this design.

## Migration, recovery and handoff

Future candidate: `supabase/migrations/20261119001200_item_rescheduling.sql` (verify next unused version at implementation time; do not edit existing twelve). Additive objects/columns, default revision 0/pointer null, no synthetic room/guest/payment seeds. Candidate SQL must be exercised after all twelve prior migrations in isolated tests; new table grants/functions and projection guards are inspected before real data.

The candidate installation is transactional: failure leaves no partial objects. Application actions also roll back atomically. After committed use, do not drop history or reset schedules; disable reschedule writes and use an owner-reviewed corrective forward migration or backup restore/reconciliation plan. Do not deploy an old writer that can bypass X02 schedule guards. Existing readers keep working with the updated projection, and monetary totals keep X01 semantics.

Acceptance distinction: owner-confirmed 12-migration synchronization is recorded, not independently reverified. No new migration/history/dry-run, application tests, scanner runs, hosted acceptance or device checks are performed for this writing task. All formal boxes remain open. The owner approved the safe financial boundary and linked implementation plan before native execution. X03 and live activation are outside this approval.

Plan: [[../plans/2026-11-19-x02-staff-approved-rescheduling-plan]].
