---
tags: [phase-07, x03, specification, final-approval-pending]
status: written-specification-awaiting-owner-approval
---
# X03 — Extensions, Overtime and Incident Charges

Date: 2026-11-19, Asia/Manila. The owner approved the architectural direction and requested this specification and its implementation plan together. Both written artifacts require final approval; no X03 application code, migration or policy activation is authorized by writing them.

## Intent, scope and evidence

Staff can extend one active checked-in room item after verifying capacity and at least 50% of its additional package charge. Staff can review overtime/smoking incidents, explicitly post supported charges or record reasoned waivers. Original booked prices, receipts, check-in evidence, room-item identity and sibling stays remain intact. No timer imposes a fee, checks out a guest, or transfers money.

Sources: [[../../phases/07-changes-refunds-and-ledger]], [[../../02-requirements]], [[../../13-development-roadmap]], [[../../15-testing-plan]], [[../../17-decisions]], [[../../18-backlog]], AGENTS.md and the existing W01/W02/W03/X01/X02 implementations. The owner confirms **all 13 migrations applied and synchronized** on `pgbierfxeviouyjsmjnh`. X02 code `deb01fa` and documentation `87bc35f` are pushed. Reuse the recorded 108 application and 13 isolated PostgreSQL passes as baseline only; none prove X03 exists or passes.

The approved approach extends current inventory and the financial read model with domain-specific immutable events. A general accounting rewrite would change more X01/X02 behavior; it is outside this task. No category change, physical room move, new occupant/extra-bed purchase, original reservation repricing, X02 money-changing reschedule activation, refund transfer, legal ruling or Phase 08 work is included.

## Global constraints

- React + TypeScript + Tailwind; separate Node.js + Express + TypeScript API; Supabase-managed PostgreSQL.
- No new runtime dependency; reuse pg, the shared allocator, package pricing and transaction retry helper.
- Store UTC instants and integer PHP centavos; show Asia/Manila times in 12-hour AM/PM.
- Preserve room-item, reservation and claim identity, original prices/payments/confirmation, immutable check-in and sibling records.
- No Family Executive 3-hour package, per-person surcharge or repeated continuous-stay Family extra-bed charge.
- All live X03 writes remain unconditionally closed in normal application registration; no environment switch opens them.
- New tables use RLS with public/anon/authenticated privileges revoked; views use security_invoker and deny browser access.
- All event writes enforce active staff, server-derived amounts/state, immutable history and atomic actor audit.
- Keep the existing 13 migration files unchanged; any new candidate remains unapplied pending separate owner approval.

## Extension clock and price

The immutable baseline is `room_check_ins.checkout_at`, reflecting existing online/walk-in check-in rules. Approved extensions form a revision chain on the same item/claim/physical room:

```text
oldEffectiveEnd = baseline checkout + sum(previous approved extension minutes)
newEffectiveEnd = oldEffectiveEnd + requested supported package minutes
```

Request time and approval time never replace `oldEffectiveEnd`. T16: a 3-hour extension requested 15 minutes after the old end still ends at old end + 3 hours. Repeated extensions add to the last approved end, never restart from now or discard earlier purchases. Rejected/pending requests contribute zero minutes.

SQL derives authoritative ends directly from persisted timestamptz anchors and purchased minutes, retaining their full precision. JavaScript Date formatting/arithmetic is for display and pure preview checks, never a reason to round a stored source instant or recalculate it from now.

The server snapshots the original category's active allowed package IDs, versions, duration and price. Reuse pure package pricing without the new-booking parser's future-start requirement, since the old end may be in the past. Original booking/package prices remain unchanged; only the additional purchase uses the approved server quote. There is no extra-bed or person-count input. An already-paid Family bed continues in the same uninterrupted room stay with zero additional bed charge. New beds, transfers, split stays and refund-treatment changes remain blocked under unresolved policies.

