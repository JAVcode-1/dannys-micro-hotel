---
tags: [pre-coding, checklist, phase-00, project-management]
status: ready-for-phase-01-with-open-items
owner: project-team
version: 1.3
updated: 2026-11-12
---
# 21 — Before Coding: Project Readiness Checklist

> [!success] Development decision
> Planning is **sufficient to start Phase 01**. F01 is complete and F02 is under quality-gate review; F03 has not started. Don't delay workspace setup for owner details needed in later phases. Use the blockers table below to decide when an answer is genuinely required.

## A. Minimum checklist BEFORE Phase 01 / F01

All items here are documentation/workstation preparation. Check them on the real developer machine; do **not** mark them done just because this page exists.

### PC-01 — Place the documents in the actual project repository (required)
- [ ] Extract this ZIP and keep `docs/`, `assets/`, `AGENTS.md`, `00-START-HERE.md` and `.obsidian/` together in the project root.
- [ ] Open the root folder in VS Code; in Obsidian choose **Open folder as vault**, selecting the same root.
- [ ] Make an initial Git commit containing the documentation baseline; do not commit payment proofs, private guest data, passwords, `.env`, or production GCash details.
- [ ] Use the Markdown files as the canonical specification; ICM stores helpful context, Graphify indexes code once built. Neither one is automatically linked by this ZIP.

**Exit evidence:** Links open in Obsidian, the project is visible in VS Code and a Git documentation baseline commit exists.

### PC-02 — Verify local development prerequisites (required)
- [ ] Check installed Node.js LTS/version supported by the chosen Vite/React/Express dependencies (`node -v`).
- [ ] Check Git, npm (or selected package manager) and editor (`git --version`, `npm -v`).
- [ ] Plan Supabase development connectivity: **either** Supabase CLI + Docker-compatible local stack **or** a separate hosted Supabase **development** project. You do **not** need a native PostgreSQL installation if using hosted Supabase. See [[22-supabase-setup]].
- [ ] Confirm enough disk space for dependencies, database and build artifacts.
- [ ] Decide local `.env` convention and prepare `.env.example` *during Phase F01*; don't paste secrets into docs or chat logs.

**Exit evidence:** Node/npm/Git versions recorded; Supabase development strategy selected (actual DB connectivity required in **F02**, not F01).

### PC-03 — Align technical implementation choices (required, may be decided IN F01)
- [ ] Confirm folder shape: `frontend`, `backend`, `packages/shared`, `docs`, `assets`.
- [ ] Adopt one repo package manager and lockfile; record a short decision (ADR) before first dependency installation.
- [ ] Adopt **Supabase CLI versioned SQL migrations**; prefer `pg` for explicit PostgreSQL transactions. If adding Prisma/Drizzle, record an ADR and prove lock/constraint behavior in tests.
- [ ] Choose tests: frontend unit/components, API integration with a test DB, and end-to-end flows; define CI typecheck/lint/test scripts.
- [ ] Decide development/staging/production environment separation; **never use real guest or GCash payment records in development**.

**Exit evidence:** Decisions logged to [[17-decisions]] / ADR during F01 and reproducible start commands recorded.

### PC-04 — Confirm Phase 01 acceptance gate (required)
- [ ] Read [[phases/00-phase-gates]] and [[phases/01-foundation-and-tooling]].
- [ ] Select **Task F01** only; do not jump to checkout/payment/online booking yet.
- [ ] Confirm target: React placeholder page, Express `/health`, strict TypeScript, shared types, root scripts, lint and env template.
- [ ] Agree on visible evidence for completion: both apps run locally, a passing typecheck and basic smoke check, commit/PR and checklist update.

**Exit evidence:** F01 task scope and expected test results stated before code changes.

## B. Important inputs to collect BEFORE their relevant feature/pilot (do not block F01)

| ID | Owner input | Must be resolved before | Safe action meanwhile |
|---|---|---|---|
| P01 | Actual 15 physical room numbers/identifiers | Phase 03 physical inventory release / pilot | Fake test IDs clearly marked test-only |
| P02 | Configured cleaning/turnover buffer minutes | Availability/housekeeping live use | Keep nullable/configurable; do not invent owner-approved default |
| P03 | Official, permission-cleared logo and reusable hotel/room photos | Public guest-facing release | Temporary illustrative images with clear license and placeholder labels |
| P04 | Hotel GCash QR, verified payee identity and manual proof-review process | Phase 05 live online payment | Dummy QR/test transfer reference only |
| P05 | Staff email accounts, OTP deliverability/provider and account recovery procedure | Phase 02 live account rollout | Dev-only mail sink; don't send test OTP to real guests |
| P06 | Legal/safety occupancy limits, minors' check-in policy, privacy/retention/consent, smoking/cancellation terms | Production guest registration/payment | Staff review/feature gate, qualified compliance advice |
| P07 | Receipt/tax requirements and refund payout procedure | Real payment/checkout | Label draft as internal transaction record, not official receipt |
| P08 | Extra bed stock/quantity (₱100 once per continuous Family stay, count pending) | Family extra bed live reservations | Offer one test option only, don't promise unlimited stock |
| P09 | Staff testing schedule, actual devices/network, restore and manual outage log process | Phase 09 pilot | Simulated outage and reconciliation drill |

