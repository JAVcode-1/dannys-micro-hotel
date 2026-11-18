---
tags: [decisions, source-of-truth]
status: approved-baseline
---
# 17 — Approved Decisions Register

## O03 applied; Phase 05 task boundary — 2026-11-19

Owner confirms O03 migration `20261119000700_staff_payment_review.sql` applied to `pgbierfxeviouyjsmjnh` and all eight versions match locally/remotely. This supersedes earlier unapplied/readiness notes, without claiming a new CLI dry run or granting live-payment approval. The canonical Phase 05 specification ends at O03; there is no next Phase 05 feature/O04 to invent. Stop development at the Phase 05 exit gate; Phase 06 needs a separate instruction and unresolved dependencies remain documented. No new business policy, code, migration, dependency, hosted upload or inventory seed. Hosted Storage acceptance, notification delivery, actual 15-room inventory, earlier phase/milestone gaps and full security gates remain pending; live booking/payment confirmation stays disabled.

## O03 approved implementation boundary — 2026-11-19

Verification follow-up: [CI run 44358583870](https://github.com/JAVcode-1/dannys-micro-hotel/actions/runs/44358583870), commit `ef0e22f`, passed build/static checks, 82 application tests and 8 isolated PostgreSQL tests with no failures/skips, including the named O03 transaction/security subtest. Earlier fixture failures are resolved by honoring O01's revised catalog price and constructing fixtures before the deliberate maintenance conflict. No production logic or approved policy was changed. This is not hosted migration approval or permission to open live confirmation.

Owner explicitly approved the six-condition staff-review design and implementation. No new hotel policy. Staff must check actual receipt/amount/recipient/time/reference in the hotel receiving GCash account; UI attestations do not automate authenticity verification. Canonical verified references are unique across reservations; request keys are actor-bound and version checks reject conflicting decisions. Confirmation atomically preserves O01 prices/schedules while updating all protected claims/items, snapshotting configured cancellation terms and immutable confirmation time, auditing and enqueueing a private notification outbox. Missing approved terms/payee fails closed. Reconciliation decisions retain capacity with history and can be reconsidered using the current version; no automatic refund/release or unilateral schedule change. Expired proof uploads remain rejected under O02; paid-late guests need manual contact, guest-consented replacement or verified manual refund, not automatic confirmation. Delivery/scheduler and Phase 07 payout processing are not implemented. Normal live confirmation remains disabled without an environment switch. Eighth candidate migration `20261119000700_staff_payment_review.sql` requires separate owner approval and remains unapplied. All seven earlier migrations stay applied; hosted synthetic Storage acceptance and Phase 03/04 gates remain open. Evidence and risks: [[phases/05-online-booking-and-gcash]]. Stop after O03.

**Current O02 hosted verification (2026-11-19):** Supersedes historical unapplied/pending-CI statements. Owner-confirmed O02 application is independently corroborated by read-only SQL: all seven local/remote migration versions match through 20261118000600. SUPABASE_DB_PASSWORD is absent. Both payment-proofs and payment-qr exist, private, PNG/JPEG only, 5242880-byte limit; verified through SQL and backend-key Storage getBucket requests. Storage RLS and the restrictive ALL-command anon/authenticated bucket exclusion policy are present; client roles cannot bypass RLS. Backend secret configuration works for metadata reads; no frontend secret/database variable names found. No hosted writes/uploads, resets, seeds or live enablement occurred. Configuration is ready for owner-approved synthetic upload/access/expiry/rejection/cleanup tests, which remain unperformed. Reuse passing O02 CI (72 application + 7 isolated PostgreSQL tests); no application checks rerun. No dependencies/code changes or acceptance checkboxes completed. Retention/email/scheduler and prior formal gates remain pending. Next official Phase 05 task is O03 staff payment review and confirmation; implementation not started. No new hotel policy or hosted-write approval. Detailed findings: [[phases/05-online-booking-and-gcash]].

## O02 implementation note — 2026-11-19

**Verified checkpoint evidence:** [Run 44344674739](https://github.com/JAVcode-1/dannys-micro-hotel/actions/runs/44344674739) passed on `794e3a0`: 72 application tests and seven isolated PostgreSQL tests, zero failures/skips, plus build/typecheck/lint/format. O02 is explicitly named in the database log. This is development acceptance evidence, not hosted Storage certification or owner approval to apply the new migration, open payments, or begin O03. Earlier six migrations remain applied; the seventh is unapplied.

Owner confirms O01 `20261118000500` applied to `pgbierfxeviouyjsmjnh`; read-only history verifies six versions, superseding prior unapplied notes. O02 is development only: backend/private Storage, staff-configured QR, screenshot plus reference, pending staff verification. The 5 MB PNG/JPEG limit and 120-second QR links are technical choices, not hotel policy; signatures are checked, not full image/malware decoding. `payment_qr` replaces free-text C03 metadata as the payment source. Guest payment routes stay closed in production; test construction opens only isolated coverage. Original deadlines/booked prices remain authoritative. Claims are protected atomically after upload and fresh DB-clock checks, never confirmed. Uncertain commits retain private media for reconciliation. Reminder times persist, but delivery/scheduler remain disabled. O02 migration remains unapplied and hosted Storage/retention acceptance pending; no O03, verified reference uniqueness, refund, formal phase completion or live activation. Details: [[phases/05-online-booking-and-gcash]].

> **Always prefer the most recent owner clarification.** Decision IDs are durable citations; amend via a new change record rather than quietly rewriting history. D = approved, P = proposed/pending.

| ID | Decision | Status |
|---|---|---|
| D-001 | Single hotel v1; architecture can extend to branches | Approved |
| D-002 | Guest online booking + staff/walk-in booking | Approved |
| D-003 | One shared inventory: 10 Double Standard, 5 Family Executive | Approved |
| D-004 | Guest reserves category; staff assigns physical room number | Approved |
| D-005 | Online **full GCash QR prepayment before confirmation**, with human verification | Approved; supersedes previous pay-at-hotel online idea |
| D-006 | Online hold 30m for proof; on-time proof remains protected pending manual review | Approved |
| D-007 | Proof reminder 5m UI, 15/25m email; reviews overdue 15m, urgent 30m, critical 60m | Approved |
| D-008 | Staff manually reviews and transfers GCash refunds; logs reference | Approved |
| D-009 | 1-hour online free-cancel window **from staff confirmation**; check-in ends that room's window | Approved; supersedes 24h/package cutoff |
| D-010 | Online arrival grace 1h, original departure unchanged; staff reviews possible no-show | Approved |
| D-011 | Registered and verified no-account guest booking; email OTP for no-account | Approved |
| D-012 | Multi-room reservations; one primary guest; individual occupant counts | Approved |
| D-013 | Each booked room can have independent package, check-in and checkout times | Approved |
| D-014 | Cancel/reschedule an individual room without modifying others | Approved; reschedule requires staff approval |
| D-015 | Stay durations are allowed per-category packages/combinations, not arbitrary durations | Approved |
| D-016 | Double 3h ₱200, 6h ₱400, 12h ₱600, 24h ₱1,000 | Approved current owner price |
| D-017 | Family **no 3h**; 6h ₱600, 12h ₱900, 24h ₱1,200 | Approved current owner price |
| D-018 | Occupancy 2 (+1 child) Double; 3 Family are standard figures, **not strict booking caps** | Approved standard/advisory; legal limit unresolved |
| D-019 | No per-person extra charge; only Family extra bed ₱100 **once per continuous stay** | Approved |
| D-020 | Walk-in accepts cash, GCash, or mixed payments; min 50% deposit | Approved |
| D-021 | Walk-in stay clock begins on staff check-in/room access, not payment time | Approved |
| D-022 | Extensions need 50% of extension charge before activation; start from old checkout | Approved |
| D-023 | Checkout countdown survives reload, never auto-checkout; overtime fee/waiver staff controlled and logged | Approved |
| D-024 | Cleaning buffer configurable + manual physical Ready before next guest | Approved |
| D-025 | Maintenance blocks rooms, tracks repair, alerts future booking impacts | Approved |
| D-026 | No-smoking disclosed; penalty configurable, staff-approved or reasoned waiver | Approved |
| D-027 | All staff have one tier but individual login and audit identity | Approved |
| D-028 | Cloud-based v1, manual offline backup and reconciliation | Approved |
| D-029 | React + TypeScript + Tailwind; Node.js + Express + TypeScript API; PostgreSQL | Approved |
| D-030 | Code only after docs-first baseline, implement one tested phase at a time | Approved |
| D-031 | Staff verifies minor's ID physically and records verification, no stored image by default | Approved procedure, **legal sufficiency pending** |
| D-032 | Staff-approved early check-in moves departure earlier to preserve duration, if available/Ready | Approved |
| D-033 | Confirmed booking pricing/policy snapshotted; changes apply to future bookings | Approved |
| D-034 | Late/eligible online refund via manual GCash transfer; no-show generally nonrefundable subject to law | Approved business policy, legal review pending |
| **D-035** | **Supabase selected as managed PostgreSQL platform**, keeping the separate React app and Node/Express API | **Approved 2026-11-12; replaces the unspecified DB hosting/provider** |

## UI design decision (separate from hotel operational policies)

- **UI-001 — Approved by project requester (2026-11-12):** **Danny's Royal Horizon**. Royal Blue `#2443B6` primary; Sunset Orange `#F97316` guest CTA (with navy text); Soft Lavender `#EEE9FA`, Warm White `#FAFAFD`, Midnight Navy `#17213D`, and Sky Blue `#EAF1FF`. Clean **white sidebar / white cards / minimal shadows** for Staff/Admin; real hotel imagery and primary blue/orange CTA for guests. Supersedes the earlier Modern Blue & Slate proposal and the unapproved Royal Sunrise draft. This is a **digital design approval from the project requester**, not an assertion of hotel management's production-brand/legal signoff. See [[09-ui-ux-design-system]] and [[21-before-coding-checklist]].

## Pending/Proposed implementation decisions (not owner-confirmed)

- **P-001** Implementation selection: Supabase CLI SQL migrations + `pg` recommended for concurrency-critical operations; detail the category lock/claim implementation and any optional ORM in Phase 01 ADR.
- **P-002** Exact physical room identifiers, configured cleaning duration, checkout alert minutes and room occupant legal limits.
- **P-003** Package combination pricing optimization/tie-break policy for long stays.
- **P-004** Fee application and quantity of multiple extra beds, if hotel can provide more than one.
- **P-005** Payment/receipt compliance, **React/API hosting**, and owner-approved GCash QR media upload. Supabase is selected for PostgreSQL.
- **P-007** Supabase Auth and private Supabase Storage are **recommended technical integrations** to be configured/tested; not separate confirmed owner policy changes.
- **P-006** Behavior when 5 vs 6 Family Executive guests use an extra bed: advisory only unless an approved safety limit exists.

## Approved change procedure

When owner changes a decision: record `date`, `old`, `new`, `reason`, `affected docs`, `data migration/finance implications`, `test updates` and `approver`. Update requirements + phase acceptance before code.

See [[18-backlog]].

## Platform implementation change — 2026-11-12

**Requested change:** Use Supabase for the project. **Technical result:** Replace unspecified PostgreSQL hosting with **Supabase-managed PostgreSQL**; preserve React/TypeScript/Tailwind, Node/Express/TypeScript and all existing hotel business rules. Supabase Auth and Storage are the recommended managed integrations pending their detailed phase ADRs. **Affected documentation:** tech stack, architecture, schema, security, API, deployment, development checklists, Graphify maps and ICM context. **Status:** documentation change only; no Supabase project/credential/app provisioned by this update. See [[22-supabase-setup]].


## D-036 — Final source-folder names (2026-11-12)

**Confirmed by developer project layout:** `frontend/` for React; `backend/` for Express; `supabase/` for SQL/CLI; optional `packages/shared/` for reusable types. All v1.3 planning references to `apps/web` and `apps/api` are normalized to match this actual folder structure. No application code is claimed.

## D-037 — Preserve original Claude skills for Codex (2026-11-12)

**Requested:** Preserve exact source files for `code-structure`, `scanloop`, and `greploop` as originally uploaded; place in `.agents/skills/`, with root `AGENTS.md` requiring their review/quality workflow. Refer to `CODEX-START-HERE.md` for compatibility and truthful execution limits. Actual scanner installation, reviewer agent features and every skill's execution remain workstation-dependent. Do not automatically commit/push.

## D-038 — Verified guest ratings, public reviews and private feedback (2026-11-16)

**Approved by project requester for planning (no code implemented):** The hotel website is open for public browsing, including a list and aggregate of published verified guest ratings. Only the reservation's verified **primary guest** with recorded staff check-in **and completed checkout** can submit a 1–5 star public rating with an optional comment, once per completed reservation (including multi-room). Applies to online registered, online no-account via the existing verified booking email + expiring single-use link, and walk-in stays with a verified contact method. Other website visitors cannot submit reviews.

**Fairness and protection:** Legitimate positive and negative ratings—including **1-star**—remain eligible for publication and the average. Private feedback is staff-only. Staff may reply and temporarily hide/restore clearly violating reviews (e.g., spam/threats/personal data) with an explicit policy reason and audit actor, but cannot modify customer stars/comments or hide feedback merely for criticism. Suspicious content may be flagged for moderation; no blanket positivity-approval gate.

**Scope/timing:** Add as a Phase 08 enhancement behind a feature gate; no impact on initial Phase 01 coding. Detailed implementation prerequisites/remaining decisions in [[24-verified-guest-reviews]] and [[18-backlog]], test cases T31–T38 in [[15-testing-plan]]. **No owner-stated operating results or completed development implied.**

## D-039 — F01 workspace tooling (2026-11-17)

**Implementation choice:** Use npm 10.9.8 workspaces with Node.js 22 or newer for separate `frontend/`, `backend/` and `packages/shared/` packages. F01 uses Vite, React, Tailwind CSS, Express, strict TypeScript, ESLint and Prettier. This records developer tooling, not a hotel business-policy change. Database migrations, connectivity, Auth and Storage remain for later tasks; the existing Supabase project is preserved. F01 quality-gate evidence is recorded in [[14-milestones]].

## D-040 — F02 hosted development acceptance and deferred reset tests (2026-11-17)

**Owner-approved change:** Complete F02 against the existing `dannys-micro-hotel` hosted Supabase development project (`pgbierfxeviouyjsmjnh`) without Docker or another project. The approved catalog migration was already applied. Current F02 acceptance uses migration history, read-only catalog/constraint checks, generated types, TLS-verified Express connection, HTTP health/readiness, application tests, security scanners and independent reviews. The project must not be reset or seeded for this decision.

**Target label clarification:** The owner designated this existing project for development. Supabase CLI 3.2.0 reports its base branch as `environment: production`; this is the platform branch label, not evidence that StayTrack is deployed to hotel users. The gate requires the approved project reference and name plus that observed base-branch label. [Supabase's branch documentation](https://supabase.com/docs/guides/deployment/branching/dashboard) says the dashboard displays `main / PRODUCTION` for every project's base branch. F02 still forbids hosted reset, seed execution and routine non-dry-run schema changes.

**Approved local migration artifact:** SHA-256 `1B0E4BB6DE9B9C11C2068BDE7C4F827BCC3DEE8D73CBE748A610911FD6C194A3` for `20261117000100_foundation_catalog.sql`. The F02 gate checks this exact file hash before hosted verification. This pins the reviewed local source; Supabase migration history records a version, not a remote SQL checksum. Any later catalog change requires a reviewed forward migration.

**Explicitly deferred, not passed:** A second fresh isolated database migration, reset rehearsal and fictitious seed execution/count checks. Risk: an unnoticed fresh-install or seed defect could obstruct recovery or later physical inventory setup. Require isolated non-hosted testing before relying on a rebuild or activating physical inventory; this decision does not waive security or implementation findings. F03 and the Phase 01 exit gate remain separate.

**2026-11-18 checkpoint authorization:** The owner approved committing and pushing current F02 work as a development checkpoint while final verification remains pending. This does not change D-040 acceptance or the mandatory scan and independent review thresholds. The latest hosted gate stopped at Supabase CLI type generation; F02 is not marked Done.

## D-041 — F03 isolated test database boundary (2026-11-18)

**Implementation choice:** GitHub Actions uses its own PostgreSQL 17 service and a loopback `staytrack_test` URL. The F03 constraint test rejects any other host or database name before opening a connection, applies the F02 catalog migration only inside a transaction and rolls it back. CI provides no hosted Supabase credentials. Local isolated database execution and the first CI run remain unverified; this decision does not waive the F02 gate or future authorization tests.

**2026-11-18 verification note:** `picomatch 4.0.7` is installed through Vite/fdir/tinyglobby in frontend development tooling; it is absent from `npm ls --omit=dev`. The high-severity GHSA-fc5q-39xc-vjpf remains a genuine, unsuppressed scan finding, and no verified patched npm version was available. No incompatible override is approved. GitHub Actions and its isolated PostgreSQL test remain unverified; F03 and Phase 01 are not Done.

## D-042 — A01 staff identity implementation checkpoint (2026-11-18)

**Implementation choice:** Supabase Auth manages individual employee credentials and sessions. Express verifies each bearer token with Auth, queries `staytrack.staff_accounts` for active membership on each staff request, and records the actor in `staytrack.staff_audit`. There is one capability tier; no public signup or self-edited metadata grants staff access. The browser receives only a publishable key. The SQL migration is prepared but unapplied pending explicit owner approval. Actual invitation, rate limits, hosted acceptance, and quality-gate evidence remain pending; this is not an A01 completion decision.

**Audit retention:** `staff_audit.actor_auth_user_id` preserves the verified actor UUID without a foreign key to `auth.users`, so later employee account deletion cannot erase or block retained audit rows. Account disabling remains the immediate access-revocation mechanism.

## D-043 — Development checkpoint workflow (2026-11-18)

**Owner-approved workflow:** Build → Quick Test → Fix Critical Issues → Commit → Push → Next Feature. Each feature runs build, typecheck, lint and application tests, and confirmed critical security/correctness defects are fixed before a development checkpoint on `main`. Sensitive features receive essential authorization checks before real data. Full scanloop/greploop quality gates remain required for major milestones and predeployment, but perfect 5/5 review scores are not required for ordinary checkpoints. Deferred tests and findings remain documented and cannot be claimed as passed. A01 may be saved as a checkpoint with its migration unapplied; hosted migration, real staff identities and full phase acceptance still require separate approval and verification. No A02 work is authorized by this decision.

**2026-11-18 tooling note:** Root `npm run dev` starts the existing frontend and backend dev commands together; both individual commands remain available. The official Ponytail Codex plugin is installed in the user profile with Full mode as its default. Neither change alters A01 acceptance or authorizes its migration.

**2026-11-18 A01 deployment hold:** The owner approved applying only `20261118000100_staff_identities.sql` to ref `pgbierfxeviouyjsmjnh` if it is the sole pending migration. CLI target output labels that ref `production`, whereas the documented A01 target is hosted development; migration history also failed with 403. No migration was applied. This records an unresolved target/access discrepancy, not a new platform decision.

**2026-11-18 A01 post-application note:** Owner subsequently reported successful A01 application. Read-only database verification confirms both expected migration versions and staff schema isolation. This supersedes the earlier application hold as an operational status, without deciding the project's environment classification. Account activation and hosted Auth/rate-limit acceptance are still pending.

A01 verification note (2026-11-18): Existing per-process Express throttling is not a shared deployment rate limit. No new architecture decision was made; hosted rate-limit configuration remains pending.

## A02 implementation note - 2026-11-18

Guest verification uses Supabase Auth email OTP and Express confirms the resulting managed identity and confirmed email. A verified Auth user need not have an app guest profile. Reservation access remains unavailable until an ownership-aware API exists; a public reference alone will never grant access. No new business decision or migration was made.


## A03 verification note - 2026-11-18

A03 adds authorization regression tests for current identity routes. Existing RLS design remains unchanged. Isolated database and hosted checks remain pending; no new platform decision or migration was made.


## C01 implementation note - 2026-11-18

Package price changes create a new active version in one transaction and retain old versions. Existing F02 schema and approved prices are reused. No new owner decision or migration was made.


## C01 price snapshot implementation rule - 2026-11-18

Catalog price revisions retain prior package versions. Future reservation items must store their accepted price in centavos at booking time and never recompute an existing charge from the current catalog version. The reservation schema and its snapshot tests belong to the later booking phase; no migration was applied here.


## C02 schema reuse note - 2026-11-18

The existing F02 staytrack.rooms schema already separates physical readiness from future reservation state. C02 adds a protected read-only board; real identifiers are pending owner confirmation. No new migration or inventory seeding decision was made.


## C03 implementation note - 2026-11-18

Unknown owner settings remain null in the proposed operational settings migration. Express keeps the extra-bed quote at 10000 centavos for one Family bed per continuous stay and treats occupancy as advisory; reservation persistence and legal limits remain pending. No migration was applied or new owner policy approved.

## Phase 03 exit-gate review - 2026-11-18

No new business or platform decision. The formal Phase 03 gate remains open because 15 real room entities and booked-price snapshot evidence are absent, while the C03 settings migration has since been applied and staff settings persistence verified by the owner. The verified C01–C03 work is a development checkpoint, not approval to use live bookings.

## V01 implementation note - 2026-11-18

No new owner decision. Feasibility uses UTC epoch milliseconds and half-open occupancy-plus-buffer ranges internally. Roomless category claims are provisionally assigned together for evaluation, without showing room numbers to guests. This is a read-only calculation; database locking and durable claims remain V02. The C03 migration was already applied per owner verification; no V01 migration was applied.

## V02 implementation note - 2026-11-18

No new owner policy. Pending migration `20261118000300_inventory_claims.sql` stores an internal provisional room for every active claim so PostgreSQL can exclude overlapping room ranges. Express will remain the authorization boundary when booking routes are added; current claim operations have no HTTP route. Category locks and same-transaction V01 revalidation protect capacity across concurrent backend calls, while request keys make retries idempotent. The migration is unapplied pending owner approval; V03 proof deadlines and protected-review lifecycle are not included.

## V03 implementation note - 2026-11-18

The owner reports V02 migration `20261118000300_inventory_claims.sql` applied to project `pgbierfxeviouyjsmjnh`, with four local/remote migrations matching; this supersedes the V02 unapplied status above. No new business policy is approved. The V03 candidate migration `20261118000400_claim_hold_lifecycle.sql` remains unapplied pending owner review. Late proof goes to manual reconciliation, never automatic confirmation. Proof-state transitions are internal until Phase 05 adds private Storage, reference validation, staff authorization and actor audit. Maintenance blocks remain in V01/V02 feasibility reads; a future maintenance write workflow must coordinate with claims and staff audit before real use.

## Phase 04 exit-gate status - 2026-11-18

The owner confirms V03 migration `20261118000400_claim_hold_lifecycle.sql` applied to `pgbierfxeviouyjsmjnh`, with all five local/remote versions matching; this supersedes the V03 unapplied status above. No new business decision or authorization to start Phase 05 is made. Phase 04 formal exit remains failed for live integration, real room inventory, expiry scheduling and major-milestone quality-gate evidence. The database password environment variable was cleared per owner report; no secret value is recorded here.


## O01 implementation boundary — 2026-11-18

**CI evidence follow-up:** [Run 44339371390](https://github.com/JAVcode-1/dannys-micro-hotel/actions/runs/44339371390) passed on `6c479a8`, explicitly reporting O01 PostgreSQL success and six database tests with no failures/skips, plus 64 application tests and all build/static checks. Existing stored GitHub identity selection restored read-only CI access; no new credential or configuration change. The unavailable-CI blocker is superseded. No migration application, live activation, new hotel policy or formal phase completion is authorized by this evidence.

**CI reporting clarification (2026-11-18):** No policy change. The earlier five-test database summary concealed O01 inside the V02 test body; O01 was not excluded by the integration glob. A separately named awaited subtest and explicit TAP reporting now expose its result. The assertions and isolated database safeguards remain; exact schedule and one-time Family bed line checks were added. CI success must be observed separately before migration readiness changes.

**Readiness review follow-up (2026-11-18):** No new policy. Remote SQL confirms the five prior migrations; a password-based Supabase dry run succeeds and lists only O01 pending after one login-role 403. This does not establish SQL application correctness. O01 coverage exists in CI, but its actual private Actions result is inaccessible, so readiness remains **NOT SAFE TO APPLY pending CI evidence**. Eleven focused tests passed; no code/migration change or schema application occurred. Details: [[phases/05-online-booking-and-gcash]].

No new hotel policy. Owner authorizes the Phase 05 O01 development checkpoint while Phase 03/04 exit gates remain incomplete. Guests explicitly choose consecutive allowed package blocks; no optimization/tie-break discount is invented (P-003 remains open). One Family bed costs 10000 centavos once per continuous item stay; stock/extension acceptance remains pending. Server quote, existing V01/V02 claims, V03 deadline creation and per-item price snapshots share one transaction internally. O01 snapshots remain immutable and replay does not reprice from the catalog. Existing claims gain no new lifecycle transitions.

The new candidate migration `20261118000500_guest_multi_room_booking.sql` is unapplied and seeds no inventory. Guest lookup requires server-verified Auth UUID plus matching verified email, covering the existing no-account OTP path; hosted OTP/T24 acceptance is deferred. HTTP booking creation is unconditionally disabled pending real inventory, channel/maintenance/expiry integration, Auth readiness and O02/O03 private-proof/manual-GCash verification. Preview quotes are price calculations, not availability or booking promises. Details/evidence: [[phases/05-online-booking-and-gcash]]. No Phase 03/04 completion or O02 authorization follows from this checkpoint.
