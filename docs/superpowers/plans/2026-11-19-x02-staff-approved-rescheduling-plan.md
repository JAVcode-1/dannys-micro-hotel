# X02 Staff-Approved Rescheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native implementation, or superpowers:subagent-driven-development only if the owner selects that method. Implement task-by-task after final approval. Steps use checkbox syntax; none are completed by writing this plan.

**Goal:** Let verified guests request and staff safely approve an individual room-item schedule move, preserving identity, purchased price and history.

**Architecture:** Immutable request/decision events drive a guarded current-schedule projection and the existing claim in one PostgreSQL transaction. Reuse shared allocation mechanics and Express identity checks. Price-changing duration proposals are separate policy-pending records, never posted obligations, receipts or refunds in this slice.

**Tech Stack:** React, TypeScript, Tailwind, Node.js/Express, pg, Supabase PostgreSQL/Auth; existing node:test and React Testing Library; no new runtime dependency.

**Spec:** [X02 design](../specs/2026-11-19-x02-staff-approved-rescheduling-design.md). Read it in full, especially the safe financial boundary; direction approval is not approval to expand money-changing behavior.

## Approval and starting evidence

Written specification and plan await final owner approval. Owner confirms all 12 Supabase migrations synchronized, including X01. This session performs no code implementation, hosted query, migration, reset or activation. Passing X01 CI 44459769726 (100 app + 12 isolated PostgreSQL tests) is baseline evidence only. No X02 tests have run or passed. Earlier phase and hosted acceptance remain open.

The owner explicitly requested both artifacts now; do not wait for a separate document-writing round. Final written-artifact approval and execution-method selection are still required before coding. Recommend native execution because schema, projection guards and action contracts are tightly coupled. No subagents are launched by this plan-writing task.

## Global Constraints

- React + TypeScript + Tailwind frontend; separate Node.js + Express + TypeScript API; Supabase-managed PostgreSQL.
- Store UTC instants; render all guest/staff schedule times in Asia/Manila using 12-hour AM/PM.
- No new runtime dependency; reuse pg, Supabase Auth, existing allocator and transaction retry helper.
- Preserve reservation/item/claim UUID or numeric identity, immutable prices, original confirmation and cancellation terms, payment evidence, cancellation/refund records and sibling item fields.
- No Family Executive 3-hour package; no automatic per-person fee; no additional extra-bed charge.
- Live transaction routes remain unconditionally disabled in normal app registration.
- All new tables enable RLS and deny public/anon/authenticated privileges. Backend-only actions enforce actor rights; trigger functions use empty search paths and revoked browser execution.
- Existing twelve migration files remain byte-for-byte unchanged. A thirteenth candidate is created only during approved implementation and remains unapplied until separate owner approval.

## Review Focus

1. A lost response replay arrives after an approved move incremented the revision: return the original result rather than duplicating work or failing stale-version validation (Tasks 2/3).
2. A catalog rate/package changes after purchase: a same-package move preserves its purchased price and duration (Tasks 1/3).
3. A request is created before check-in/cancellation but reviewed after it: approval rechecks and leaves current capacity untouched (Tasks 2/5).
4. A comparison quote is negative: show policy-pending and never add it to refund due or permit transfer (Tasks 1/3/4).
5. A second browser tab or another room's form contains stale values: only the submitted item/request/revision can change (Tasks 3/4/5).

## File map and responsibilities

| Files | Responsibility |
|---|---|
| Create `packages/shared/src/rescheduling.ts`; modify `packages/shared/src/index.ts` | Wire types only, no trusted calculation in browser |
| Create `backend/src/rescheduling-policy.ts` | Pure bounded parser and server snapshot/quote classification |
| Create `backend/src/rescheduling.ts` | Request/list/decision actions, SQL orchestration and Express routes; domain policy stays here |
| Modify `backend/src/app.ts` | Register closed routes with existing Auth/throttling |
| Create `supabase/migrations/20261119001200_item_rescheduling.sql` | Private append-only history, current pointer/revision and atomic approval guards |
| Create `backend/test/rescheduling.test.mjs`, `backend/test/rescheduling-routes.test.mjs`, `backend/test/x02-postgres.mjs`; modify `backend/test/zz-v02.integration.mjs` | Pure/API tests and new nested isolated DB fixture after X01 |
| Create `frontend/src/RescheduleDesk.tsx`; modify `frontend/src/GuestReservations.tsx`, `frontend/src/StaffLogin.tsx`, `frontend/src/App.tsx` | Per-item guest request, staff queue/confirmation, protected navigation and synthetic preview |
| Create `frontend/test/rescheduling.test.mjs` | Interaction, stale-state, financial copy and identity isolation |
| Modify Phase 07, milestones, decisions, context | Actual evidence and pending gates, never inferred completion |

