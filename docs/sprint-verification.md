# Functional sprint verification — 2026-11-21

Scope: C01–C20; see [[functional-completion-tracker]]. Landing source and palette preserved. No hosted Supabase access, migration application, real email or money. New dependencies: none. The isolated launcher relies on existing locally installed embedded PostgreSQL tooling, documented in [[isolated-development]].

Candidate migrations: `020_notification_outbox`, `021_staff_operational_corrections`, `023_booking_contact_policy`, `024_review_invitation_jobs`, `025_request_limits`, `026_walkin_contact_verification`. Number 022 was reserved for Hall but no Hall schema change was needed. All six are unapplied to hosted databases. Shared schema types were generated from the fully migrated disposable PostgreSQL catalog.

Evidence: `.quality/sprint-tests.log` reports 123 backend + 72 frontend tests passing. `.quality/h01/isolated-postgres.log` reports 39 passing tests, no failures/skips. Root build, typecheck, lint and format checks passed. Generated reports remain ignored and are not committed as fake acceptance artifacts. Build retains the existing >500 kB bundle warning.

Security: six unpublished UI commits reviewed and scanned before publication; no secrets found. Current source scan explicitly excludes unrelated untracked prototypes/editor/vault data. Five Gitleaks findings were synthetic test idempotency identifiers, not authentication secrets; narrow inline explanations permit those exact fixture lines. Semgrep uses pinned local rules with metrics off: 4 rules / 107 targets / no findings. OSV scanned 422 lockfile packages and exited 0 after authorized network access. No full scanloop/CLI greploop production-gate success is claimed.

Independent review findings and resolution: maintenance registrar now receives the isolated pool; review OTP/invitations queue in the credential transaction; migration021 preserves extension projection; current inspections reconcile historical readiness; no-show mutations lock before insertion and read timestamp order; staff statement uses effective checkout; fixture subject-shaped random tokens support Hall recovery; isolated startup enables modules only behind validated development flags and probes required schema; verified payment history remains verified after room release. Rendered Hall retry test memory explosion was a DOM diagnostic assertion and is fixed without altering production behavior. Inventory and payment-finalization reads now bound conflicts to the requested schedule window, with the expanded race suite passing.

Browser limitation: Windows Computer Use stopped because it could not establish the current browser URL securely. No successful end-to-end browser or physical-device acceptance is claimed. Local disposable launcher started successfully before being stopped to release Windows paging memory. API and rendered-component coverage passed; real browser/staff-device verification remains the next acceptance task.

Checkpoint preparation: final staged paths and sensitive-file exclusions reviewed; source Gitleaks rescan reports no leaks. Baseline main `4e573dd`, six commits ahead of cached origin/main `33d3cf4`. Commit hash and verified remote state are reported in the delivery response. No history rewrite or branch switch. Unrelated Obsidian preferences, VS Code settings, skill archives, nested folder and prototype directory are excluded. Formatting-only changes to frontend index/package files satisfy the root formatting check.

Verified code checkpoint: `29b9cdcd463f9b324b3fdbe2f28aec6d7ec49160` (`feat: integrate functional correction development checkpoint`). `git push origin main` exited 0 with `33d3cf4..29b9cdc main -> main`; local `HEAD` and fetched tracking `origin/main` both resolve to that full hash. This publishes the six reviewed UI commits and the functional checkpoint, without deploying or applying migrations. A documentation-only delivery note follows this code checkpoint.

## Modified files

