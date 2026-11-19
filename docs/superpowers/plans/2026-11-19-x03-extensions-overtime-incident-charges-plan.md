# X03 Extensions, Overtime and Incident Charges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution or superpowers:subagent-driven-development only if the owner selects it. Implement task-by-task after final written-artifact approval. Unchecked steps below are instructions, not evidence of completed work.

**Goal:** Safely extend a checked-in room item with verified funding and record explicit supported charges/waivers while preserving original history and sibling stays.

**Architecture:** Immutable extension events advance a separate effective-checkout projection and the existing claim. Domain-specific charge/receipt/allocation events extend the private financial read model; allocated money, pending funds and normal checkout debt are distinct. Existing guards gain only exact event-backed extension exceptions.

**Tech Stack:** React/TypeScript/Tailwind, separate Node/Express/TypeScript, pg, Supabase PostgreSQL/Auth, node:test and existing Testing Library; no new runtime dependency.

**Spec:** [X03 design specification](../specs/2026-11-19-x03-extensions-overtime-incident-charges-design.md). Read it fully before executing; it is the authority for financial gates and lock/clock behavior.

## Approval and baseline

Direction approved 2026-11-19; the owner explicitly requested the written specification and plan together. Both now await final owner review and execution-method selection. No X03 source, test, dependency or migration file is created by this writing task. All 13 migrations are owner-confirmed applied/synchronized. X02 `deb01fa` has recorded build/typecheck/lint/format and 108 application + 13 isolated PostgreSQL passes; these are baseline, not X03 results. X01/X02 hosted/device/policy and earlier phase/full-gate acceptance remain open.

## Global Constraints

- React + TypeScript + Tailwind; separate Node.js + Express + TypeScript API; Supabase-managed PostgreSQL.
- No new runtime dependency; reuse pg, the shared allocator, package pricing and transaction retry helper.
- Store UTC instants and integer PHP centavos; show Asia/Manila times in 12-hour AM/PM.
- Preserve room-item, reservation and claim identity, original prices/payments/confirmation, immutable check-in and sibling records.
- No Family Executive 3-hour package, per-person surcharge or repeated continuous-stay Family extra-bed charge.
- All live X03 writes remain unconditionally closed in normal application registration; no environment switch opens them.
- New tables use RLS with public/anon/authenticated privileges revoked; views use security_invoker and deny browser access.
- All event writes enforce active staff, server-derived amounts/state, immutable history and atomic actor audit.
- Keep the existing 13 migration files unchanged; any new candidate remains unapplied pending separate owner approval.

## Review Focus

1. A pending deposit makes account balance negative but must not pay an original debt or permit normal checkout (Tasks 1/3/6).
2. A late request or second extension must add to the persisted purchased schedule, never to browser/server now (Tasks 1/4/6).
3. A network retry after funds were allocated must not create another receipt, allocation, debit or extension (Tasks 3/4/6).
4. A review on a legacy booking without genuine prior disclosure must remain review-only even if a fee rate later becomes configured (Tasks 2/5/6).
5. An approval/checkout race or refresh in another item must preserve immutable evidence, countdown and independent drafts (Tasks 4/6).

## File map

