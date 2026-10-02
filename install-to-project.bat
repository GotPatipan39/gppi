@echo off
rem Double-click: pick a project folder, then pick skills to install into it
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-skills.ps1" -Pick
echo.
pause