On approval, require unchanged source revision/end/claim/room, an active check-in with no checkout, unchanged quoted active package versions/prices and a future resulting effective end. A request whose entire added interval has already elapsed is review-only until an explicit owner policy exists; no elapsed-only package charge is inferred. A changed/stale quote must be rejected and replaced with guest consent, never silently repriced against collected funds. Approval reasons record the guest's requested purchase.

## Immutable records and projections

These are future object names, not objects created in this writing session:

| Object | Required contents and constraints |
|---|---|
| `stay_extension_requests` | UUID; room/reservation/source-claim identity; staff actor; actor-scoped retry key/body hash; reason/guest-consent note; expected extension revision; baseline checkout and old/new effective end; unchanged room/start/buffer snapshot; package/version/price snapshot; additional minutes and charge; trusted server time. One unresolved request per item, enforced under item lock and a guarded nullable pointer. No proposed-capacity hold. |
| `stay_extension_decisions` | Request FK primary key; approve/reject; actor/key/hash/reason/time; old/new revision/end and immutable source snapshot. One approved revision per item; reject has no capacity/charge effect. |
| `stay_charge_reviews` | Immutable overtime or smoking facts, item/reservation, actor/reason/time, proposed interval/minutes where relevant, optional policy version and pre-booking disclosure evidence. Unknown rate/amount is null, not a fictional zero-priced obligation. |
| `stay_charge_entries` | Immutable kind `extension_debit`, `overtime_debit`, `smoking_debit`, `waiver_record` or `charge_credit`; item/reservation; actor/key/hash/reason/time; nonnegative magnitude/PHP; exactly the appropriate extension/review/original-charge reference. Unique extension debit per approved request, one debit or terminal pre-charge waiver per review. Credit is bounded to the original supported charge's unpaid, uncredited portion. |
| `stay_receipts` | Immutable actual cash or staff-verified GCash receipt; reservation; positive amount/PHP; actor/key/hash; actual received/server recorded times; required receiving-account/ledger/time/reference evidence for GCash. Screenshot alone is never verified money. |
| `stay_receipt_allocations` | Immutable `allocate` or `release` event; receipt/reservation; extension-request OR posted-charge target; positive amount; actor/key/hash/reason/time. Release references exactly one original allocation, copies its source/target/amount, and is unique for that allocation. Release is permitted only for an unactivated rejected/stale request, never a posted charge or active extension. |
| `stay_charge_policy_versions` | Immutable typed overtime/smoking policy, PHP rate/unit, effective interval, disclosure text/version and owner-approval evidence. No rates or approvals are seeded; X03 exposes no API that can invent/approve a missing owner policy. |
| `reservation_charge_disclosures` | Immutable reservation/policy/text-version acknowledgement captured in the booking transaction before confirmation and stay/incident. No retroactive backfill or staff assertion may manufacture historical disclosure. |
| `stay_item_terms` | Private view of baseline checkout, latest approved effective checkout/revision and item identity; falls back to baseline for items without extensions. A view avoids rewriting immutable check-in history. |

Add nonnegative extension revision and a nullable current-request pointer to `room_bookings`, separate from X02's schedule revision/pointer. Use composite FKs to prohibit cross-item/reservation links. Immutable rows retain actors after staff account deletion. No UPDATE/DELETE/TRUNCATE privilege is granted to client roles. Do not add generic accounting abstractions beyond these specific records.

Requests, allocations, releases, charges, credits and receipt recordings require exact actor/key/canonical-body retry matching. A changed body, target or actor conflicts. Successful POST responses are stable event snapshots, even after later decisions; GET provides current blockers and balances. Existing key format is 16–100 `[A-Za-z0-9_-]` characters, reasons 1–1000 trimmed characters with no controls, block count 1–30, safe integer monetary values. Validate dates by strict calendar/timezone round trip. The browser supplies no actor, authoritative charge, clock anchor, eligibility or allocation balance.

## Payment and allocation rules

