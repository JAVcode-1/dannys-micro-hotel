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
    $files = @(Get-ChildItem -Path $roots -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '[\\/](node_modules|dist|build|\.temp)[\\/]' })
    $codeFiles = @($files | Where-Object { $_.Extension -in @('.ts','.tsx','.js','.jsx','.mjs','.cjs') })
    $codeFiles += @(Get-ChildItem -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in @('.js','.jsx','.mjs','.cjs','.ts','.tsx') })
    if ($codeFiles.Count -gt 0) {
        Write-Host '--- Semgrep (local rules; metrics OFF) ---' -ForegroundColor Cyan
        $ErrorActionPreference = 'Continue'
        try {
            $scanOutput = @(& semgrep scan --metrics=off --config .scanloop/rules/local-security.yml --no-git-ignore --error --json --output (Join-Path $output 'semgrep.json') @($codeFiles.FullName) 2>&1 | ForEach-Object { $_.ToString() })
            $exit = $LASTEXITCODE
        } finally {
            $ErrorActionPreference = 'Stop'
        }
        $scanOutput | Tee-Object -FilePath (Join-Path $output 'semgrep-console.log')
        if ($exit -ne 0) { Write-Host "Semgrep failed or found issues: exit $exit" -ForegroundColor Red; $failed = $true }
        $summary = $scanOutput -join "`n"
        $report = Get-Content -Raw (Join-Path $output 'semgrep.json') | ConvertFrom-Json
        $scanned = @($report.paths.scanned)
        $missing = @($codeFiles.FullName | Where-Object { $_ -notin $scanned })
        if ($summary -notmatch 'Rules run:\s*[1-9]\d*' -or $summary -notmatch 'Targets scanned:\s*[1-9]\d*' -or $missing.Count -gt 0 -or @($report.errors).Count -gt 0) {
            Write-Host "Semgrep coverage could not be verified. Missing targets: $($missing -join ', ')" -ForegroundColor Red
            $failed = $true
        }
    } else {
        Write-Host 'NOT APPLICABLE: Semgrep (no TypeScript or JavaScript files yet)' -ForegroundColor Yellow
    }
    Write-Host '--- PowerShell tooling check (syntax and dynamic execution; limited coverage) ---' -ForegroundColor Cyan
    foreach ($file in @(Get-ChildItem -Path scripts -Filter '*.ps1' -File -Recurse)) {
        $tokens = $null
        $parseErrors = $null
        $ast = [System.Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$tokens, [ref]$parseErrors)
        $dynamicCommands = @($ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.CommandAst] -and $node.GetCommandName() -in @('Invoke-Expression','iex') }, $true))
        if (@($parseErrors).Count -gt 0 -or $dynamicCommands.Count -gt 0) {
            Write-Host "PowerShell check failed: $($file.FullName)" -ForegroundColor Red
            $failed = $true
        }
    }
    Write-Host 'PowerShell scripts parsed; dynamic execution commands absent. Other PowerShell security issues require code review.' -ForegroundColor Yellow
    $lockfiles = @($files | Where-Object { $_.Name -match '^(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$' })
    $lockfiles += @(Get-ChildItem -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$' })
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
