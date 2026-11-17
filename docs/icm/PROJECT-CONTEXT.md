---
tags: [icm, project-context]
status: docs-first-handoff
---
# Session Context — StayTrack / Danny's Micro Hotel

**Project status:** Phase 01 F01 complete; F02 hosted development migration and connectivity implemented, with the mandatory quality gate still pending; F03 and later phases have not started. This is not a deployed application.

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

F01 evidence is in [[14-milestones]] and [[phases/01-foundation-and-tooling]]. F02 implementation is at an owner-authorized development checkpoint; D-040 defers fresh isolated migration/reset and fictitious seed tests. The catalog migration was applied previously. The latest hosted gate confirmed migration history and a no-pending-migration dry run, then stopped when Supabase CLI type generation exited 1; the scan and independent review stages did not run in that attempt. On 2026-11-18, local build, typecheck, lint, format check, and 16 application tests passed. F02 quality-gate verification remains pending; F03 has not started.

## Supabase implementation guardrails (2026-11-12)

- **D-035/D-040:** Supabase PostgreSQL selected. F02 uses the linked hosted development project for the catalog migration and read-only checks. Auth and Storage remain unconfigured; fresh isolated rebuild and seed behavior are untested.
- Prefer Supabase Auth managed login/OTP and private Storage proof bucket; confirm detailed approach in Phase 02 / Phase 05. Express API authorizes all domain writes.
- Do not expose Supabase secret key or DB connection string in React. Use publishable key with tested RLS, backend authorization, SQL migrations and true PostgreSQL transaction locks.
- Supabase CLI + Docker local stack or isolated hosted development project. Backend Express and React hosting are separate, still unchosen. Read [[22-supabase-setup]].

## Codex original skills installation (project baseline v1.4)

Repo source paths are `frontend/`, `backend/`, `supabase/` and optional `packages/shared/`. Original `code-structure`, `scanloop`, `greploop` user-uploaded skill files copied verbatim into `.agents/skills/` and guarded by root `AGENTS.md`. Codex should read originals every code task, use actual external security tools when installed, run real tests, review changes and report unsupported Claude-only subagent steps transparently. No automatic Git commits; no code implemented yet by this baseline.
