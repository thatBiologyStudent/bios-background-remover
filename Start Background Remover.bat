@echo off
cd /d "%~dp0"

where npm.cmd >nul 2>&1
if errorlevel 1 (
  if exist "%ProgramFiles%\nodejs\npm.cmd" (
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
  ) else (
    echo Error: Node.js / npm was not found on your PATH.
    echo Please install Node.js ^(v18 or newer^) from https://nodejs.org/ and try again.
    pause
    exit /b 1
  )
)

rem Check GitHub for a newer version (set NO_UPDATE_CHECK=1 to skip). Exit code 10 = updated: restart
rem so the new version of this script runs. Keep both lines in one block: cmd reads the whole block
rem before running it, so the update can safely replace this file.
(
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\update.ps1" -Repo thatBiologyStudent/bios-background-remover
  if errorlevel 10 ( set "NO_UPDATE_CHECK=1" & "%~f0" & exit /b )
)

if not exist node_modules (
  echo Installing dependencies, this only happens once...
  call npm.cmd install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

echo Starting Bios Background Remover...
call npm.cmd run dev -- --open
if errorlevel 1 pause