| Files | Responsibility |
|---|---|
| Create `packages/shared/src/stay-changes.ts`; modify shared index and optional walk-in display fields | Wire request/event/financial types; no browser-trusted policy |
| Create `backend/src/stay-change-policy.ts`, `backend/test/stay-change-policy.test.mjs` | Pure package/minimum/end/settlement calculations and strict input parsers |
| Create `supabase/migrations/20261119001300_item_extensions_and_charges.sql` | Eight event/policy/disclosure tables, exact guard extensions, private effective/financial projections and preserved registry |
| Create `backend/src/stay-finance.ts`, `backend/test/stay-finance.test.mjs` | Domain actions for actual receipts, allocations/releases, fee reviews/debits/waivers/credits and shared financial reads |
| Create `backend/src/extensions.ts`, `backend/test/extensions.test.mjs`, `backend/test/stay-change-routes.test.mjs` | Extension request/decision/read orchestration and staff HTTP registration |
| Modify `backend/src/stay-monitoring.ts`, `check-in.ts`, `guest-booking.ts`, `walkins.ts`, `app.ts` | Effective-end/settlement reads, default closed registration and narrowly scoped booking-time disclosure capture hook |
| Create `frontend/src/StayChangesDesk.tsx`, `frontend/test/stay-changes.test.mjs`; modify `StayMonitor.tsx`, `GuestReservations.tsx`, `WalkInDesk.tsx`, `StaffLogin.tsx`, `App.tsx` | Item extension/payment/review UI, honest balance/clock displays and synthetic preview |
| Create `backend/test/x03-postgres.mjs`; modify `backend/test/zz-v02.integration.mjs` | Chained disposable PostgreSQL coverage immediately after X02, retaining prior fixtures |
| Relevant Phase 07, milestones, decisions, context and approved spec/plan | Actual results, policy blockers and unapplied migration status |

Check the next unused migration version before creating the candidate. Do not edit prior SQL files. Keep domain authorization/transitions in actions and reusable calculations pure, following code-structure. Do not refactor the allocator, replace original ledgers or add a generic accounting framework.

### Task 1: Contracts and pure policy/financial arithmetic

**Files:** New shared stay-change types/index export, pure policy module and its tests.

**Interfaces:** Define these names before later tasks use them:

```ts
type ExtensionInput = { requestKey: string; expectedRevision: number; blocks: number[]; reason: string };
type ExtensionDecisionInput = { requestKey: string; expectedRevision: number; approved: boolean; reason: string };
type StayEvent = { id: string; kind: string; roomBookingId: string; recordedAt: string };
type StayReceiptInput = {
  requestKey: string; method: 'cash' | 'gcash'; amountCentavos: number;
  receivedAt: string; reason: string; cashReceived?: true;
  verification?: { reference: string; recipient: string; ledgerChecked: true;
    receivingAccountChecked: true; timeChecked: true };
};
type StayAllocationInput = {
  requestKey: string; extensionRequestId?: string; chargeId?: string;
  amountCentavos: number; reason: string;
};
type StayReviewInput = {
  requestKey: string; kind: 'overtime' | 'smoking'; reason: string;
  startAt?: string; endAt?: string; policyVersionId?: string; disclosureId?: string;
};
type StayFinancials = {
  originalCentavos: number; netChargeCentavos: number; collectedCentavos: number;
  balanceCentavos: number; settlementDueCentavos: number;
  refundDueCentavos: number; unallocatedX03Centavos: number; pendingExtensionFundsCentavos: number;
};
```

Expose `minimumExtensionPayment(chargeCentavos: number): number`, `nextExtensionCheckout(baselineAt: string, approvedMinutes: number, requestedMinutes: number): string`, `settlementDue(baseDue: number, extras: {amountCentavos:number; creditCentavos:number; allocatedCentavos:number}[]): number`, `parseExtensionInput(value: unknown): ExtensionInput`. Quote the source category using `priceBooking` with authoritative original counts and extraBed=false, bypassing only the new-booking future-start parser, not allowed-package/price checks.

`nextExtensionCheckout` is a display/preview helper. SQL computes persisted request/decision ends from the full-precision baseline and approved chain; never round a source timestamptz through JavaScript Date before writing it back.

