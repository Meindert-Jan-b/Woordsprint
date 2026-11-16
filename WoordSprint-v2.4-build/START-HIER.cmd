@echo off
rem Houdt de terminal open, ook als de website niet kan starten.
cd /d "%~dp0"
cmd.exe /d /k ""%~dp0start-windows.bat""
