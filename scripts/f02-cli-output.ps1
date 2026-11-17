function Test-F02CliTarget($lines, $projectRef) {
    $text = $lines -join "`n"
    return $text -match "(?m)^Target: project dannys-micro-hotel \($([regex]::Escape($projectRef))\) .+ production\s*$"
}

function Test-F02MigrationHistory($lines, $projectRef) {
    $jsonLine = $lines | Where-Object { $_ -match '^\{' } | Select-Object -Last 1
    if ($jsonLine) {
        try { $result = $jsonLine | ConvertFrom-Json } catch { return $false }
        return $result.target.project_ref -eq $projectRef -and $result.target.project_name -eq 'dannys-micro-hotel' -and $result.target.environment -eq 'production' -and @($result.migrations).Count -eq 1 -and $result.migrations[0].local -eq '20261117000100' -and $result.migrations[0].remote -eq '20261117000100'
    }
    if (-not (Test-F02CliTarget $lines $projectRef)) { return $false }
    $rows = @($lines | Where-Object { $_ -match '^\s*\d{14}\s*\|\s*\d{14}\s*\|' })
    return $rows.Count -eq 1 -and $rows[0] -match '^\s*20261117000100\s*\|\s*20261117000100\s*\|'
}

function Test-F02DryRun($lines, $projectRef) {
    $jsonLine = $lines | Where-Object { $_ -match '^\{' } | Select-Object -Last 1
    if ($jsonLine) {
        try { $result = $jsonLine | ConvertFrom-Json } catch { return $false }
        return $result.target.project_ref -eq $projectRef -and $result.target.project_name -eq 'dannys-micro-hotel' -and $result.target.environment -eq 'production' -and $result.dryRun -eq $true -and $result.upToDate -eq $true -and @($result.migrations).Count -eq 0
    }
    if (-not (Test-F02CliTarget $lines $projectRef)) { return $false }
    $text = $lines -join "`n"
    return $text -match 'DRY RUN: migrations will \*not\* be pushed to the database\.' -and $text -match 'Remote database is up to date\.' -and $text -notmatch '(?m)^\s*Applying migration '
}
