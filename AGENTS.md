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


## Mandatory original Claude skills — Codex project workflow (D-037)

These are the **original, unmodified user-provided Claude skills**, stored verbatim at:
- `.agents/skills/code-structure/SKILL.md`
- `.agents/skills/scanloop/SKILL.md`
- `.agents/skills/greploop/SKILL.md`

**For EVERY source-code implementation, bug fix, refactor, or database migration task in this repository:**

1. **Before editing code**, read ALL THREE `SKILL.md` files, read the relevant `docs/phases/` task, and apply `code-structure`'s action/service responsibility rules where its extraction trigger fits. Do not create artificial service layers for one-off logic.
2. **After implementing**, execute real project build/typecheck/test/lint gates when configured. Then apply the ORIGINAL `scanloop` procedures, running installed scanners where available, with version-appropriate commands; do not silently skip checks. If no scanner executes, write **SCAN NOT PERFORMED** and DO NOT claim a clean security scan. Never install security tools, contact outside services, or transmit source/secrets without approval.
3. **Before declaring any coding task complete**, apply the ORIGINAL `greploop` review criteria: changed files in full, related callers, correctness, security/contracts, and quality/testing, logging all blocking/major findings and fixing confirmed issues. Use available independent Codex reviewer agents when supported; **Claude-only subagent types are not natively guaranteed in Codex**. If unavailable, explicitly label the result **single-agent review / independent panel unavailable**, and NEVER claim a three-agent panel or 5/5 agreement that did not occur. Follow its five-iteration cap when an actual loop is feasible.
4. Report the skill name and exact file path read, scanners actually run/skipped and why, reviewers actually used, tests actually run, remaining findings and milestone status. If a mandatory gate cannot run, mark it **BLOCKED / UNVERIFIED**, not Done.
5. After a completed development task passes all mandatory gates, follow the GitHub workflow below without asking again. Do not commit or push blocked or unverified work. Do not automatically merge, checkout a PR, or stash working files. Do not change the original skill files; this project-specific policy controls Codex actions.
6. For the initial folder/git bootstrap when no baseline diff exists, perform the non-destructive checks that are possible, log the absence of a base branch or installed scanners, and mark review steps honestly **PENDING** until a proper baseline exists. Never fabricate a clean diff.
7. The original skills are preserved exactly, including Claude-specific terms and external scanner/tool requirements. **Where an exact instruction is impossible in Codex, do not pretend it ran.** Follow the remaining applicable steps and clearly record the limitation. No instruction file can technically guarantee that an AI agent obeys all steps: for the strongest triggering, explicitly mention `$code-structure $scanloop $greploop` in your Codex coding prompt.

**Start new coding tasks with:** `Read AGENTS.md and $code-structure $scanloop $greploop (original files). Work only on the active phase task. Do not mark Done without genuine scan + review + tests; report any missing tools.`

See `CODEX-START-HERE.md` for exact setup/validation and `CODEX-FIRST-TASK-PROMPT.md` for the first coding prompt.


## Codex native reviewer agents + executable quality gate (D-038)

The three original Claude skill files under `.agents/skills/` remain UNMODIFIED. Current Codex releases support native reviewer subagents.

Before marking ANY coding or migration task Done:

1. Read original `code-structure`, `scanloop`, and `greploop` files; implement one documented phase item.
2. Run build/typecheck/lint/tests for affected frontend/backend components; record actual results.
3. Execute `powershell -NoProfile -File .\scripts\run-scanloop.ps1`. Missing required scanners, scanner errors or scan findings BLOCK completion. A local Semgrep starter ruleset has limited coverage; do not describe it as a comprehensive scan.
4. **Run 3 independent read-only Codex reviews** (correctness, security, quality) for original greploop. Native Codex subagents defined at `.codex/agents/greploop_{correctness,security,quality}.toml` are available during interactive sessions; the reproducible scripted baseline is `powershell -NoProfile -File .\scripts\run-greploop-review.ps1`, which uses 3 separate authenticated Codex CLI sessions. The scripted reviews are the mandatory evidence gate; native interactive reviewers are optional additional assurance, not a substitute for the executable gate. No need to run duplicate native reviewers if CLI gate was run. Verify findings, fix confirmed issues, rerun scans/tests/review up to 5 iterations. If sessions cannot run, status is **BLOCKED / REVIEW NOT PERFORMED**, never fake consensus.
5. The executable `powershell -NoProfile -File .\scripts\run-quality-gate.ps1` requires installed scanners AND independent Codex CLI review. Before completing any coding phase, it MUST exit 0, and code-specific tests must also pass. Do not fake a report or mark the milestone Done if a check is missing.
6. Follow the GitHub workflow below after successful verification; never disclose secrets. Security tools run only on local repository; **OSV sends dependency names and versions to its vulnerability service by default** unless separately configured for offline mode. Scanner setup performs network installs only when the user executes the setup script. Independent Codex CLI reviews use the user's authenticated Codex service and may transmit project code to that service under the user's configured privacy settings.

## GitHub workflow after every completed development task

The project owner has approved this workflow for future completed development tasks. Apply it without requesting repeat authorization.

1. Run and record the required task-specific tests, builds, TypeScript/lint checks, security scans, and independent code reviews. The mandatory quality gate must pass. If any required check fails or cannot run, report the blocker; do not commit or push.
2. Update only the relevant Obsidian milestone and decision/context documents after successful verification. Mark checklist items Done only when their acceptance evidence exists.
3. Inspect `git status` and review the complete in-scope diff, including untracked files. Keep unrelated or unfinished work out of the commit.
4. Check the proposed staged content for `.env` files, passwords, API secrets, Supabase credentials, payment proofs, guest data, and other sensitive files. Never stage or commit them. `.env.example` may contain placeholders only.
5. Stage only files for the completed task using explicit paths. Review the staged diff and staged file list before committing.
6. Create a descriptive Conventional Commit for the completed task, then push that commit to the existing `origin` GitHub remote on the current development branch. Do not switch branches or force-push as part of this workflow.
7. Confirm the push succeeded by checking the command result and remote branch state. Report the commit and push result. If the push fails, report it and leave the local commit intact for resolution.

Read `QUALITY-GATE-SETUP.md` for the one-time Windows setup, review scoring and diagnostics.
