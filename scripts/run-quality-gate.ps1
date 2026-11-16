# Explicit fail-closed gate. Tests/build run per active phase; this performs scanning and 3 reviewers.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'run-scanloop.ps1')
& (Join-Path $PSScriptRoot 'run-greploop-review.ps1')
Write-Host 'QUALITY GATE PASSED. Still run and record phase-specific build/typecheck/tests.' -ForegroundColor Green
