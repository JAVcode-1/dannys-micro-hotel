---
tags: [milestone, progress]
status: in-progress
---
# 14 — Milestones & Work Tracker

**Snapshot date:** 2026-11-18. F01 is complete; Phase 01 remains in progress because F02 and F03 are open. A checked item requires implementation plus tests, not just a plan.

| Milestone | Status | Evidence |
|---|---|---|
| Requirements baseline documented | **Done (docs only)** | [[02-requirements]], [[17-decisions]] |
| UI color theme approved by project requester | **Done (design only)** | [[09-ui-ux-design-system]], [[design/brand-and-navigation-brief]] |
| Pre-coding workstation/repository checks | Not verified | [[21-before-coding-checklist]] |
| Technical architecture drafted | **Done (draft only)** | [[06-architecture]], [[07-database-schema]] |
| Phase 01 Foundation | In progress — F01 complete; F02 under verification; F03 checkpoint under verification | [[phases/01-foundation-and-tooling]]; F02 gate pending; F03 isolated DB and CI runs pending |
| Phase 02 Auth | In progress — A01 development checkpoint, not accepted | [[phases/02-auth-and-authorization]]; migration unapplied; hosted Auth and rate limits unverified |
| Phase 03 Catalog and rooms | Not started | [[phases/03-catalog-inventory-settings]] |
| Phase 04 Safe availability and holds | Not started | [[phases/04-availability-and-holds]] |
| Phase 05 Online booking and GCash | Not started | [[phases/05-online-booking-and-gcash]] |
| Phase 06 Walk-ins and countdown | Not started | [[phases/06-walkins-and-stay-monitoring]] |
| Phase 07 Changes/refunds/extensions | Not started | [[phases/07-changes-refunds-and-ledger]] |
| Phase 08 Operations/reports | Not started | [[phases/08-housekeeping-maintenance-and-reporting]] |
| Phase 09 Pilot/production | Not started | [[phases/09-hardening-pilot-and-release]] |

## Current focus

**Next step:** A01 is an authorized development checkpoint, not a completed phase task. The four checkpoint commands pass; the SQL migration and hosted Auth acceptance remain pending. F02/F03 verification debt and the OSV `picomatch` finding remain open under D-043. Do not begin A02 until instructed.

**A01 review follow-up (2026-11-18):** Isolated PostgreSQL security assertions were extended in `backend/test/staff-migration.integration.mjs` and pushed as `749ca2b`. Build, typecheck, lint, format and 32 application tests passed locally. GitHub Actions' `test:db` result has not been observed, so migration approval readiness remains pending. No A01 checkbox changed.

**A01 hosted attempt (2026-11-18):** Owner reports isolated GitHub Actions PostgreSQL results of 2 passed, 0 failed, 0 skipped. The linked CLI ref matches `pgbierfxeviouyjsmjnh`, but the CLI labels `dannys-micro-hotel` as `production` and `migration list --remote` returned a 403 before showing history. Therefore the sole-pending-migration condition could not be verified; no dry run, apply, seed, reset, or hosted permission check occurred. Local build, typecheck, lint, and application tests passed on rerun outside the process-restricted sandbox. A01 remains open; no new checkpoint was committed or pushed. Resolve project classification and CLI access before retrying the preview. Hosted Auth, recovery, and shared rate-limit checks remain pending.

**A01 post-application verification (2026-11-18):** Owner reports A01 migration applied; read-only DB verifier confirmed both migration versions, private staff tables, RLS, no client policies/grants, denied client-role reads, constraints, and default inactive membership. Backend `/health` and `/ready` returned 200. Hosted tables contain zero staff and audit rows. Build, typecheck, lint, and 32 application tests passed; Auth dashboard settings, live guest/inactive sessions, two staff audit rows, and shared rate limiting remain pending. A01 checkbox stays open.

**A01 invitation callback fix (2026-11-18):** Frontend handles invite callbacks at the homepage or `/staff`, presents password setup, removes callback tokens from the URL after session restoration, and keeps protected staff identity behind active membership verification. Targeted tests passed. Hosted invitation delivery and real-account acceptance remain pending; A01 stays open.

