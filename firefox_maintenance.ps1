# Firefox Profile Maintenance Script

$ErrorActionPreference = "Stop"
$profile_dir = "C:\Users\admin\AppData\Roaming\Mozilla\Firefox\Profiles\gs2b9rlq.default-esr"

if (-not (Test-Path $profile_dir)) {
    Write-Host "ERROR: Profile not found" -ForegroundColor Red
    exit 1
}

$ff = Get-Process firefox -ErrorAction SilentlyContinue
if ($ff) {
    Write-Host "ERROR: Firefox is running. Close it first." -ForegroundColor Red
    exit 1
}

function Get-DirSize($path) {
    if (-not (Test-Path $path)) { return 0 }
    return (Get-ChildItem $path -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
}

function FmtMB($bytes) {
    return [math]::Round($bytes / 1MB, 2).ToString() + " MB"
}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " FIREFOX PROFILE MAINTENANCE" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$sizeBefore = Get-DirSize $profile_dir
Write-Host ""
Write-Host ("Profile size BEFORE: " + (FmtMB $sizeBefore))

# 1. Remove dead-weight files
Write-Host ""
Write-Host "[1/4] Removing dead-weight files..." -ForegroundColor Yellow

$deadFiles = @(
    "suggest.sqlite",
    "suggest.sqlite-wal",
    "suggest.sqlite-shm",
    "domain_to_categories.sqlite",
    "domain_to_categories.sqlite-wal",
    "domain_to_categories.sqlite-shm",
    "shield-recipe-client.log",
    "saved-telemetry-pings"
)

$deadDirs = @(
    "weave\logs",
    "datareporting\archived",
    "datareporting\session-state.json",
    "crashes\events"
)

foreach ($f in ($deadFiles + $deadDirs)) {
    $path = Join-Path $profile_dir $f
    if (Test-Path $path) {
        $sz = if ((Get-Item $path -Force).PSIsContainer) { Get-DirSize $path } else { (Get-Item $path).Length }
        try {
            Remove-Item $path -Recurse -Force -ErrorAction Stop
            Write-Host ("  REMOVED: " + $f + "  (" + (FmtMB $sz) + ")") -ForegroundColor Green
        } catch {
            Write-Host ("  SKIP: " + $f)
        }
    }
}

# 2. VACUUM SQLite databases
Write-Host ""
Write-Host "[2/4] VACUUM + REINDEX + ANALYZE sqlite databases..." -ForegroundColor Yellow

$sqlite = $null
$candidates = @(
    "C:\Users\admin\Desktop\FIREFOX-ENDGAME\sqlite3.exe",
    "C:\Program Files\sqlite\sqlite3.exe"
)
foreach ($c in $candidates) {
    if (Test-Path $c) { $sqlite = $c; break }
}
if (-not $sqlite) {
    $found = Get-Command sqlite3 -ErrorAction SilentlyContinue
    if ($found) { $sqlite = $found.Source }
}

if (-not $sqlite) {
    Write-Host "  Downloading portable sqlite3..." -ForegroundColor Yellow
    $tmpZip = "$env:TEMP\sqlite-tools.zip"
    $extractDir = "C:\Users\admin\Desktop\FIREFOX-ENDGAME\sqlite-tools"
    try {
        $url = "https://www.sqlite.org/2025/sqlite-tools-win-x64-3500000.zip"
        Invoke-WebRequest -Uri $url -OutFile $tmpZip -UseBasicParsing
        Expand-Archive -Path $tmpZip -DestinationPath $extractDir -Force
        $found = Get-ChildItem $extractDir -Recurse -Filter sqlite3.exe | Select-Object -First 1
        if ($found) {
            Copy-Item $found.FullName "C:\Users\admin\Desktop\FIREFOX-ENDGAME\sqlite3.exe" -Force
            $sqlite = "C:\Users\admin\Desktop\FIREFOX-ENDGAME\sqlite3.exe"
            Write-Host "  Got sqlite3 at: $sqlite" -ForegroundColor Green
        }
    } catch {
        Write-Host "  Could not download sqlite3 - skipping vacuum step" -ForegroundColor Red
    }
}

if ($sqlite) {
    $dbs = Get-ChildItem "$profile_dir\*.sqlite" -ErrorAction SilentlyContinue
    foreach ($db in $dbs) {
        $beforeKB = [math]::Round($db.Length / 1KB, 1)
        try {
            & $sqlite $db.FullName "PRAGMA journal_mode=WAL; VACUUM; REINDEX; ANALYZE; PRAGMA optimize; PRAGMA wal_checkpoint(TRUNCATE);" 2>&1 | Out-Null
            $afterKB = [math]::Round((Get-Item $db.FullName).Length / 1KB, 1)
            $savedKB = $beforeKB - $afterKB
            Write-Host ("  " + $db.Name.PadRight(40) + $beforeKB.ToString().PadLeft(8) + " KB -> " + $afterKB.ToString().PadLeft(8) + " KB  saved " + $savedKB + " KB") -ForegroundColor Green
        } catch {
            Write-Host ("  ERROR: " + $db.Name + ": " + $_) -ForegroundColor Red
        }
    }
}

# 3. Prune old cache entries
Write-Host ""
Write-Host "[3/4] Pruning cache2 entries older than 30 days..." -ForegroundColor Yellow
$cache_dir = "C:\Users\admin\AppData\Local\Mozilla\Firefox\Profiles\gs2b9rlq.default-esr\cache2\entries"
if (Test-Path $cache_dir) {
    $cutoff = (Get-Date).AddDays(-30)
    $old = Get-ChildItem $cache_dir -Force | Where-Object { $_.LastWriteTime -lt $cutoff }
    $oldSize = ($old | Measure-Object Length -Sum).Sum
    $count = ($old | Measure-Object).Count
    $old | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Host ("  Removed " + $count + " entries  (" + (FmtMB $oldSize) + ")") -ForegroundColor Green
} else {
    Write-Host "  No cache2 dir present"
}

# 4. Summary
$sizeAfter = Get-DirSize $profile_dir
$savedMB = [math]::Round(($sizeBefore - $sizeAfter) / 1MB, 2)

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " RESULTS" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host ("Profile size BEFORE: " + (FmtMB $sizeBefore))
Write-Host ("Profile size AFTER:  " + (FmtMB $sizeAfter))
Write-Host ("Saved:               " + $savedMB + " MB") -ForegroundColor Green
Write-Host ""
Write-Host "Done. Safe to start Firefox now." -ForegroundColor Cyan
