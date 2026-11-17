---
tags: [supabase, setup, phase-00, security, architecture]
status: hosted-development-catalog-configured
version: 1.3
updated: 2026-11-17
---
# 22 — Supabase Setup and Integration Plan

> [!important] Status
> **Supabase platform is selected by the project requester** as of 2026-11-12. The hosted development project and approved F02 catalog migration were verified on 2026-11-17. Auth, Storage, a deployed application, fresh isolated migration/reset testing and seed execution are **not** evidenced here. Implement them in their documented phases; do not mark tasks done without observed evidence.

## A. What Supabase does in our architecture

| Supabase product | Hotel use | Decision level |
|---|---|---|
| **PostgreSQL** | Durable source of truth for 15 physical rooms, packages, inventory claims, reservations, payments, reviews and audits | **Confirmed Supabase database platform** |
| **Supabase Auth** | Individual staff accounts, registered guests and email OTP flows for guests without app accounts | **Recommended integration; configure in Phase 02** |
| **Supabase Storage** | Private GCash proof screenshots; optionally a public bucket for hotel room photos and published hotel QR | **Recommended integration; configure in Phase 05 / 03** |
| Supabase Realtime | Optional non-authoritative dashboard updates | **Deferred**; not required for Phase 01 or booking correctness |
| Supabase Edge Functions | Optional supporting jobs | **Deferred**; the separate Express backend is retained |

## B. Pre-coding checklist: first setup

- [ ] Obtain access to a Supabase organization. **Do not share a password, token, secret key, or database URL in chat.**
- [ ] For F02, use the owner-approved existing `dannys-micro-hotel` development project (`pgbierfxeviouyjsmjnh`); record its region, responsible owner and hosting budget **without recording credentials**. Do not create another project for F02.
- [ ] Open **Project Dashboard → Connect**; choose a DB connection method supported by the planned Express host. For a persistent IPv6-capable backend, direct is appropriate; otherwise use **session pooler** on IPv4-only hosts.
- [ ] Identify **Project URL** and **publishable API key** for the React Auth client (safe for public clients only with RLS). Store `SUPABASE_SECRET_KEY` and `DATABASE_URL` in backend secrets only.
- [ ] Use the approved hosted development workflow for F02 (D-040). Local DB installation is **not mandatory** for this task.
- [ ] Agree on the migration workflow: SQL files under `supabase/migrations/`; no unmanaged manual production schema changes.

**Exit evidence:** Screenshot or private note that the development project exists, CLI/config strategy chosen, and safe connectivity demonstrated **without exposing keys**.

## C. Recommended environment placeholders

```dotenv
# frontend/.env.example — these are placeholders, not real secrets
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_example_only

# backend/.env.example — never expose these to the browser
PORT=3001
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_example_only
SUPABASE_SECRET_KEY=SERVER_ONLY_SET_IN_SECRET_MANAGER
DATABASE_URL=SERVER_ONLY_POSTGRES_CONNECTION_STRING
```

- Commit **only** `.env.example`. Real `.env*` files must be ignored by Git.
- Secret keys **bypass Row Level Security**; server authorization is mandatory for each protected operation.
- Do not print sensitive headers, OTP tokens, raw guest identities or payment proof URLs in logs.

## D. Phase 01: migration strategy

- [ ] Create `supabase/` CLI config with `supabase init` **during coding F02**, not in this docs package.
- [ ] Create first SQL migration in `supabase/migrations`; store only fictitious seed room codes until actual room identifiers are confirmed.
- [ ] Run migrations against the **local/dev target only**; verify generated TypeScript types. Under D-040, the fresh isolated reset and seed test is explicitly deferred, not passed.
- [ ] Preserve migration history and prohibit direct production schema experiments.
- [ ] Use a dedicated PostgreSQL integration test target to test simultaneous holds and cross-channel booking constraints.

**Note:** Current Supabase CLI docs describe target selection with `--remote` for hosted projects. Check your installed CLI version and confirm target before applying migrations; never execute destructive resets on production.

