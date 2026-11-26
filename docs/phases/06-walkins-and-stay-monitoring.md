---
tags: [phase-06, implementation, front-desk]
status: exit-gate-failed-acceptance-pending
---
# Phase 06 — Walk-In Desk, Check-In/Out & Countdown

**Current status - W03 hosted migration / Phase 06 review (2026-11-19):** Owner confirms `20261119001000_room_checkout.sql` successfully applied to Supabase project `pgbierfxeviouyjsmjnh`, with **all 11 local and remote migrations matching**. This supersedes historical W03 unapplied/pending-dry-run/readiness notes below. It records the owner-confirmed result; no new remote query, dry run or migration application was performed in this review. Live transactions remain disabled.

## Phase 06 exit-gate review - 2026-11-19

**Verdict: FAIL for formal phase completion / acceptance pending.** W01-W03 development checkpoints exist and all 11 migrations are owner-confirmed applied/synchronized. This establishes development and migration progress, not hosted front-desk acceptance. Dependencies in Phases 03-05 remain incomplete. No new critical implementation defect is established by this review; missing acceptance and integration evidence blocks the phase gate.

**Task sequence exhausted:** the official task headings are W01, W02 and W03. Neither this specification nor [[13-development-roadmap]] defines W04. This review adds no task.

| Official exit criterion | Existing evidence | Formal result |
|---|---|---|
| Demonstrate walk-in through checkout while online reservation remains protected | W01 mixed cash/verified-GCash ledger and deposit checks; W02 actual check-in/online scheduled checkout; W03 atomic departure, buffer, sibling/future-claim protection and rollback covered in isolated tests | Incomplete: authorized hosted end-to-end staff/session and cross-channel demonstration remains pending; live writes stay disabled |
| Staff correctly see room-by-room countdown and unpaid balances | Persisted check-in/checkout timestamps, server-time countdown, configured warnings, overdue without auto-checkout/charge, reservation-wide balance labels, audited unpaid-departure reasons and later settlement have application/PostgreSQL evidence | Incomplete: hosted staff UI acceptance, two-device comparison and real browser-sleep/reopen verification remain pending; synthetic/component tests are not hardware acceptance |
| Update [[14-milestones]] | This review updates milestones, decisions, context and relevant phase status notes | Met as documentation evidence only; does not complete the phase |

**Critical exit blockers:**

- Owner-confirmed real inventory of 10 Double Standard + 5 Family Executive rooms and authorized hosted front-desk/online-channel acceptance are absent. Synthetic rooms are not actual inventory.
- Hosted walk-in creation, mixed collection, check-in, overdue monitoring, settled/exception checkout and continued debt collection have not been demonstrated together with real authorized staff sessions while protecting online and sibling bookings. Feature gates contain the risk; they do not satisfy acceptance.
- Shared-channel/maintenance-write coordination and the deployed hold-expiry schedule remain unverified/incomplete. A late checkout preserves a future claim but can require staff reconciliation when cleaning overlaps it; no automatic cancellation or Ready transition is implemented.
- The mandatory major-milestone scanloop/greploop/executable quality gate has no passing evidence. Focused code review and passing application/SQL tests are not that gate. Prior Phase 01/02 and Phase 03-05 acceptance debt is not waived.

**Deferred acceptance:** W02 hosted T12/T13/T14/T21 scenarios; W03 T12/T15/T21 on two devices and browser sleep; visual/mobile/accessibility acceptance; owner operational/policy/receipt/privacy/retention values and full Auth/OTP/session checks. Phase 05 notification delivery/retry worker and scheduler remain unimplemented; outbox/reminder persistence does not mean delivery. Existing private-proof/manual-GCash/reference safeguards and no-automatic-refund rules remain unchanged. No task/phase acceptance checkbox is completed by this review.

