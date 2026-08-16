@echo off
title Offline Contest Server Control Center
cd /d "%~dp0"

:: Launch PowerShell with execution policy bypass
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_contest.ps1"

pause
