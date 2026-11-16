# Fail-closed local security scan. Does not edit application source.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $root
try {
    $output = Join-Path $root '.scanloop/reports'
    New-Item -ItemType Directory -Path $output -Force | Out-Null
    $failed = $false
    foreach ($tool in @('gitleaks','semgrep','osv-scanner')) {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
            Write-Host "BLOCKED: missing required scanner $tool" -ForegroundColor Red
            $failed = $true
        }
    }
    if ($failed) { throw 'Missing required scanner(s). Install tools and retry.' }
    Write-Host '--- Gitleaks (repository working files, redacted) ---' -ForegroundColor Cyan
    & gitleaks dir --no-banner --redact --report-format json --report-path (Join-Path $output 'gitleaks.json') .
    $exit = $LASTEXITCODE
    if ($exit -ne 0) { Write-Host "Gitleaks failed or found issues: exit $exit" -ForegroundColor Red; $failed = $true }

    $roots = @('frontend','backend','packages','supabase') | Where-Object { Test-Path $_ }
    $hasCode = @(Get-ChildItem -Path $roots -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in @('.ts','.tsx','.js','.jsx') }).Count -gt 0
    if ($hasCode) {
        Write-Host '--- Semgrep (local rules; metrics OFF) ---' -ForegroundColor Cyan
        & semgrep scan --metrics=off --config .scanloop/rules/local-security.yml --error --json --output (Join-Path $output 'semgrep.json') @roots
        $exit = $LASTEXITCODE
        if ($exit -ne 0) { Write-Host "Semgrep failed or found issues: exit $exit" -ForegroundColor Red; $failed = $true }
    } else {
        Write-Host 'NOT APPLICABLE: Semgrep (no TypeScript or JavaScript files yet)' -ForegroundColor Yellow
    }
    $lockfiles = @(Get-ChildItem -Path $roots -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$' -and $_.FullName -notmatch '[\\/](node_modules|dist|build)[\\/]' })
    if ($lockfiles.Count -gt 0) {
        Write-Host '--- OSV-Scanner (lockfiles; network dependency metadata disclosure) ---' -ForegroundColor Cyan
        $args = @('scan','source','--format=json','--output-file', (Join-Path $output 'osv.json'))
        foreach ($file in $lockfiles) { $args += @('--lockfile', $file.FullName) }
        & osv-scanner @args
        $exit = $LASTEXITCODE
        if ($exit -ne 0) { Write-Host "OSV-Scanner failed or found vulnerabilities: exit $exit" -ForegroundColor Red; $failed = $true }
    } else {
        Write-Host 'NOT APPLICABLE: OSV (no JS package lockfile yet)' -ForegroundColor Yellow
    }
    if ($failed) { throw 'SECURITY GATE FAILED. Do not mark Done.' }
    Write-Host 'SCAN PASSED FOR AVAILABLE TARGETS (see reports and rule coverage limits).' -ForegroundColor Green
} finally { Pop-Location }
