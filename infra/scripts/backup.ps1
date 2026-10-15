param(
  [string]$BackupDir = "backups"
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $BackupDir)) {
  New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dumpFile = Join-Path $BackupDir "vitalguard_$timestamp.dump"

Write-Host "Creating VitalGuard database backup to $dumpFile..."
cmd /c "docker compose -f infra/docker-compose.prod.yml exec -T postgres pg_dump -U vitalguard -d vitalguard -F c -b > `"$dumpFile`""
if ($LASTEXITCODE -ne 0) {
  Write-Error "Database backup failed with exit code $LASTEXITCODE"
}

Write-Host "Backup complete: $dumpFile ($(Get-Item $dumpFile | Select-Object -ExpandProperty Length) bytes)"
