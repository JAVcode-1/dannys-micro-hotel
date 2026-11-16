# Original Claude skill sources — byte-for-byte preserved

The three `SKILL.md` files in `.agents/skills/` are copied **verbatim** from the user-provided ZIPs (`code-structure.zip`, `scanloop.zip`, `greploop.zip`). Their original YAML frontmatter and Claude-only language are intentionally retained.

Codex discovers repository skills under `.agents/skills/`; use `/skills` and explicit `$code-structure $scanloop $greploop` in coding prompts. Root `AGENTS.md` specifies required timing, truthful execution evidence and safe boundaries. Read `CODEX-START-HERE.md` for details.

**Execution caveats:** `greploop` expects Claude reviewer subagents and automatic Git commits; `scanloop` expects gitleaks, semgrep, osv-scanner and can contact OSV. Codex does not automatically provide those exact facilities. No modifications were made to the skills to disguise the differences. Missing tools or reviewers must be reported, not presented as successful checks. Never auto-commit or use live credentials.

`skills-manifest.json` contains original SHA-256 hashes. Run `scripts/verify-original-skills.ps1` to check integrity.