**A01 two-account activation (2026-11-18):** Owner-approved Auth UUIDs `955ab3cb-0b07-44ed-a5e1-f373d7c75702` and `d3eb81cb-7fb1-44b8-b7ca-307849f9918f` were verified as invited and email-confirmed, inserted into `staff_accounts` with inactive defaults, and activated. No other Auth users or hotel data changed. Readback shows both active; missing and invalid tokens yielded 401/403 with a valid publishable key supplied in memory. Build, typecheck, lint and application tests passed. Normal backend `.env` lacks the publishable key; real separate login/audit, guest-session denial and deactivation tests remain pending, so A01 stays open.

**A01 live login follow-up (2026-11-18):** The browser-safe key was added only to ignored local `backend/.env`; backend reload restored invalid-token 403. Hosted audit has distinct `staff.session_verified` events for both approved Auth UUIDs. The account ending `f9918f` was deactivated and restored; both memberships read back active. The inactive-session response was not clearly reported, and real guest-session denial remains untested. A01 stays open.

**A01 hosted revocation gate check (2026-11-18):** A controlled Auth identity for the inactive account ending `f9918f` received 403 through `/staff/me` against the hosted membership table, without a new audit row. The membership was restored active in `finally`. Real-token revocation and real guest-session denial remain pending; A01 stays open.

## Session log

**2026-11-18 setup checkpoint:** Root combined dev command starts Vite at `http://localhost:5173/` and Express at `http://localhost:3001/`; the frontend page and `/health` returned HTTP 200. Build, typecheck, lint and application tests passed (21 backend, 11 frontend). Ponytail Full was installed through the official Codex plugin commands. A01 migration remains unapplied; isolated SQL/RLS, hosted Auth, shared rate limiting and real employee acceptance remain pending. No checklist status changed.

| Date | Phase/task | Result | Tests/evidence | Next action |
|---|---|---|---|---|
| 2026-11-18 | Phase 02 / A01 development checkpoint | Individual staff sign-in UI, Express staff membership check, local rate limit and actor audit path, and unapplied migration prepared | `npm run build`, `typecheck`, `lint`, and `test` passed (21 backend, 11 frontend). Staff API tests cover missing/invalid tokens, inactive membership, distinct actors, audit failures and rate limiting. Gitleaks and four local Semgrep rules found none; OSV reports existing GHSA-fc5q-39xc-vjpf in development-only `picomatch` 4.0.7. Earlier independent review failed at 3/5 correctness, 3/5 security, 3/5 quality. Isolated migration test cannot run without `TEST_DATABASE_URL`; hosted invitation, recovery, revocation and two-person acceptance remain unverified. Full milestone gate not passed. | Keep migration unapplied; resolve deployment rate limits, isolated DB and OSV before real use; wait for next task instruction |
| 2026-11-11 | Documentation handoff | Created Obsidian/Graphify/ICM-compatible planning source | Baseline document tree | Design review |
| 2026-11-12 | UI approval and doc update | Approved Royal Horizon; updated design spec and pre-coding readiness checklist | Version 1.2 documentation package | Verify PC-01–PC-04, then Phase 01 / F01 |
| 2026-11-12 | Platform plan revision (docs only) | Owner selected Supabase-managed PostgreSQL; updated architecture, setup, security, phase guides; Royal Horizon unchanged | Version 1.3 docs; no Supabase project or runnable code claimed | Finish PC tasks, F01 first; Supabase dev setup during F02 |
| 2026-11-17 | Phase 01 / F01 | React/Vite/Tailwind shell, separate Express `/health`, shared TypeScript contract, npm workspaces, environment examples and quality tooling implemented | Owner confirmed quality gate passed. Retained log: build, typecheck, lint, format check, four application tests and source-filter regression passed; current independent reviews 5/5 correctness, 5/5 security, 4/5 quality with no blocking/major findings. Gitleaks/OSV no findings; Semgrep four local rules over 10 files, no findings. No commit or push made. | F02 remains not started |
| 2026-11-18 | Phase 01 / F02 checkpoint | Supabase catalog migration, Express connectivity/readiness, generated types and read-only verification scripts present; final quality gate remains pending | Local `npm run build`, `typecheck`, `lint`, `format:check`, and `test` passed (14 backend, 2 frontend). Prior hosted gate passed migration-history and dry-run checks but stopped at Supabase type generation exit 1, before scans/reviews. No migration or seed executed during this checkpoint. | Resolve type-generation failure and rerun full F02 gate; F03 remains unstarted |
| 2026-11-18 | Phase 01 / F03 checkpoint | Component and isolated-DB constraint tests added; GitHub Actions CI configured with loopback PostgreSQL and no hosted credentials | Local build, typecheck, lint, format check and 17 application tests passed (14 backend, 3 frontend). Isolated DB test and GitHub Actions execution not yet observed. Gitleaks and local Semgrep found none; OSV found GHSA-fc5q-39xc-vjpf in existing `picomatch` 4.0.7, so scan gate failed. Second independent review: 4/5 correctness, 3/5 security, 3/5 quality; gate failed. No protected API route exists yet for an unauthorized access test. | Verify CI and isolated DB test; triage OSV finding; finish F02 gate separately |
| 2026-11-18 | Phase 01 / F03 verification follow-up | Reviewed dependency provenance and published advisory; no application code or dependency override changed | `npm ls` traced `picomatch` to Vite/fdir/tinyglobby development tooling; `npm ls --omit=dev` was empty. GHSA-fc5q-39xc-vjpf remains unsuppressed; npm latest is 4.0.7. GitHub Actions and isolated DB result not available for verification. | Obtain authenticated CI evidence; address advisory when a compatible patched release exists; complete F02/F03 gates before A01 |