Reused evidence: [CI run 44452005520](https://github.com/JAVcode-1/dannys-micro-hotel/actions/runs/44452005520) on `178ff73` passed build/typecheck/lint/format, **96 application tests (67 backend + 29 frontend) and 11 isolated PostgreSQL tests, zero failures/skips**. `aa04608` records that evidence. No application, database or comprehensive milestone tests were rerun for this documentation-only review; only documentation diff and staged-secret checks are performed.

**Earlier gates remain FAIL:** Phase 03 still lacks verified real room inventory and full owner/settings/phase acceptance; booked snapshots and per-item persistence now have later automated evidence, so old statements that reservation tables do not exist are historical. Phase 04's allocator/holds are now used by gated online/walk-in code and have concurrency evidence; hosted all-channel/maintenance/expiry acceptance and the full gate remain open. Phase 05 O01-O03 exist, but hosted sessions/proof-access/receiving-account/reconciliation procedures, notification delivery and shared operational/security acceptance remain pending. Applied migrations do not turn any of these gates into PASS.

**Next documented task:** [[07-changes-refunds-and-ledger|Phase 07]], **X01 - Individual cancellation and manual refund** (T17/T18/T19/T27): item-specific cancellation, the original staff-confirmation cancellation clock, itemized refund eligibility, staff manual GCash transfer with verified destination/reference, stage-correct capacity changes and audited financial entries. Phase 07 depends on Phases 05-06. X01 is identified only, **not started or authorized for implementation by this review**. Resolve acceptance/dependencies or obtain a separately scoped development instruction; stop here.


**W02 hosted migration verified (2026-11-19).** Owner confirms successful application of `20261119000900_room_check_in.sql` to `pgbierfxeviouyjsmjnh`. Read-only SQL independently verifies all ten local/remote migration versions match with none pending. This supersedes earlier W02 unapplied notes. Live transactions stay disabled. Phase 03–05 acceptance gaps and real inventory/hosted acceptance remain open. The next documented task is W03, Countdown, overdue and checkout.

**W01 hosted migration verified (2026-11-19).** The owner applied `20261119000800_walkin_booking_ledger.sql` to `pgbierfxeviouyjsmjnh`. A read-only PostgreSQL history query verified that all nine local and hosted migration versions match with none pending. The linked CLI returned 403 during login-role initialization. This supersedes earlier W01 unapplied notes. Live transactions remain disabled. Real hotel inventory, hosted acceptance, and prior exit gates remain open.

**W01 final CI evidence (2026-11-19):** [Run 44432132249](https://github.com/JAVcode-1/dannys-micro-hotel/actions/runs/44432132249) on `307e580` passed build/typecheck/lint/format, **89 application tests and nine isolated PostgreSQL tests, zero failures/skips**. This supersedes W01 pending-CI statements below. The named W01 database fixture includes exactly two receipts (50% cash + 50% verified GCash), additional partial splits, reference races, retries and rollback. Implementation commit `7193d1b` and test follow-up `307e580` are pushed to main. The candidate ninth migration ran only in disposable CI PostgreSQL and remains **unapplied on hosted Supabase**, pending separate owner review/approval. No formal W01/phase checkbox is completed; hosted acceptance and Phase 03–05 dependencies remain open, live writes stay closed, and W02 is not started.

**Goal:** Real staff/front desk operation on same inventory; room-specific reliable countdown.

**Dependencies:** [[03-catalog-inventory-settings]], [[04-availability-and-holds]], [[05-online-booking-and-gcash]].

## Task sequence

### W01 — Walk-in booking and mixed ledger
- [ ] Staff creates category reservation/room items from current shared availability.
- [ ] Staff records multiple cash and staff-verified GCash payments against one reservation.
- [ ] Enforce 50% minimum of selected charges before normal check-in (separate extension minimum in Phase 07).
- [ ] Record payment method, amount, reference, staff and timestamps. Ledger balance = journal totals.

**Acceptance:** T11 passes for 50% cash + 50% GCash; arbitrary missing payment cannot admit guest.

#### W01 development checkpoint — 2026-11-19

Owner approved the six-condition W01 design and gated development despite the **FAILED Phase 03–05 formal gates**. Those acceptance gaps remain open. Implemented W01 only; no W02 final assignment, Ready→Occupied transition, check-in, stay clock or room access. Eight earlier Supabase migrations remain owner-confirmed applied/synchronized. The ninth migration below is **unapplied**.

Implemented:
- Staff-only `/staff/walkins` planner/list/detail, protected quote/create/payment endpoints and Royal Horizon UI. Category-specific allowed package blocks, separate AM/PM Manila arrivals/occupants per item and one optional Family-only ₱100 bed use the existing server quote and V01/V02 transaction allocator. There is no Family 3h option or browser-authoritative price. Planned arrival must be future; it is not an actual check-in timestamp. Existing room identities are read only for labelled provisional capacity; no real hotel identifiers are invented.
- Walk-in reservations have an explicit `walk_in` channel and creating staff UUID, primary guest name and **null Auth owner/verified email**. Online identity requirements remain enforced by a channel constraint. No Auth account, verified contact or ID-photo record is fabricated. Existing online guest ownership queries cannot expose these unowned walk-in records.
- Creation atomically rechecks active staff, locks retry/category/price/settings data, allocates against shared claims/maintenance/cleaning buffers, persists immutable independent item prices/schedules, posts one immutable charge journal entry per item and audits the actor. Shared item-insert mechanics are extracted into `booked-items.ts` and reused by O01 without changing pricing semantics. Same request replays; a changed request with the same key conflicts.
- New `walkin_reserved` is **durable provisional capacity**, distinct from online proof states, paid status, final room assignment and check-in. Existing exclusion constraints include it; the online held/no-proof expiry job does not expire it. Online payment reminders are not created for walk-ins. Existing V02 revalidation cannot silently convert this state. No new automatic walk-in TTL, capacity-release/refund or unpaid admission policy is invented; future explicit cancellation/reconciliation remains pending. Production writes are gated, so no real provisional reservations are created here.
- Append-only journal records room charges and multiple positive cash or **manually verified GCash** receipts. Entries record server time, responsible staff, amount/method/reference and receiving-account evidence/time where applicable. Unverified GCash is rejected and never counted. Balances and `ceil(total/2)` minimum are computed from journal sums; incomplete charges, overpayments, unsafe amounts and unavailable capacity fail closed. Booking/claim locks serialize competing payments; same actor/key/body replays while conflicting retries return 409. Payment eligibility is authoritative server output, not room access; W02 must still enforce all final capacity/Ready/check-in checks. No normal-deposit waiver was documented, so no bypass is added.
- A private global GCash reference registry backfills only existing verified online references and is maintained by insert triggers for O03 and W01. Unique canonical references prevent reuse and concurrent double collection across channels. Registry, journal and staff audit commit/rollback together; immutable records retain actor UUIDs after employee deletion. O03 warnings use the registry after installation and fall back to the existing online table on the current eight-migration schema. Existing payment proof Storage remains private and unchanged.
- Normal Express registration keeps **walk-in creation and payment writes closed**, without an environment toggle. Only isolated test dependency injection opens them. The real staff page requires active sessions and approved migration. Synthetic preview `http://127.0.0.1:5173/staff/walkin-preview` performs local fixture operations only, labels all slots/prices synthetic, and never makes a booking/payment network write. Successful creation clears its quote to prevent an accidental second booking; uncertain requests retain their retry key. GCash receipt input starts at the current minute rather than a future arrival time.

Migration: `supabase/migrations/20261119000800_walkin_booking_ledger.sql` adds channel-aware identity checks, provisional state, channel-scoped reminder scheduling, private append-only charge/payment journal, cross-channel reference registry/backfill and guards/triggers. New tables use RLS and deny browser roles; trigger functions use empty search paths and revoked client execution. It preserves O01 snapshot triggers, V02/V03 exclusion/expiry safeguards and O02 Storage policy. No rooms, guest identities, media or new payment are seeded. **Prepare only; separate owner approval required before hosted application.** Hosted generated DB types are not claimed regenerated.

Changed files/dependencies: backend `walkins.ts`, `walkin-routes.ts`, `booked-items.ts`, app registration/rate limiting, shared insert extraction in `guest-booking.ts`, provisional revalidation guard and backward-compatible O03 duplicate warning; shared walk-in DTO/export; frontend `WalkInDesk.tsx`, App/StaffLogin routes/navigation; focused W01 API/core/UI tests, `w01-postgres.mjs` invoked after O01–O03 in the existing isolated fixture, small O03 query-binding assertion update and CI step label; candidate migration; milestone/decision/context notes. **No dependency or lockfile change.** Unrelated editor/Obsidian configuration and nested workspace files are excluded.

Verification: root build/typecheck/lint/format check and **89 application tests passed (63 backend + 26 frontend), zero failures/skips**. Route/preview and duplicate-creation regressions were observed failing before implementation/fix. Independent read-only review found the successful-creation retry issue; fixed and targeted re-review confirmed resolution, along with receipt-time/default-schema fixes. No full milestone quality gate/perfect score is claimed. Existing >500 kB bundle warning remains nonblocking; code splitting is deferred.

`npm run test:db` was attempted locally and **did not pass**: all five parent fixtures stopped before connection because `TEST_DATABASE_URL` is absent. No Docker/native DB installation, reset or hosted fallback occurred. The new named W01 CI fixture covers candidate migration/RLS, identity separation, journal-derived balances and the 50% threshold, mixed collection/replay/overpayment races, both cross-channel reference directions/concurrency, old online reminders/confirmation and guest ownership, immutable journal/registry, audit-failure rollback of payment/booking/capacity/registry, revoked staff, expiry retention and maintenance rejection. CI cleans only O03's explicitly labelled deliberately conflicting test blocks **after O03's assertions** in the disposable loopback fixture; it does not touch hosted data or weaken that test. Final CI passed all nine isolated PostgreSQL tests, including the named W01 subtest and exact two-receipt T11 scenario; see evidence above.

Preview HTTP returned **200**; component tests demonstrate local mixed collection, unverified-GCash rejection, a fresh-quote requirement after creation, independent AM/PM schedules, one-time Family bed and disabled W02 check-in. Manual browser visual/real-device acceptance is not claimed.

Reviewed all 24 staged in-scope files; staged Gitleaks found no leaks. No new Semgrep/OSV or full scanloop/greploop milestone gate is claimed for this ordinary development checkpoint. Prior security-gate debt remains open.

Remaining acceptance: owner review/application of candidate, approved isolated/hosted synthetic staff sessions and cross-channel operations, real 10 Standard + 5 Family room identities, maintenance-write/expiry/channel integration, receipt/payee/policy/retention/shared throttling/notification/device checks and the outstanding Phase 03–05/full-quality gates. W01 task/phase boxes remain open for dependent acceptance. Live online and walk-in writes remain disabled. **Stop after W01; W02 is the next documented task, not started.**

### W02 — Room assignment and check-in
- [ ] Assign feasible physical Ready room to category booking, rechecking availability.
- [ ] On staff check-in, persist actual start timestamp; for walk-ins compute checkout from purchased duration.
- [ ] For online arrivals, do **not** shift original scheduled checkout by default; 1h grace flagged for staff.
- [ ] Enforce room status transition Ready → Occupied; prevent a second conflicting check-in.

**Acceptance:** T12/T13/T14/T21 pass.

**W02 development checkpoint (2026-11-19).** The staff check-in desk lists Ready candidates and flags online arrivals at one hour without altering capacity. Check-in rechecks staff, payment eligibility, room readiness, maintenance and the buffered claim in one transaction. The room becomes Occupied with an immutable check-in record and staff audit. Walk-ins use actual check-in plus purchased duration. Online stays retain their scheduled checkout. The synthetic preview is available at http://127.0.0.1:5174/staff/check-in-preview.

Build, typecheck, lint, formatting, 90 application tests, and 10 isolated PostgreSQL tests passed on `8ea19a5`. The W02 fixture covers T12/T13/T14/T21 and concurrent check-in. The local database command stopped because `TEST_DATABASE_URL` was absent. Migration `20261119000900_room_check_in.sql` ran in isolated CI and awaits separate owner approval for hosted application. Live check-in remains disabled. Formal acceptance, real inventory, and prior exit gates remain open. [GitHub Actions run 44447042367](https://github.com/JAVcode-1/dannys-micro-hotel/actions/runs/44447042367)

### W03 — Countdown, overdue and checkout
- [ ] Dashboard computes from persisted server timestamps; reload/reopen no drift.
- [ ] One configurable reminder before checkout and a separate overdue status.
- [ ] Timer zero never auto-checks out; staff records real checkout.
- [ ] Remaining balance must normally be settled; allow documented exception to complete departure.
- [ ] After checkout mark Needs cleaning, not instantly Ready.

**Acceptance:** T12/T15/T21 pass, test on two devices and browser sleep.

## Exit gate

- [ ] Demonstrate walk-in through checkout while online reservation remains protected.
- [ ] Staff can correctly see room-by-room countdown and unpaid balances.
- [ ] Update [[14-milestones]].

**Next:** [[07-changes-refunds-and-ledger]].


## W03 development checkpoint - 2026-11-19

Owner approved the bounded W03 design and seven requirements. Dependency: existing W01 ledger and W02 persisted check-in/checkout times; owner-confirmed W02 hosted application is retained in the working notes. Prior Phase 03-05 acceptance gaps remain open. This implements W03 only and does not complete Phase 06 or authorize Phase 07.

Implemented: protected `/staff/stays` monitor and retry-safe `/staff/stays/:id/checkout`, with live checkout unconditionally closed in normal Express registration. Countdown derives from persisted W02 timestamps and a PostgreSQL server-time anchor, with monotonic elapsed time, periodic/focus/visibility resynchronization and stale-time warning. Zero is overdue; no automatic checkout, schedule extension or overtime charge. Multiple configurable warning thresholds are nullable, bounded and audited through operational settings; unset values fall back to the existing single threshold without inventing owner defaults. Manila dates use AM/PM.

Checkout rechecks active staff and locks the reservation/item, category, claim, room-block table and Occupied physical room. It derives the reservation-wide balance from actual ledger receipts or staff-verified online payments. Normal departure requires settlement; an unpaid departure requires an immutable reason, staff actor, actual server timestamp and balance snapshot. Checkout record, staff audit, exact item-claim release, protective cleaning block and Occupied -> Needs Cleaning commit together. Retry actor/key/reason must match; concurrent alternative departures conflict. A later receipt can settle an unpaid departure without erasing the departure balance snapshot. Unexplained released claims still prohibit collection.

Capacity protection: W02's checked-in claim guard permits only an exact recorded checkout release and otherwise remains intact. Cleaning protection runs until the later of the original buffered end and actual departure plus purchased buffer. Early departure conservatively retains the original protected window. Late cleaning may overlap a future reservation claim; departure succeeds without rewriting/cancelling that claim, while readiness and blocks prevent premature access. Cleaning is never automatically marked Ready. Reservation schedules, prices, other room items and W02 timestamp records remain unchanged.

Changed files: `backend/src/{stay-monitoring,app,operational-settings,walkins}.ts`, backend W03 application/PostgreSQL tests and W01 fixture wiring; `frontend/src/{StayMonitor,stay-clock,App,StaffLogin,OperationalSettings}` and focused countdown/preview tests; candidate migration below; these milestone/decision/context/phase notes. No dependencies or lockfile changes. Unrelated Obsidian/editor/nested-workspace changes and pre-existing note edits are excluded from the checkpoint.

Migration prepared only: `supabase/migrations/20261119001000_room_checkout.sql` adds private RLS-protected append-only checkout records, bounded warning configuration and narrow claim/buffer protections. Requires the ten existing migrations, isolated PostgreSQL success and separate owner review/approval before hosted application. No hosted migration, reset, Docker installation, inventory seed, real payment or live transaction activation occurred. Existing settings continue working on the pre-W03 schema; the new monitor requires the candidate.

Verification: root build, typecheck, lint and formatting check pass; 96 application tests pass (67 backend + 29 frontend), zero failures/skips. The tests cover staff/guest denial, input and settings validation, exact countdown boundaries/client clock skew/delayed ticks, overdue UI, persisted preview timestamps and independent-room departure. Focused independent read-only review found payment-after-departure, fixture-context and preview/retry issues; fixed and re-review found no remaining critical/important issues. This is not the executable full scanloop/greploop milestone gate.

`npm run test:db` was attempted locally and failed before connection because `TEST_DATABASE_URL` is absent; no hosted fallback was used. The new named nested W03 fixture is wired into the existing disposable-loopback CI suite and asserts RLS, concurrent same/different-key retries, audit-failure rollback, real overdue monitoring without auto departure/charges, unpaid exceptions/revoked staff/later settlement, cleaning buffers, immutable history, unchanged sibling room schedules and unchanged real future reservation claims. CI execution is pending at this checkpoint; do not describe these PostgreSQL assertions as passed until its result is observed.

Preview: http://127.0.0.1:5173/staff/stay-preview returned HTTP 200. Synthetic fixtures only; no actual room identifiers or booking/payment network writes. Component interaction checks pass. Computer Use stopped because Windows browser URL could not be verified; visual/two-device/real browser-sleep/hardware acceptance is not passed. Existing >500 kB bundle warning remains nonblocking.

Checklist: W03 and Phase 06 formal boxes remain unchecked. Outstanding acceptance includes candidate owner approval/application, isolated CI result, hosted synthetic staff sessions and cross-channel acceptance, two-device/browser-sleep checks, real room inventory, owner operational/policy settings, receipt/privacy/notification/device requirements and prior full-quality gates. Stop after W03. Next action is W03 acceptance/migration review when instructed, with no next feature started.

Staged security inspection: Gitleaks executed and reported four generic-key matches in W03 PostgreSQL fixture request-key strings. All four are synthetic idempotency labels, not credentials; no scan rule was weakened or suppression added. No actual secret, guest data, proof image or .env file is staged. Semgrep/OSV/full executable milestone review were not run for this ordinary checkpoint.

W03 verification follow-up (2026-11-19): first CI run 44451363848 on ea0f935 passed all application/static checks but the W03 PostgreSQL cart correctly collided with O02's protected +30/+31-day Family fixture. The W03-only cart moves to +100/+101 days; O02 claims and allocator checks are preserved. The candidate also updates W01's database ledger guard, retaining all financial/staff checks while permitting a released item only with an immutable checkout record. This matches the Express allowance and enables later collection of unpaid-departure debt. A focused read-only review confirmed the narrow guard replacement. Local required checks and 96 application tests pass; PostgreSQL rerun remains pending.

W03 final CI evidence (2026-11-19): [run 44452005520](https://github.com/JAVcode-1/dannys-micro-hotel/actions/runs/44452005520) on implementation checkpoint `178ff7386c059f56f20646ff64714afa30d15f91` passed build/typecheck/lint/format, **96 application tests (67 backend + 29 frontend) and 11 isolated PostgreSQL tests, zero failures/skips**. The named W03 database fixture passed, including late checkout/future-claim independence and later unpaid-departure collection through the preserved database guard. This supersedes the earlier pending-CI and first failed fixture run. The eleventh migration ran only in disposable CI PostgreSQL and remains **unapplied on hosted Supabase**, pending separate owner approval; SHA-256 `2FB20C42A46ADF0DFDA358034FE965F95F8940BC5ECC5D6B58458E6D43F994D3`. Main implementation and correction are pushed. No formal W03/Phase 06 box is marked Done; device/browser-sleep/hosted acceptance and prior gaps remain open, live writes remain closed, and no subsequent feature is started.


W03 targeted migration readiness review (2026-11-19): **NOT SAFE TO APPLY pending successful password-based CLI dry run.** Reviewed `20261119001000_room_checkout.sql` and connected authorization, settings, clock, ledger and transaction code; no blocking implementation defect found. Candidate SHA-256 remains `2FB20C42A46ADF0DFDA358034FE965F95F8940BC5ECC5D6B58458E6D43F994D3`, unchanged from tested `178ff73`. Reused passing run 44452005520 (96 application + 11 isolated PostgreSQL tests); comprehensive tests were not repeated. Reviewed RLS/client-denied permissions, retained function ACLs/empty search paths, immutable checkout/debt evidence, active-staff checks, retry/unique/rollback protections, Needs Cleaning and conservative buffers, future-claim/sibling-item isolation, persisted UTC countdown and configurable alerts. Read-only hosted SQL independently confirms exactly ten applied versions matching the first ten local files, no remote-only version, and only `20261119001000` pending. Supporting tables retain RLS/client denial; existing supporting functions retain revoked client execution; W03 table/alert column are absent. Both `supabase migration list --remote` and `supabase db push --remote --dry-run` identify `pgbierfxeviouyjsmjnh` (platform branch label production), then fail login-role initialization with HTTP 403. Therefore no successful CLI dry-run evidence exists yet. Owner will use the established database-password method; do not share its value in chat. No migration/reset/live activation, code change or subsequent feature; no acceptance box completed. Device/hosted/full-phase acceptance remains separate from migration readiness.
