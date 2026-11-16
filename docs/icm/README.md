---
tags: [icm, memory]
status: prepared-not-installed
---
# ICM — Persistent Memory Preparation

**No ICM database is installed or created by this ZIP.** The documentation here is an explicit project handoff; it can be seeded into `rtk-ai/icm` once you install ICM on your Windows development PC.

## What belongs where

| Source | Purpose |
|---|---|
| `docs/02-requirements.md`, `docs/17-decisions.md` | Canonical approved facts/decisions |
| `docs/13-development-roadmap.md`, `docs/14-milestones.md` | Planned phases and current completion |
| `docs/icm/PROJECT-CONTEXT.md` | Concise session-onboarding context |
| ICM `memories.db` (created locally after installation) | Recallable session facts/errors/choices, not replacement for Markdown |

## Windows setup (after user installs the tool)

Official ICM guide: <https://github.com/rtk-ai/icm/blob/main/docs/guide.md>.

1. Install the binary using the **current official Windows installation instructions** (review before executing any remote PowerShell script).
2. Open PowerShell in the project root and run `icm init --per-project` to create a local project-specific ICM configuration/database.
3. Inspect `docs/icm/seed-memory.ps1` before running it; this optional script seeds **selected durable facts**, not private guest data.
4. `powershell -ExecutionPolicy Bypass -File .\docs\icm\seed-memory.ps1` (only if you trust the inspected script and installed CLI).
5. Verify: `icm recall "hotel package Family Executive"` and `icm topics`.
6. At start of each AI coding session, search memory (`icm recall "current phase and decisions"`) and read [[PROJECT-CONTEXT]] and [[14-milestones]].
7. When a new decision or important bug fix is made, **update Markdown first**, then `icm store -t "decisions-staytrack" -c "..." -i high` or `icm store -t "errors-resolved" -c "..." -i medium`.

## Important

`icm init --per-project` creates tool-owned `.icm/` files, which are intentionally **not fabricated** here. If an older ICM version does not support a listed flag, check its `icm --help` / `icm store --help` before running the seed commands.

Do not store customer identity, OTPs, IDs, real GCash payment references, passwords, proof files, or sensitive personal data in ICM. Do not assume the local memory database auto-updates simply because Markdown changes.
