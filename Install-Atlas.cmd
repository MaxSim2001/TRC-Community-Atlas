@echo off
setlocal
title Installation de TRC Community Atlas

echo.
echo ============================================================
echo   TRC Community Atlas - Installation Windows
echo ============================================================
echo.

if "%~1"=="" (
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Configure-TRCCommunityAtlas.ps1"
) else (
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Install-TRCCommunityAtlas.ps1" %*
)
set "ATLAS_EXIT=%ERRORLEVEL%"

echo.
if not "%ATLAS_EXIT%"=="0" (
  echo L'installation n'a pas pu etre terminee.
  echo Le message ci-dessus indique quoi corriger.
) else (
  echo Atlas est installe et pret a utiliser.
)
echo.
pause
exit /b %ATLAS_EXIT%