### Rule when updating

Change **Not started → In progress → Done** only after acceptance gates. Include a commit hash, test command/output, or demo reference. Do not mark future tasks as done just because files were scaffolded.

| 2026-11-12 | Project structure + original skill files assembled (docs only) | Preserved all 3 user-provided SKILL.md files byte-for-byte under `.agents/skills/`, linked mandatory workflow from root `AGENTS.md`, aligned source paths `frontend/`, `backend/`, `supabase/` | ZIP and integrity manifest validated; **no application code/scanners/reviewer panels were executed** | Merge baseline safely, verify Codex skill discovery, then begin F01 |

**A01 final acceptance follow-up (2026-11-18):** Build, typecheck, lint and 34 tests passed. Real non-staff denial, live-session revocation, hosted Auth settings and shared rate limiting remain unverified. Owner approved a controlled disable/restore, but no employee live session was available, so membership was not changed. A01 remains open.

**A02 checkpoint (2026-11-18):** Guest OTP UI and protected Express `/guest/me` identity gate implemented. Reservation ownership and hosted OTP checks remain pending because reservation storage is not built. A02 remains open; A01/F02/F03 debt is retained. No A03 work started.


**A03 checkpoint (2026-11-18):** Added endpoint tests for expired guest sessions, Auth provider failure, and immediate staff membership revocation. Existing isolated PostgreSQL staff RLS test remains unrun locally without TEST_DATABASE_URL; hosted RLS and real expired-token checks remain pending. No migration, Storage bucket, or new UI was added. A01/A02/F02/F03 acceptance debt remains open.


**C01 development checkpoint (2026-11-18):** Existing F02 migration already defines categories, versioned packages and seven approved rows. Added public active-package catalog, /rooms rate view, and a staff-only audited price revision with a staff editor. Server rejects Family 3-hour and invalid prices. Build, typecheck, lint and 39 application tests pass (25 backend, 14 frontend). Full staff settings CRUD, isolated price-version transaction test, hosted catalog verification and booked-price snapshot behavior remain pending; C01 and Phase 03 exit checkboxes stay open. No migration was added or applied. A01/A02/A03/F02/F03 acceptance debt remains open.


**C01 follow-up (2026-11-18):** Staff-only catalog history read, package activate/deactivate, and category name/active updates now use Express membership checks and transactional staff audit. Price revision transaction tests cover new version insertion and rollback on audit failure; route tests deny anonymous and non-staff users. A read-only check against the configured hosted development project verified all seven active approved rates. Build, typecheck, lint and 43 application tests passed (29 backend, 14 frontend). No migration or hosted write was performed. Booked-price snapshots still require reservation tables in Phase 05; isolated PostgreSQL write/rollback integration remains pending. Existing A01/A02/A03/F02/F03 debt stays open. C01 remains a verified development checkpoint, not a Phase 03 exit gate.