The approved additional package charge is `C`. Activation requires active verified funding allocated to that exact extension request of at least `ceil(C / 2)` centavos. If a configured permitted package has price zero, threshold zero follows the quoted price; there is no independent staff-entered free-extension price. The full remaining approved extension debt is due at normal final checkout.

1. Record each actual receipt independently of activation, with actor audit and an actor-bound idempotency key. Walk-in extensions support the existing cash/verified-GCash methods. Online extensions use verified GCash; an online-cash policy is not introduced by X03. Unsupported payment methods are rejected before posting.
2. Only new `stay_receipts` may fund X03 allocations. Original `verified_online_payments` and `walkin_ledger` receipts retain their existing base-reservation meaning and cannot be presented as fresh extension funding. No original deposit is counted twice.
3. Extend `gcash_reference_registry` with a unique `stay_receipt_id` FK and an exactly-one-source constraint across its three incoming sources. Preserve existing rows and registration logic. Normalize GCash references with the existing helper; insertion plus receipt audit is atomic. Do not weaken the existing registry's immutable trigger or create a competing registry.
4. Lock the reservation and affected receipt rows before allocating. Across all targets, active allocations cannot exceed the receipt amount. One target allocation cannot exceed its outstanding quoted/posted amount. Both source and target must belong to the same reservation; no implicit sibling allocation or refund-netting. Splitting one new receipt across explicitly selected room items is allowed only through separately audited allocations.
5. An allocation to an extension request continues to fund its unique posted extension debit after activation. Do not create a second allocation when posting that debit. Later top-ups use the same request target and are capped against its outstanding approved debit.
6. A rejected unactivated request creates no debit. Staff may append reasoned release events to its funding commitments, returning money to unallocated status without deleting receipts or claiming money returned. Reallocation to a replacement request requires explicit staff/guest-consent reason and all constraints again.
7. If availability, policy, quote or stay state blocks activation after actual payment, retain receipt and commitments for reconciliation. No automatic refund/transfer, invented refund entitlement, automatic release of paid capacity, or silently lost money. Unexpected real receipts can remain unallocated with a reconciliation warning; they do not activate an extension.
8. Allocations on activated purchases/posted charges cannot be released or reassigned in this slice. An accounting error involving spent/paid money requires a separately reviewed reconciliation design. Never relabel it as an unpaid waiver.

Cash recording is a staff attestation with audit/idempotency; the software cannot prove that two physically indistinguishable cash handovers are different. GCash reference uniqueness and allocation caps are database-enforced. No official receipt/tax compliance is claimed.

## Financial totals and checkout

Preserve the existing `reservation_financials` column names/types/order and append X03-specific fields. Keep the view private/security-invoker. Define:

```text
original = immutable reservation total
baseDue = max(0, original - X01 cancellation credits - original receipts + X01 completed refunds)
extraNet = posted X03 debits - bounded posted X03 charge credits
extraPaid = active allocations matched once to posted X03 debits
netCharge = original - X01 cancellation credits + extraNet
collected = original receipts + all actual X03 receipts
balance = netCharge - collected + X01 completed refunds
settlementDue = baseDue + sum(max(0, each X03 debit - its credits - its active allocations))
refundDue = existing X01 cancellation credits - existing X01 completed refunds
unallocatedX03 = actual X03 receipts - all active X03 allocations
pendingExtensionFunds = active allocations to unactivated extension requests
```

`balance` is the account-wide economic balance and can be negative while money is awaiting reconciliation; it is not a payout instruction. `settlementDue` controls normal checkout. Unallocated deposits or commitments to an unactivated request must not settle an original debt or another item's extension. Original receipts and already-completed refunds are counted once; X02 proposals remain excluded. Never make `refundDue` include unsupported X03 refunds. Show unallocated/pending money separately.

Modify W03's balance reader to use `settlement_due_centavos` when X03 is installed, otherwise preserve the existing X01/pre-X01 fallback. Retain the existing reservation-wide normal settlement rule and documented unpaid-departure exception; do not introduce a new per-item base-payment allocation or remove a sibling's debt. Show the base balance and added obligations distinctly on older walk-in screens; their base collection endpoint still applies only to the original ledger.

