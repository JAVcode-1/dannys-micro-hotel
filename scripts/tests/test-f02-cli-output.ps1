$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../f02-cli-output.ps1')
$ref = 'pgbierfxeviouyjsmjnh'
$header = "Target: project dannys-micro-hotel ($ref) - production"
$historyJson = @($header, '{"migrations":[{"local":"20261117000100","remote":"20261117000100"}],"target":{"project_ref":"pgbierfxeviouyjsmjnh","project_name":"dannys-micro-hotel","environment":"production"}}')
$historyTable = @($header, '  Local          | Remote         | Time (UTC)', '-----------------|----------------|----------------', '  20261117000100 | 20261117000100 | 2026-11-17 00:01:00')
$dryJson = @($header, '{"upToDate":true,"dryRun":true,"migrations":[],"target":{"project_ref":"pgbierfxeviouyjsmjnh","project_name":"dannys-micro-hotel","environment":"production"}}')
$dryText = @($header, 'DRY RUN: migrations will *not* be pushed to the database.', 'Remote database is up to date.')
if (-not (Test-F02MigrationHistory $historyJson $ref)) { throw 'JSON history rejected.' }
if (-not (Test-F02MigrationHistory $historyTable $ref)) { throw 'Table history rejected.' }
if (Test-F02MigrationHistory @($header, '  20261117000100 |                | 2026-11-17') $ref) { throw 'Missing remote migration accepted.' }
if (Test-F02MigrationHistory ($historyTable + '  20261117000200 | 20261117000200 | 2026-11-17') $ref) { throw 'Extra migration accepted.' }
if (Test-F02MigrationHistory $historyTable 'other-project') { throw 'Wrong project accepted.' }
if (-not (Test-F02DryRun $dryJson $ref)) { throw 'JSON dry run rejected.' }
if (-not (Test-F02DryRun $dryText $ref)) { throw 'Text dry run rejected.' }
if (Test-F02DryRun ($dryText + 'Applying migration 20261117000200...') $ref) { throw 'Pending migration accepted.' }
if (Test-F02DryRun $dryText 'other-project') { throw 'Wrong dry-run project accepted.' }
Write-Output 'F02 CLI output regression checks passed.'
