@echo off
echo ========================================
echo  Deploying Convex Backend Functions...
echo ========================================
cd /d "%~dp0frontend"
echo.
echo Running: npx convex dev --once
echo (A browser window will open to authenticate if needed)
echo.
npx convex dev --once
echo.
echo ========================================
echo  Done! Press any key to close.
echo ========================================
pause
