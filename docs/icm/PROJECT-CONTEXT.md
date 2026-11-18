---
tags: [icm, project-context]
status: docs-first-handoff
---
# Session Context — StayTrack / Danny's Micro Hotel

**Project status:** Phase 01 F01 complete; F02 quality gate pending; F03 testing and CI prepared as an unverified checkpoint. Later phases have not started. This is not a deployed application.

## Read first

- [[02-requirements]] approved functional rules
- [[17-decisions]] decisions/superseded choices
- [[18-backlog]] unresolved owner/legal/technical inputs
- [[13-development-roadmap]] phase ordering
- [[14-milestones]] what is *actually* done
- [[AGENTS]] agent instructions

## Stack

React + TypeScript + Tailwind frontend; separate Node.js + Express + TypeScript API; **Supabase-managed PostgreSQL (D-035)**, with proposed Supabase Auth (staff and guest email OTP) and private Supabase Storage (GCash proofs). Cloud-first v1, manual offline backup. **Supabase is not a substitute for Express or transactional business logic.** All UI times 12-hour AM/PM; timezone Asia/Manila.

## Hotel truth

Inventory 10 Double Standard and 5 Family Executive. Double packages: 3h ₱200, 6h ₱400, 12h ₱600, 24h ₱1,000. Family packages: 6h ₱600, 12h ₱900, 24h ₱1,200 — **NO FAMILY 3H**. Family extra bed optional ₱100 **once per continuous stay**; Double has no extra bed. No per-person surcharge. Standard occupancy counts are guidance, not absolute legal max.

## Most critical invariants

- Both booking channels share one transactional inventory; guest selects category, staff final physical assignment.
- One reservation contains multiple independent room item schedules, statuses, cancellation/extension choices; single primary guest/shared payment ledger.
- Online **100%** static QR GCash before confirmation; staff verifies actual transaction, uploaded screenshot+reference not sufficient. 30m proof deadline, on-time proof protects held capacity beyond deadline for staff review.
- Walk-ins cash/GCash/mixed, **50% deposit** before actual check-in; countdown begins at staff-confirmed room access.
- Online scheduled checkout remains unchanged for late arrival; 1h grace then flag for staff manual no-show review. Countdown reaching zero does not auto-checkout.
- Online free-cancel **one hour after staff payment confirmation**, ending on that room's check-in; room-item refund via staff manual GCash transfer. Reschedule staff-approved and does not restart free window.
- Extension requires 50% payment and starts from prior scheduled checkout, not current request time.
- Cleaning buffer + manual Ready, maintenance blocks physical rooms; ensure no double-booking on concurrent writes.
- Staff/Admin is one access tier with unique per-staff accounts and audit actor. Smoking fees and overtime waivers only after staff decision/reason.

## Approved design direction

Digital software theme **Danny's Royal Horizon**, approved by requester 2026-11-12: Royal Blue `#2443B6`, Sunset Orange `#F97316` (navy text on orange), Soft Lavender `#EEE9FA`, Warm White `#FAFAFD`, Midnight Navy `#17213D`, Sky Blue `#EAF1FF`. Guest site uses hotel photography and selective orange CTA; staff dashboard uses **minimalist white sidebar and room cards**, blue active navigation, and semantic status badges. See [[09-ui-ux-design-system]]. Never copy prices from AI-generated design mockups or historical signage.

## New optional Phase 08 enhancement — D-038 (2026-11-16)

Guests and anonymous visitors may **read** published verified ratings; only the verified primary guest of a stay with a recorded **check-in AND checkout** may submit one 1–5 public rating/review per reservation. Registered guests use account ownership; online guest-checkout users reuse verified booking email with expiring single-use link; walk-ins require verified contact. Private feedback remains staff-only. True negative (including 1-star) ratings cannot be suppressed just for criticizing the hotel; staff may hide/restore policy-violating content with reason and audit, but never rewrite guest stars/comments. Implementation in optional Phase 08 after checkout/identity foundations; gated by tests T31–T38 and owner/privacy confirmation. Details: [[24-verified-guest-reviews]]. No code has been written for this feature.

## Next action

