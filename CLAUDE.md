# Claude compatibility guidance (read-only shim)

This file exists because the ORIGINAL unmodified `greploop` SKILL.md instructs reviewer agents to load `CLAUDE.md`.

Read [`AGENTS.md`](AGENTS.md) as the authoritative house rules for this repository, together with relevant `docs/` specifications. The approved design tokens are in `docs/09-ui-ux-design-system.md`.

- Preserve the user-provided `.agents/skills/*/SKILL.md` files without modification.
- Never auto-commit, auto-push, or stash project work; ask for explicit approval.
- Use real evidence; do not claim Claude reviewer subagents/scanners ran if unsupported or unavailable.
- Keep the React app in `frontend/`, Express API in `backend/`, SQL migrations in `supabase/migrations/`, and optional shared types in `packages/shared/`.
- No unapproved Family Executive 3-hour package; no client-trusted payments or inventory.
