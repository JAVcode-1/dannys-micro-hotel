# Opt-in: applies only to this repository's local Git configuration.
# Git commit then fails closed unless security scan + independent Codex review pass.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $root
try {
    if (-not (Test-Path '.git')) { throw 'First initialize Git for this project (git init).' }
    $existing = & git config --local --get core.hooksPath 2>$null
    if ($existing -and $existing.Trim() -ne '.githooks') {
        throw "Existing hooksPath '$existing' detected. Review/merge existing hooks manually rather than overwriting."
    }
    & git config --local core.hooksPath .githooks
    if ($LASTEXITCODE -ne 0) { throw 'Could not configure Git hooks.' }
    Write-Host 'Local Git pre-commit quality gate enabled. It runs 3 scanners + 3 independent Codex reviews.' -ForegroundColor Green
    Write-Host 'It will increase commit time and Codex token usage. To disable manually: git config --local --unset core.hooksPath' -ForegroundColor Yellow
} finally { Pop-Location }
