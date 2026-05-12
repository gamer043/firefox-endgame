@echo off
setlocal enabledelayedexpansion
title Firefox ENDGAME Installer

echo ====================================================================
echo  Firefox ENDGAME Installer
echo  https://github.com/gamer043/firefox-endgame
echo ====================================================================
echo.

REM ----- Refuse to run if Firefox is open -----
tasklist /FI "IMAGENAME eq firefox.exe" 2>NUL | find /I "firefox.exe" >NUL
if not errorlevel 1 (
    echo ERROR: Firefox is currently running.
    echo Close all Firefox windows and re-run this installer.
    echo.
    pause
    exit /b 1
)

REM ----- Locate Firefox profile directory -----
set "PROFILES=%APPDATA%\Mozilla\Firefox\Profiles"
if not exist "%PROFILES%" (
    echo ERROR: No Firefox profile directory found at:
    echo   %PROFILES%
    echo.
    echo Firefox may not be installed or has never been launched.
    pause
    exit /b 1
)

set "PROFILE_DIR="
REM Prefer default-release, then default-esr, then default, then any folder
for /d %%P in ("%PROFILES%\*.default-release") do set "PROFILE_DIR=%%P"
if not defined PROFILE_DIR for /d %%P in ("%PROFILES%\*.default-esr") do set "PROFILE_DIR=%%P"
if not defined PROFILE_DIR for /d %%P in ("%PROFILES%\*.default") do set "PROFILE_DIR=%%P"
if not defined PROFILE_DIR for /d %%P in ("%PROFILES%\*") do (
    if not defined PROFILE_DIR set "PROFILE_DIR=%%P"
)

if not defined PROFILE_DIR (
    echo ERROR: No Firefox profile found under %PROFILES%
    pause
    exit /b 1
)

echo Detected profile: %PROFILE_DIR%
echo.

REM ----- Backup existing user.js if present -----
set "TIMESTAMP=%DATE:/=-%_%TIME::=-%"
set "TIMESTAMP=%TIMESTAMP: =0%"
set "TIMESTAMP=%TIMESTAMP:.=-%"

if exist "%PROFILE_DIR%\user.js" (
    set "BACKUP=%PROFILE_DIR%\user.js.backup-%TIMESTAMP%"
    copy /Y "%PROFILE_DIR%\user.js" "!BACKUP!" >NUL
    if errorlevel 1 (
        echo ERROR: Could not back up existing user.js
        pause
        exit /b 1
    )
    echo Backed up existing user.js to:
    echo   !BACKUP!
    echo.
)

REM ----- Create chrome subdirectory if needed -----
if not exist "%PROFILE_DIR%\chrome" mkdir "%PROFILE_DIR%\chrome"

REM ----- Download files from repo -----
set "BASE_URL=https://raw.githubusercontent.com/gamer043/firefox-endgame/main"

echo Downloading user.js ...
curl -fsSL "%BASE_URL%/user.js" -o "%PROFILE_DIR%\user.js"
if errorlevel 1 (
    echo ERROR: Failed to download user.js from %BASE_URL%
    echo Check internet connection and try again.
    pause
    exit /b 1
)

echo Downloading userChrome.css ...
curl -fsSL "%BASE_URL%/userChrome.css" -o "%PROFILE_DIR%\chrome\userChrome.css"
if errorlevel 1 (
    echo ERROR: Failed to download userChrome.css
    pause
    exit /b 1
)

echo Downloading userContent.css ...
curl -fsSL "%BASE_URL%/userContent.css" -o "%PROFILE_DIR%\chrome\userContent.css"
if errorlevel 1 (
    echo ERROR: Failed to download userContent.css
    pause
    exit /b 1
)

echo.
echo ====================================================================
echo  Installation complete
echo ====================================================================
echo.
echo  Files installed:
echo    %PROFILE_DIR%\user.js
echo    %PROFILE_DIR%\chrome\userChrome.css
echo    %PROFILE_DIR%\chrome\userContent.css
echo.
echo  Start Firefox to apply the new configuration.
echo.
echo  Some prefs require a Firefox restart to take effect (mirror:once).
echo.
echo  To roll back: rename or delete the files above. The most recent
echo  user.js backup is at:
if defined BACKUP echo    !BACKUP!
echo.
pause
endlocal
