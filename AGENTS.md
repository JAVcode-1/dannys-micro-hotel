# AI coding agent instructions — Danny's Micro Hotel

The `docs/` Markdown files are the canonical specification. The application has NOT been built by this planning package.

1. Read `00-START-HERE.md`, `docs/02-requirements.md`, `docs/17-decisions.md`, `docs/18-backlog.md`, `docs/09-ui-ux-design-system.md`, `docs/21-before-coding-checklist.md`, and the active `docs/phases/*.md` before changing code.
2. Build **one phase/task at a time**. Do not mark checkboxes done unless code exists, tests pass, and acceptance checks are demonstrated.
3. Confirmed tech: React + TypeScript + Tailwind frontend, **separate** Node.js + Express + TypeScript API, **Supabase-managed PostgreSQL**. Supabase Auth and Storage recommended; confirm specific integrations via phase ADR. Read `docs/22-supabase-setup.md`.
4. User-facing hotel times use 12h AM/PM; store UTC instants with proper timezone conversion (Asia/Manila).
5. Do not create a Family Executive 3-hour package; do not confuse Standard/Family inventory (10/5). One-time ₱100 Family-only extra bed. No automatic per-person surcharge.
6. Online booking is **not confirmed by uploaded screenshot**: actual staff GCash verification and availability-safe finalization are mandatory. Never auto-refund with static QR.
7. Staff users have individual credentials and equal Staff/Admin permissions; always audit actors. Guests may book with/without accounts; no-account access requires email OTP verification.
8. All channels use the same concurrency-safe room capacity engine; physical room assignment may occur after category booking. Hold expiration never releases a submitted-proof pending-review request merely for slow staff action.
9. One reservation may contain independently scheduled room bookings. Room-item cancellations/reschedules/checkout must not modify other room items.
10. The reservation/room/hold/payment/physical-readiness state machines are distinct. Countdown at zero does **not** auto-check out. Walk-in stay starts at recorded staff check-in.
11. No guessed owner data, fake receipt compliance, automatic legal judgments about minors, or unlimited-occupancy promises. Mark unresolved facts as pending and feature-gate where required.
12. Avoid insecure patterns: no browser-trusted pricing, no GCash screenshot-only approval, no double-booking race, no ID-photo persistence by default, no plaintext secrets. Log sensitive actions without exposing payment proof publicly.
13. After a meaningful phase or decision, update `docs/14-milestones.md`, `docs/17-decisions.md`, and `docs/icm/PROJECT-CONTEXT.md`. If ICM/Graphify are installed, update them only after Markdown reflects the change.
14. **Approved UI theme:** Danny's Royal Horizon — primary `#2443B6`, guest CTA `#F97316` with dark navy text, subtle lavender `#EEE9FA`, canvas `#FAFAFD`, text `#17213D`, selected blue `#EAF1FF`; minimal white-sidebar staff dashboard. Do not hard-code old Royal Sunrise values or copy AI mockup rate errors.
15. Report exactly what is implemented, tested, and not implemented. Never claim completion from a plan file.

## Working contract

Provide for each task: changed files, dependency, implementation summary, test evidence, risks, checklist updates, and next task. Ask the owner only when a pending answer blocks safe behavior; otherwise build behind configurable defaults/feature flags with no unsupported assumptions.

## Supabase platform safeguards

- Supabase does **not** replace Express. React may use Supabase Auth for login/OTP but core booking/payments go through Express.
- Use migrations under `supabase/migrations`; **never** use a hosted production database as a test DB.
- `sb_publishable_...` is browser-safe only with proper RLS; secret keys and Postgres connection strings are backend-only. Express still checks actor rights even if its DB user bypasses RLS.
- Keep GCash proof screenshots in a **private Supabase Storage** bucket; don't create publicly accessible URLs.
- Never call Supabase Data APIs separately and assume an availability check plus a booking insert is atomic: use a single DB transaction and locking.


## Development workflow — Build → Quick Test → Fix Critical Issues → Commit → Push → Next Feature

These are the **original, unmodified user-provided Claude skills**, stored verbatim at:
- `.agents/skills/code-structure/SKILL.md`
- `.agents/skills/scanloop/SKILL.md`
- `.agents/skills/greploop/SKILL.md`