An additive room_checkouts insert guard recomputes settlement due under the same reservation/item lock, requires the captured balance to match and requires the existing documented exception for nonzero debt. This prevents a backend writer from recording a false zero balance while an approved extension remains unpaid. Preserve the original checkout row/history and cleaning-release checks.

Post-checkout payments may settle existing posted X03 debt, with active staff and allocation checks. They never reopen occupancy or rewrite `room_checkouts.balance_centavos`/exception history. Pending extension requests become currently blocked by checkout and can be explicitly rejected/reconciled; they do not block physical departure indefinitely. A zero timer, remaining debt or unallocated deposit never automatically checks out, releases a room or marks it Ready.

## Overtime, smoking, waivers and policy gates

Staff first record an item-specific review. Overtime captures actual interval/minutes and server time; smoking captures incident facts and relevant evidence references, without storing new guest/ID photos. No guest self-posting or timer-triggered financial action exists.

Posting a debit requires an owner-approved, configured rate/version applicable to the review and valid disclosure evidence. Rates are derived on the server, never taken from a browser amount. Smoking specifically requires durable evidence the policy was disclosed before the booking; a new acknowledgement after the incident does not qualify. Reservations among the existing 13 migrations lack this new evidence by default, so incident posting stays blocked unless genuine qualifying evidence already exists; no fabricated historical migration backfill. Missing/ambiguous policy leaves a review-only record and actionable blocker. Policy configuration is a separate owner-reviewed operation; no owner role or approval is guessed from the shared Staff/Admin tier.

Initial supported units are an explicitly approved overtime per-minute rate and a smoking per-incident amount; other units remain review-only. Store exact interval/duration milliseconds. Any conversion to billable minutes, including rounding, must come from the approved policy version; no default ceiling rule is invented. Waiver history may retain exact elapsed duration without asserting a monetary amount. Include a booking-transaction disclosure capture hook for future genuine acknowledgements, preserving existing callers when no policy is configured. There is no retroactive acknowledgement API; the public/assisted booking presentation and actual policy approval remain activation acceptance requirements.

An explicit waiver of an unposted review records actor, reason, timestamp and relevant waived minutes, with no debit or refund. Where an approved rate exists, retain the proposed amount in the review snapshot; unknown amounts stay null. A credit against a posted overtime/incident debit must name that charge, require a reason, and cannot exceed its unpaid/uncredited portion or make it overpaid. Preserve the original debit. An adjustment affecting paid funds is policy-pending, not a posted credit/refund. Extension package charges cannot be manually discounted through this fee-waiver path.

Paid-funds adjustment attempts return a policy conflict without a posted event; this slice does not claim a separate paid-adjustment proposal workflow or execute a refund. Staff retain the original incident/review history for separately reviewed reconciliation. The UI must not request payment for a policy-blocked charge; unexpected money already received may only be recorded factually as unallocated funds awaiting reconciliation.

New overtime/incident debits after checkout remain blocked in this slice pending explicit post-departure charging policy. Reviews and waivers can still record facts, and existing posted debts can still be settled or receive a permitted unpaid credit without reopening occupancy.

The same overtime interval cannot receive overlapping debit/waiver decisions or be billed again as an extension. An extension conflicting with a prior terminal overtime decision is blocked for reconciliation; no silent reversal of a charge or waiver. A proposed overtime interval overlapping purchased extension time is rejected. No penalty amount, smoking finding or legal enforceability is automatically inferred. Family continuous-stay bed continuation is supported without another fee; adding/transferring beds or changing split/refund treatment remains gated.

## Transactions, locks and protected capacity

