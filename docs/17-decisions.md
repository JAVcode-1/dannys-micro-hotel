---
tags: [decisions, source-of-truth]
status: approved-baseline
---
# 17 — Approved Decisions Register

> **Always prefer the most recent owner clarification.** Decision IDs are durable citations; amend via a new change record rather than quietly rewriting history. D = approved, P = proposed/pending.

| ID | Decision | Status |
|---|---|---|
| D-001 | Single hotel v1; architecture can extend to branches | Approved |
| D-002 | Guest online booking + staff/walk-in booking | Approved |
| D-003 | One shared inventory: 10 Double Standard, 5 Family Executive | Approved |
| D-004 | Guest reserves category; staff assigns physical room number | Approved |
| D-005 | Online **full GCash QR prepayment before confirmation**, with human verification | Approved; supersedes previous pay-at-hotel online idea |
| D-006 | Online hold 30m for proof; on-time proof remains protected pending manual review | Approved |
| D-007 | Proof reminder 5m UI, 15/25m email; reviews overdue 15m, urgent 30m, critical 60m | Approved |
| D-008 | Staff manually reviews and transfers GCash refunds; logs reference | Approved |
| D-009 | 1-hour online free-cancel window **from staff confirmation**; check-in ends that room's window | Approved; supersedes 24h/package cutoff |
| D-010 | Online arrival grace 1h, original departure unchanged; staff reviews possible no-show | Approved |
| D-011 | Registered and verified no-account guest booking; email OTP for no-account | Approved |
| D-012 | Multi-room reservations; one primary guest; individual occupant counts | Approved |
| D-013 | Each booked room can have independent package, check-in and checkout times | Approved |
| D-014 | Cancel/reschedule an individual room without modifying others | Approved; reschedule requires staff approval |
| D-015 | Stay durations are allowed per-category packages/combinations, not arbitrary durations | Approved |
| D-016 | Double 3h ₱200, 6h ₱400, 12h ₱600, 24h ₱1,000 | Approved current owner price |
| D-017 | Family **no 3h**; 6h ₱600, 12h ₱900, 24h ₱1,200 | Approved current owner price |
| D-018 | Occupancy 2 (+1 child) Double; 3 Family are standard figures, **not strict booking caps** | Approved standard/advisory; legal limit unresolved |
| D-019 | No per-person extra charge; only Family extra bed ₱100 **once per continuous stay** | Approved |
| D-020 | Walk-in accepts cash, GCash, or mixed payments; min 50% deposit | Approved |
| D-021 | Walk-in stay clock begins on staff check-in/room access, not payment time | Approved |
| D-022 | Extensions need 50% of extension charge before activation; start from old checkout | Approved |
| D-023 | Checkout countdown survives reload, never auto-checkout; overtime fee/waiver staff controlled and logged | Approved |
| D-024 | Cleaning buffer configurable + manual physical Ready before next guest | Approved |
| D-025 | Maintenance blocks rooms, tracks repair, alerts future booking impacts | Approved |
| D-026 | No-smoking disclosed; penalty configurable, staff-approved or reasoned waiver | Approved |
| D-027 | All staff have one tier but individual login and audit identity | Approved |
| D-028 | Cloud-based v1, manual offline backup and reconciliation | Approved |
| D-029 | React + TypeScript + Tailwind; Node.js + Express + TypeScript API; PostgreSQL | Approved |
| D-030 | Code only after docs-first baseline, implement one tested phase at a time | Approved |
| D-031 | Staff verifies minor's ID physically and records verification, no stored image by default | Approved procedure, **legal sufficiency pending** |
| D-032 | Staff-approved early check-in moves departure earlier to preserve duration, if available/Ready | Approved |
| D-033 | Confirmed booking pricing/policy snapshotted; changes apply to future bookings | Approved |
| D-034 | Late/eligible online refund via manual GCash transfer; no-show generally nonrefundable subject to law | Approved business policy, legal review pending |
| **D-035** | **Supabase selected as managed PostgreSQL platform**, keeping the separate React app and Node/Express API | **Approved 2026-11-12; replaces the unspecified DB hosting/provider** |

## UI design decision (separate from hotel operational policies)

