@echo off
rem Double-click: install ALL skills for all projects
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-skills.ps1" -All
echo.
pause