All mutations use one `claimTransaction` connection. Order: active staff FOR SHARE; reservation then item FOR UPDATE; involved receipt rows in UUID order; category advisory lock when changing inventory; source claim FOR UPDATE; room_blocks SHARE; original physical room FOR UPDATE. The reservation lock serializes money, extension approval and W03 checkout. Existing category-before-row operations can deadlock; retain bounded 40001/40P01 retries and perform no external payment/notification side effect within a retry.

Approval re-reads the entire request/revision/quote/stay/receipt state after locks. Require same active occupied room and source claim, unchanged baseline and old end, confirmed claim, no recorded checkout, no cancellation/refund conflict, no policy block and sufficient uniquely allocated funding. Allocation must never be released or spent between the 50% check and commit. Reuse `allocateRooms` with the original room fixed; convert only overlapping other claims/maintenance/cleaning to fixed blocked ranges. Exclude only the source claim. Do not move other claims, reassign an occupied room or force-fit an extension over a future booking. Preserve exact source start/buffer and expand only end/buffered end.

The allocator's added-occupancy interval is `[oldEffectiveEnd, newEffectiveEnd + storedBuffer)`, including elapsed time for a late request. A historical block wholly before that interval must not reject otherwise valid added capacity. The persisted claim still spans its unchanged original start through the expanded end; its existing exclusion constraint arbitrates the complete occupied range. A block/booking intersecting any part of the added stay or its new cleaning buffer blocks approval.

The approved-decision insert atomically creates its single extension debit, advances extension revision/pointer, extends the claim and writes audit. Direct SQL guards independently enforce policy/funding/interval invariants. Failure at any charge, claim, projection or audit write rolls everything in that approval back. Previously committed actual receipts stay recorded; rejected/failed approvals create no debit or new clock. Same-request replay returns its original event; competing/stale approvals produce conflict.

Existing checked-in-claim guards currently reject every interval change. The future candidate must narrowly extend `protect_checked_in_claim()` and `guard_reschedule_claim_projection()` to accept only an exact approved X03 end expansion on the same room/claim/start/buffer with matching +1 extension revision. Retain every original deny branch and the W03 exact-release/cleaning-buffer exception. Do not disable triggers, alter immutable check-in rows, or accept a session flag as authorization. X02 schedule revision remains separate; its pre-check-in restriction is unchanged.

Use the effective term view in monitoring, check-in history reads and guest stay displays. Preserve `checkout_at` as the effective end in the existing monitor wire response while exposing `original_checkout_at` separately; countdown and alert ordering must use the same effective value. Checkout's existing buffer computation uses the expanded claim's buffered end and still marks Needs Cleaning. A concurrent extension that loses to checkout cannot activate; if extension wins, checkout sees its new debt/end and requires settlement or the existing exception.

## HTTP and UI contracts

Use existing verified staff middleware, active-staff rechecks, no-store headers, throttling, bounded pages and default closed writes. No new guest mutation authority is introduced. Guest ownership/verified-email reads may expose their own effective end and itemized obligations, never private receiving-ledger/reference/payer data.

| Route (future) | Meaning |
|---|---|
| GET `/staff/stay-changes?page=0` | Active/pending item histories, immutable source/effective times, quote, allocated/remaining amounts and current blockers; deterministic 100-row pages |
| POST `/staff/stay-changes/:itemId/extensions` | `{requestKey, expectedRevision, blocks, reason}`; server anchors and prices the request |
| POST `/staff/stay-extensions/:requestId/decision` | `{requestKey, expectedRevision, approved, reason}` |
| POST `/staff/stay-changes/:itemId/receipts` | Actual supported payment method/amount/time and cash/GCash verification evidence; no activation |
| POST `/staff/stay-receipts/:receiptId/allocations` | Exactly one extension-request or posted-charge target, amount, reason/key |
| POST `/staff/stay-allocations/:allocationId/release` | Key/reason; server derives immutable release values after checking rejection/unactivated status |
| POST `/staff/stay-changes/:itemId/reviews` | Overtime/smoking facts, interval/minutes and reason; record-only when policy unavailable |
| POST `/staff/stay-reviews/:reviewId/decision` | Explicit charge or pre-charge waiver, key/reason; no client authoritative penalty |
| POST `/staff/stay-charges/:chargeId/credit` | Requested unpaid credit magnitude/key/reason; server bounds it against the supported unpaid charge |

