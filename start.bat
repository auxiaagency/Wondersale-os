@echo off
setlocal EnableDelayedExpansion
title Wondersale Retail System - Starter
cd /d "%~dp0"

echo ===================================================
echo           Starting Wondersale Retail System
echo ===================================================
echo.

:: 1. Verify Python is installed on the system
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "PYTHON_CMD=python"
    goto :PYTHON_FOUND
)

where py >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "PYTHON_CMD=py"
    goto :PYTHON_FOUND
)

echo [!] Python is not found on your system PATH.
echo     Please install Python 3.10+ from https://www.python.org/
echo     IMPORTANT: Check "Add python.exe to PATH" during installation.
echo.
pause
exit /b 1

:PYTHON_FOUND

:: 2. Check and Setup Python Virtual Environment (backend\venv)
if not exist "backend\venv\Scripts\python.exe" goto :CREATE_VENV

:: Check if the existing virtual environment is valid and functional on this machine
backend\venv\Scripts\python.exe -c "import sys" >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [*] Detected an invalid or copied virtual environment from another machine.
    echo [*] Re-creating virtual environment for this machine...
    rmdir /s /q "backend\venv"
    goto :CREATE_VENV
)

:: Check if backend requirements are installed (test import of django)
backend\venv\Scripts\python.exe -c "import django" >nul 2>nul
if %ERRORLEVEL% neq 0 goto :INSTALL_REQ

goto :CHECK_NODE

:CREATE_VENV
echo [*] Python virtual environment not found in backend\venv.
echo [*] Automatically creating virtual environment...
%PYTHON_CMD% -m venv backend\venv
if %ERRORLEVEL% neq 0 (
    echo [!] Failed to create virtual environment with %PYTHON_CMD%.
    echo     Please verify your Python installation.
    pause
    exit /b 1
)
echo [*] Virtual environment created successfully.

:INSTALL_REQ
echo [*] Installing backend dependencies from backend\requirements.txt...
backend\venv\Scripts\python.exe -m pip install --upgrade pip
backend\venv\Scripts\pip.exe install -r backend\requirements.txt
if %ERRORLEVEL% neq 0 (
    echo [!] Failed to install Python dependencies. Please check your internet connection.
    pause
    exit /b 1
)
echo [*] Backend requirements installed successfully.

:CHECK_NODE
:: 3. Check Node.js and npm
where npm >nul 2>nul
if %ERRORLEVEL% equ 0 goto :NPM_FOUND

echo [!] Node.js / npm was not found on your system PATH.
echo     Please install Node.js LTS from https://nodejs.org/
echo.
pause
exit /b 1

:NPM_FOUND

:: 4. Check Node modules in frontend
if exist "frontend\node_modules\vite" goto :RUN_MIGRATIONS

echo [*] Frontend dependencies not found. Installing dependencies via npm...
cd frontend
call npm install
if %ERRORLEVEL% neq 0 (
    echo [!] npm install failed. Please check your internet connection.
    cd ..
    pause
    exit /b 1
)
cd ..
echo [*] Frontend dependencies installed successfully.

:RUN_MIGRATIONS
:: 5. Ensure media folder exists and run database migrations
if not exist "backend\media" mkdir "backend\media"

echo [*] Checking and applying database migrations...
backend\venv\Scripts\python.exe backend\manage.py migrate --no-input
if %ERRORLEVEL% neq 0 (
    echo [!] Database migration failed. Please check your configuration.
    pause
    exit /b 1
)

echo.
echo [*] Starting Django API Backend on http://127.0.0.1:8000/
start "Wondersale Backend (Django)" /D "%~dp0backend" cmd /k ".\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000"

echo [*] Starting React Frontend on http://localhost:5173/
start "Wondersale Frontend (Vite)" /D "%~dp0frontend" cmd /k "npm run dev"

echo.
echo [*] Waiting for services to initialize...
timeout /t 3 /nobreak >nul

echo [*] Opening Wondersale in your default browser...
start http://localhost:5173/

echo.
echo ===================================================
echo   Wondersale is running!
echo.
echo   - Web UI:      http://localhost:5173/
echo   - REST API:    http://127.0.0.1:8000/api/inventory/
echo   - Admin Panel: http://127.0.0.1:8000/admin/
echo.
echo   Two background windows have been opened for the
echo   backend and frontend. Close them to stop servers.
echo ===================================================
echo.
pause
