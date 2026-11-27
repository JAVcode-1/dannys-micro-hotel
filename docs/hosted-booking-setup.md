# Hosted development: rooms, OTP and booking emails

## Staff Realtime on D-040 (2026-11-27)

Migration `20261127003500` is applied to the approved hosted development database. Realtime was already enabled. Anonymous and signed-in non-staff private joins were denied. A committed catalog update refreshed two separate staff browser sessions and left their dashboard queries cached. See [[14-milestones]] for the verification record.

1. Run `npm run dev`. Sign in as two authorized staff members in separate browser profiles and open the same operational page.
2. Make an authorized development-only change in one profile. Check that the matching page in the other profile refreshes without reloading.
3. Interrupt only the Realtime socket in one foreground profile. On the dashboard, check the disconnect notice and allow up to 30 seconds for the Express fallback. Restore the socket and verify the notice clears and data refreshes.
4. Sign out, then sign in as another staff member in that profile. Check that the previous session's data is gone. If several profiles receive HTTP 429, follow the response's `Retry-After` before retrying.

## Hosted turnover and cash migrations applied (2026-11-24)

The owner approved migrations 20261124002900 and 20261124003000 for the linked Supabase development project. Both were previewed in a rolled-back transaction and committed together through the project-pinned PostgreSQL connection after the CLI login-role request returned HTTP 403. One outstanding turnover block ended at its recorded Ready time. Hosted API readiness returned HTTP 200, and npm run dev started the API and Vite. The verification server was stopped afterward. The application test suite and end-to-end cash receipt check were not run.

Updated 2026-11-22. Scope: owner-approved development project `pgbierfxeviouyjsmjnh`, never production activation.

## Applied and checked

- Applied the 14 approved migrations (014–028, excluding nonexistent 022) together in one transaction. History now contains 28 migrations. No dummy 022 or extra migration was added.
- Before applying, saved the existing application's 36 tables, sequence states and recorded schema statements to ignored `.quality/hosted-activation/backup.json`. Reconstructed the old schema/data in fresh local PostgreSQL and matched every table's row digest. Recovery evidence and application report are in the same ignored directory. This is an application-scope recovery snapshot; Auth accounts and Storage objects were not modified and are not a full-project disaster-recovery backup. Do not commit or distribute these artifacts. Preserve them before any future backup operation.
- Compared original table contents again inside the hosted migration transaction, before and after application; existing rows, including staff accounts, were preserved. The approved migrations create the independent Hall resource and provisional settings.
- Essential read-only post-migration source readiness checked the project guard, full schema and private payment buckets. Financial checks reported zero negative collected/refunded/refund-due projections and zero verified-payment/reservation-total mismatches. Existing business data may be empty; these checks do not establish end-to-end booking acceptance.
- Exactly one Hall resource exists, not Ready. No physical room identifiers were inserted. Production remains gated.

## Register the actual 15 rooms

1. Stop old development servers and restart **`npm run dev`** from the repository root. Sign in with the existing hosted staff account.
2. Open **Rooms** (`/staff/rooms`). In **Register a physical room**, enter an actual room number/identifier, choose its real category and enter a registration note. Register **10 Double Standard** and **5 Family Executive** rooms. The Hall is not a room-category entry.
3. Registration creates an **inactive, Unverified** room. It does not make a room available or record a fabricated inspection. Duplicate identifiers are rejected case-insensitively, including trimmed whitespace; category totals are enforced. Retrying an unchanged uncertain submission uses the same request key.
4. For each room that is actually empty, inspected, clean and usable, open **Room administration and inspection**, enter the actual inspection note, confirm the physical check and choose **Inspect and mark Ready**. Do not do this for occupied or blocked rooms; reconcile existing occupancy/maintenance first through staff operations.
5. In the same panel, select **Active for booking**, enter an administration reason and save. A current inspection is required before activation. The board shows availability, holds/reservations, occupancy, turnover and maintenance independently.
6. Edit identifiers or active state in this panel. Category corrections require an inactive room with no booking/maintenance history and space in the target category. Deactivation is refused while protected bookings or an open stay depend on the room. There is no delete operation.