Existing guest/check-in/stay readers already consume `room_bookings.start_at/end_at`; no new effective-schedule layer. Verify them, change only if a concrete incompatibility is found. Do not refactor unrelated code. Do not introduce a generic financial journal or second allocator. Pure shared mechanics accept explicit inputs; SQL mutations remain in actions/triggers under the existing code-structure rules.

### Task 1: Contracts and pure schedule/financial classification

**Files:** Create shared rescheduling types, `backend/src/rescheduling-policy.ts` and `backend/test/rescheduling.test.mjs`; modify shared index export.

**Interfaces:** Define and export these wire types before later tasks consume them:

```ts
type RescheduleInput = {
  requestKey: string; expectedRevision: number;
  startAt: string; endAt: string; blocks: number[]; reason: string;
};
type RescheduleDecisionInput = {
  requestKey: string; expectedRevision: number; approved: boolean; reason: string;
};
type RescheduleEligibility = 'eligible' | 'walk_in_policy_pending' |
  'extra_bed_policy_pending' | 'financial_policy_pending';
type RescheduleRecord = {
  id: string; roomBookingId: string; expectedRevision: number;
  originalStartAt: string; originalEndAt: string;
  requestedStartAt: string; requestedEndAt: string;
  eligibility: RescheduleEligibility; approved: boolean | null;
  originalCentavos: number; proposalDeltaCentavos: number | null;
  proposalStatus: 'policy_pending' | null;
  confirmationAt: string; cancellationDeadlineAt: string;
};
type RescheduleSnapshot = {
  channel: 'online' | 'walk_in'; startAt: string; endAt: string;
  blocks: number[]; totalCentavos: number; extraBedCentavos: number;
};
```

`parseRescheduleInput(value: unknown, now: number): RescheduleInput` normalizes instants/reason and rejects unknown mutation fields. `classifyReschedule(snapshot: RescheduleSnapshot, input: RescheduleInput, comparisonCentavos: number | null): {eligibility: RescheduleEligibility; deltaCentavos: number | null}` derives the approvable schedule-only zero delta or policy-pending proposal. Category-specific block validation uses the authoritative item category in the action; never trust a browser category.

- [ ] Write parser/classification tests, including this preserved-price regression:

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyReschedule } from '../dist/rescheduling-policy.js';
test('same purchased blocks preserve price despite a new catalog price', () => {
  const source = { channel: 'online', startAt: '2027-01-01T02:00:00Z',
    endAt: '2027-01-01T08:00:00Z', blocks: [360],
    totalCentavos: 40000, extraBedCentavos: 0 };
  const input = { requestKey: 'reschedule-synthetic-001', expectedRevision: 0,
    startAt: '2027-01-02T02:00:00Z', endAt: '2027-01-02T08:00:00Z',
    blocks: [360], reason: 'Synthetic schedule change' };
  assert.deepEqual(classifyReschedule(source, input, 50000),
    { eligibility: 'eligible', deltaCentavos: 0 });
  assert.deepEqual(classifyReschedule(source, { ...input, blocks: [180],
    endAt: '2027-01-02T05:00:00Z' }, 20000),
    { eligibility: 'financial_policy_pending', deltaCentavos: -20000 });
});
```

- [ ] Run `npm run build -w packages/shared` then `npm run build -w backend` and `node --test backend/test/rescheduling.test.mjs`; confirm the new test fails from missing exports rather than a pre-existing failure.
- [ ] Implement validation/classification only: strict UUIDs/keys/version/safe money, allowed block list, 1–30 blocks, valid zoned future minute instants, calendar round trip, end matches duration, trimmed/control-free reasons, no unchanged request. Reject client actors/prices/eligibility. Walk-in/extra-bed policy outranks same-duration eligibility.
- [ ] Add explicit tests for invalid February dates, omitted timezone, non-minute time, negative/unsafe revision, mismatched end, Standard/Family package restrictions, no-op, zero-price-difference duration change still blocked, positive/negative/zero comparison proposals and paid extra-bed/walk-in gating.
- [ ] Rebuild and run the focused test until passing; record actual output. Keep these changes inside X02 until the verified checkpoint in Task 6.

### Task 2: Candidate schema and atomic event/projection guards

**Files:** Create candidate SQL and `backend/test/x02-postgres.mjs`; modify `backend/test/zz-v02.integration.mjs` to import/invoke `x02Postgres(t, pool)` immediately after `x01Postgres`. Do not create another destructive standalone DB runner.

**Interfaces:** Export `x02Postgres(t, pool): Promise<void>` from the new fixture. Reuse the disposable pool/roles/inventory of the existing chained fixture. New tables/columns/constraints match the spec's record table. The candidate decision trigger performs the single approval operation; Express will insert decisions rather than independently mutating capacity.

- [ ] Read the current integration harness and copy only its synthetic **data setup** into a local helper in `x02-postgres.mjs`: `makeConfirmedPair(pool)` returns `{guest, staffId, reservationId, itemId, siblingId, claimId, readyRoomId, startAt, endAt}`. Use `createGuestHold`, `submitPaymentProof`, `decidePaymentReview` as in X01. Never weaken production guards or use hosted identities.
- [ ] Write a failing nested migration test, loading candidate SQL after twelve existing migrations. Assert RLS/client denials on all three tables; function ACLs/search paths; immutable events; unique retry/request/revision enforcement. PostgreSQL statement examples for the harness:

```sql
select relname, relrowsecurity,
 has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as anon_access,
 has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as authenticated_access
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='staytrack' and relname in
 ('reschedule_requests','reschedule_decisions','reschedule_adjustment_proposals');
