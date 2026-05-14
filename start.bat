@echo off
title VvE Beheer Platform

echo ================================================
echo   VvE Beheer Platform - Opstarten
echo ================================================
echo.

:: Backend
echo [1/2] Backend starten...
cd /d "%~dp0backend"

if not exist venv (
    echo   Virtuele omgeving aanmaken...
    py -m venv venv
)

call venv\Scripts\activate.bat

echo   Paketten installeren / controleren...
pip install -r requirements.txt -q

if not exist vve_beheer.db (
    echo   Demo data aanmaken...
    py seed.py
)

echo   Backend starten op http://localhost:8000
start "VvE Backend" cmd /k "call venv\Scripts\activate.bat && uvicorn app.main:app --reload"

:: Even wachten zodat de backend opstart
timeout /t 3 /nobreak >nul

:: Frontend
cd /d "%~dp0frontend"

if exist node_modules (
    echo [2/2] Frontend starten op http://localhost:5173
    start "VvE Frontend" cmd /k "npm run dev"
    timeout /t 3 /nobreak >nul
    start http://localhost:5173
) else (
    echo [2/2] Node.js / npm niet gevonden.
    echo.
    echo   Installeer Node.js via: https://nodejs.org
    echo   Daarna: cd frontend ^&^& npm install
    echo.
    echo   Backend API docs: http://localhost:8000/docs
    start http://localhost:8000/docs
)

echo.
echo Druk op een toets om dit venster te sluiten...
pause >nul
