# Checks GitHub for a newer version of this app before it starts, and installs it after asking.
#   Git clone:      git pull --ff-only (skipped when you have local changes)
#   Zip download:   downloads the latest source zip from GitHub and copies it over this folder
# Your projects, images and settings live in the browser, not in this folder, so updating never touches them.
# Exit codes: 0 = nothing changed, 10 = updated (the start script then restarts itself).
# Skip the check: set the environment variable NO_UPDATE_CHECK=1.
param(
  [Parameter(Mandatory = $true)][string]$Repo,
  [string]$Branch = 'main'
)

$ErrorActionPreference = 'Continue'  # 'Stop' would turn git's normal stderr output into errors in Windows PowerShell 5.1
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if ($env:NO_UPDATE_CHECK) { exit 0 }

function Ask-Update([string]$question) {
  # Y/N with a 15 s timeout that defaults to Yes, so an unattended start still updates
  & choice.exe /c YN /t 15 /d Y /m $question
  return $LASTEXITCODE -eq 1
}

function Get-LockHash {
  if (Test-Path 'package-lock.json') { return (Get-FileHash 'package-lock.json').Hash }
  return ''
}

function Install-Dependencies([string]$before) {
  if ((Get-LockHash) -ne $before -or -not (Test-Path 'node_modules')) {
    Write-Host 'Dependencies changed, installing...'
    & npm.cmd install --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) { Write-Host 'npm install failed. Run it yourself, then start again.' -ForegroundColor Yellow }
  }
}

Write-Host 'Checking for updates...'

# ---- git clone ----
$git = Get-Command git -ErrorAction SilentlyContinue
if ((Test-Path '.git') -and $git) {
  & git fetch --quiet origin $Branch 2>$null
  if ($LASTEXITCODE -ne 0) { Write-Host 'Could not reach GitHub, starting without update check.'; exit 0 }
  $behind = [int](& git rev-list --count "HEAD..origin/$Branch")
  if ($behind -eq 0) { Write-Host 'Up to date.'; exit 0 }
  Write-Host "$behind new change(s) on GitHub:"
  & git log --oneline --no-decorate -n 8 "HEAD..origin/$Branch" | ForEach-Object { Write-Host "  $_" }
  if (& git status --porcelain --untracked-files=no) {
    Write-Host 'You have local changes in this folder, so it is not updated automatically. Run "git pull" yourself.' -ForegroundColor Yellow
    exit 0
  }
  if (-not (Ask-Update 'Update now?')) { exit 0 }
  $lock = Get-LockHash
  & git pull --ff-only --quiet origin $Branch
  if ($LASTEXITCODE -ne 0) { Write-Host 'Update failed (your branch has its own commits?). Run "git pull" yourself.' -ForegroundColor Yellow; exit 0 }
  Install-Dependencies $lock
  Write-Host 'Updated.' -ForegroundColor Green
  exit 10
}

# ---- zip download (no .git folder) ----
$marker = Join-Path $root '.app-version'
try {
  $latest = (Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/commits/$Branch" -Headers @{ Accept = 'application/vnd.github+json'; 'User-Agent' = 'app-updater' } -TimeoutSec 10 -ErrorAction Stop).sha
} catch {
  Write-Host 'Could not reach GitHub, starting without update check.'
  exit 0
}
$current = if (Test-Path $marker) { (Get-Content $marker -Raw).Trim() } else { '' }
if ($current -eq $latest) { Write-Host 'Up to date.'; exit 0 }
if ($current) { Write-Host 'A newer version is available on GitHub.' }
else { Write-Host 'This copy has no version stamp yet, so it cannot tell whether it is current. Updating installs the latest version from GitHub.' }
if (-not (Ask-Update 'Update now?')) { exit 0 }

$tmp = Join-Path ([IO.Path]::GetTempPath()) ("app-update-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $tmp | Out-Null
try {
  $zip = Join-Path $tmp 'source.zip'
  Invoke-WebRequest -Uri "https://codeload.github.com/$Repo/zip/$latest" -OutFile $zip -UseBasicParsing -TimeoutSec 120 -ErrorAction Stop
  Expand-Archive $zip -DestinationPath $tmp -ErrorAction Stop
  $src = Get-ChildItem $tmp -Directory | Select-Object -First 1
  $lock = Get-LockHash
  # copy over this folder; node_modules and your own extra files stay
  & robocopy.exe $src.FullName $root /E /XD node_modules .git /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "copying the new files failed (robocopy $LASTEXITCODE)" }
  Set-Content -Path $marker -Value $latest -Encoding ascii
  Install-Dependencies $lock
  Write-Host 'Updated.' -ForegroundColor Green
  exit 10
} catch {
  Write-Host "Update failed: $($_.Exception.Message). Starting the current version." -ForegroundColor Yellow
  exit 0
} finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
