@echo off
setlocal
cd /d "%~dp0"
set "URL=http://localhost:8000/"

netstat -ano | findstr /R /C:":8000 .*LISTENING" >nul
if errorlevel 1 (
  start "Stock Dashboard Server" /min cmd /c "node server.js"
  timeout /t 2 /nobreak >nul
)

start "" "%URL%"
echo Stock dashboard: %URL%
