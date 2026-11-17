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
