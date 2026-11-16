# Three independent Codex CLI reviewer sessions, one per original greploop lens.
# Read-only sandbox; uses user's Codex login and may consume additional tokens.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $root
try {
    if (-not (Get-Command codex -ErrorAction SilentlyContinue)) { throw 'Codex CLI missing. Install with npm install -g @openai/codex and sign in using codex.' }
    if (-not (Test-Path '.git')) { throw 'Git repository not initialized. Initialize Git before running the reviewer gate.' }
    $paths = @('frontend','backend','supabase','packages','scripts')
    $changed = @(& git status --porcelain --untracked-files=all -- @paths)
    if ($LASTEXITCODE -ne 0) { throw 'git status failed.' }
    $codeChanges = @($changed | Where-Object { $_ -match '\.(ts|tsx|js|jsx|json|sql|ps1|yml|yaml|toml)(\s|$)' -or $_ -match 'package\.json|Dockerfile|\.env' })
    if ($codeChanges.Count -eq 0) { throw 'No uncommitted source/tooling changes to review. This gate is intended to run BEFORE committing the work, and does not claim previous code is reviewed.' }
    $output = Join-Path $root '.quality/reviews'
    New-Item -ItemType Directory -Path $output -Force | Out-Null
    $schema = Join-Path $PSScriptRoot 'review-schema.json'
    $results = @()
    foreach ($lens in @('correctness','security','quality')) {
        $target = Join-Path $output "$lens.json"
        Remove-Item $target -ErrorAction SilentlyContinue
        $role = "greploop_$lens"
        $prompt = @"
You are an INDEPENDENT, READ-ONLY Codex $lens reviewer. Read original .agents/skills/greploop/SKILL.md and the project's AGENTS.md. This is review-only: do not edit files, commit, install packages, delegate further, or invoke this gate recursively. Review the CURRENT UNCOMMITTED source/tooling diff from git status, including untracked code. Scope paths: frontend backend supabase packages scripts. Check each changed file IN FULL and trace related callers/importers. Focus on $lens lens. For security, read existing .scanloop/reports if available; do not claim the scanners ran if no reports. Return STRICT JSON conforming to the supplied schema with true findings; score 1-5. Include every issue severity blocking|major|minor, file:line, explanation, concrete fix. If unable to access a file, list that limitation and lower score. No fabricated evidence.
"@
        Write-Host "Running independent Codex reviewer: $lens" -ForegroundColor Cyan
        & codex exec --sandbox read-only -C $root --output-schema $schema -o $target $prompt
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path $target)) { throw "$lens reviewer did not finish successfully." }
        $result = Get-Content -Raw $target | ConvertFrom-Json -ErrorAction Stop
        if ($result.lens -ne $lens -or $null -eq $result.score -or $null -eq $result.findings -or $null -eq $result.files_reviewed -or @($result.files_reviewed).Count -lt 1) { throw "$lens reviewer returned invalid review metadata." }
        $results += $result
        Write-Host "$lens score: $($result.score)/5, findings: $(@($result.findings).Count)" -ForegroundColor Yellow
    }
    $critical = @($results | ForEach-Object { @($_.findings) } | Where-Object { $_.severity -in @('blocking','major') })
    $high = @($results | Where-Object { $_.score -eq 5 }).Count
    $weak = @($results | Where-Object { $_.score -le 3 }).Count
    if ($critical.Count -gt 0 -or $weak -gt 0 -or $high -lt 2) {
        Write-Host 'REVIEW GATE FAILED — fix confirmed findings then rerun. Maximum 5 iterations per original greploop.' -ForegroundColor Red
        throw 'Reviewer consensus requirement not met.'
    }
    Write-Host 'REVIEW GATE PASSED: three actual independent reviewer sessions; no blocking/major findings.' -ForegroundColor Green
} finally { Pop-Location }
