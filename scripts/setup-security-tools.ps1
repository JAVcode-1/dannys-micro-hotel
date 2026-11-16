# Installs required scanners on the LOCAL Windows computer when the user runs it.
# Package sources: official WinGet (Gitleaks, OSV-Scanner, uv) and PyPI via uv (Semgrep).
# Does NOT run automatically when unpacking the ZIP.
[CmdletBinding()]
param([switch]$InstallCodexCli)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
function Have($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }
function Install-Package($id) {
    Write-Host "Installing $id through winget..." -ForegroundColor Cyan
    & winget install --id $id --exact --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { throw "WinGet installation failed for $id (exit $LASTEXITCODE)." }
}
if (-not (Have 'winget')) { throw 'Windows Package Manager (winget) not found. Update App Installer, then retry.' }
if (-not (Have 'gitleaks')) { Install-Package 'Gitleaks.Gitleaks' }
if (-not (Have 'osv-scanner')) { Install-Package 'Google.OSVScanner' }
if (-not (Have 'uv')) { Install-Package 'astral-sh.uv' }
# PATH of the running terminal does not always refresh after winget installs.
$env:PATH += ';' + [Environment]::GetEnvironmentVariable('PATH','User') + ';' + [Environment]::GetEnvironmentVariable('PATH','Machine')
if (-not (Have 'uv')) { throw 'uv installation may have succeeded but is not on PATH. Restart VS Code/PowerShell and rerun.' }
if (-not (Have 'semgrep')) {
    Write-Host 'Installing Semgrep with uv (Windows beta; may need WSL fallback)...' -ForegroundColor Cyan
    & uv tool install --python 3.12 semgrep
    if ($LASTEXITCODE -ne 0) { throw 'Semgrep installation failed. See QUALITY-GATE-SETUP.md for WSL/Docker fallback.' }
}
$env:PATH += ';' + (Join-Path $env:USERPROFILE '.local\bin')
if ($InstallCodexCli -and -not (Have 'codex')) {
    if (-not (Have 'npm')) { throw 'npm is needed to install Codex CLI. Install Node.js first.' }
    & npm install --global '@openai/codex'
    if ($LASTEXITCODE -ne 0) { throw 'Codex CLI installation failed.' }
}
Write-Host 'Close and reopen VS Code/PowerShell to refresh PATH, then run:' -ForegroundColor Yellow
Write-Host '  powershell -NoProfile -File .\scripts\test-security-tools.ps1'
Write-Host '  powershell -NoProfile -File .\scripts\run-quality-gate.ps1'
