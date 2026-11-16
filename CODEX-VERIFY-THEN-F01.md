# Codex verification + first coding task

Open **VS Code Terminal → PowerShell** at the project root. Check tools and original skill integrity:

```powershell
node --version
npm --version
git --version
powershell -NoProfile -File .\scripts\verify-original-skills.ps1
```

**Install the security scanners (one time).** This is a script that installs third-party programs on your own computer. Read it before running it:

```powershell
Get-Content .\scripts\setup-security-tools.ps1
powershell -NoProfile -File .\scripts\setup-security-tools.ps1 -InstallCodexCli
```

Restart the VS Code terminal after installation and verify:

```powershell
powershell -NoProfile -File .\scripts\test-security-tools.ps1
codex --version
```

If a tool cannot be installed, investigate the error; **never mark the security gate as passed**. Semgrep on Windows may require an additional setup or WSL/Docker wrapper; `QUALITY-GATE-SETUP.md` explains the limitations.

Set up a Git repository for change reviews. If your parent folder already has Git, check before running `git init`. For this brand-new replacement baseline:

```powershell
git init
git add .
git commit -m "docs: initial Danny's Micro Hotel planning baseline"
```

Git may ask you to configure your username/email. The initial commit is required for meaningful diff reviews; never include real credentials in Git.

## Verify skill discovery in Codex

Use the **Codex VS Code extension**, open the project root and start a new session. Paste:

```text
Read AGENTS.md, the docs phase 01 F01 acceptance criteria, and the original
.agents/skills/code-structure/SKILL.md,
.agents/skills/scanloop/SKILL.md,
.agents/skills/greploop/SKILL.md.
Confirm each skill's exact path and explain how its requirements are fulfilled
by the installed tools and executable quality-gate scripts.
Do not change application code or claim a scanner/reviewer result yet.
```

## Begin coding

Open `CODEX-FIRST-TASK-PROMPT.md` and paste its **entire contents** into Codex. The project root `AGENTS.md` also requires the actual gate below before a coding task is marked complete:

```powershell
powershell -NoProfile -File .\scripts\run-quality-gate.ps1
```

This quality gate needs a Git diff with uncommitted code, three installed scanners, a signed-in Codex CLI and network access for optional services. It may consume extra Codex tokens. Build/lint/typecheck/test must ALSO pass independently. **Do not mark F01 Done until its acceptance criteria and mandatory checks are verified.**

## After F01

Record actual commands and evidence in `docs/14-milestones.md`, then proceed to F02 (Supabase dev setup) as the phase roadmap directs.
