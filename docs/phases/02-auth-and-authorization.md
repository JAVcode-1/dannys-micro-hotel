---
tags: [phase-02, implementation, supabase, auth]
status: not-started
---
# Phase 02 — Supabase Authentication & Application Authorization

**Goal:** Identity and permissions implemented without building custom password/token storage.

**Dependencies:** [[01-foundation-and-tooling]], [[03-user-roles-and-permissions]], [[08-security-and-risks]], [[22-supabase-setup]].

## A01 — Individual Staff/Admin identities

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
