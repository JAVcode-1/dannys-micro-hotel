$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../a01-gate-scope.ps1')
$migration = 'supabase/migrations/20261118000100_staff_identities.sql'
Assert-A01GateScope -ChangedPaths @($migration, 'backend/src/app.ts') -F02Hosted:$false
foreach ($case in @(
    @{ Paths = @('backend/src/app.ts'); Hosted = $false },
    @{ Paths = @($migration, 'backend/src/database.ts'); Hosted = $false },
    @{ Paths = @($migration, 'supabase/config.toml'); Hosted = $false },
    @{ Paths = @($migration, 'supabase/migrations/20261119000100_other.sql'); Hosted = $false },
    @{ Paths = @($migration); Hosted = $true }
)) {
    $rejected = $false
    try { Assert-A01GateScope -ChangedPaths $case.Paths -F02Hosted:$case.Hosted } catch { $rejected = $true }
    if (-not $rejected) { throw 'A01 scope accepted an invalid change set.' }
}
Write-Output 'A01 gate scope regression checks passed.'
