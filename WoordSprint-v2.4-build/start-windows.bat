@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>nul
title WoordSprint - Website starten
cd /d "%~dp0"

echo.
echo  ========================================
echo           WOORDSPRINT STARTER
echo  ========================================
echo.
echo  Projectmap: %CD%
echo.

if not exist "package.json" (
    echo  FOUT: package.json niet gevonden.
    echo.
    echo  Pak eerst het HELE zipbestand uit met 'Alles uitpakken'.
    echo  Start het programma NIET rechtstreeks vanuit de zip.
    goto error
)
if not exist "server.js" (
    echo  FOUT: server.js ontbreekt.
    echo  Pak het volledige zipbestand opnieuw uit.
    goto error
)

where node >nul 2>nul
if errorlevel 1 (
    echo  FOUT: Node.js is niet geinstalleerd of staat niet in PATH.
    echo  Installeer de LTS-versie op https://nodejs.org/
    echo  Sluit hierna alle vensters en probeer opnieuw.
    goto error
)
where npm >nul 2>nul
if errorlevel 1 (
    echo  FOUT: npm is niet gevonden.
    echo  Installeer Node.js opnieuw via https://nodejs.org/
    goto error
)

echo  Gevonden Node.js-versie:
node --version
if errorlevel 1 goto error

echo.
if not exist "node_modules\pdf-parse\package.json" (
    echo  Onderdelen worden geinstalleerd. Internet is nodig.
    echo.
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo.
        echo  FOUT: npm install is mislukt.
        echo  Controleer internet, foutmelding en eventuele antivirusblokkades.
        goto error
    )
)

echo.
echo  Website wordt gestart...
echo  Open in je browser: http://localhost:3000
echo  LAAT DIT VENSTER OPEN zolang je de site gebruikt.
echo.

rem Browser openen met een korte vertraging, zodat de server kan starten.
start "" /min cmd /d /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

node server.js
set "RESULT=%errorlevel%"
echo.
echo  De server is gestopt. Exitcode: %RESULT%
echo  Zie eventuele foutmeldingen hierboven.
goto end

:error
echo.
echo  Er is een probleem bij het starten van WoordSprint.
echo  Maak eventueel een foto van de foutmelding hierboven.

:end
echo.
echo  Dit venster blijft open om de foutmelding te kunnen lezen.
echo  Druk op een toets om dit script af te sluiten.
pause >nul
endlocal
