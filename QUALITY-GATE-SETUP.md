# Codex greploop + scanloop quality gate — Windows setup

The original Claude `SKILL.md` files are preserved under `.agents/skills/`. In Codex, use `/skills` to check discovery. The verifier compares file hashes with `.agents/skills-manifest.json`. Follow [AGENTS.md](AGENTS.md) for the development checkpoint and full quality-gate requirements.

Before running the full quality gate in a fresh clone, copy the original skill files into the local `.agents/skills/` directory.

## Run once in VS Code PowerShell

```powershell
# Inspect this script before executing it; it installs external tools to your local Windows machine.
powershell -NoProfile -File .\scripts\verify-original-skills.ps1
Get-Content .\scripts\setup-security-tools.ps1
powershell -NoProfile -File .\scripts\setup-security-tools.ps1 -InstallCodexCli
```

The installer uses WinGet: `Gitleaks.Gitleaks`, `Google.OSVScanner`, `astral-sh.uv`; and `uv tool install --python 3.12 semgrep` (Semgrep native Windows beta). The optional `-InstallCodexCli` installs `@openai/codex` globally through npm if needed. **It may require Internet access and system prompts.** Reopen VS Code after installation. If Semgrep native Windows beta fails, install it in WSL or use Docker, but the provided runner expects a working `semgrep` command in PowerShell; set up an explicit wrapper before declaring it ready.

```powershell
powershell -NoProfile -File .\scripts\test-security-tools.ps1
codex --version
# Sign into Codex CLI if required:
codex
```

## Full gate for major milestones and predeployment

```powershell
# Run the relevant build / lint / tests first. Then:
powershell -NoProfile -File .\scripts\run-quality-gate.ps1
```

This executes **Gitleaks**, **Semgrep** (pinned local rule file and metrics off), **OSV** (for detected JS lockfiles), and **three independent `codex exec --sandbox read-only` reviews** with JSON reports in `.quality/reviews/`. If a tool is missing, a scanner finds a problem, or reviewers find a blocking/major issue, it exits nonzero. Fix confirmed problems and rerun, at most five review iterations per original greploop.

Run the gate on uncommitted source changes. The three independent CLI sessions use your Codex login. Native reviewer agents can provide additional assurance alongside the required scripted evidence.

## Limitations and privacy

- Semgrep pinned local YAML is a small offline starter pack, **not the full Semgrep community registry coverage** in the Claude original. Add reviewed local rules as the security program matures; don't assert that all application vulnerabilities were checked.
- OSV-Scanner normally sends dependency package names and versions to OSV.dev; configure its offline database mode separately if network-free checks are required.
- Gitleaks output is redacted; never upload raw report data or real `.env` files.
- Independent CLI Codex reviewers send source context to the configured Codex service. Use your organization's approved confidentiality settings.
- The `run-greploop-review.ps1` uses `git status` to review the current uncommitted changes, including untracked code; Git needs to be initialized first.
- The quality gate does not itself replace real tests or a human production deployment review.

## Original skills and supported substitutions

| Original requirement | Codex route |
| --- | --- |
| code-structure | Unmodified skill read through `.agents/skills/` |
| scanloop's scanners | WinGet/uv installer + fail-closed PowerShell scan script |
| greploop's 3 Claude subagents | 3 native Codex custom reviewers or 3 independent Codex CLI sessions |
| original review loop | Main Codex agent fixes and repeats scan/review, maximum 5 iterations |
| no fake results | Scanners/reviewer script exits nonzero if requirements unmet |

## Optional hard enforcement on every Git commit

For a brand-new repository, create your initial documentation/tooling baseline commit **before enabling the hook**, then run the gate against subsequent feature changes. The **optional pre-commit hook** will block `git commit` unless real scans and 3 independent Codex CLI reviews pass. First ensure your editor's Git is initialized and your Codex CLI is logged in. Then enable:

```powershell
powershell -NoProfile -File .\scripts\install-quality-git-hook.ps1
```

A commit triggers the checks; this adds runtime and Codex token usage to every commit. If your repo already has custom Git hooks, the installer refuses to overwrite them. Disable with `git config --local --unset core.hooksPath`. Hooks can be bypassed by Git flags or users with filesystem control, so they are a local developer guardrail, not an unbreakable security boundary; CI policies are needed for enforced team-wide guarantees.
