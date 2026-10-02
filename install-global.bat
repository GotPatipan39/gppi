@echo off
chcp 65001 >nul
rem ดับเบิลคลิก: ติดตั้ง skill ทั่วไป (grilling, domain-modeling ...) ให้ใช้ได้ทุกโปรเจกต์
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-skills.ps1"
echo.
pause