The detailed list is in [[18-backlog]]. **Never silently assume** unresolved information, especially legal or monetary rules.

## C. Recommended tools and system boundaries

| Tool | Planned purpose | Initial action |
|---|---|---|
| **VS Code** | Write/debug code; browse Markdown | Open project root |
| **Obsidian** | Read requirement links, phase tasks, decision log | Open same folder as vault; use Mermaid preview |
| **Git/GitHub** | Version control and change review | Commit docs baseline, later one task per PR/commit |
| **Graphify** | Optional code graph after implementation exists | Use existing `docs/graphify/*.mmd`; actual repo indexing later |
| **ICM** | Optional persistent memory for task handoffs | Read `docs/icm/PROJECT-CONTEXT.md`; initialize only if tool installed |
| **Supabase PostgreSQL** | Reservation, hold, payment and room state | Isolated development DB and migrations in F02 |
| **Supabase Auth (recommended)** | Individual staff identity and verified guest OTP | Configure in Phase 02 |
| **Supabase Storage (recommended)** | Private payment proof images; optional public hotel media | Configure bucket policies before real uploads |

> [!important] Obsidian is NOT the database
> The Obsidian vault is editable project documentation; **Supabase-managed PostgreSQL** stores live hotel data. Graphify/ICM don't replace tests, Git history or database migrations.

## D. Exact first coding task — F01

- [ ] Create a Git workspace with `frontend`, `backend`, `packages/shared`.
- [ ] React + TypeScript + Tailwind UI shell that uses **Royal Horizon** token names (see [[09-ui-ux-design-system]]).
- [ ] Express + TypeScript API with `/health` response.
- [ ] Strict shared TypeScript contracts, ESLint/formatter, root run/test scripts, `.gitignore`, `.env.example`.
- [ ] Run both applications locally; verify typechecks.
- [ ] Record code files, executed commands, results and commit under [[14-milestones]].

**Do not start Phase 02 until F01/F02/F03 pass their exit gates.** See [[13-development-roadmap]].

## E. Pre-coding meeting decision and live progress

| Item | Status as of 2026-11-17 |
|---|---|
| Hotel operation rules baseline | Recorded in [[02-requirements]] |
| Architecture and schema concepts | Drafted; still to be validated during implementation |
| Stack | **Approved:** React/TypeScript/Tailwind; Node/Express/TypeScript; **Supabase PostgreSQL** (D-035) |
| Digital UI theme | **Approved by project requester:** Danny's Royal Horizon |
| Dev tools on user's own computer | **Unverified**; follow PC-02 |
| Project Git repository and local app setup | Git repository and F01 app setup evidenced; remaining workstation checklist items are still open |
| Phase 01 coding | F01 complete; F02 under quality-gate review; F03 not started |

### When a checklist item is completed

Change `[ ]` to `[x]` only after observed evidence, add `date`, `owner`, `evidence` (command output or commit), and next action to [[14-milestones]]. Use [[17-decisions]] to record **new choices**, not fabricated approvals.

## F02 platform-specific prerequisites (after F01, before Phase 02)

- [ ] Follow [[22-supabase-setup]] and use the existing hosted development project approved for F02 by D-040.
- [ ] Choose direct or session-pooled Postgres connection for the actual Express host/network; don't hardcode guessed server names.
- [ ] Record migration target, SQL migration file and forward-recovery strategy. Fresh isolated reset evidence is explicitly deferred by D-040, not passed.
- [ ] Configure placeholder URLs/keys in `.env.example` **without real credentials**.
- [ ] Verify that frontend receives no `SUPABASE_SECRET_KEY` or `DATABASE_URL`.
- [ ] Test a backend-only database connection and a denied anonymous business write.

**Development gate:** F01 can begin without a Supabase project; complete the items above before declaring F02 done.

## PC-05 — Original Claude skills configured for Codex (new pre-coding check)

- [ ] Verify original SHA-256 hashes using `./scripts/verify-original-skills.ps1`.
- [ ] Open VS Code at the repository root and confirm Codex skill discovery via `/skills` or an explicit `$code-structure $scanloop $greploop` prompt.
- [ ] Ensure `AGENTS.md` persistent policy is read before editing application source.
- [ ] Determine whether Gitleaks, Semgrep and OSV-Scanner are installed and permitted; record any missing/unsupported checks (never claim scans passed if they did not run).
- [ ] Establish a Git baseline and review execution/commit permissions; the original greploop includes auto-commit behavior that **must not** run without user approval.

See [QUALITY-GATE-SETUP.md](../QUALITY-GATE-SETUP.md) and the [repository skills guide](../.agents/README.md). This check is not evidence of an implemented application.
