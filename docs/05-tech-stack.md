---
tags: [technology, architecture, supabase]
status: stack-approved-with-implementation-proposals
updated: 2026-11-12
---
# 05 — Technology Stack

## Confirmed project choices

| Layer | Selected platform | Responsibility |
|---|---|---|
| Guest/staff web | React + TypeScript | Guest reservation portal and Staff/Admin dashboard |
| UI | Tailwind CSS | **Approved Royal Horizon** tokens, responsive components |
| Business API | **Node.js + Express + TypeScript** | Booking capacity, manual GCash verification, ledgers, staff approvals, audits, server-side timestamps |
| Relational datastore | **Supabase-managed PostgreSQL** | One authoritative hotel inventory, bookings, payments and holds |
| Hosting | Cloud-first v1 | Web and API deployed separately; Supabase hosts PostgreSQL |

**2026-11-12 change D-035:** Supabase is selected for this project; **it is not a replacement for Express or a switch to a frontend-only architecture**. PostgreSQL remains the actual database engine. See [[22-supabase-setup]] and [[06-architecture]].

## Proposed Supabase service usage (recommended implementation; finalize technical details during F01/F02)

- **Supabase Auth:** named Staff/Admin accounts, registered guests and email OTP guest verification. Staff roles/authorization decisions reside in hotel-controlled tables/API, **not** in untrusted client fields. Supabase Auth owns password/session/token lifecycle; we do **not** build our own `password_hash` store.
- **Supabase Storage:** private `payment-proofs` bucket for customer GCash screenshots, restricted by ownership/staff approval; only verified staff receive short-lived signed access. An optional public `hotel-media` bucket can serve sanitized/authorized room photos and the public GCash QR image; uploads are staff-controlled.
- **Supabase CLI + SQL migrations:** reviewable migrations checked into Git; generated TypeScript types. For transactional allocation logic use PostgreSQL transactions with a server-side SQL client (`pg`/node-postgres) or equivalent, plus database constraints and integration tests.
- **API-controlled business data:** React calls Express for room inventory, prices, bookings, holds, payments, staff workflows. React may use the Supabase Auth client for user sign-in and session acquisition; **do not place elevated database operations in React**.

## Supporting library choices (implementation proposals, not hotel-owner business decisions)

- React tooling: Vite; React Router; TanStack Query; Zod.
- Node backend: Express; Zod; `pg` (node-postgres) for explicit transactional booking operations; optional ORM needs an ADR and must not weaken locks/constraints.
- Tests: Vitest, React Testing Library, Playwright, PostgreSQL integration tests with parallel booking cases.
- Local database: Supabase CLI + Docker-compatible runtime **recommended** for full local stack; alternatively a separate **Supabase development project** for initial connectivity without installing local Postgres. Never test destructive migrations against production.
- Hosted web/API vendors: choose later in deployment phase. Supabase doesn't host the standalone Express service automatically.

## Suggested source layout after Phase 01

```text
Dannys-Micro-Hotel/
├── 00-START-HERE.md
├── AGENTS.md
├── docs/                       # Obsidian-ready source of truth
├── frontend/                    # React guest/staff UI
├── backend/                     # Express REST + authorization + transactions
├── packages/
│   └── shared/                 # Types, DTOs and Zod validation
├── supabase/
│   ├── config.toml             # Supabase CLI metadata (created by init)
│   ├── migrations/             # SQL schema versions
│   └── seed.sql                # Fake hotel test data, never real guest data
├── infra/                      # Hosting/CI configuration later
└── package.json
```

## Non-negotiable boundaries

1. **Express** owns every write that books capacity, verifies money, confirms/refunds reservations, or changes guest stays. The browser never establishes paid status from a screenshot.
2. All writes affecting room availability run in a **single PostgreSQL transaction** with appropriate per-category/room serialization, idempotency keys and conflict tests. A Supabase REST read followed by an unrelated write is not sufficient.
3. Supabase publishable key can be used from the browser **only with RLS rules**. **Secret key and database URL must never appear in frontend bundles or Git**; even on the API, enforce explicit authorization before an elevated operation.
4. Store prices in **integer centavos**, time instants in `timestamptz`, display in hotel-local 12-hour AM/PM.
5. Supabase Auth/Storage are recommended components; if changed, document an ADR **before Phase 02**. The approved main stack (React/Express/Supabase Postgres) stays stable.

Next [[06-architecture]] · [[07-database-schema]] · [[22-supabase-setup]].
