# Explicit fail-closed gate for project checks, scanning, and 3 reviewers.
[CmdletBinding()]
param([switch]$F02Hosted, [switch]$A01)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$output = Join-Path $root '.quality'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$validation = Join-Path $output 'validation.log'
. (Join-Path $PSScriptRoot 'f02-cli-output.ps1')
. (Join-Path $PSScriptRoot 'a01-gate-scope.ps1')
Push-Location $root
try {
    $f02Change = @(& git status --porcelain --untracked-files=all -- 'supabase/migrations/' 'supabase/config.toml' 'backend/src/database.ts' 'backend/src/app.ts' 'packages/shared/src/database.types.ts' 'scripts/verify-f02-*.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Unable to check F02 migration change status.' }
    if ($A01 -and $F02Hosted) { throw 'Choose either A01 or F02Hosted verification.' }
    if ($A01) {
        $a01Changes = @(& git status --porcelain --untracked-files=all)
        if ($LASTEXITCODE -ne 0) { throw 'Unable to check A01 change status.' }
        $a01Paths = @($a01Changes | ForEach-Object { $_.Substring(3).Replace('\','/') })
        Assert-A01GateScope -ChangedPaths $a01Paths -F02Hosted:$F02Hosted
    } elseif ($f02Change.Count -gt 0 -and -not $F02Hosted) { throw 'F02 migration changes require -F02Hosted read-only verification.' }
    "Project validation started $(Get-Date -Format o)" | Out-File -FilePath $validation -Encoding utf8
    foreach ($check in @('build','typecheck','lint','format:check','test')) {
        "--- npm run $check ---" | Out-File -FilePath $validation -Append -Encoding utf8
        & npm run $check 2>&1 | ForEach-Object { $_.ToString() } | Out-File -FilePath $validation -Append -Encoding utf8
        if ($LASTEXITCODE -ne 0) { throw "Validation failed: npm run $check (exit $LASTEXITCODE)." }
    }
    "--- greploop source-filter regression ---" | Out-File -FilePath $validation -Append -Encoding utf8
    & (Join-Path $PSScriptRoot 'tests/test-greploop-source-filter.ps1') | Out-File -FilePath $validation -Append -Encoding utf8
    if (-not $?) { throw 'Greploop source-filter regression failed.' }
    & (Join-Path $PSScriptRoot 'tests/test-f02-cli-output.ps1') | Out-File -FilePath $validation -Append -Encoding utf8
    if (-not $?) { throw 'F02 CLI output regression failed.' }
    & (Join-Path $PSScriptRoot 'tests/test-a01-gate-scope.ps1') | Out-File -FilePath $validation -Append -Encoding utf8
    if (-not $?) { throw 'A01 gate scope regression failed.' }
    if ($A01) {
        if (-not $env:TEST_DATABASE_URL) { throw 'A01 isolated migration verification requires TEST_DATABASE_URL.' }
        '--- npm run test:db (isolated A01 migration) ---' | Out-File -FilePath $validation -Append -Encoding utf8
        & npm run test:db 2>&1 | ForEach-Object { $_.ToString() } | Out-File -FilePath $validation -Append -Encoding utf8
        if ($LASTEXITCODE -ne 0) { throw "A01 isolated migration verification failed (exit $LASTEXITCODE)." }
    }
    if ($F02Hosted) {
        if (-not (Test-Path 'backend/.env')) { throw 'F02 hosted verification requires the local ignored backend/.env.' }
        $migrationFiles = @(Get-ChildItem 'supabase/migrations' -Filter '*.sql' -File)
        if ($migrationFiles.Count -ne 1 -or $migrationFiles[0].Name -ne '20261117000100_foundation_catalog.sql') { throw 'F02 migration set differs from the approved single catalog migration.' }
        $approvedMigrationSha256 = '1B0E4BB6DE9B9C11C2068BDE7C4F827BCC3DEE8D73CBE748A610911FD6C194A3'
        if ((Get-FileHash -LiteralPath $migrationFiles[0].FullName -Algorithm SHA256).Hash -ne $approvedMigrationSha256) { throw 'F02 migration SQL differs from the approved D-040 checksum; use a reviewed forward migration.' }
        $linkedRef = (Get-Content 'supabase/.temp/project-ref' -Raw).Trim()
        if ($linkedRef -ne 'pgbierfxeviouyjsmjnh') { throw 'F02 linked project reference differs from approval.' }
        $supabaseCli = Join-Path $root 'node_modules/.bin/supabase.cmd'
        if (-not (Test-Path $supabaseCli)) { throw 'Workspace Supabase CLI is missing; run npm ci.' }
        $cliVersion = @(& $supabaseCli --version)
        if ($LASTEXITCODE -ne 0 -or ($cliVersion -join "`n") -notmatch '^3\.2\.0\s*$') { throw 'F02 requires workspace Supabase CLI 3.2.0.' }
        $ErrorActionPreference = 'Continue'
        try { $migrationHistory = @(& $supabaseCli migration list --remote 2>&1 | ForEach-Object { $_.ToString() }) }
        finally { $ErrorActionPreference = 'Stop' }
        if ($LASTEXITCODE -ne 0) { throw 'F02 migration history command failed.' }
        if (-not (Test-F02MigrationHistory $migrationHistory $linkedRef)) { throw 'Approved F02 migration is not recorded on the linked project base branch.' }
        'F02 target: owner-designated development project dannys-micro-hotel; Supabase CLI environment=production denotes its base branch (D-040), not application deployment status.' | Out-File -FilePath $validation -Append -Encoding utf8
        'F02 linked project: pgbierfxeviouyjsmjnh; local SQL migration set: only 20261117000100_foundation_catalog.sql; seed.sql not executed by this gate.' | Out-File -FilePath $validation -Append -Encoding utf8
        'F02 linked migration history:' | Out-File -FilePath $validation -Append -Encoding utf8
        $migrationHistory | Out-File -FilePath $validation -Append -Encoding utf8
        $ErrorActionPreference = 'Continue'
        try { $dryRun = @(& $supabaseCli db push --remote --dry-run 2>&1 | ForEach-Object { $_.ToString() }) }
        finally { $ErrorActionPreference = 'Stop' }
        if ($LASTEXITCODE -ne 0) { throw 'F02 post-apply dry-run failed.' }
        if (-not (Test-F02DryRun $dryRun $linkedRef)) { throw 'Unexpected target or pending hosted migration.' }
        'F02 post-apply dry-run (no pending migration):' | Out-File -FilePath $validation -Append -Encoding utf8
        $dryRun | Out-File -FilePath $validation -Append -Encoding utf8
        & npm run verify:f02:types 2>&1 | ForEach-Object { $_.ToString() } | Out-File -FilePath $validation -Append -Encoding utf8
        if ($LASTEXITCODE -ne 0) { throw 'F02 hosted database type drift verification failed.' }
        'F02 linked database type comparison passed.' | Out-File -FilePath $validation -Append -Encoding utf8
        foreach ($check in @('verify-f02-db.mjs','verify-f02-http.mjs')) {
            $checkOutput = @(& node --env-file=backend/.env (Join-Path $PSScriptRoot $check) 2>&1)
            if ($LASTEXITCODE -ne 0) { throw "F02 hosted verification failed: $check" }
            "F02 hosted read-only verification passed: $check" | Out-File -FilePath $validation -Append -Encoding utf8
            $checkOutput | ForEach-Object { $_.ToString() } | Out-File -FilePath $validation -Append -Encoding utf8
        }
        'F02 D-040 deferred: fresh isolated migration/reset and fictitious seed tests were not run.' | Out-File -FilePath $validation -Append -Encoding utf8
    }
    & (Join-Path $PSScriptRoot 'run-scanloop.ps1')
    & (Join-Path $PSScriptRoot 'run-greploop-review.ps1') -F02Hosted:$F02Hosted
    Write-Host 'QUALITY GATE PASSED.' -ForegroundColor Green
} finally {
    Pop-Location
}