The routes use active individual staff identity plus transaction-level checks and audit actors. Registration writes the existing `staytrack.rooms` inventory used by both online bookings and walk-ins. Customer selections remain categories; capacity-engine room IDs are provisional, while actual guest room assignment/check-in stays a staff action. The displayed booking policy is versioned `booking-v2` to clarify the existing UB-05 room/Hall cutoff; older stored policy snapshots are untouched and new submissions must acknowledge the current version.

## Function Hall and payment settings

Open **Function Hall** (`/staff/hall`) to review actual readiness and the existing scheduling/settings actions. Theater Type and Room Type share the single exclusive Hall resource and exclusion-protected schedule. Do not register either setup as another room or another Hall. The migration's provisional hours, notice and buffers still require owner review; no automatic Ready or event start was performed.

Before payment testing, configure/verify the real hotel GCash QR/payee through the existing staff payment/settings workflow, and enter the owner-approved cancellation display text in **Settings**. The legacy operational QR fields are separate from the existing `payment_qr` record. Staff confirmation deliberately refuses missing cancellation terms and mismatched receiving-account evidence. UB-01–UB-06, full online payment, protected timely proof, the original one-hour item cancellation clock, existing staff Hall deposit/walk-in policies and manual refunds remain in their existing business services.

## Required Supabase guest OTP correction — manual dashboard step

