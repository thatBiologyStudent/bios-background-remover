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

echo Starting Bios Background Remover...
call npm.cmd run dev -- --open
if errorlevel 1 pause
