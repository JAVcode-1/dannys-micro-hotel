[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$required = @('gitleaks', 'osv-scanner', 'semgrep')
$missing = @()
foreach ($tool in $required) {
    $command = Get-Command $tool -ErrorAction SilentlyContinue
    if (-not $command) { Write-Host "MISSING: $tool" -ForegroundColor Red; $missing += $tool; continue }
    Write-Host "FOUND: $tool at $($command.Source)" -ForegroundColor Green
    if ($tool -eq 'gitleaks') { & gitleaks version }
    else { & $tool --version }
}
$codex = Get-Command codex -ErrorAction SilentlyContinue
if ($codex) { Write-Host 'FOUND: codex CLI' -ForegroundColor Green } else { Write-Warning 'Codex CLI missing: independent scripted reviewer gate cannot run. VS Code Codex extension alone may not provide the codex command.' }
if ($missing.Count -gt 0) { Write-Error "FAILED: required scanner(s) missing: $($missing -join ', ')"; exit 1 }
Write-Host 'All three scanners are installed. This does NOT prove a security scan was run.' -ForegroundColor Cyan