No Supabase Management API token or dedicated management connector was available to inspect/update hosted templates. Database/service keys do not authorize management template changes. **Hosted templates were not changed.** Apply these changes only in the [confirmed development project](https://supabase.com/dashboard/project/pgbierfxeviouyjsmjnh).

1. Open **Authentication → Emails → Templates** (called **Email Templates** in some dashboard versions). Save a private copy of the existing **Magic Link** and **Confirm Signup** bodies before editing. For **each** template, set its separate **Subject** field to `Your Danny's Micro Hotel verification code` and save. Preserve the configured Royal Horizon HTML; ensure it displays `{{ .Token }}` rather than a login link. If a template has no customized body yet, this minimal code body illustrates the required variable:

   ```html
   <h2>Your email verification code</h2>
   <p>Enter this code on the Danny's Micro Hotel website:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
   <p>If you did not request this code, you can ignore this email.</p>
   ```

   The body must contain the literal `{{ .Token }}` variable, not `{{ .ConfirmationURL }}`, `{{ .TokenHash }}` or a login link. Supabase generates a fresh real code; the template never contains a fixed value. Magic Link covers returning passwordless customers; Confirm Signup covers the applicable first-time confirmation path.
2. In **Authentication → Sign In / Providers → Email**, keep Email sign-in enabled, allow new-user signup and require email confirmation. Set the email OTP length to **6** if it differs. Preserve the existing OTP expiry, resend frequency and rate limits. If length is not exposed by your dashboard version, the Management API setting is `mailer_otp_length: 6`; an authorized management credential is needed to change it, not the browser publishable key. Do not enable automatic email confirmation or allow unverified-email sign-in.
3. **Do not edit Invite User, Reset Password/Recovery, Email Change or staff credential settings.** Staff password/username authentication, invitations and password recovery use their existing paths/templates.
4. Verify custom SMTP for customer addresses: provider hostname, port, username, password and verified sender email/name, including the provider's sender/domain verification requirements. Enter secrets privately in Supabase's dashboard. The default Supabase mail service restricts recipients to project-team addresses; receiving one test email does not prove delivery to arbitrary customers. SMTP configuration is currently unverified, not asserted missing.
5. Configure the actual development Site URL/allowed redirects (locally `http://127.0.0.1:5173`, plus `http://localhost:5173` only if used). Keep staff invite/recovery redirect URLs intact.

The app already uses `signInWithOtp({email, options:{shouldCreateUser:true}})` and `verifyOtp({email, token, type:'email'})`; customers type the six-digit code on `/verify`. Express revalidates the resulting verified-email identity. Room/Hall selections remain in sessionStorage and the validated return URL resumes booking. Do not substitute fixed/synthetic codes, trust the browser as proof of identity, or treat OTP as payment verification.

Source: [Supabase passwordless email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Auth configuration fields](https://supabase.com/docs/reference/api/v1-update-auth-service-config).

### Email still contains a sign-in link despite an edited OTP template

The owner corrected their initial response: the latest email titled "Your sign-in link" contains a **clickable sign-in link**, not a six-digit code. OTP delivery is therefore **not established**. This is an active email-rendering/configuration mismatch, not merely a stale subject. A subject-only edit will not fix the required flow. The initial assumption that a six-digit code had arrived is superseded by this correction.

The inspected guest path is `GuestAccess.tsx` → real `guestAuth` Supabase client → `signInWithOtp` → Supabase Auth email delivery → website code input → `verifyOtp` with type `email` → Express `/guest/me` → Supabase `getUser` and confirmed-email/ownership checks. The app sets no email subject/body or Brevo template ID in this path. The inspected application files contain no hardcoded "Your sign-in link" subject. The separate booking-notification adapter in `backend/src/mail.ts` does not send authentication codes and must not be changed to troubleshoot login email branding.

Credential-redacted configuration inspection confirmed that backend Auth URL, frontend Auth URL/public key, database project and linked CLI project agree with the D-040 reference. No process-level Supabase/Vite overrides were present. Read-only inspection of the running Vite server's `/src/staff-auth.ts` also confirmed the actual served guest Auth client contains only `pgbierfxeviouyjsmjnh.supabase.co`. Root startup passes the same public Auth configuration to Vite. For a browser running an older build or another dev server, inspect its Send code request in DevTools → Network: the request must target `https://pgbierfxeviouyjsmjnh.supabase.co/auth/v1/otp`, and verification must target that project's `/auth/v1/verify` with type `email`. Do not share request tokens, headers or guest addresses. A wrong browser request target requires restarting the intended local server/reloading or correcting the deployed public environment and redeploying; editing another project's templates cannot affect it.

Check the actual sender configuration in the development dashboard:

- **Send Email Hook disabled:** Supabase renders its Auth templates and sends through configured SMTP. In the exact development project, inspect the saved **Magic Link** and **Confirm Signup** HTML bodies and their separate subjects. Keep the intended Royal Horizon HTML, replace its login-link action with the literal `{{ .Token }}` code display, remove the guest login link using `{{ .ConfirmationURL }}`/`{{ .TokenHash }}`, and Save changes for each template. Reopen each template to verify the saved body, rather than only its preview. Updating a template stored only in Brevo does not select it for Supabase's SMTP-rendered message. Local `supabase/config.toml` has no active custom email subject or Send Email Hook definition and does not establish hosted hook state.
- **Send Email Hook enabled:** the hook handles Auth sending and SMTP is bypassed. Inspect its configured endpoint/function and its handling of `email_data.email_action_type` values `magiclink` and `signup`. Fix those branches' subject and Royal Horizon body/active Brevo template selection. Display the real `email_data.token`, not `token_hash` or a generated/fixed number; retain hook signature validation and existing invite/recovery/email-change branches. When a hook uses a Brevo `templateId`, the selected provider template controls the content, so editing unrelated HTML will not replace it. Do not blindly disable a shared hook or overwrite all Auth templates to fix guest wording.
- **Brevo SMTP:** in Authentication → Emails → SMTP Settings, confirm custom SMTP uses `smtp-relay.brevo.com`, the actual Brevo SMTP username and SMTP key, and the verified hotel sender. Brevo documents port 587 (STARTTLS) or 465 (SSL/TLS). Use an SMTP key, not its HTTP API key. Keep the current expiry/resend limits. In Brevo → Transactional → Email logs, match the recipient/time of a newly requested email and inspect the recorded subject/sender; avoid judging an older threaded message.

No Management API credential or dedicated management connector was available for this review. Hosted subjects, hook status, SMTP settings and the saved Royal Horizon body therefore remain **unverified remotely**; no dashboard change is claimed applied. Use the branch matching the actual hook setting. Leave staff Invite/Recovery templates and application booking-mail configuration unchanged.

Sources: [Supabase Send Email Hook routing](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook), [Brevo's Supabase SMTP setup](https://developers.brevo.com/docs/supabase-smtp-integration), [Brevo content/template parameters](https://developers.brevo.com/docs/smtp-integration).

## Application confirmation emails, notifications and reminders

Implemented a real **Resend API** adapter using built-in fetch; no new npm dependency or credentials were added. Configure these in ignored **`backend/.env`**, then restart development:

```dotenv
MAIL_PROVIDER=resend
RESEND_API_KEY=YOUR_PRIVATE_RESEND_API_KEY
MAIL_FROM=YOUR_VERIFIED_SENDER_EMAIL
MAIL_SITE_URL=http://127.0.0.1:5173
# Optional: actual, owner-approved staff inboxes, separated by commas.
# MAIL_REVIEW_RECIPIENTS=
```

Use an authorized sender/domain in your Resend account. The example values are placeholders, not working credentials. Do not put these settings in frontend `.env`, source control or chat. Auth SMTP is separate; configuring either service alone does not configure the other. If using Resend for both, obtain its SMTP settings from that account and enter them separately in Supabase.

- Full staff verification atomically confirms the persisted room/Hall reservation and writes a completed immutable itemized snapshot into the single deduplicated confirmation-email queue. OTP or proof upload never confirms a reservation. One snapshot/email includes room schedules/packages, Hall setup/schedule, item amounts, full total, original confirmation time and cancellation terms.
- The development scheduler runs every 30 seconds, performs shared hold expiry, queues due 15-/25-minute payment reminders and dispatches configured email delivery. It also creates 15-/30-/60-minute staff review alerts when actual recipients are configured. Stale reminders and obsolete/lower-stage alerts are suppressed. A provider send already in flight cannot be recalled; final booking state remains authoritative.
- Existing outbox leases, retry/backoff and failed-state visibility are preserved. Resend idempotency uses each notification's stable ID. Requests time out before the lease; ambiguous retries older than the conservative 23-hour window stop as failed rather than risking duplicates beyond the provider's 24-hour retention. After a provider timeout, staff should check its delivery record before any manual resend. Provider acceptance is not proof of inbox delivery.
- **Payments** (`/staff/payments`) shows whether delivery is configured and pending/failed counts; Refresh queue reloads this status. The protected `/staff/notifications` endpoint exposes counts without guest addresses or secrets. Without provider configuration, messages remain queued and a startup message explains the required variables; nothing is marked sent falsely.
- The worker is active while development is running. Closing the app stops it; this is not an unattended production scheduler or production release. Optional review-invitation delivery remains separately gated; this task does not substitute fake mail or turn it on accidentally.

Source: [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email), [24-hour idempotency retention](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Remaining owner inspection

Register/inspect the real rooms; review Hall settings/readiness; configure approved cancellation text and real QR/payee; make the OTP dashboard correction; provide real SMTP/application-mail credentials privately. Then manually inspect first-time/returning OTP, saved selections, room-only/Hall-only/multiple/mixed bookings, real shared availability, proof privacy, actual staff receiving-account verification, confirmation emails, reminders and independent item changes/refunds.

No full automated suite, build, lint, typecheck, UI/browser acceptance, guest email send, booking/payment creation, commit or push was performed. Only the authorized backup-recovery, migration, read-only readiness and financial-integrity safety checks were run. No feature/phase is marked fully accepted or production-ready.

Changed application files: `backend/src/runtime-config.ts`, `hosted-development.ts`, `app.ts`, `server.ts`, `rooms.ts`, new `room-registration.ts`, `guest-booking.ts`, `payment-review.ts`, `notifications.ts`, new `mail.ts`; `frontend/src/StaffRooms.tsx`, `StaffPaymentReviews.tsx`; `scripts/dev.mjs`; and placeholder-only `backend/.env.example`. Documentation updates are limited to this setup, the activation plan, startup README and relevant milestone/decision/context/Supabase notes. No dependencies were added.