A01 migration review follow-up (2026-11-18): Commit `749ca2b` extends the existing isolated GitHub Actions PostgreSQL test to cover client privileges, RLS, default inactive staff and audit retention. Local build, typecheck, lint, format and 32 application tests passed. The private Actions run could not be read in this session; isolated SQL validation is pending and the migration is not yet ready for approval. Hosted schema and real staff accounts remain untouched.

A01 hosted attempt (2026-11-18): Owner reports isolated CI PostgreSQL tests 2 passed, 0 failed, 0 skipped. Linked ref matches `pgbierfxeviouyjsmjnh`, but Supabase CLI labels it production and migration history returned 403. Sole-pending A01 migration was not established; no dry run or migration apply occurred. Local build, typecheck, lint, and app tests passed outside the process-restricted sandbox. No new commit/push; A01 and hosted Auth/rate-limit acceptance remain open. Resolve target classification and CLI privileges before retrying; do not begin A02.

A01 post-application verification (2026-11-18): Owner reports migration applied. Read-only hosted verifier confirms F02/A01 versions, staff table constraints, RLS and client-role denials; zero staff/audit rows. Backend connection, `/health`, `/ready`, build, typecheck, lint and 32 app tests passed. Two employee sessions, real guest/revoked denial, live audit persistence, Auth dashboard/recovery and shared rate limits remain pending. No accounts created; A01 remains open and A02 must not start.

A01 invitation callback fix (2026-11-18): Homepage and `/staff` invite links open staff password setup; callback URL is cleared after Supabase session restoration, and Express active membership still gates staff identity. Targeted tests passed. Real invite delivery/account acceptance is pending; no account was created and A02 remains untouched.

A01 activation (2026-11-18): Exactly two owner-approved invited, confirmed Auth UUIDs (`955ab3cb-0b07-44ed-a5e1-f373d7c75702`, `d3eb81cb-7fb1-44b8-b7ca-307849f9918f`) received default-inactive staff rows and were activated. Readback confirms both active. `/staff/me` denied absent/invalid tokens 401/403 with the frontend publishable key supplied only in process memory. Backend `.env` lacks `SUPABASE_PUBLISHABLE_KEY`; normal Auth access requires local configuration. Build/typecheck/lint/app tests passed. Real employee sessions, distinct audit rows, guest-session and deactivation tests still pending; A01 remains open, no A02.

A01 live login follow-up (2026-11-18): Browser-safe publishable key added to ignored local backend `.env`; backend reloaded and invalid token returned 403. Both approved employee sessions produced distinct `staff.session_verified` audit actor IDs. One membership was briefly deactivated and restored; readback confirms both active. Inactive-session response and real guest-session denial remain unverified. No password or token exposed; A01 and A02 status unchanged.

A01 hosted revocation gate check (2026-11-18): Controlled Auth identity for temporarily inactive approved UUID received 403 through Express `/staff/me` using hosted membership query; no audit write. Membership restored active in `finally`. Real-session revocation and guest-session denial still pending; do not mark A01 done.

Setup checkpoint (2026-11-18): `npm run dev` launches the existing Vite and Express commands together; HTTP checks passed at `http://localhost:5173/` and `http://localhost:3001/health`. Build, typecheck, lint and 32 application tests passed. Official Ponytail Codex plugin installed with default Full mode. A01 migration remains unapplied. Before hosted A01 use, test isolated SQL/RLS and database grants, configure invite-only Auth/recovery and shared rate limits, then verify two employee identities, guest denial, revocation and audit persistence. No A02 work started.

A01 development checkpoint (2026-11-18): D-043 now authorizes the Build → Quick Test → Fix Critical Issues → Commit → Push workflow for ordinary checkpoints. Staff sign-in/recovery UI, Express token-plus-active-membership check, actor audit path, 30-per-minute local endpoint limit, tests and an unapplied SQL migration are prepared. `npm run build`, `typecheck`, `lint`, and `test` passed (32 application tests). Gitleaks and four local Semgrep rules found none; OSV reports the existing development-only `picomatch` advisory. The earlier independent review failed at 3/5 correctness, 3/5 security, 3/5 quality; no perfect review is claimed. No isolated `TEST_DATABASE_URL` is available, so migration execution remains unverified. Hosted Auth invitation, provider/ingress rate limits, migration, and real two-staff/revocation checks remain unverified. A01 and Phase 02 gates stay open; no hosted migration without explicit approval. Do not begin A02 until instructed.

