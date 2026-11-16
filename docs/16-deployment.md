---
tags: [deployment, operations, supabase]
status: planned
updated: 2026-11-12
---
# 16 — Deployment, Backup and Operations

## Version 1 target

**React frontend + independently hosted Node/Express API + Supabase-managed PostgreSQL**, with recommended Supabase Auth and Storage. This remains cloud-first; hotel internet outages use the approved **manual backup and reconciliation** workflow. Actual frontend/API host, region, domain, budget, GCash QR and receipt terms remain to be selected/verified before release.

## Isolated environments

1. **Local development:** Supabase CLI local stack with Docker-compatible runtime (recommended), or a **dedicated hosted development Supabase project** if local Docker isn't practical. Fake guests only; never production data.
2. **Staging:** separate Supabase project for migration rehearsals, staff UAT and redacted data. Never send actual GCash money unless an authorized test plan exists.
3. **Production:** separate Supabase project; production keys and database URL only on secured servers; approved staff onboarding and signed privacy policy.

## Infrastructure responsibilities

- **Supabase:** PostgreSQL, optional Auth and Storage; configure RLS, secrets, bucket policies, verified Auth email sender, backups and monitoring.
- **Independent Node/Express host:** Node runtime, HTTPS, deployment health, outbox/hold cleanup jobs and alerting, DB connection strategy.
- **Frontend host:** static/Vite build and HTTPS domain. Browser gets a **publishable key only**, plus backend URL.
- **DB connection:** for a persistent Express host use Supabase direct connection when compatible with host networking, or **session-mode pooler** if IPv4-only. Use `Connect` in Supabase dashboard, not guessed strings. See [[22-supabase-setup]].

## Deployment checklist

- [ ] Separate Supabase projects/keys for local or development, staging and production.
- [ ] Check the actual Supabase plan's backup/restore/point-in-time recovery options; **test restoration** before production.
- [ ] Email OTP/transactional email delivery tested with real managed sender configuration and quota review.
- [ ] Bucket policy review: private payment proofs, staff-only upload approval, retention/expiry policy and signed access.
- [ ] RLS reviewed and tested against anonymous, guests, staff, revoked staff, other guests and malicious clients.
- [ ] `SUPABASE_SECRET_KEY`, `DATABASE_URL`, SMTP keys and other secrets stored outside Git/browser assets.
- [ ] Backend staff permission and ownership checks tested even when server has elevated database access.
- [ ] Schema migrations under Git; apply to staging before production with restore/rollback plan.
- [ ] API connectivity/health and error alerts; rate limits, audit and notification retries.
- [ ] Separate real/test GCash reference handling; screenshots never treated as proof of payment by themselves.
- [ ] Written front-desk outage procedure and actual acceptance-test walkthrough before launch.

## Hotel internet outage protocol

1. Attempt cellular backup; if reception cannot access cloud, use approved manual log with operator identity and timestamps.
2. Record physical room, guest contact (minimal), payment method/details, check-in/out and package intervals.
3. **Online bookings may still arrive while reception is offline**. Do not promise rooms from stale information; use an approved management escalation policy.
4. On reconnection, reload Supabase-backed actual inventory via Express, reconcile manual items one by one, flag conflicts and reconcile the financial journal.
5. Audit every exception; never silently delete or overwrite a booked guest.

**Production remains blocked** until management approves operational policy, backups/restores are tested, GCash recipient validated, and legal/receipt requirements verified.
