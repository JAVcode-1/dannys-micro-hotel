## Codex native reviewer agents + executable quality gate (D-038)

The three original Claude skill files under `.agents/skills/` remain UNMODIFIED. Current Codex releases support native reviewer subagents.

Before marking ANY coding or migration task Done:

1. Read original `code-structure`, `scanloop`, and `greploop` files; implement one documented phase item.
2. Run build/typecheck/lint/tests for affected frontend/backend components; record actual results.
3. Execute `powershell -NoProfile -File .\scripts\run-scanloop.ps1`. Missing required scanners, scanner errors or scan findings BLOCK completion. A local Semgrep starter ruleset has limited coverage; do not describe it as a comprehensive scan.
4. **Run 3 independent read-only Codex reviews** (correctness, security, quality) for original greploop. Native Codex subagents defined at `.codex/agents/greploop_{correctness,security,quality}.toml` are available during interactive sessions; the reproducible scripted baseline is `powershell -NoProfile -File .\scripts\run-greploop-review.ps1`, which uses 3 separate authenticated Codex CLI sessions. The scripted reviews are the mandatory evidence gate; native interactive reviewers are optional additional assurance, not a substitute for the executable gate. No need to run duplicate native reviewers if CLI gate was run. Verify findings, fix confirmed issues, rerun scans/tests/review up to 5 iterations. If sessions cannot run, status is **BLOCKED / REVIEW NOT PERFORMED**, never fake consensus.
5. The executable `powershell -NoProfile -File .\scripts\run-quality-gate.ps1` requires installed scanners AND independent Codex CLI review. Before completing any coding phase, it MUST exit 0, and code-specific tests must also pass. Do not fake a report or mark the milestone Done if a check is missing.
6. No automatic Git commits/pushes or secrets disclosure. Security tools run only on local repository; **OSV sends dependency names and versions to its vulnerability service by default** unless separately configured for offline mode. Scanner setup performs network installs only when the user executes the setup script. Independent Codex CLI reviews use the user's authenticated Codex service and may transmit project code to that service under the user's configured privacy settings.

Read `QUALITY-GATE-SETUP.md` for the one-time Windows setup, review scoring and diagnostics.