F01 evidence is in [[14-milestones]] and [[phases/01-foundation-and-tooling]]. F02 implementation is at an owner-authorized development checkpoint; D-040 defers fresh isolated migration/reset and fictitious seed tests. The catalog migration was applied previously. The latest hosted gate confirmed migration history and a no-pending-migration dry run, then stopped when Supabase CLI type generation exited 1; the scan and independent review stages did not run in that attempt. F02 quality-gate verification remains pending.
F03 now has a component test and a GitHub Actions workflow with an isolated loopback PostgreSQL service. The existing API unit/integration suite remains in place. Local build, typecheck, lint, format check and 17 application tests passed. No isolated DB server was available locally, so its migration/constraint test and the first CI run remain unverified. Gitleaks and four local Semgrep rules found no issues; OSV found one existing `picomatch` advisory, leaving the security gate failed. Two independent review passes ran; the second scored 4/5 correctness, 3/5 security and 3/5 quality, so review also remains failed. No Phase 02 authorization endpoint exists yet; an unauthorized access test remains deferred.
The F03 follow-up traced `picomatch 4.0.7` to Vite/fdir/tinyglobby development tooling; it is absent from the production dependency tree. GHSA-fc5q-39xc-vjpf remains unsuppressed and no verified patched npm release was available. GitHub Actions and isolated PostgreSQL results for commit `55a3a4b` remain unavailable, so no CI success is claimed. The owner authorized A01 development with these limits documented; A01 remains open pending its own gates and migration acceptance.

## Supabase implementation guardrails (2026-11-12)

- **D-035/D-040:** Supabase PostgreSQL selected. F02 uses the linked hosted development project for the catalog migration and read-only checks. Auth and Storage remain unconfigured; fresh isolated rebuild and seed behavior are untested.
- Prefer Supabase Auth managed login/OTP and private Storage proof bucket; confirm detailed approach in Phase 02 / Phase 05. Express API authorizes all domain writes.
- Do not expose Supabase secret key or DB connection string in React. Use publishable key with tested RLS, backend authorization, SQL migrations and true PostgreSQL transaction locks.
- Supabase CLI + Docker local stack or isolated hosted development project. Backend Express and React hosting are separate, still unchosen. Read [[22-supabase-setup]].

## Codex original skills installation (project baseline v1.4)

Repo source paths are `frontend/`, `backend/`, `supabase/` and optional `packages/shared/`. Original `code-structure`, `scanloop`, `greploop` user-uploaded skill files copied verbatim into `.agents/skills/` and guarded by root `AGENTS.md`. Codex should read originals every code task, use actual external security tools when installed, run real tests, review changes and report unsupported Claude-only subagent steps transparently. No automatic Git commits; no code implemented yet by this baseline.

A01 final acceptance follow-up (2026-11-18): local build, typecheck, lint and 34 tests passed. Real non-staff denial, live-session revocation, hosted Auth settings and shared rate limiting remain pending; no hosted membership changed.

**A02 development checkpoint (2026-11-18):** Guest email OTP UI and Express confirmed-email identity gate added. Reservation access remains unavailable until ownership-aware reservation storage and API exist. Hosted OTP template, actual expiry, shared throttling, and cross-guest denial remain pending. A01/F02/F03 verification debt is unchanged; stop before A03.


**A03 checkpoint (2026-11-18):** Added endpoint tests for expired guest sessions, Auth provider failure, and immediate staff membership revocation. Existing isolated PostgreSQL staff RLS test remains unrun locally without TEST_DATABASE_URL; hosted RLS and real expired-token checks remain pending. No migration, Storage bucket, or new UI was added. A01/A02/F02/F03 acceptance debt remains open.


**C01 development checkpoint (2026-11-18):** Existing F02 migration already defines categories, versioned packages and seven approved rows. Added public active-package catalog, /rooms rate view, and a staff-only audited price revision with a staff editor. Server rejects Family 3-hour and invalid prices. Build, typecheck, lint and 39 application tests pass (25 backend, 14 frontend). Full staff settings CRUD, isolated price-version transaction test, hosted catalog verification and booked-price snapshot behavior remain pending; C01 and Phase 03 exit checkboxes stay open. No migration was added or applied. A01/A02/A03/F02/F03 acceptance debt remains open.
