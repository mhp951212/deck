@echo off
chcp 65001 >nul
title LAN Poker
echo ==========================================
echo   LAN Poker - Texas Holdem
echo   Starting...
echo ==========================================
echo.

cd /d "%~dp0"

rem Clear ELECTRON_RUN_AS_NODE to prevent Electron running as plain Node.js
set "ELECTRON_RUN_AS_NODE="

rem Check Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    echo Download: https://nodejs.org
    pause
    exit /b 1
)

rem Build client (ensures latest UI code is used)
echo Building client...
call npm run build:client
if errorlevel 1 (
    echo [ERROR] Client build failed. See messages above.
    pause
    exit /b 1
)

rem Start Electron app (server included)
echo Starting app...
call npx electron .

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to start. See messages above.
    pause
)
