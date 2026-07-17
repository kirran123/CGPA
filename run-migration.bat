@echo off
echo 📦 Step 1: Deploying functions to Production Convex...
cd frontend
call npx convex deploy
if %errorlevel% neq 0 (
    echo ❌ Production deployment failed.
    cd ..
    exit /b %errorlevel%
)
cd ..

echo 🚚 Step 2: Running migration to Production Convex...
set CONVEX_URL=https://gallant-duck-837.convex.cloud
node scripts/migrate-to-convex.js
if %errorlevel% neq 0 (
    echo ❌ Production migration failed.
) else (
    echo ✅ Production migration successful!
)

echo.
echo 📦 Step 3: Syncing functions to Development Convex (aromatic-crow-956)...
echo Starting local Convex dev watcher in background to sync functions...
start "convex-dev-watcher" /min cmd /c "cd frontend && npx convex dev"
echo Waiting 12 seconds for sync to complete...
timeout /t 12 /nobreak

echo 🚚 Step 4: Running migration to Development Convex...
set CONVEX_URL=https://aromatic-crow-956.convex.cloud
node scripts/migrate-to-convex.js
if %errorlevel% neq 0 (
    echo ❌ Development migration failed.
) else (
    echo ✅ Development migration successful!
)

echo.
echo 🧹 Cleaning up background Convex watcher...
taskkill /fi "windowtitle eq convex-dev-watcher*" /f >nul 2>&1
echo Done! All migrations completed.
pause
