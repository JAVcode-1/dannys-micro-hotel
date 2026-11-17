# Explicit fail-closed gate for project checks, scanning, and 3 reviewers.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$output = Join-Path $root '.quality'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$validation = Join-Path $output 'validation.log'
Push-Location $root
try {
    "Project validation started $(Get-Date -Format o)" | Out-File -FilePath $validation -Encoding utf8
    foreach ($check in @('build','typecheck','lint','format:check','test')) {
        "--- npm run $check ---" | Out-File -FilePath $validation -Append -Encoding utf8
        & npm run $check 2>&1 | ForEach-Object { $_.ToString() } | Out-File -FilePath $validation -Append -Encoding utf8
        if ($LASTEXITCODE -ne 0) { throw "Validation failed: npm run $check (exit $LASTEXITCODE)." }
    }
    "--- greploop source-filter regression ---" | Out-File -FilePath $validation -Append -Encoding utf8
    & (Join-Path $PSScriptRoot 'tests/test-greploop-source-filter.ps1') | Out-File -FilePath $validation -Append -Encoding utf8
    if (-not $?) { throw 'Greploop source-filter regression failed.' }
    & (Join-Path $PSScriptRoot 'run-scanloop.ps1')
    & (Join-Path $PSScriptRoot 'run-greploop-review.ps1')
    Write-Host 'QUALITY GATE PASSED.' -ForegroundColor Green
} finally {
    Pop-Location
}
