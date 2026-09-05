@echo off
title Push ERP to GitHub
echo ===================================================
echo        Antigravity Enterprise ERP - GitHub Push
echo ===================================================
echo.
set /p REPO_URL="Enter your GitHub Repository URL (e.g. https://github.com/username/erp.git): "

if "%REPO_URL%"=="" (
    echo [ERROR] Repository URL cannot be empty!
    pause
    exit /b
)

echo.
echo [1/3] Adding remote origin...
git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%

echo [2/3] Setting branch to main...
git branch -M main

echo [3/3] Pushing all code to GitHub...
git push -u origin main

echo.
echo ===================================================
echo  Code successfully pushed to GitHub!
echo  Now open https://vercel.com/new and import your repo!
echo ===================================================
pause
