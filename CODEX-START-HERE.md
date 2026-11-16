# START HERE — Original Claude skills in Codex / Danny's Micro Hotel

## What this final project contains

- Original, byte-identical `SKILL.md` files from the three user-provided Claude ZIP files.
- The **complete v1.3 Supabase + Royal Horizon Obsidian vault** (with only folder-path references normalized to match the user's real `frontend/` and `backend/` directories).
- `.agents/skills/` for native Codex discovery, a root `AGENTS.md` policy to require the workflow, and a `CLAUDE.md` compatibility shim to satisfy original greploop house-rule lookup.
- Empty source folders (`frontend`, `backend`, `supabase/migrations`, `packages/shared`) ready for Phase 01. **No application source has been installed**.

## Install/merge safely on your Windows computer

1. In VS Code **back up or commit the current `Dannys-Micro-Hotel` directory**. The downloaded archive is a full baseline, not a patch and cannot see any local files you might have already changed.
2. Extract this ZIP. Its top-level folder is named `Dannys-Micro-Hotel`. If you have newer local content, compare and **merge**, not blindly overwrite; in particular preserve any local `frontend`, `backend`, `supabase`, `.env`, `.obsidian` and changed notes.
3. Open the repository root `Dannys-Micro-Hotel` in VS Code (not `frontend/` alone). Open the same folder as the Obsidian vault.
4. Check that `.agents/skills/{code-structure,scanloop,greploop}/SKILL.md` each exists. Enable showing hidden dot folders in VS Code if needed.
5. In PowerShell at the project root, run `./scripts/verify-original-skills.ps1` to compare SHA-256 hashes with the uploaded original skill archives (expected hashes recorded in `.agents/skills-manifest.json`). The script does not run any skill commands.
6. Restart/refresh your Codex VS Code session. You can use `/skills` in Codex to check discovery and use `$code-structure`, `$scanloop`, `$greploop` in prompts to explicitly select them. Codex also reads `AGENTS.md` for repo instructions.
7. Paste `CODEX-FIRST-TASK-PROMPT.md` into Codex to begin **Phase 01 F01** after confirming Node/npm/Git readiness.

## Critical reality check

There is **no reliable switch that forces an AI assistant to truly execute every instruction**. Our repo's `AGENTS.md` strongly requires reading the original skills each coding task and an explicit `$skill` prompt maximizes activation, but external tools and agent features still have to exist.

The original `greploop` expects **Claude-only reviewer subagents** and contains **automatic commit/PR checkout** instructions; the original `scanloop` expects installed **gitleaks, semgrep, osv-scanner**. You asked that the skill files remain exact, so we have **not edited their contents**. The project policy requires truthful fallback reporting and forbids unsolicited Git changes; a scan not performed must not be reported as clean. Semgrep may require WSL or Docker on Windows.

Before claiming security validation, install and configure tools separately and verify permitted network/telemetry settings. Do not enable automatic external scans or third-party downloads without reviewing them.

## Order of work

1. PC-01–PC-04 preflight (`docs/21-before-coding-checklist.md`), including Git baseline.
2. Phase 01 F01: scaffold React + Tailwind frontend, Express backend, shared TypeScript types, health endpoint.
3. Phase 01 F02: connect to **isolated** Supabase dev project and apply controlled SQL migrations.
4. Phase 01 F03: automatic lint, type-check, test and build gates.
5. Update Obsidian milestones **only after evidence**. Never pretend the app is implemented because the documentation exists.

Documentation is the source of truth. Graphify diagrams and ICM context are prepared, not live integrations.
