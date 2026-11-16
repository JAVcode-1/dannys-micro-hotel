# Read-only integrity check for the three original uploaded Claude SKILL.md files.
# Run at repo root: .\scripts\verify-original-skills.ps1
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$manifestPath = Join-Path $repoRoot '.agents/skills-manifest.json'
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$valid = $true
foreach ($skill in $manifest.skills) {
  $filePath = Join-Path $repoRoot ($skill.path -replace '/', [IO.Path]::DirectorySeparatorChar)
  if (-not (Test-Path $filePath)) { Write-Host "MISSING $($skill.skill): $filePath"; $valid = $false; continue }
  $actual = (Get-FileHash -Path $filePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $skill.sha256) { Write-Host "MODIFIED $($skill.skill): checksum mismatch"; $valid = $false }
  else { Write-Host "OK $($skill.skill): original SHA-256 matched" }
}
if (-not $valid) { throw 'Skill integrity check FAILED.' }
Write-Host 'All three original skill files are unchanged.'
