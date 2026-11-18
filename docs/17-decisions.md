---
tags: [decisions, source-of-truth]
status: approved-baseline
---
# 17 — Approved Decisions Register

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
