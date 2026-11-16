@echo off
cd /d "%~dp0"

where npm.cmd >nul 2>&1
if errorlevel 1 (
  if exist "%ProgramFiles%\nodejs\npm.cmd" (
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
  ) else (
    echo Node.js was not found. Attempting automatic installation via winget...
    where winget >nul 2>&1
    if errorlevel 1 (
      echo.
      echo Node.js auto-install wasn't available. Please install Node.js manually from https://nodejs.org/ and try again.
      start https://nodejs.org/
      pause
      exit /b 1
    )

    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    if exist "%ProgramFiles%\nodejs\npm.cmd" (
      set "PATH=%ProgramFiles%\nodejs;%PATH%"
    ) else (
      echo.
      echo Node.js auto-install wasn't available or did not complete. Please install Node.js manually from https://nodejs.org/ and try again.
      start https://nodejs.org/
      pause
      exit /b 1
    )
  )
)

echo Installing Bios Background Remover dependencies...
call npm.cmd install
if errorlevel 1 (
  echo.
  echo Installation failed. Please check the error message above.
  pause
  exit /b 1
)

echo.
echo Dependencies installed successfully! You can now run "Start PureEraser.bat".
pause
