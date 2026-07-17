@echo off
setlocal

title FreeShow Development
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
    echo npm was not found. Install Node.js 22 or newer, then try again.
    pause
    exit /b 1
)

echo Starting FreeShow in development mode...
echo Keep this window open while FreeShow is running.
echo.

call npm start
set "exitCode=%errorlevel%"

if not "%exitCode%"=="0" (
    echo.
    echo FreeShow stopped with error code %exitCode%.
    pause
)

exit /b %exitCode%