- `.prettierignore`
- `backend/src/analytics.ts`
- `backend/src/app.ts`
- `backend/src/audit.ts`
- `backend/src/cancellations.ts`
- `backend/src/catalog.ts`
- `backend/src/check-in.ts`
- `backend/src/database.ts`
- `backend/src/guest-booking.ts`
- `backend/src/hall-reports.ts`
- `backend/src/hall-reservations.ts`
- `backend/src/hall-routes.ts`
- `backend/src/inventory-claims.ts`
- `backend/src/isolated-composition.ts`
- `backend/src/isolated-server.ts`
- `backend/src/maintenance.ts`
- `backend/src/notifications.ts`
- `backend/src/operational-settings.ts`
- `backend/src/payment-proofs.ts`
- `backend/src/payment-review.ts`
- `backend/src/request-limits.ts`
- `backend/src/reservation-workspace.ts`
- `backend/src/review-access.ts`
- `backend/src/rooms.ts`
- `backend/src/runtime-config.ts`
- `backend/src/transaction-staff.ts`
- `backend/src/walkin-routes.ts`
- `backend/src/walkins.ts`
- `backend/test/catalog.test.mjs`
- `backend/test/check-in.test.mjs`
- `backend/test/guest-completion-postgres.mjs`
- `backend/test/guest-completion.test.mjs`
- `backend/test/hall-operations-postgres.mjs`
- `backend/test/isolated-composition.test.mjs`
- `backend/test/notifications.test.mjs`
- `backend/test/o02-postgres.mjs`
- `backend/test/occupants-settings.test.mjs`
- `backend/test/reservation-workspace.test.mjs`
- `backend/test/review-delivery-postgres.mjs`
- `backend/test/review-delivery-transaction.test.mjs`
- `backend/test/runtime-config.test.mjs`
- `backend/test/sprint-postgres.mjs`
- `backend/test/staff-operational-postgres.mjs`
- `backend/test/walkin-contact-postgres.mjs`
- `backend/test/walkin-contact.test.mjs`
- `backend/test/x02-postgres.mjs`
- `backend/test/zz-v02.integration.mjs`
- `docs/11-pages-and-navigation.md`
- `docs/14-milestones.md`
- `docs/17-decisions.md`
- `docs/functional-completion-tracker.md`
- `docs/icm/PROJECT-CONTEXT.md`
- `docs/isolated-development.md`
- `docs/sprint-verification.md`
- `docs/superpowers/plans/2026-11-21-functional-completion.md`
- `frontend/src/App.tsx`
- `frontend/src/BookingPlanner.tsx`
- `frontend/src/Catalog.tsx`
- `frontend/src/CheckInDesk.tsx`
- `frontend/src/GuestAccess.tsx`
- `frontend/src/GuestPayment.tsx`
- `frontend/src/GuestReservations.tsx`
- `frontend/src/GuestSession.tsx`
- `frontend/src/HallDesk.tsx`
- `frontend/src/RoomMaintenancePanel.tsx`
- `frontend/src/StaffAuditDesk.tsx`
- `frontend/src/StaffCatalog.tsx`
- `frontend/src/StaffReservations.tsx`
- `frontend/src/StaffRooms.tsx`
- `frontend/src/StaffRoutes.tsx`
- `frontend/src/WalkInDesk.tsx`
- `frontend/src/development-auth.ts`
- `frontend/src/hall-command-state.ts`
- `frontend/src/main.tsx`
- `frontend/src/staff-auth.ts`
- `frontend/test/booking-planner.test.mjs`
- `frontend/test/development-auth.test.mjs`
- `frontend/test/guest-payment.test.mjs`
- `frontend/test/guest-reservations.test.mjs`
- `frontend/test/guest-session.test.mjs`
- `frontend/test/hall-command-state.test.mjs`
- `frontend/test/hall-recovery.test.mjs`
- `frontend/test/navigation-completion.test.mjs`
- `frontend/test/payment-review.test.mjs`
- `frontend/test/staff-login.test.mjs`
- `frontend/test/staff-room-corrections.test.mjs`
- `frontend/test/staff-workspace.test.mjs`
- `frontend/test/stay-monitor.test.mjs`
- `frontend/test/walkin-contact.test.mjs`
- `frontend/test/walkin.test.mjs`
- `package.json`
- `packages/shared/src/audit.ts`
- `packages/shared/src/booking.ts`
- `packages/shared/src/database.types.ts`
- `packages/shared/src/payment.ts`
- `scripts/generate-isolated-types.mjs`
- `scripts/isolated-development.mjs`
- `supabase/migrations/20261121002000_notification_outbox.sql`
- `supabase/migrations/20261121002100_staff_operational_corrections.sql`
- `supabase/migrations/20261121002300_booking_contact_policy.sql`
- `supabase/migrations/20261121002400_review_invitation_jobs.sql`
- `supabase/migrations/20261121002500_request_limits.sql`
- `supabase/migrations/20261121002600_walkin_contact_verification.sql`