- [ ] Write failing unit tests with the following exact contracts:

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { minimumExtensionPayment, nextExtensionCheckout, settlementDue } from '../dist/stay-change-policy.js';
test('X03 odd-cent minimum and immutable late/repeated anchor', () => {
  assert.equal(minimumExtensionPayment(40001), 20001);
  assert.equal(minimumExtensionPayment(0), 0);
  assert.equal(nextExtensionCheckout('2027-01-01T09:00:00.000Z', 0, 180), '2027-01-01T12:00:00.000Z');
  assert.equal(nextExtensionCheckout('2027-01-01T09:00:00.000Z', 180, 180), '2027-01-01T15:00:00.000Z');
});
test('X03 pending funds cannot reduce original debt', () => {
  assert.equal(settlementDue(50000, [{amountCentavos:40000,creditCentavos:0,allocatedCentavos:20000}]), 70000);
  assert.equal(settlementDue(50000, []), 50000);
});
```

- [ ] Run `npm run build -w packages/shared`, `npm run build -w backend`, then `node --test backend/test/stay-change-policy.test.mjs`; confirm missing implementation fails rather than a pre-existing/environment failure.
- [ ] Implement safe integer centavo checks, nonnegative/overflow-safe sums, strict keys/reasons/UUIDs, bounded blocks and server-derived end. `settlementDue` rejects negative/overcredited/overallocated inputs rather than hiding corruption with max(0). Keep unallocated/pending funds out of its inputs.
- [ ] Add tests for negative/fractional/unsafe charges, threshold just below/exactly half, invalid calendar/offset, disallowed Family 180, zero configured package, no per-person/bed recharge, rounding-policy absent and elapsed-only result blocking. Rebuild and run focused tests to green; retain changes for the final verified X03 checkpoint.

### Task 2: Candidate schema, disclosures and financial/capacity guards

**Files:** Candidate SQL, first section of `backend/test/x03-postgres.mjs`, integration harness import/call; narrowly scoped optional disclosure capture in booking creation.

**Interfaces:** `x03Postgres(t, pool): Promise<void>` runs after `x02Postgres`. SQL creates the eight tables and `stay_item_terms` view specified in the design; adds `stay_extension_revision` and `pending_extension_id` to room_bookings. Guard functions are named `guard_stay_extension_request`, `guard_stay_extension_decision`, `apply_stay_extension_decision`, `guard_stay_charge_entry`, `guard_stay_receipt`, `guard_stay_allocation` and `guard_stay_extension_projection`. Reuse immutable-history and actor audit behavior. Existing `protect_checked_in_claim` and `guard_reschedule_claim_projection` gain only exact approved-extension exceptions.

Add `guard_stay_checkout_settlement` on room_checkouts INSERT to lock/recompute current settlement due and validate captured debt/exception. It is additive to the existing immutable checkout and cleaning-release guards; never rewrite historical checkout rows.

Within the fixture, define `makeCheckedInPair(pool)` returning `{actorId, reservationId, itemId, siblingId, baselineCheckoutAt}` through the existing synthetic booking/payment/checkIn actions, and `financialSnapshot(pool, reservationId)` returning the private view row. Define `makePendingFundingCase(pool)` returning `{before, after, depositCentavos}` by creating that pair, inserting a valid extension request/verified receipt/allocation through their production SQL guards, then reading the view again. These are disposable test helpers, not application exports. Do not invent hosted room identifiers or remove earlier fixture protections.

- [ ] Read existing W01/W03/X01/X02 SQL and fixture setup. Write a failing nested test loading the candidate after all 13 migrations, asserting installation rollback, correct new columns/defaults, client denial and preserved original function protections. Run only on disposable loopback `/staytrack_test`; missing configuration is NOT RUN and never a hosted fallback.
- [ ] Implement table FKs/composite identity constraints, immutable triggers, unique actor/key/hash rules, one unresolved request pointer, approved revision uniqueness and one debit per approved extension. Separate allocate/release event kinds with exactly-one-target and unique release-parent constraints. Ensure credits cannot target original/extension charges or already paid money.
- [ ] Extend the existing incoming GCash registry with stay_receipt_id and exactly-one-source constraint; preserve existing references, immutable rows and trigger branches. Add empty search paths and revoke all client execution/privileges. Test all new functions, not a subset.
- [ ] Implement quote/receipt/allocation/capacity/audit guards using the design's single-connection lock order. Direct decision insertion must trigger its one debit, claim/end/revision update and audit atomically. No session flag, disabled trigger or standalone `revalidateClaim` authorizes an extension.
- [ ] Test real role denial with `SET LOCAL ROLE anon` and authenticated, cross-reservation FKs, inactive staff, direct end/room/start/buffer changes, forged source/revision, duplicate allocation/release, excessive credit and immutable update/delete. For example:

```sql
select relname, relrowsecurity,
 has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') as client_access
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='staytrack' and relname like 'stay_%';
```

- [ ] Add optional server-validated charge-disclosure acknowledgements to `createGuestHold` and `createWalkInBooking` without breaking existing call signatures. Insert evidence only within a newly created reservation's transaction for an already approved policy version. Missing acknowledgements leave reservations ineligible for incident posting. No public retroactive evidence-writing or owner-policy approval route; no seeded fee/disclosure/approval.
- [ ] Verify fresh synthetic old/new bookings, and rollback evidence insertion on booking/audit failure. Preserve no-X03 booking behavior by schema detection. Use synthetic policy records only inside isolated tests, labelled explicitly as test evidence, not hotel approval.

### Task 3: Receipts, allocations, reconciliation and financial view

**Files:** `backend/src/stay-finance.ts`, finance tests, candidate financial view portion; monitoring/walk-in financial read integration.

**Interfaces:** Export `recordStayReceipt(actorId, itemId, input, pool)`, `allocateStayReceipt(actorId, receiptId, input, pool)`, `releaseStayAllocation(actorId, allocationId, {requestKey,reason}, pool)`, each returning `Promise<StayEvent>`. Export `readStayFinancials(db: PoolClient, reservationId: string): Promise<StayFinancials>` for already-authorized locked callers. Parameter input types are Task 1 contracts; pool defaults to databasePool. No external transfer API.

- [ ] Write failing focused parsing tests and isolated assertions for exact, below-half and excess/unallocated funds; original-receipt reuse is rejected; references cannot duplicate online/W01/X03. Money entered before a failed extension approval remains an actual receipt without a debit or activated clock.
- [ ] Run `npm run build -w backend` then `node --test backend/test/stay-finance.test.mjs`; run the isolated fixture when configured. Record the actual initial failure.
- [ ] Implement active-staff receipt evidence using existing normalization/control-character helpers. Cash requires staff-received attestation and is supported only for walk-in X03 purchases. GCash requires actual ledger, recipient, reference and time checks; future timestamps fail. Receipt/registry/audit insert together; never count a screenshot as money.
- [ ] Implement allocation/release under reservation and receipt locks. Enforce same reservation, remaining receipt/target caps and explicit split allocations. Reject/stale unactivated commitments may be explicitly released once; activated/posted allocations cannot. Amount, source and target on release are copied by the server from the original allocation. Require reasons and stable retries.
- [ ] Extend `reservation_financials`, retaining old column order/types and appending settlement_due_centavos, unallocated_x03_centavos and pending_extension_funds_centavos. Use the specification's formulas. Preserve X01 refund basis and exclude X02 proposals. Test economic balance versus settlement due explicitly:

```js
// In x03Postgres, after a verified receipt funds an unactivated request:
const {before, after, depositCentavos} = await makePendingFundingCase(pool);
assert.equal(after.original_centavos, before.original_centavos);
assert.equal(after.settlement_due_centavos, before.settlement_due_centavos);
assert.equal(Number(after.pending_extension_funds_centavos), depositCentavos);
assert.equal(after.refund_due_centavos, before.refund_due_centavos);
```

- [ ] Modify W03's balance reader to prefer settlement_due when installed, with X01/pre-X01 fallback unchanged. Add explicit additional/settlement display fields to walk-in reads; keep original walkInBalance and base-payment guards scoped to original charges. Test half-paid extension blocks normal checkout, full top-up succeeds, documented unpaid departure still works and later payment preserves immutable departure history.
- [ ] Test two concurrent allocations of one receipt, allocation/release versus approval, cash/GCash retries, and receipt/allocation audit failure. No negative/hidden original debt or duplicate balance contribution is acceptable.

### Task 4: Extension request/approval and effective clock

**Files:** `backend/src/extensions.ts`, extension/route tests, monitoring/check-in/guest effective-end reads; candidate extension-trigger completion.

**Interfaces:** `requestExtension(actorId: string, itemId: string, input: ExtensionInput, pool): Promise<StayEvent>`, `decideExtension(actorId, requestId, input: ExtensionDecisionInput, pool): Promise<StayEvent>`, `stayChangeRows(actorId, page, pool)` returning current per-item history/quote/funding/blocker rows; `registerStayChanges(app, staffMiddleware, enabled=false, pool?)` registers all specification routes. GET recomputes blockers; POST returns a stable event. Staff-only write rights are never inferred from guest ownership.

- [ ] Write failing route tests by adapting the existing cancellation/rescheduling app-test pattern: anonymous 401, non-staff/revoked 403, normal registered writes 503/no-store, guest cannot approve, malformed/unknown fields 400, unknown item 404. Also test missing candidate read fallback.
- [ ] Run `npm run build -w backend` and `node --test backend/test/extensions.test.mjs backend/test/stay-change-routes.test.mjs`; observe the missing route/action failure.
- [ ] Implement checked-in source snapshot/quote creation with allowed additional blocks only and no extraBed/category/price input. Quote changes, checkout, elapsed-only targets and prior overtime conflicts block approval. Repeated extensions chain from baseline + previous approved minutes, retaining original evidence.
- [ ] Implement approval ordering in one `claimTransaction`:

```text
active staff -> lock reservation/item -> exact retry -> current request/revision
-> lock funding receipts -> category/claim -> block SHARE -> original occupied room
-> re-read quote, active allocations, immutable source and current blockers
-> validate same-room target interval with fixed overlapping claims/maintenance
-> insert approved decision
   -> one extension debit + extension projection + exact claim end expansion + audit
