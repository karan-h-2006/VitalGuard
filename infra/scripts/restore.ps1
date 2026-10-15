param(
  [Parameter(Mandatory=$true)]
  [string]$DumpFile
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $DumpFile)) {
  Write-Error "Backup file $DumpFile not found!"
}

Write-Host "Restoring VitalGuard database from $DumpFile..."
cmd /c "docker compose -f infra/docker-compose.prod.yml exec -T postgres pg_restore -U vitalguard -d vitalguard --clean --if-exists -v < `"$DumpFile`""
if ($LASTEXITCODE -ne 0) {
  Write-Error "Database restore failed with exit code $LASTEXITCODE"
}

Write-Host "Restore complete!"
