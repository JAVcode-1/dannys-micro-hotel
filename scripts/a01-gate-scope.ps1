function Assert-A01GateScope {
    param([string[]]$ChangedPaths, [bool]$F02Hosted)
    if ($F02Hosted) { throw 'Choose either A01 or F02Hosted verification.' }
    $foundationPaths = @('supabase/migrations/20261117000100_foundation_catalog.sql', 'supabase/config.toml', 'backend/src/database.ts', 'packages/shared/src/database.types.ts')
    if (@($ChangedPaths | Where-Object { $_ -in $foundationPaths -or $_ -like 'scripts/verify-f02-*.mjs' }).Count -gt 0) {
        throw 'A01 verification cannot bypass changed F02 foundation files.'
    }
    if (@($ChangedPaths | Where-Object { $_ -like 'supabase/migrations/*' -and $_ -ne 'supabase/migrations/20261118000100_staff_identities.sql' }).Count -gt 0) {
        throw 'A01 verification cannot include another migration.'
    }
    if ('supabase/migrations/20261118000100_staff_identities.sql' -notin $ChangedPaths) {
        throw 'A01 verification requires the pending staff migration.'
    }
}
