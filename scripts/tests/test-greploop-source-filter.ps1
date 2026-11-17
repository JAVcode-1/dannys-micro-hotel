$ErrorActionPreference = 'Stop'
$reviewer = Join-Path $PSScriptRoot '../run-greploop-review.ps1'
$line = (Select-String -Path $reviewer -Pattern '^\s*\$codeChanges\s*=').Line
if ($line -notmatch "-match '([^']+)'") { throw 'Source-change filter not found.' }
$pattern = $Matches[1]

foreach ($path in @('frontend/test/render.test.mjs','backend/test/example.test.cjs','eslint.config.mjs')) {
    if ("?? $path" -notmatch $pattern) { throw "Source-change filter missed $path" }
}
if ('?? docs/notes.md' -match $pattern) { throw 'Source-change filter matched unrelated Markdown.' }

$expectedLine = (Select-String -Path $reviewer -Pattern '^\s*\$expected\s*=').Line
if ($expectedLine -notmatch "-notmatch '([^']+)'") { throw 'Reviewable-file exclusion not found.' }
$excluded = $Matches[1]
if (@('package-lock.json' | Where-Object { $_ -notmatch $excluded }).Count -ne 0) { throw 'Generated lockfile was not excluded.' }
if (@('frontend/test/render.test.mjs' | Where-Object { $_ -notmatch $excluded }).Count -ne 1) { throw 'MJS test was excluded from review.' }
Write-Output 'Greploop source-change filter regression checks passed.'
