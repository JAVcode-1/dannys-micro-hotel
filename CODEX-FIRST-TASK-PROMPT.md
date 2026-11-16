# Paste into Codex — Phase 01 / F01 (after skill verification)

$code-structure $scanloop $greploop

You are the implementation engineer for the **Danny's Micro Hotel Reservation & Management System**. Start **Phase 01 F01 only**, in the existing opened `Dannys-Micro-Hotel` repository.

MANDATORY PRE-READ: Read `AGENTS.md`, `CLAUDE.md`, **the ORIGINAL user-provided** `.agents/skills/code-structure/SKILL.md`, `.agents/skills/scanloop/SKILL.md`, `.agents/skills/greploop/SKILL.md`, `docs/05-tech-stack.md`, `docs/09-ui-ux-design-system.md`, `docs/21-before-coding-checklist.md`, `docs/phases/01-foundation-and-tooling.md`, and `docs/17-decisions.md`.

1. Inspect existing files FIRST. Preserve all user data and documents. Follow the actual root folder convention: **`frontend/` (React/Vite/TypeScript/Tailwind), `backend/` (Node.js/Express/TypeScript), `supabase/migrations/` (future SQL migration scripts), `packages/shared/` (optional shared contracts).** Do not create a competing `apps/web` or `apps/api` tree.
2. Implement only the **F01 foundation**: React scaffold with Royal Horizon CSS tokens, clean responsive placeholder, Express `/health` API, strict TypeScript, environment variable examples without secrets, practical root scripts, minimal shared types. Do NOT build hotel booking/payment/auth features or Supabase resources in F01.
3. Observe the ORIGINAL code-structure rules: business policy stays in action/orchestration; reusable mechanics belong in services only when they are actually reused, and don't build premature abstractions.
4. Run real install/build/lint/typecheck/health validations. Apply the ORIGINAL scanloop after changes using actually installed and approved scanners; if none execute, print `SCAN NOT PERFORMED` as a blocking security verification, not `clean`.
5. Apply the ORIGINAL greploop as closely as your Codex environment actually supports: inspect changed files in full, caller references, maintain ledger, use independent reviewer agents only when available and identify the actual reviewer method. Never fabricate a three-Claude-subagent verdict. Never automatically commit/stash/push or modify Git history without my approval, regardless of what the original skill says.
6. Update `docs/14-milestones.md` and the relevant phase checklist only with evidence from executed commands. If scanner/reviewer tools are missing, report the exact blocker and do not declare F01 fully verified.

Before coding, summarize the identified F01 acceptance criteria, tool availability and working tree status briefly; then proceed with implementation within the stated scope. At the end, report changed files, checks actually executed, missing checks, risks and the next exact task.

## Mandatory execution gate for this final release

After code changes, execute `powershell -NoProfile -File .\scripts\run-quality-gate.ps1` which invokes real installed `scanloop` security scanners plus three independent Codex CLI reviewers for `greploop`; also run frontend/backend build, lint and tests. A missing tool, failed scan or failed review means **F01 BLOCKED/UNVERIFIED** until resolved. Do not claim success without evidence.