- **UI-001 — Approved by project requester (2026-11-12):** **Danny's Royal Horizon**. Royal Blue `#2443B6` primary; Sunset Orange `#F97316` guest CTA (with navy text); Soft Lavender `#EEE9FA`, Warm White `#FAFAFD`, Midnight Navy `#17213D`, and Sky Blue `#EAF1FF`. Clean **white sidebar / white cards / minimal shadows** for Staff/Admin; real hotel imagery and primary blue/orange CTA for guests. Supersedes the earlier Modern Blue & Slate proposal and the unapproved Royal Sunrise draft. This is a **digital design approval from the project requester**, not an assertion of hotel management's production-brand/legal signoff. See [[09-ui-ux-design-system]] and [[21-before-coding-checklist]].

## Pending/Proposed implementation decisions (not owner-confirmed)

- **P-001** Implementation selection: Supabase CLI SQL migrations + `pg` recommended for concurrency-critical operations; detail the category lock/claim implementation and any optional ORM in Phase 01 ADR.
- **P-002** Exact physical room identifiers, configured cleaning duration, checkout alert minutes and room occupant legal limits.
- **P-003** Package combination pricing optimization/tie-break policy for long stays.
- **P-004** Fee application and quantity of multiple extra beds, if hotel can provide more than one.
- **P-005** Payment/receipt compliance, **React/API hosting**, and owner-approved GCash QR media upload. Supabase is selected for PostgreSQL.
- **P-007** Supabase Auth and private Supabase Storage are **recommended technical integrations** to be configured/tested; not separate confirmed owner policy changes.
- **P-006** Behavior when 5 vs 6 Family Executive guests use an extra bed: advisory only unless an approved safety limit exists.

## Approved change procedure

When owner changes a decision: record `date`, `old`, `new`, `reason`, `affected docs`, `data migration/finance implications`, `test updates` and `approver`. Update requirements + phase acceptance before code.

See [[18-backlog]].

## Platform implementation change — 2026-11-12

**Requested change:** Use Supabase for the project. **Technical result:** Replace unspecified PostgreSQL hosting with **Supabase-managed PostgreSQL**; preserve React/TypeScript/Tailwind, Node/Express/TypeScript and all existing hotel business rules. Supabase Auth and Storage are the recommended managed integrations pending their detailed phase ADRs. **Affected documentation:** tech stack, architecture, schema, security, API, deployment, development checklists, Graphify maps and ICM context. **Status:** documentation change only; no Supabase project/credential/app provisioned by this update. See [[22-supabase-setup]].


## D-036 — Final source-folder names (2026-11-12)

**Confirmed by developer project layout:** `frontend/` for React; `backend/` for Express; `supabase/` for SQL/CLI; optional `packages/shared/` for reusable types. All v1.3 planning references to `apps/web` and `apps/api` are normalized to match this actual folder structure. No application code is claimed.

## D-037 — Preserve original Claude skills for Codex (2026-11-12)

**Requested:** Preserve exact source files for `code-structure`, `scanloop`, and `greploop` as originally uploaded; place in `.agents/skills/`, with root `AGENTS.md` requiring their review/quality workflow. Refer to `CODEX-START-HERE.md` for compatibility and truthful execution limits. Actual scanner installation, reviewer agent features and every skill's execution remain workstation-dependent. Do not automatically commit/push.

## D-038 — Verified guest ratings, public reviews and private feedback (2026-11-16)

**Approved by project requester for planning (no code implemented):** The hotel website is open for public browsing, including a list and aggregate of published verified guest ratings. Only the reservation's verified **primary guest** with recorded staff check-in **and completed checkout** can submit a 1–5 star public rating with an optional comment, once per completed reservation (including multi-room). Applies to online registered, online no-account via the existing verified booking email + expiring single-use link, and walk-in stays with a verified contact method. Other website visitors cannot submit reviews.

**Fairness and protection:** Legitimate positive and negative ratings—including **1-star**—remain eligible for publication and the average. Private feedback is staff-only. Staff may reply and temporarily hide/restore clearly violating reviews (e.g., spam/threats/personal data) with an explicit policy reason and audit actor, but cannot modify customer stars/comments or hide feedback merely for criticism. Suspicious content may be flagged for moderation; no blanket positivity-approval gate.

**Scope/timing:** Add as a Phase 08 enhancement behind a feature gate; no impact on initial Phase 01 coding. Detailed implementation prerequisites/remaining decisions in [[24-verified-guest-reviews]] and [[18-backlog]], test cases T31–T38 in [[15-testing-plan]]. **No owner-stated operating results or completed development implied.**
