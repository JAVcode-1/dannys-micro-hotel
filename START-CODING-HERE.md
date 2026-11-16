# START HERE — Ready for Phase 01 Coding

**Project folder:** `Dannys-Micro-Hotel`  
**Package:** Final replacement baseline (2026-11-12)  
**Status:** Documentation, Codex configuration and development tooling scripts included; hotel application code NOT yet installed.

## Safe replacement on your laptop

1. **Before deleting your old folder, preserve a backup copy** if it contains any edits, local Git history, screenshots, `.env` files, or other work. A downloaded ZIP cannot recover those files.
2. Download **only** `Dannys-Micro-Hotel_FINAL_Ready_For_Coding.zip` and extract it to the parent directory where you want your project. The archive already contains **one top-level `Dannys-Micro-Hotel/` folder**. Avoid nesting it within another folder of that name.
3. In **VS Code → File → Open Folder**, open `Dannys-Micro-Hotel/` (the project root).
4. In **Obsidian → Open folder as vault**, select that same root; navigate from `00-START-HERE.md`.
5. Use `CODEX-VERIFY-THEN-F01.md` for the one-time setup and your first Codex prompt.

## What is in this ZIP

- `.obsidian/`, `docs/`: the approved Obsidian planning vault, Phase 01–09 checklist, hotel requirements, data/architecture diagrams, Supabase planning, and **Danny's Royal Horizon** palette.
- `.agents/skills/{code-structure,greploop,scanloop}/SKILL.md`: **original, byte-identical user-provided skills**, with no edits.
- `AGENTS.md`, `CLAUDE.md`, `.codex/`: Codex instructions and three independent reviewer profiles.
- `scripts/`: hash verifier, **Windows scanner installer**, security scan runner, independent Codex review runner and quality gate.
- `frontend/`, `backend/`, `supabase/migrations/`, `packages/shared/`: EMPTY source scaffolds ready for F01. `node_modules/` and application dependencies are intentionally not included.

## Important reality check

- Extracting the ZIP does **not** install React, Node.js, Express, Supabase, Gitleaks, Semgrep, OSV-Scanner or Codex CLI on your computer. Follow the setup commands in `CODEX-VERIFY-THEN-F01.md`.
- Supabase Cloud project, real GCash QR, passwords and secret keys are **not included**. Set these up later according to the documented phase.
- The original Claude skill instructions have not been modified. Codex uses companion project rules and independent Codex reviewer sessions where Claude-only tools are unavailable. Reviews and scanners have to run successfully; instructions alone cannot magically force execution.
- Security scans, reviewer checks and the F01 application build **have not been executed on your Windows computer**. Never mark them passed without local evidence.

## First coding milestone

**Phase 01 / F01:** create the React + TypeScript + Tailwind frontend, Express + TypeScript `/health` API and shared workspace tooling. Read `docs/phases/01-foundation-and-tooling.md`; do not implement reservations/GCash or provisioning until their respective phases.