```

- [ ] Run root `npm run test:db` **only** with the existing loopback `TEST_DATABASE_URL` pointing at `/staytrack_test`. If unavailable, record NOT RUN and rely on future isolated CI; never substitute DATABASE_URL or remote Supabase. Confirm test fails because the candidate/objects are absent when an isolated environment is available.
- [ ] Implement additive columns and tables. Add item/request composite uniqueness/FK for the pending pointer, actor/key/hash uniqueness and one terminal decision per request. Persist server-derived snapshots; require zero-delta/unchanged-duration approval; proposals are always policy-pending. All event tables reuse immutable-history protection; no financial-view posting.
- [ ] Implement the transaction guard/apply triggers with the spec's lock/recheck protocol, category allocator validation and exclusion checks, actor audit, exact +1 revision and old/new allocation match. Pure allocation happens in the action but SQL must independently verify the selected room against overlapping claims and maintenance under the same locks. Insert approval before its projection writes; forbid direct schedule/revision edits or clearing the pointer without matching request/decision. A decision insert must never be a record-only success.
- [ ] Add raw-SQL bypass tests: fabricated guest actor/email, inactive staff, wrong claim/revision/pointer, missing/forged request, changed duration/price/confirmation, released/checked-in/pending-cancellation claim and direct schedule mutation. Expected exception; unchanged snapshot. Use database assertions, not only HTTP mocks.
- [ ] Inject an audit trigger failure with `errcode='XX000'`, matching X01's tested error-masking convention. Approval must leave no decision and preserve schedule/revision/pointer/claim. Also fail claim/projection writes and assert rollback. Remove only injected fixture triggers afterward.
- [ ] In a disposable transaction apply the candidate then roll back and check new objects/columns absent while prior objects survive. Test candidate application against existing populated synthetic records (revision 0/pointer null). No production recovery exercise or down migration.

### Task 3: Actions, routes and inventory integration

**Files:** Create `backend/src/rescheduling.ts`, `backend/test/rescheduling-routes.test.mjs`; extend policy and PostgreSQL tests; modify `backend/src/app.ts`.

**Interfaces:** Implement and export:

```ts
type RescheduleActor = GuestIdentity | { staffId: string };
requestReschedule(actor: RescheduleActor, roomItemId: string,
  input: unknown, pool = databasePool()): Promise<RescheduleRecord>;
decideReschedule(actorId: string, requestId: string,
  input: unknown, pool = databasePool()): Promise<RescheduleRecord>;
rescheduleRows(actor: RescheduleActor, pool = databasePool(),
  page = 0): Promise<RescheduleRecord[]>;
registerReschedules(app: Express, staff: RequestHandler,
  verifyGuest: (token: string) => Promise<GuestIdentity | null>,
  enabled = false, pool?: ReturnType<typeof databasePool>): void;
