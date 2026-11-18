---
tags: [phase-02, implementation, supabase, auth]
status: in-progress
---
# Phase 02 — Supabase Authentication & Application Authorization

**Goal:** Identity and permissions implemented without building custom password/token storage.

**Dependencies:** [[01-foundation-and-tooling]], [[03-user-roles-and-permissions]], [[08-security-and-risks]], [[22-supabase-setup]].

## A01 — Individual Staff/Admin identities

**Final acceptance follow-up (2026-11-18):** Build, typecheck, lint, and 34 application tests passed (21 backend, 13 frontend). Local tests cover guest and disabled-token denial, but a real authenticated non-staff request to hosted `/staff/me` remains unverified. The owner approved a temporary membership disable/restore for the employee ending `f9918f`; no live employee session is available to observe the response, so no membership change was made. Hosted Auth dashboard settings could not be inspected here. Signup controls, recovery redirects, email delivery, provider limits, and shared ingress throttling remain unverified. Express currently limits requests in memory per process, which does not provide a shared deployment limit. A01 acceptance remains open.

**Two-account activation (2026-11-18):** Owner approved Auth UUIDs `955ab3cb-0b07-44ed-a5e1-f373d7c75702` and `d3eb81cb-7fb1-44b8-b7ca-307849f9918f`. Read-only checks showed both were invited and email-confirmed with no prior staff membership. Exactly two `staff_accounts` rows were inserted with the default inactive state, then activated in one transaction; no Auth users were created. Both rows were read back active. `/staff/me` returned 401 without a token and 403 for an invalid token when the existing frontend publishable key was supplied in memory. The backend `.env` currently lacks `SUPABASE_PUBLISHABLE_KEY`, so normal backend Auth verification needs that browser-safe key configured locally. Live separate logins, audit actor persistence, guest-session denial, and immediate denial after deactivation are still pending employee sign-ins; do not mark A01 accepted yet. No employee password or token was requested, printed, or stored.

**Live login follow-up (2026-11-18):** The existing browser-safe publishable key was copied into ignored `backend/.env` without printing it, and the local backend watcher reloaded. An invalid token then returned 403. Both approved employee sessions reached `/staff/me`, producing distinct hosted `staff.session_verified` audit actor IDs. The account ending `f9918f` was briefly deactivated and restored; readback confirms both approved memberships active. The user's message did not establish whether the refreshed inactive session was denied, so immediate revocation remains unverified. A real guest session has also not been tested. No passwords or tokens were captured.

**Hosted revocation gate check (2026-11-18):** With the account ending `f9918f` inactive, a controlled Auth identity for that exact UUID was sent through the real Express `/staff/me` route and hosted membership query. It returned 403 and wrote no audit row. A `finally` block restored the membership; both approved rows remain active. This verifies the database membership gate, while a real-session revocation and real guest-session test remain pending.

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

**A02 development checkpoint (2026-11-18):** Guest `/verify` (also `/login` and `/register`) accepts email and six-digit Supabase Auth OTP, then requires successful Express `/guest/me` verification before showing success. Express checks the managed token and confirmed email. Guest and staff identity endpoints share a local per-process request limit. No reservation table or lookup endpoint exists, so ownership/cross-guest acceptance remains open. Hosted OTP template, actual expiry, provider/shared throttling, and live wrong/replay/brute-force checks are unverified. No migration was added or applied. A01/F02/F03 debt remains open.


**A03 checkpoint (2026-11-18):** Added endpoint tests for expired guest sessions, Auth provider failure, and immediate staff membership revocation. Existing isolated PostgreSQL staff RLS test remains unrun locally without TEST_DATABASE_URL; hosted RLS and real expired-token checks remain pending. No migration, Storage bucket, or new UI was added. A01/A02/F02/F03 acceptance debt remains open.
