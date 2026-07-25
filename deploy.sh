#!/bin/bash
# deploy.sh — Run this script ON the production server via SSH
# Usage: bash deploy.sh

set -e

echo "========================================"
echo " RIT CGPA Portal — Production Deploy"
echo "========================================"

# Change to project root (update this path if needed)
cd ~/CGPA || cd /var/www/CGPA || cd /home/*/CGPA || { echo "ERROR: Cannot find CGPA folder. Update the path in this script."; exit 1; }

echo ""
echo "[1/4] Pulling latest code from GitHub..."
git pull origin main

echo ""
echo "[2/4] Installing frontend dependencies..."
cd frontend
npm install --prefer-offline

echo ""
echo "[3/4] Building frontend..."
npm run build

echo ""
echo "[4/4] Deploying Convex backend functions..."
npx convex dev --once

echo ""
echo "========================================"
echo " Deployment complete!"
echo " Site: https://cgpa.ritrjpm.ac.in"
echo "========================================"
