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
    # Scan only current tracked edits and untracked files. Git excludes ignored
    # private credentials; this also rejects credential paths if already tracked.
    $scanRoot = Join-Path $output ("gitleaks-input-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $scanRoot -Force | Out-Null
    try {
        $workingFiles = @(& git diff --name-only --diff-filter=ACMRT)
        if ($LASTEXITCODE -ne 0) { throw 'Unable to enumerate working tree changes for Gitleaks.' }
        $stagedFiles = @(& git diff --cached --name-only --diff-filter=ACMRT)
        if ($LASTEXITCODE -ne 0) { throw 'Unable to enumerate staged changes for Gitleaks.' }
        $untrackedFiles = @(& git ls-files --others --exclude-standard)
        if ($LASTEXITCODE -ne 0) { throw 'Unable to enumerate untracked files for Gitleaks.' }
        $scanFiles = @($workingFiles + $stagedFiles + $untrackedFiles) | Sort-Object -Unique
        if ($scanFiles.Count -eq 0) { throw 'No current changed files for Gitleaks.' }
        $privateFiles = @($scanFiles | Where-Object { $_ -match '(^|/)\.env($|\.(?!example$))' -or $_ -match '\.(pem|key|crt|p12|pfx)$' })
        if ($privateFiles.Count -gt 0) { throw 'Private credential files are in the current Git change set. Remove them before scanning or committing.' }
        $scanFiles = @($scanFiles | Where-Object { $_ -notmatch '(^|/)(node_modules|dist|build|\.temp|\.quality|reports)/' })
        if ($scanFiles.Count -eq 0) { throw 'No eligible changed files for Gitleaks.' }
        Write-Host "Gitleaks scanning $($scanFiles.Count) current changed files." -ForegroundColor Cyan
        foreach ($file in $scanFiles) {
            $source = Join-Path $root $file
            if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { continue }
            $destination = Join-Path $scanRoot $file
            New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
            Copy-Item -LiteralPath $source -Destination $destination
        }
        foreach ($file in $stagedFiles) {
            $destination = Join-Path $scanRoot (Join-Path '__staged__' $file)
            New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
            $stagedContent = @(& git show ":$file")
            if ($LASTEXITCODE -ne 0) { throw "Unable to read staged content for Gitleaks: $file" }
            [System.IO.File]::WriteAllText($destination, ($stagedContent -join "`n"), [System.Text.UTF8Encoding]::new($false))
        }
        & gitleaks dir --no-banner --redact --report-format json --report-path (Join-Path $output 'gitleaks.json') $scanRoot
        $exit = $LASTEXITCODE
    } finally {
        $resolvedOutput = (Resolve-Path -LiteralPath $output).Path.TrimEnd('\') + '\'
        $resolvedScan = (Resolve-Path -LiteralPath $scanRoot).Path
        if (-not $resolvedScan.StartsWith($resolvedOutput, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw 'Refusing to remove a scan directory outside the report folder.'
        }
        Remove-Item -LiteralPath $resolvedScan -Recurse -Force
    }
    if ($exit -ne 0) { Write-Host "Gitleaks failed or found issues: exit $exit" -ForegroundColor Red; $failed = $true }

    $roots = @('frontend','backend','packages','supabase','scripts') | Where-Object { Test-Path $_ }
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
