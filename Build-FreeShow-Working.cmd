@echo off
setlocal

title Build FreeShow Working Copy
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
    echo npm was not found. Install Node.js 22 or newer, then try again.
    pause
    exit /b 1
)

echo Refreshing the production-style FreeShow working copy...
echo Unchanged frontend, server, Electron, and native outputs will be reused.
echo.

call npm run build:working
set "exitCode=%errorlevel%"

echo.
if "%exitCode%"=="0" (
    echo Working build ready:
    echo %~dp0dist\win-unpacked\FreeShow.exe
) else (
    echo Working build failed with error code %exitCode%.
)

pause
exit /b %exitCode%
