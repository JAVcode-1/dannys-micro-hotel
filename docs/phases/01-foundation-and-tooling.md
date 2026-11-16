---
tags: [phase-01, implementation, supabase]
status: not-started
---
# Phase 01 — Foundation & Tooling (React, Express, Supabase)

**Goal:** Reproducible separate React and Express workspace with planned Supabase-managed PostgreSQL. **Do not build guest payment or reservations during this phase.**

**Dependencies:** [[02-requirements]], [[05-tech-stack]], [[22-supabase-setup]], [[00-phase-gates]], [[21-before-coding-checklist]], and approved [[09-ui-ux-design-system]].

## F01 — Workspace and developer tooling

- [ ] Create `frontend`, `backend`, `packages/shared`; TypeScript strict mode and shared type contracts.
- [ ] Configure React + Tailwind shell with approved **Danny's Royal Horizon** theme tokens; Express TypeScript API with `/health` endpoint.
- [ ] Add `.env.example` placeholders for Supabase URL / publishable key in web, server-only `SUPABASE_SECRET_KEY` / `DATABASE_URL` in API, lint/format and `.gitignore`.
- [ ] Create root workspace commands; choose one package manager and record version. Do **not** put live credentials or real guests into repo.

**Acceptance:** Both web and API start, `/health` works, the frontend renders approved tokens, all TypeScript checks pass. Supabase service need not be provisioned to finish F01.

## F02 — Supabase project, SQL migrations and DB connectivity

- [ ] Create/obtain **development-only** Supabase project and decide local CLI/Docker or isolated hosted-dev workflow, as documented in [[22-supabase-setup]].
- [ ] Initialize `supabase/` using Supabase CLI; create **versioned SQL migrations** and fictitious seed data.
- [ ] Verify Express PostgreSQL DB connection using **direct or session pooler** as appropriate for host network; do not guess connection URI.
- [ ] Add readiness checks, connection timeouts, safe pooling, migration target verification and generated TS database types.
- [ ] Document one clear migration workflow and how to safely reset an isolated *development-only* DB.

**Acceptance:** A fresh dev DB applies migrations reproducibly, Express connects safely without leaking database credentials, schema types generate, and no production project is touched.

## F03 — Testing and baseline CI

- [ ] Add UI/component tests, API unit/integration tests and Postgres-backed tests against an isolated test target.
- [ ] Configure CI typecheck, lint, build and test commands (no production keys).
- [ ] Add a sample unauthorized API test and a sample failing constraint test to prove CI catches regressions.

**Acceptance:** Automated baseline test suite and builds pass from a clean checkout; reviewer can repeat tests.

## Exit gate

- [ ] F01, F02 and F03 acceptance evidence recorded in [[14-milestones]].
- [ ] No live GCash, hotel guest PII or booking functionality in Phase 01.
- [ ] Environment/key separation validated and an initial Supabase ADR recorded.

**Next:** [[02-auth-and-authorization]].