```

Import existing `GuestIdentity`, `BookingError`, `claimTransaction`, `allocateRooms` and new wire types. No separate transaction inside decision actions. The pseudocode below specifies ordering, not additional public helpers:

```text
claimTransaction(db =>
  verify active actor / guest ownership;
  lock reservation, then item;
  find exact actor/key/hash replay -> return it before version validation;
  assert current request, revision and business/policy state;
  acquire category lock, claim row, block SHARE and selected room lock;
  rebuild allocator snapshot, excluding only this claim;
  compute selected destination or conflict;
  insert immutable decision (trigger moves claim/projection and audits);
  return committed event DTO;
)
```

- [ ] Write failing route tests using the existing `cancellation-routes.test.mjs` app/pool-stub pattern: anonymous 401, revoked/non-staff 403, guest wrong owner 404, closed POST 503, no guest decision endpoint; no-store reads and bounded pages. Fake pools never replace true SQL concurrency tests.
- [ ] Run `npm run build -w backend` then `node --test backend/test/rescheduling-routes.test.mjs backend/test/rescheduling.test.mjs`; confirm missing registration/actions fail as expected.
- [ ] Implement routes exactly as the spec's route table, with existing catalog staff/verified guest middleware, request throttling and safe business-error mapping. Register without enabled=true in normal `app.ts`; no new environment switch opens writes.
- [ ] Implement request transaction: trusted time, exact-body retries, ownership, revision and source snapshots; set pending pointer; append assisted-request audit; preserve-price move or separate duration-change comparison proposal. Add reject transaction with terminal audit and pointer clearing. Use parameterized SQL for every user value.
- [ ] Implement approval orchestration using `allocateRooms` on authoritative locked data. Keep siblings and other allocations fixed. Do not call `revalidateClaim` or release/recreate the claim. Keep `rescheduling.ts` domain-specific; extract no generic SQL service for this single flow.
- [ ] Test success/reject/re-request, no-X02 schema behavior, exact replay after successful revision increment, same key changed body, same request different actor/key, and deterministic unresolved-first pagination. List guest DTOs must exclude payer/payment identifiers and other guests' data.
- [ ] Extend isolated fixture through exported actions: rate update/deactivation does not reprice same-package moves; comparison delta is signed correctly, policy-pending and excluded from `reservation_financials`; duration change approval fails even for zero delta; ordinary X01 eligible cancellation still uses unchanged original price/deadline after repeated schedule moves.
- [ ] Verify existing `guestReservations`, `checkInItems`, `checkIn`, stay monitoring and cancellation rows read the updated projection. Preserve their current routes/flags; modify those files only if the tests demonstrate a compatibility defect.

### Task 4: Per-item guest UI and staff review desk

**Files:** Create `frontend/src/RescheduleDesk.tsx` and `frontend/test/rescheduling.test.mjs`; modify `GuestReservations.tsx`, `StaffLogin.tsx`, `App.tsx`. Use existing theme tokens; add CSS only if existing primitives cannot express the form.

**Interfaces:** `RescheduleDesk` is the default staff component. Export `GuestRescheduleForm({itemId, revision, startAt, endAt, blocks, confirmationAt, submit})`, where submit accepts `RescheduleInput` and returns `Promise<RescheduleRecord>`. Export `ReschedulePreview` with synthetic local state only. GuestReservations uses its authenticated request path; it never supplies an actor ID or trusted amount.

- [ ] Write failing Testing Library tests following `frontend/test/cancellations.test.mjs`: render two forms, change one, submit it, assert the other retains its values; render blocked negative proposal and assert no enabled Approve action or refund-completed copy. Test a stale 409 response preserves inputs and requires refresh/review.
- [ ] Run `npm run build -w packages/shared` and `node --import tsx --test frontend/test/rescheduling.test.mjs`; confirm missing components fail.
- [ ] Build the guest form and owned history using per-item state. Render current/proposed times, original cancellation deadline and capacity-not-reserved notice. Calculate displays from server fields, never browser-trusted financial/eligibility decisions. Use explicit Asia/Manila conversion and 12-hour AM/PM.
- [ ] Build staff queue and approve/reject confirmation with old/new times, original price, blocker label, reason and expected revision. Keep history and policy proposals separate from due/paid money. Disable duplicate submissions; return focus and announce errors accessibly.
- [ ] Add protected `/staff/reschedules` navigation and `/staff/reschedule-preview` synthetic route. Normal POSTs remain closed; no fixture triggers real network payments or creates hotel identifiers.
- [ ] Add boundary UI tests: long reasons and labels, two-item form isolation, second-tab stale data, correct 12-hour date across UTC/Manila day boundary, keyboard confirmation/cancel, HTTP 503 schema/write gate and guest-private-field absence. Run focused component tests again.

### Task 5: Real concurrency and regression evidence

**Files:** Extend `backend/test/x02-postgres.mjs`, the route tests and relevant existing test files only where asserting compatibility. Keep existing CI workflow if the nested harness already runs the new fixture.

**Interfaces:** Use `makeConfirmedPair` from Task 2 inside the same fixture. `pool.connect()` allocates independent clients. Hold the shared reservation/item or category lock on a controlling client, launch competitors, then release the lock to force a real race. Compare committed records on a third query, not only promise statuses.

- [ ] First write failing T20: insert a labelled disposable maintenance block on the only feasible destination, approve, expect conflict, compare full source item/claim/sibling/financial snapshots. Also exercise cleaning buffer ending exactly at target start and a later maintenance insertion serialized with the approval lock.
- [ ] Write T28: record sibling item/claim/check-in/countdown and financial snapshots, approve only target, assert target identities preserved and all sibling fields deeply equal. Include a sibling already checked in to prove reservation locking does not mutate it.
- [ ] Write two destination approvals competing for one slot and an ordinary booking competing with approval. Assert exactly one capacity winner and losing original capacity remains. Include both lock orders/deadlock retry exhaustion with safe 409/503 and no partial move; no unbounded retry.
- [ ] Write check-in versus approval and X01 request/decision versus approval races using independent connections and explicit barriers. Force each possible winner in separate cases. Assert committed outcomes match the spec race table, not arbitrary success expectations.
- [ ] Write exact retry concurrency plus same actor/key/different body and different staff/request key conflicts. Verify one approved event, +1 revision and one approval audit; replay after later revision remains original result.
- [ ] Write fault injection at audit/projection/claim plus immutable UPDATE/DELETE, foreign item/request pointer mismatch and active-staff revocation. Assert no partial changes; guest/anon privilege failures are real role checks.
- [ ] Write two sequential approved moves then cancellation boundaries at trusted 59:59.999 and exactly 60:00 from original confirmation. Verify no new confirmation and original refund amount; no financial proposal counted in due/collected/refunded totals.
- [ ] Run existing full isolated suite on loopback PostgreSQL and all application tests. Record exact result counts/failures/skips, including inherited X01/W03 tests. Missing isolated service is NOT RUN, not a passing migration gate; future CI must provide evidence before checkpoint acceptance.

### Task 6: Verification, documentation and development checkpoint

**Files:** Only completed X02 implementation/test/candidate files above and relevant Phase 07/milestone/decision/context notes. These design/plan files may be updated to reflect owner-approved amendments.

- [ ] Run at repository root, recording each exit code: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run format:check`, and isolated `npm run test:db` where configured. Fix failing checks and confirmed critical security/correctness defects. Do not alter assertions or safeguards to gain a pass.
- [ ] Review complete in-scope diff and untracked paths; check API/DB actor rights, client ACLs, immutability, financial-policy gates, closed app registration, race/rollback evidence and all twelve original migration hashes unchanged. No `.env`, proof, payer/guest data, credentials or unrelated Obsidian/editor/nested-workspace content belongs in staging.
- [ ] Ordinary checkpoint: essential authorization/security and diff/secret review are mandatory. Major milestone/predeployment: read original scanloop/greploop skills, run `powershell -NoProfile -File .\scripts\run-quality-gate.ps1` and require exit 0 plus code-specific tests. Do not report scanners/independent reviews/hosted/device checks passed unless actually run.
- [ ] Update current status with changed files, dependencies, actual test output and risks. Keep money-changing X02 acceptance and every hosted/earlier gate unchecked. Record candidate as unapplied; do not claim synchronized count 13. No X03 work begins automatically.
- [ ] Stage explicit completed file paths, inspect `git diff --cached --check`, staged file list and full staged diff, then create a Conventional Commit and push the verified development checkpoint to existing origin/main under AGENTS.md. No branch switch/force push. Check push output and remote branch SHA; if failure, retain local commit and report it. Do not push unfinished intermediate tasks.
- [ ] Present the checkpoint for separate owner candidate-migration readiness/application and hosted synthetic acceptance. Do not run non-dry-run db push, reset, seed or enable transactions. No checkbox becomes Done merely because code was committed.

## Plan self-review and execution handoff

Self-review performed while writing: T20/T28 map to Task 5; identity/ACL policy to Tasks 2/3; immutable history and transaction rollback to Tasks 2/5; shared inventory and races to Tasks 3/5; purchased-price and monetary proposal gating to Tasks 1/3/4; UI/read compatibility to Tasks 3/4/5; deployment/migration separation to Task 6. All five Review Focus cases have explicit tests. No new library, invented owner policy, production test DB or automatic transfer path is required.

The principal remaining product limitation is deliberate: duration/price-changing approvals are not implemented by this slice. Their requests/proposals remain review-only. Owner approval of the written spec must explicitly accept that boundary; otherwise revise the financial settlement design before implementation. All test commands above are future execution instructions, not claims of results.

Final handoff: review this plan and the linked specification together, confirm the proposed boundary and choose native execution or explicitly request subagent-driven execution. Stop until that approval arrives.
