---
tags: [phase-02, implementation, supabase, auth]
status: in-progress
---
# Phase 02 — Supabase Authentication & Application Authorization

**Goal:** Identity and permissions implemented without building custom password/token storage.

**Dependencies:** [[01-foundation-and-tooling]], [[03-user-roles-and-permissions]], [[08-security-and-risks]], [[22-supabase-setup]].

## A01 — Individual Staff/Admin identities

**Invitation callback fix (2026-11-18):** The frontend now routes an invite callback sent to `/` or `/staff` into staff onboarding, waits for Supabase to restore the session, clears the callback URL, and lets the invited user set a password. Staff identity is still shown only after Express confirms active membership. Dashboard invitation redirect should be the exact `/staff` URL; live email delivery and an invited-user acceptance test remain pending. No staff account was created by this fix.

**Hosted schema verification (2026-11-18):** Owner reports the A01 migration applied. `scripts/verify-a01-hosted.mjs` confirmed exactly the F02 and A01 migration versions, both staff tables, enabled RLS with no client policies, no `anon`/`authenticated` table or audit-sequence privileges, denied direct client-role reads, the Auth-user foreign key, primary keys, and `active=false` by default. The backend connected and `/health` and `/ready` returned HTTP 200. No staff or audit rows exist yet; therefore live audit persistence, two-employee distinction, and actual inactive-account endpoint denial remain pending. Unit tests cover guest denial, inactive membership, separate actors, and fail-closed audit behavior.

**Staff activation procedure (pending owner approval):** In the linked Supabase project's Auth dashboard, first verify the site/recovery redirect allowlist, email sender and delivery, password policy, invitation behavior, signup controls, and provider rate limits. Local `supabase/config.toml` has `enable_signup=true` and localhost redirects; it is not evidence of hosted Auth settings. Put shared ingress/provider throttling in front of `/staff/me` before live use. Invite two named employees separately through the dashboard; do not put credentials in SQL, chat, logs, or repository files. After each employee accepts the invitation, map the exact Auth user UUID to a distinct `staytrack.staff_accounts` row, initially inactive. Activate each row only after owner identity approval. With their own sessions, verify `/staff/me` returns 200 and produces distinct audit actor UUIDs; use a guest session to verify 403, then deactivate one staff row and verify that session immediately receives 403. Keep accounts inactive if any check fails. Do not create accounts as part of this checkpoint.

**Development checkpoint (2026-11-18):** Code and an unapplied migration are prepared. The `/staff` UI uses Supabase Auth password sessions, sign-out and recovery; Express `/staff/me` checks the managed token and active database membership on every call, then writes an actor audit row. The only staff API currently present is `/staff/me`. No hosted Auth settings or database data were modified. Invitation and account activation require owner-reviewed Supabase dashboard setup after migration approval. Hosted two-employee, disabled-account, email sender, recovery, and rate-limit acceptance are pending. Do not mark A01 Done or the phase exit gate passed.

**D-043 checkpoint validation:** Build, typecheck, lint and 32 application tests passed. Unit tests cover unauthorized access, inactive membership, actor audit and failure handling. The isolated SQL integration test could not run without `TEST_DATABASE_URL`; the migration remains unapplied. The full quality gate is deferred to milestone/predeployment verification, and the known OSV finding and hosted acceptance gaps remain open.

**Before hosted A01 deployment:** Apply the pending migration only after owner approval and test it on an isolated PostgreSQL target first. Verify `anon`/`authenticated` cannot read or write staff tables or audit rows, and confirm the Express database role has only the required access. Configure invite-only staff creation, recovery URL allowlist, email delivery and Auth throttling. Put a shared ingress/provider rate limit in front of `/staff/me` (the current in-memory limit is per process), then test real tokens for two distinct employees, a guest, a disabled employee, and audit persistence/failure. Keep staff accounts inactive until these checks pass.

**A01 migration review (2026-11-18):** The existing CI PostgreSQL test now checks default inactive membership, both client roles' schema/table/sequence privileges, enabled RLS, RLS behavior after temporary grants, disabled membership, and audit retention. Commit `749ca2b` was pushed to trigger the isolated CI service, but its run result was not accessible in this session. Local build, typecheck, lint, format and 32 application tests passed; the isolated SQL test remains **unverified**, and the migration is **not yet ready for approval**. No hosted migration or staff account was changed.

- [ ] Configure **Supabase Auth** login, logout, session handling, staff invitation/account recovery and strong rate limits.
- [ ] Create `staff_accounts` linked to `auth.users.id`; one common Staff/Admin capability tier, but **unique login for each employee**.
- [ ] Express validates Supabase Auth token identity, verifies active staff membership on each privileged request, and writes actor ID to audit.
- [ ] Never let public signup, a frontend field or self-edited metadata grant staff privileges.

**Acceptance:** Two different staff members create distinct audited actions; guests cannot access staff API; disabled staff denied immediately.

## A02 — Guest identities and email OTP

- [ ] Registered guests may use Supabase Auth; guest/no-account booking must have a **verified email OTP** before sensitive reservation lookup/access.
- [ ] Configure Supabase Auth email OTP template and verify actual token expiry and throttling; managed Auth identity may exist without requiring app-profile registration.
- [ ] Reservation identity is tied to verified email/ownership, not just a public booking reference.
- [ ] Mask contact details, suppress account-enumeration behavior and avoid leaking OTPs in logs.

**Acceptance:** Wrong, expired, replayed or brute-forced OTP cannot expose booking data; cross-guest access denied.

## A03 — Authorization and RLS integration tests

- [ ] Verify Express policies on every staff and guest endpoint.
- [ ] Enable RLS and test permissions for any Supabase tables/storage available to a client; do not rely on RLS alone for server secret-key operations.
- [ ] Test session expiration, revoked staff and invalid tokens.

## Exit gate

- [ ] All identity/ownership tests pass; credentials never stored in the app database.
- [ ] Payment proof bucket remains private and disabled until securely configured in Phase 05.
- [ ] Record results in [[14-milestones]].

**Next:** [[03-catalog-inventory-settings]].
