---
tags: [phase-01, implementation, supabase]
status: in-progress
---
# Phase 01 — Foundation & Tooling (React, Express, Supabase)

**Goal:** Reproducible separate React and Express workspace with planned Supabase-managed PostgreSQL. **Do not build guest payment or reservations during this phase.**

**Dependencies:** [[02-requirements]], [[05-tech-stack]], [[22-supabase-setup]], [[00-phase-gates]], [[21-before-coding-checklist]], and approved [[09-ui-ux-design-system]].

## F01 — Workspace and developer tooling

- [x] Create `frontend`, `backend`, `packages/shared`; TypeScript strict mode and shared type contracts.
- [x] Configure React + Tailwind shell with approved **Danny's Royal Horizon** theme tokens; Express TypeScript API with `/health` endpoint.
- [x] Add `.env.example` placeholders for Supabase URL / publishable key in web, server-only `SUPABASE_SECRET_KEY` / `DATABASE_URL` in API, lint/format and `.gitignore`.
- [x] Create root workspace commands; choose one package manager and record version. Do **not** put live credentials or real guests into repo.

**F01 evidence (2026-11-17):** npm 10.9.8 workspaces; Node.js 22 or newer. The owner confirmed the executable quality gate passed. Its retained validation log records passing build, typecheck, lint, format check, two backend tests, two frontend tests and the greploop source-filter regression. Current independent review reports score correctness 5/5, security 5/5 and quality 4/5, with no blocking or major findings. Gitleaks and OSV reported no findings; the local Semgrep starter rules scanned 10 JavaScript/TypeScript files with no findings. The frontend tests render the page and serve the production page/CSS through Vite preview. No database migration or Supabase connectivity was attempted.

**Acceptance:** Both web and API start, `/health` works, the frontend renders approved tokens, all TypeScript checks pass. Supabase service need not be provisioned to finish F01.

## F02 — Supabase project, SQL migrations and DB connectivity

- [ ] Create/obtain **development-only** Supabase project and decide local CLI/Docker or isolated hosted-dev workflow, as documented in [[22-supabase-setup]].
- [ ] Initialize `supabase/` using Supabase CLI; create the approved **versioned SQL catalog migration**. Keep fictitious seed data local-only and unexecuted on the hosted project.
- [ ] Verify Express PostgreSQL DB connection using **direct or session pooler** as appropriate for host network; do not guess connection URI.
- [ ] Add readiness checks, connection timeouts, safe pooling, migration target verification and generated TS database types.
- [ ] Document the hosted development migration workflow, target checks, and recovery approach without resetting the hosted project.

**F02 acceptance (D-040, owner-approved 2026-11-17):** The existing hosted **development** project is confirmed by name and reference; the CLI preview lists only the approved catalog migration and no seed; migration history records that version; read-only hosted checks verify the three tables, constraints, zero physical rooms and seven approved rates; generated types, TLS-verified Express connectivity, `/health` and `/ready` HTTP 200, application tests, scans and independent reviews pass. Do not reapply or reset the hosted migration.

**Deferred, not passed:** Applying the migration to a second fresh isolated database, testing a reset, and executing/checking fictitious seed rows. These tests would catch portability, fresh-install and seed errors that the hosted catalog check cannot. Complete them before relying on a reproducible rebuild or introducing physical inventory; do not use the hosted project as the test database. F02 implementation may be complete with this explicit test debt, while F03 and the Phase 01 exit gate remain open.

## F03 — Testing and baseline CI

- [ ] Add UI/component tests, API unit/integration tests and Postgres-backed tests against an isolated test target.
- [ ] Configure CI typecheck, lint, build and test commands (no production keys).
- [ ] Add a sample unauthorized API test and a sample failing constraint test to prove CI catches regressions.

**Acceptance:** Automated baseline test suite and builds pass from a clean checkout; reviewer can repeat tests.

**F03 checkpoint (2026-11-18):** The React foundation component has a semantic render test; existing database configuration and readiness unit/API tests remain in place. GitHub Actions runs npm build, typecheck, lint, format and application tests with blank hosted credentials, then runs a PostgreSQL constraint test against its own loopback `staytrack_test` service. The DB test refuses any other host or database name and rolls back its migration and invalid insert. It creates Supabase's `anon` and `authenticated` roles inside that rollback transaction so the catalog SQL can run on plain PostgreSQL. No isolated PostgreSQL instance was available for a local execution, and the GitHub Actions run has not yet been observed. There is no protected API route in Phase 01, so unauthorized access enforcement remains a Phase 02 test. Keep F03 unchecked until CI and isolated DB evidence exist. The local security gate found one OSV advisory in the existing `picomatch` lockfile dependency, so it did not pass.
**Review status:** Two independent three-session review passes ran. The first found the missing PostgreSQL roles in the CI test and a misleading 404 authorization test; both were corrected. The second reported correctness 4/5, security 3/5 and quality 3/5. Its remaining blockers are the existing OSV advisory and the unexecuted isolated database/CI test. The review gate did not pass.

**F03 verification update (2026-11-18):** The commit `55a3a4b` was pushed to `main`, but no authenticated GitHub Actions run result or isolated PostgreSQL test log is available in this workspace; neither is claimed passed. `npm ls picomatch --all` traces `picomatch 4.0.7` to frontend Vite, `fdir` and `tinyglobby`; `npm ls --omit=dev picomatch --all` is empty. OSV classifies it as a dev dependency. [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) concerns attacker-controlled glob patterns and lists no verified patched version; npm still lists 4.0.7 as latest. This narrows current application runtime exposure but does not resolve the genuine development-tooling risk or pass the security gate. No override or suppression was added.

## Exit gate

- [ ] F01, F02 and F03 acceptance evidence recorded in [[14-milestones]].
- [ ] No live GCash, hotel guest PII or booking functionality in Phase 01.
- [ ] Environment/key separation validated and an initial Supabase ADR recorded.

**Next:** [[02-auth-and-authorization]].