1. Implement one documented roadmap feature at a time. Read the active phase task before changing code. Apply `code-structure`'s action/service rules when logic is genuinely shared; do not add layers for one-off logic.
2. After each feature, run `npm run build`, `npm run typecheck`, `npm run lint`, and `npm test`. Fix failing checks and confirmed critical security or correctness defects before proceeding.
3. For authentication, database migrations, reservations, and payments, perform the essential security and authorization checks before using them with real data. Keep migrations unapplied until separately approved; document isolated database and hosted checks that have not run.
4. Review the in-scope diff and staged files for secrets and sensitive data. Commit and push a **development checkpoint** to the current `main` branch after the essential checks pass. A checkpoint does not mark a feature, phase, migration, or deployment Done.
5. Record deferred tests and unresolved findings honestly. Never claim a scanner, independent review, migration test, or hosted acceptance passed when it did not. Do not require a perfect 5/5 independent reviewer score for an ordinary development checkpoint.
6. Reserve the complete scanloop/greploop quality gate and comprehensive testing for major milestones and predeployment verification. Preserve the original skill files and executable security scripts; run them when the gate is required or the task warrants them. Never weaken a security check to obtain a passing result.
7. Update the relevant Obsidian milestone, decision, and context notes. Continue to the next documented feature only when instructed.

See [QUALITY-GATE-SETUP.md](QUALITY-GATE-SETUP.md) for tool setup, skill verification, and full-gate procedures.


## Full quality gate for major milestones and predeployment (D-038)

The three original Claude skill files under `.agents/skills/` remain UNMODIFIED. Current Codex releases support native reviewer subagents.

Before marking a major milestone or predeployment gate Done:

1. Read original `code-structure`, `scanloop`, and `greploop` files; implement one documented phase item.
2. Run build/typecheck/lint/tests for affected frontend/backend components; record actual results.
3. Execute `powershell -NoProfile -File .\scripts\run-scanloop.ps1`. Missing required scanners, scanner errors or scan findings BLOCK completion. A local Semgrep starter ruleset has limited coverage; do not describe it as a comprehensive scan.
4. **Run 3 independent read-only Codex reviews** (correctness, security, quality) for original greploop. Native Codex subagents defined at `.codex/agents/greploop_{correctness,security,quality}.toml` are available during interactive sessions; the reproducible scripted baseline is `powershell -NoProfile -File .\scripts\run-greploop-review.ps1`, which uses 3 separate authenticated Codex CLI sessions. The scripted reviews are the mandatory evidence gate; native interactive reviewers are optional additional assurance, not a substitute for the executable gate. No need to run duplicate native reviewers if CLI gate was run. Verify findings, fix confirmed issues, rerun scans/tests/review up to 5 iterations. If sessions cannot run, status is **BLOCKED / REVIEW NOT PERFORMED**, never fake consensus.
5. The executable `powershell -NoProfile -File .\scripts\run-quality-gate.ps1` requires installed scanners AND independent Codex CLI review. For a major milestone or predeployment gate, it MUST exit 0, and code-specific tests must also pass. Do not fake a report or mark the milestone Done if a check is missing.
6. Follow the GitHub workflow below after successful verification; never disclose secrets. Security tools run only on local repository; **OSV sends dependency names and versions to its vulnerability service by default** unless separately configured for offline mode. Scanner setup performs network installs only when the user executes the setup script. Independent Codex CLI reviews use the user's authenticated Codex service and may transmit project code to that service under the user's configured privacy settings.

## GitHub workflow after each verified development checkpoint

The project owner has approved this workflow for future completed development tasks. Apply it without requesting repeat authorization.

1. Run and record `npm run build`, `npm run typecheck`, `npm run lint`, and `npm test`. Fix failures and confirmed critical security or correctness issues. For sensitive features, record essential authorization and security checks. A full quality gate is required for major milestones and predeployment, not ordinary development checkpoints.
2. Update only the relevant Obsidian milestone and decision/context documents. Mark checklist items Done only when their acceptance evidence exists; keep unapplied migrations and deferred tests pending.
3. Inspect `git status` and review the complete in-scope diff, including untracked files. Keep unrelated or unfinished work out of the commit.
4. Check the proposed staged content for `.env` files, passwords, API secrets, Supabase credentials, payment proofs, guest data, and other sensitive files. Never stage or commit them. `.env.example` may contain placeholders only.
5. Stage only files for the completed task using explicit paths. Review the staged diff and staged file list before committing.
6. Create a descriptive Conventional Commit for the development checkpoint, then push that commit to the existing `origin` GitHub remote on `main`. Do not switch branches or force-push as part of this workflow.
7. Confirm the push succeeded by checking the command result and remote branch state. Report the commit and push result. If the push fails, report it and leave the local commit intact for resolution.

Read `QUALITY-GATE-SETUP.md` for the one-time Windows setup, review scoring and diagnostics.