**C02 development checkpoint (2026-11-18):** The F02 migration already defines staytrack.rooms with category, unique code, active=false and a physical operational state; no new migration is necessary or applied. Added protected Express /staff/rooms and a responsive staff room board with labelled Ready/Occupied/Cleaning/Maintenance/Unverified states. There is no guest room-state API or guest write route. A test-only isolated PostgreSQL fixture inserts DS-TEST-01..10 and FE-TEST-01..05 inside a rolled-back transaction; it has not run without TEST_DATABASE_URL. Hosted room rows remain absent pending owner-confirmed real identifiers, so 15-live-room acceptance remains open. Phase 02 and C01 acceptance debt remains documented.


**C03 development checkpoint (2026-11-18):** Added server-side adults/children advisory evaluation and Family-only one-extra-bed ₱100 single-stay quote; no Double extra bed or per-person surcharge. The public /rooms guide labels legal/safety limits unverified and requires staff review above usual occupancy. Prepared unapplied 20261118000200_operational_settings.sql with nullable cleaning buffer, checkout alert, private GCash QR metadata and cancellation text; protected Express staff settings reads/writes audit the actor. Existing reservation tables do not exist, so per-room occupant persistence and extension-safe one-time extra-bed charge remain pending for the booking phase. QR storage and legal policy approval remain gated. Isolated SQL/RLS test is prepared but unrun without TEST_DATABASE_URL; no hosted migration or settings write occurred. Phase 02, C01 and C02 acceptance debt remains open.

**Phase 03 exit-gate review (2026-11-18): FAIL for formal completion.** CI [run #17](https://github.com/JAVcode-1/dannys-micro-hotel/actions/runs/44250093933) passed build, typecheck, lint, formatting, application tests and 4/4 isolated PostgreSQL tests; C01's hosted read previously confirmed seven approved active rates. Catalog changes and settings API are staff-gated and actor-audited, and the C02 test fixture verifies 10 Double plus 5 Family rooms without inventing live identifiers. Critical milestone blockers: no owner-confirmed 15-room live inventory and no reservation/booked-price snapshot test. The C03 settings migration was subsequently applied, and the 15-minute cleaning buffer and 30-minute checkout alert persisted in the staff screen (owner-reported verification). C01–C03 development checkpoints remain useful but do not satisfy Phase 03 exit checkboxes. Deferred: per-room occupant persistence, extension-safe extra-bed charging, QR Storage, policy values, earlier Phase 01/02 acceptance and full milestone gate. No migration, seed or hosted write was performed in this review. Next documented task: Phase 04 V01, not started.

**V01 development checkpoint (2026-11-18):** Internal time-range and joint-room feasibility logic added with focused tests; no booking endpoint, live reservation source, migration, or database claim write. Phase 03 remains formally open for real 15-room inventory and booked-price snapshots. V01 acceptance and Phase 04 exit remain open pending real PostgreSQL integration and V02 atomic claims. See [[phases/04-availability-and-holds]].

**V02 development checkpoint (2026-11-18):** Prepared private claim/request/block migration `20261118000300_inventory_claims.sql` (unapplied) and backend-only transaction operations for serialized capacity claims, idempotent retries, release and revalidation. A 30-contender isolated PostgreSQL integration test was added; no local PostgreSQL target was used. Build/typecheck/lint/application tests and CI evidence are recorded with the checkpoint result. No claim API or payment hold lifecycle is exposed. Phase 03 real inventory and price-snapshot debt, V01 live-flow integration, V02 database acceptance and Phase 04 exit remain open. V03 not started.

**V02 CI follow-up:** [Run #18](https://github.com/JAVcode-1/dannys-micro-hotel/actions/runs/44279578668) passed build, typecheck, lint, formatting, application tests and five isolated PostgreSQL tests, 0 failed. The 30-contender test granted exactly one claim in its disposable database. Hosted migration `20261118000300` remains pending owner approval and unapplied; no live booking route or full Phase 04 acceptance is claimed.

**V02 retry follow-up:** Bounded retries for serialization/deadlock failures were added to claim creation with a focused failing-then-passing regression test. This is a development check, not evidence that the hosted candidate migration was applied or that Phase 04 is complete.

**V02 final verification:** [GitHub Actions run #19](https://github.com/JAVcode-1/dannys-micro-hotel/actions/runs/44281199949) succeeded after the retry fix; local build/typecheck/lint/format/application checks passed. The migration is still unapplied and V01/V02 live-flow acceptance remains pending.
