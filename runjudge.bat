@echo off
setlocal
cd /d "%~dp0"
where pythonw >nul 2>nul
if %errorlevel%==0 (
    start "" pythonw judge.py
) else (
    where py >nul 2>nul
    if %errorlevel%==0 ( start "" pyw judge.py ) else ( python judge.py & pause )
)
endlocal