-> commit and return stable event
```

Use `[oldEffectiveEnd,newEffectiveEnd + storedBuffer)` as the allocator target with its original room fixed and zero extra buffer in that already-buffered range representation. Keep the source claim's persisted start/buffer untouched. Add a regression for an unrelated historical maintenance block before the added interval; it must not block a free extension, while a buffer-only conflict must.

- [ ] Modify monitor sorting/countdown, check-in history and guest stay display reads to use `stay_item_terms.effective_checkout_at` when installed. Keep original checkout as a separate field and preserve original check-in table untouched. W03 cleaning buffers use the expanded claim end and its exact-release exception remains valid.
- [ ] Register new routes with existing staff verification/no-store/throttling in app.ts with enabled omitted. No environment flag opens them. Invalid funding/state/capacity conflicts are safe 409, infrastructure failures 503; no raw SQL or private payment evidence leaks.
- [ ] Add true SQL tests for late T16, two sequential extensions, stale quote after funds received, same key/body/actor replay, original bed fee unchanged, checked-out rejection and unactivated funds reconciliation. Rebuild/run focused checks to green.

### Task 5: Overtime/incident review, supported posting and waivers

**Files:** Finance action/review tests, policy parsers, candidate entry guards and disclosure tests; specification routes registered through registerStayChanges.

**Interfaces:** `recordStayReview(actorId, itemId, input: StayReviewInput, pool): Promise<StayEvent>`, `decideStayReview(actorId, reviewId, {requestKey, action:'charge'|'waive',reason}, pool): Promise<StayEvent>`, `creditStayCharge(actorId, chargeId, {requestKey,amountCentavos,reason}, pool): Promise<StayEvent>`.

- [ ] Write failing T23 SQL cases: no owner-approved rate, missing historical disclosure, approval created after booking, unknown overtime rounding, duplicate/overlapping overtime, explicit unposted waiver and bounded unpaid charge credit. Existing reservations must not become chargeable from a newly inserted checkbox/acknowledgement.
- [ ] Run focused unit/route tests and isolated fixture to observe missing handlers/guards. Use deliberately synthetic approved policy/disclosure rows for positive posting cases, with valid booking-time transaction capture; never backfill owner facts.
- [ ] Implement record-only reviews and current policy blockers. Posting derives amount/minutes from the approved policy version; exact interval milliseconds remain history. Missing rates, rounding/disclosure or unsupported units cause conflict with no debit. Do not add a policy self-approval route or penalty defaults.
- [ ] Implement pre-charge waiver_record with actor/reason/time/duration and zero financial effect; preserve unknown proposed amount as null on review. Credit only unpaid/uncredited overtime/incident portions; never credit extension/base charges or already paid funds. Paid adjustment attempts return policy conflict with no posting; the original review remains for separate reconciliation, not a falsely implemented proposal/refund workflow.
- [ ] Enforce one terminal review outcome, credit caps, no double billing of purchased/waived/overtime intervals and actor-bound retries in SQL. An extension overlapping a prior terminal overtime interval must fail, preserving the prior decision. Neither countdown nor incident creation posts a charge automatically.
- [ ] Gate new fee debits after checkout while allowing record-only review/waiver, existing posted-debt payment and bounded unpaid credits. Test fee posting versus checkout in both lock orders; a completed departure must not gain a new debit from a losing race.
- [ ] Assert original debit/receipt/check-in history remains immutable, refundDue does not increase from unsupported credits, and post-checkout settlement does not reopen a room. Record actual test results, not a legal-compliance claim.

### Task 6: UI, independent concurrency and regression coverage

**Files:** New StayChangesDesk/component tests, existing stay/guest/walk-in/navigation displays, x03 PostgreSQL fixture and unchanged CI harness structure.

**Interfaces:** `StayChangesDesk({token?: string})` is the staff desk; export `StayChangesPreview` with synthetic-only data. Existing StayMonitor response keeps checkout_at as effective time and adds original_checkout_at. New financial display fields are optional before candidate installation. Guest routes reuse verified identity/email filtering and expose only owned effective times/obligations.

- [ ] Write failing component tests from the frontend package cwd (`node --import tsx --test test/stay-changes.test.mjs`): two item drafts survive per-item refresh/409/503; received/allocated/pending/activated states are distinct; 50% threshold, policy-pending labels and explicit confirmation are visible. Enter a reason before asserting a policy-disabled button so the test pins the actual policy guard.
- [ ] Build the functional extension quote, receipt verification/allocation, approval, incident review and waiver/credit flows. Use existing tokens/AM-PM date helpers and accessible dialogs; no redesign, animation dependency, real hotel fixture or implementation jargon in guest copy. Add `/staff/stay-changes` and `/staff/stay-changes-preview`; normal mutation routes remain closed.
- [ ] Wire monitor effective end and original/additional/settlement balances without erasing source records. Verify refresh/sleep countdown anchors and stale-source conflicts. A receipt recorded before failed approval remains visible for reconciliation; UI never labels it refunded or extension active.
- [ ] Extend x03Postgres using independent checked-out pool clients and a finally-safe contention helper modeled on X02. Observe pg_stat_activity lock waits before releasing barriers; timeouts must rollback/release all clients and consume all promises. Force both orderings, not a timing-dependent Promise.all alone.
- [ ] Exercise: last-slot extension versus ordinary booking; two requests for one revision; allocation/release versus approval; checkout versus extension; sibling X01 cancellation/refund versus extension; maintenance/cleaning including buffer-only/exact boundaries; a full-precision fractional-second source anchor. Assert one winner, loser source capacity unchanged, original cancellation clock/refund basis and sibling snapshots unchanged.
- [ ] Inject XX000 failures at receipt registry/audit, allocation, extension debit, revision/claim update and final audit. Assert no partial approval/financial mutation. Test candidate BEGIN/apply/ROLLBACK and all prior suite behavior afterward, plus pre-candidate read fallbacks. Retain all inherited fixture assertions.
- [ ] Run complete isolated PostgreSQL and application suites. No Docker installation, hosted test DB, real room seeding or provider transfers. If isolated execution is unavailable, record NOT RUN and require isolated CI evidence before claiming migration acceptance.

### Task 7: Verification, preview, docs and development checkpoint

**Files:** Only completed X03 scope above and relevant Phase 07/milestone/decision/context notes; existing migrations remain unchanged.

- [ ] Run root `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run format:check`, and `npm run test:db` against isolated loopback PostgreSQL. Record actual counts/exit codes; fix confirmed critical/security defects and every failing required check. Do not weaken assertions/ACLs or bypass guards to pass.
- [ ] Start loopback-only frontend preview and verify HTTP plus functional component interactions. If using Computer Use, follow its skill; do not claim real-device/hosted acceptance from a synthetic page. Record the actual URL and limitations.
- [ ] Review entire in-scope diff including new files, actor rights, all RLS/function ACLs, funding caps and original 13 migration hashes. Inspect staged secrets/sensitive data; `.env`, guest/payer data, payment proofs and unrelated Obsidian/editor/nested-workspace changes must stay out. Follow the chosen execution skill's final review; do not substitute it for the full milestone gate.
- [ ] Record changed files/dependencies, implementation/test results, candidate unapplied status and unresolved financial/hosted/device/earlier acceptance. Keep Phase 07 boxes open without actual full acceptance. At major milestone/predeployment, the original scanloop/greploop executable gate must pass separately; do not claim a clean scanner/independent-review gate without evidence.
- [ ] Stage explicit completed file paths, review staged diff/list and create a Conventional Commit for the verified X03 development checkpoint on existing main; push origin/main under AGENTS.md and verify remote SHA. If push fails, retain local commit and report it. Do not push unfinished substeps or force-push/switch branches.
- [ ] Present the candidate for separate owner readiness/application and authorized hosted acceptance. Do not apply/reset/seed/activate or begin Phase 08. Completion of the last documented task is not automatic completion of Phase 07.

## Self-review and handoff

Coverage checked: immutable identity/history and guards (Tasks 2/4/6); T03/T16 plus funding/clock (Tasks 1/3/4/6); T23/policy/waiver history (Tasks 2/5/6); original payments and checkout settlement (Tasks 3/6); incoming references and allocation conservation (Tasks 2/3/6); authorization/audit and rollback (Tasks 2/4/5/6); UI/fallback/preview (Tasks 4/6/7); migration/hosting separation (Task 7). All five Review Focus conditions have specific tests. No new policy amounts, fabricated disclosures, unsupported payment methods or default billing rounding are required.

This written plan is not implemented or tested. Default policy gates keep real fee posting and live transactions closed. Owner should review the specification and plan together, especially pending-money settlement isolation, disclosure/rounding gates and the immutable baseline/effective-checkout distinction. Choose native execution or explicitly request subagent-driven execution only after final artifact approval. Recommend native execution for these tightly coupled financial/claim interfaces. Stop here until approval; no next task is started.


## Execution status ? 2026-11-19

The owner subsequently gave final approval and explicitly selected native execution. The earlier awaiting-approval language records the artifact's original writing stage, not a remaining implementation permission gate. X03 integrated development checkpoint now has passing build/typecheck/lint/format, 116 application and 15 isolated PostgreSQL tests. New candidate `20261119001300_item_extensions_and_charges.sql` remains unapplied; all prior 13 migrations remain owner-confirmed synchronized. See the Phase 07 checkpoint for implemented scope, independent-review fixes, precise test coverage and remaining acceptance drills. Unchecked instructions above are not retroactively claimed complete: comprehensive permutation/hosted/device/policy/full milestone acceptance remains open. Live writes remain closed.


## Implementation status ? 2026-11-19

Final owner approval and native execution were subsequently granted. X03 is now implemented as a development checkpoint; see [[../../phases/07-changes-refunds-and-ledger#X03 development checkpoint ? 2026-11-19]] for implemented scope, actual checks and remaining acceptance. Candidate `20261119001300_item_extensions_and_charges.sql` remains unapplied. All previous 13 migrations remain owner-confirmed synchronized. Live writes are closed. This supersedes the writing-session approval-pending wording without treating unexecuted acceptance drills or Phase 07 exit gates as complete.