**F02 hosted development workflow (D-040):** Use the already linked `dannys-micro-hotel` development project (`pgbierfxeviouyjsmjnh`). The approved `20261117000100_foundation_catalog.sql` was previewed as the only pending migration and applied once. Check migration history with the workspace CLI using `node_modules/.bin/supabase migration list --remote`; run `node --env-file=backend/.env scripts/verify-f02-db.mjs` and `node --env-file=backend/.env scripts/verify-f02-http.mjs` for read-only catalog and API verification. The quality gate's `-F02Hosted` option also runs `db push --remote --dry-run` to confirm no migration is pending. Never run `db reset`, `seed.sql`, or a non-dry-run `db push` for routine F02 verification. Recovery from a failed hosted migration requires an owner-reviewed forward migration or backup restore plan, not an ad hoc reset. Fresh-install/reset and fictitious seed tests remain deferred with the risk recorded in [[phases/01-foundation-and-tooling]].

**Generated type verification:** Run `npm run verify:f02:types`. It uses the installed Supabase CLI 3.2.0 to read `public` and `staytrack` from the approved linked project, formats the generated TypeScript with Prettier, and compares it with `packages/shared/src/database.types.ts`. It exits nonzero on schema/type drift and is part of the `-F02Hosted` quality gate. The check reads the hosted database; it does not change its schema or seed data.

## E. Phase 02: authentication

- [ ] Use Supabase Auth managed credentials/sessions for individual staff (invite/approval only; never let public signup acquire Staff/Admin permission).
- [ ] Add a `staff_accounts` table with `auth_user_id` reference and `active` state; every privileged action verifies both the Auth identity **and** active staff membership.
- [ ] Plan email OTP for guests who don't maintain a hotel account; use Supabase Auth templates with a six-digit token and confirm actual OTP expiration/rate limits in dashboard. A managed Auth user ID can exist without a full **registered guest profile**.
- [ ] Bind guest reservation access to verified email identity plus reservation ownership; public reference alone is insufficient.
- [ ] Test stolen/replayed/expired OTP, revoked staff and horizontal access to another guest's reservation.

## F. Phase 03/05: Storage and GCash proofs

- [ ] Create `payment-proofs` as a **private** bucket, with MIME/size restrictions and retention policy.
- [ ] Restrict guest upload to the appropriate reservation/payment review using signed policy or API-brokered upload; never permit guest listing of another guest's files.
- [ ] Show payment-proof images to verified Staff/Admin using short-lived signed URLs issued only after authorization.
- [ ] Keep hotel public room photos/GCash static QR separate from payment proofs; a `hotel-media` public-read bucket is optional, with writes restricted to staff.
- [ ] Staff confirms payment only after checking the real GCash ledger and matching amount/reference; proof upload alone never confirms a booking.

## G. Database and business logic boundaries

- **All** guest and staff business reads/writes route through Express for consistent authorization and price/capacity rules.
- For availability, reserve inventory in **one Postgres transaction** using lock ordering, hold lifecycle, potential physical allocation and overlap constraints. Never `SELECT` over HTTP then `INSERT` later as an apparently atomic decision.
- Use App-specific roles, RLS policies for every exposed surface, structured audit records, idempotency keys, and safe retry behavior. Elevated database access is backend-only.
- Keep immutable financial records and centavos; snapshots preserve booked rates even if staff later change catalog pricing.

## H. Deployment and costs to verify

- Separate dev/staging/production **projects**, not just a single project with a flag.
- Supabase hosts the database and managed services, **not our standalone Node/Express server or Vite website by default**. Pick independent hosting in Phase 09.
- Verify the current plan's database size, storage and bandwidth quotas, Auth email rate limits/custom SMTP, backups/restore options and available connection networking. Do not assume production backup/point-in-time recovery on free plans.

## I. Acceptance checklist before calling Supabase connected

- [ ] Supabase project and environment recorded by developer (without credential disclosure).
- [ ] Dev migration successfully applied and safely repeatable.
- [ ] API health check can reach dev database with no secret returned to frontend.
- [ ] Auth demo confirms valid identity; invalid or revoked staff cannot use staff routes.
- [ ] Private proof storage blocks anonymous/direct public access.
- [ ] Concurrent capacity test succeeds with actual PostgreSQL transactions.

## Official references

- [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase local workflow and migrations](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase Auth email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase Storage access controls](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase keys and privileges](https://supabase.com/docs/guides/getting-started/api-keys)

See [[05-tech-stack]] · [[06-architecture]] · [[07-database-schema]] · [[21-before-coding-checklist]] · [[phases/01-foundation-and-tooling]].
