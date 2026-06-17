@echo off
setlocal
cd /d "%~dp0"
set "FOUND="

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8000 .*LISTENING"') do (
  set "FOUND=1"
  taskkill /F /PID %%P >nul 2>nul
)

if defined FOUND (
  echo Stock dashboard stopped.
) else (
  echo Stock dashboard is not running.
)