Use 400 malformed input, 401 unauthenticated, 403 inactive/non-staff, 404 unknown/not-owned read, 409 stale/capacity/policy/funding/duplicate conflict, 503 unavailable schema/closed writes/infrastructure error. No raw SQL/provider evidence in errors. Action responses are immutable event snapshots; queue GET recomputes blockers such as checked out, stale quote, insufficient funds and policy pending.

Staff flow: select checked-in item; see old end, allowed added blocks, exact additional quote, 50% minimum and remaining debt; record/verify receipt; allocate it; explicitly confirm approval with new end and unchanged original terms. Distinct tabs/cards handle charge review, waiver/credit and reconciliation so money entry cannot be mistaken for activation. Preserve each draft/retry key through errors and per-item refresh; refresh authoritative state without resetting sibling drafts. Show original versus effective checkout and original versus additional balances. Use existing Royal Horizon tokens, accessible labels/focus-return dialogs, AM/PM and synthetic-only previews. No final UI polish dependency.

## Acceptance and recovery

| Requirement | Required evidence during implementation |
|---|---|
| T03 | Repeated Family extensions never add another paid continuous-stay bed fee; new/split/transfer policy requests blocked |
| T16 | Late 15-minute request gets old end + package duration; repeated extensions remain a contiguous revision chain; elapsed-only/stale requests cannot post |
| T23 | Review-only unsupported incident; explicit pre-charge waiver and bounded unpaid credit preserve reason/actor/time/minutes and historical debit |
| Funding | Below/exact/above ceil-50%, odd centavo charge, zero configured package, top-ups, pending/unallocated money, original receipt reuse refusal, duplicate GCash across all three sources, over-allocation and release-after-activation denial |
| Concurrency | Independent DB connections with observed lock barriers: ordinary booking/extension, two extensions, allocation/release/approval, checkout/extension in both orders, sibling cancellation/refund/extension, maintenance insertion and duplicate actor/key/body retries |
| Rollback/security | Real role/table/function denials, revoked staff, cross-reservation links, immutable UPDATE/DELETE, direct claim/end/debit bypasses, audit/charge/allocation/claim fault injection and migration transaction rollback |
| Settlement | Half-paid activated extension blocks normal checkout; full top-up permits it; documented unpaid departure works and later collection preserves immutable departure history; pending funds cannot pay original debt |
| Compatibility | Apply candidate after all 13, exercise W01/W02/W03/X01/X02 behavior before/after, no-X03 read fallback, sibling claims/check-ins/prices/refunds byte-for-byte unchanged; countdown reload/sleep and AM/PM UI checks |

Future fourteenth candidate path: `supabase/migrations/20261119001300_item_extensions_and_charges.sql`; verify next unused version before creating it. No candidate file exists from this writing task. No rates, disclosures, real room identifiers or actual receipts are seeded. Preserve ACLs when replacing functions/views. A candidate-installation failure rolls back transactionally; committed financial history is recovered through an owner-reviewed forward correction or backup restore/reconciliation, never reset/deletion or an old writer that bypasses guards.

Normal implementation checkpoint requires build/typecheck/lint/format/application tests plus isolated PostgreSQL evidence and essential security/secret inspection. Formal Phase 07 completion additionally requires outstanding hosted/device/policy/earlier-phase acceptance and the full executable milestone quality gate; no completed milestone is inferred from a checkpoint. All 13 synchronized migrations are owner evidence, not a fresh query by this writing session. No tests/scanners/hosted checks for X03 are claimed here. Written-artifact approval and an execution-method choice are the next gate; do not begin another task.

Implementation plan: [[../plans/2026-11-19-x03-extensions-overtime-incident-charges-plan]].
