@echo off
chcp 65001 >nul
title RiftMester
cd /d "%~dp0"

where pyw >nul 2>nul
if %errorlevel%==0 (
    start "" pyw -3 server.py
    exit /b
)
where pythonw >nul 2>nul
if %errorlevel%==0 (
    start "" pythonw server.py
    exit /b
)
where py >nul 2>nul
if %errorlevel%==0 (
    py -3 server.py
    goto :end
)
where python >nul 2>nul
if %errorlevel%==0 (
    python server.py
    goto :end
)

echo.
echo  Nem talalom a Pythont!
echo  Toltsd le innen: https://www.python.org/downloads/
echo  Telepiteskor pipald be: "Add python.exe to PATH"
echo.
pause

:end
