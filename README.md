# Danny's Micro Hotel — Documentation-first system project

## Run StayTrack locally

With Node.js 22+ and npm installed, run **`npm run dev`** from this repository root, then open **http://127.0.0.1:5173**.

Normal development now starts the real Express API and Vite using the Supabase settings in backend/.env. Install workspace dependencies with npm ci if needed. The launcher shares only the public Auth URL/key with the frontend; database credentials and secret keys stay backend-only. No disposable database, fixture login, automatic migration or seed is used by npm run dev. Stop and restart both servers after changing environment configuration.

Guest email OTP uses Supabase Auth. Customer delivery requires configured custom SMTP and token email templates; see [Supabase setup](docs/22-supabase-setup.md). Hosted staff sign-in uses the existing individual Supabase account, not the local fixture account. Saved booking selections remain in browser sessionStorage.

**Hosted development booking is wired:** the 14 approved pending migrations are applied to the pinned D-040 development project. Register and inspect the actual rooms, review Hall readiness, configure the real GCash/policy settings and finish OTP/email-provider configuration before manual booking/payment acceptance. Production remains closed. See [current setup and evidence](docs/hosted-booking-setup.md); no full test-suite or production-readiness claim is made.

The explicit npm run dev:isolated command retains the disposable fixture harness for separate development work; it is no longer the normal startup. Older isolated-development instructions apply only to that harness.

**START CODING:** Read [`START-CODING-HERE.md`](START-CODING-HERE.md), then [`CODEX-VERIFY-THEN-F01.md`](CODEX-VERIFY-THEN-F01.md). This is a complete replacement project folder, not an update patch.

**State:** Requirements baseline drafted and approved through the latest owner discussions; **no implementation is claimed**.
**Last consolidated:** November 12, 2026 · **Version:** documentation baseline v1.4 (Supabase architecture update; approved Royal Horizon theme unchanged)

> **START HERE:** Open [[00-START-HERE]] in Obsidian, then [[docs/13-development-roadmap]] and [[docs/phases/00-phase-gates]].

This folder contains **planning documentation and exact original Claude skill instructions; no hotel application implementation yet**. React, Node.js, and **Supabase PostgreSQL** coding happens in the **next stage**, phase-by-phase. The documents are the source of truth for implementation and are readable in VS Code, GitHub, and Obsidian.

## Hosted staff username

The owner-designated existing Supabase staff account has official application username `admin`. Its email remains internal to Supabase Auth; use the owner-configured password, which is not repeated here. Deploy the updated frontend and Express API together: the sign-in page accepts the username, and Express resolves its admin-managed Auth metadata before Supabase password verification and active staff authorization. The workspace displays the verified username. Normal development uses this hosted Supabase identity. No production transaction gate is opened by this account change.

## Open in Obsidian

1. Extract the ZIP to a permanent folder, e.g. `Documents/Dannys-Micro-Hotel/`.
2. Open **Obsidian → Open folder as vault** and select the extracted `Dannys-Micro-Hotel` root folder (not the ZIP).
3. Open `00-START-HERE.md` or `docs/13-development-roadmap.md`.
4. Use **Graph view** for wiki-linked requirements, decisions, milestones, and phases; use Obsidian's Mermaid preview for diagrams.
5. Later place the application source code in this *same* root beside `docs/`, or copy this `docs/` folder into the actual application repository. Preserve links and IDs.

## Open in VS Code

Open the root folder. The numbered `docs/` pages mirror the reference screenshot. Review `AGENTS.md` before any AI coding session. The folder is not a running application and intentionally has no `package.json`, dependency folder, or credentials.

## Three complementary tools

| Tool | Role | What this ZIP provides |
|---|---|---|
| **Obsidian** | Read and maintain the specification | Wiki-linked Markdown vault, dashboard, notes, phase checklists |
| **Graphify** | Index/query connected repository code and docs once installed | `docs/graphify/` Mermaid architecture maps and Graphify setup notes (not a live generated knowledge graph) |
| **ICM** | Remember decisions and progress across coding sessions once installed | `docs/icm/` context and optional PowerShell seed commands (not an initialized memory database) |

## Project baseline

- 15 rooms: **10 Double Standard**, **5 Family Executive**.
- Double Standard: 3h ₱200; 6h ₱400; 12h ₱600; 24h ₱1,000.
- Family Executive: **no 3-hour package**; 6h ₱600; 12h ₱900; 24h ₱1,200.
- Only Family Executive has optional extra bed, **₱100 once per continuous stay**. No per-person extra charge; standard occupant counts are advisories, not an asserted legal maximum.
- Online: QR GCash, full prepayment and **manual staff verification**; timed hold and payment-proof flow.
- Walk-ins: cash/GCash/mixed payments, **minimum 50% down** before staff check-in; countdown begins at actual staff check-in.
- Shared inventory across channels, individual room schedules inside one reservation, category-based guest booking and later staff physical room assignment.
- Cloud-first v1; manual outage backup with reconciliation. **Supabase-managed PostgreSQL selected; Supabase Auth and Storage recommended for the planned integration.**

## Approved UI/UX baseline

**Danny's Royal Horizon** is approved for development: Royal Blue `#2443B6`, Sunset Orange `#F97316`, Soft Lavender `#EEE9FA`, Warm White `#FAFAFD`, Midnight Navy `#17213D`, Sky Blue `#EAF1FF`. Use [[docs/09-ui-ux-design-system]] for design tokens and [[docs/design/brand-and-navigation-brief]] for navigation and hotel photo references.

**Before coding**, complete the required environment and repository preparation in [[docs/21-before-coding-checklist]] and [[docs/22-supabase-setup]]. All code phases are still not started in this documentation-only release.

## How to implement piece by piece

**Never implement everything in one prompt.** Take exactly one issue from `docs/phases/`, satisfy its acceptance criteria, run its tests, then update `docs/14-milestones.md`, `docs/17-decisions.md` and `docs/18-backlog.md` as required. See [[docs/13-development-roadmap]] and [[docs/15-testing-plan]].

**Safety/quality:** Price, legal obligations, room identifiers, extra-bed quantities, cleaning minutes, receipt/tax procedures, and any genuinely safe capacity maximum require explicit owner verification before the relevant feature is released. These are tracked in [[docs/18-backlog]].

## Supabase update — v1.3

**D-035** selects **Supabase for managed PostgreSQL**; recommended supporting services are Supabase Auth and private Supabase Storage. The application **still uses React + separate Express**, and the Royal Horizon UI theme remains approved and unchanged. The setup tasks are in [[docs/22-supabase-setup]], with Phase 01 updated for Supabase CLI/SQL migrations. This ZIP has **not** configured any Supabase resources or written application code.

## Original Claude skills + Codex — v1.4

The original unmodified `greploop`, `scanloop`, and `code-structure` skills are installed under `.agents/skills/`. See [`CODEX-START-HERE.md`](CODEX-START-HERE.md), [`.agents/README.md`](.agents/README.md) and the skill policy in [`AGENTS.md`](AGENTS.md). The real project directories are `frontend/`, `backend/`, `supabase/` (plus optional `packages/shared/`); code still needs to be built.


## Mandatory Codex review and security tools

Read `QUALITY-GATE-SETUP.md`: `.codex/agents/` defines the three independent reviewer roles, `.agents/skills/` preserves the original Claude SKILL.md files, and `scripts/setup-security-tools.ps1` installs Gitleaks/Semgrep/OSV to your Windows machine when run locally. Use `scripts/run-quality-gate.ps1` before completing coding tasks.

