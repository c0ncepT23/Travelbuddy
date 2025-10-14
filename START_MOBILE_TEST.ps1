# Quick start script for mobile testing
Write-Host "`n=== TRAVEL AGENT MOBILE TEST SETUP ===" -ForegroundColor Cyan
Write-Host ""

# Check if backend is running
Write-Host "1. Checking backend status..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://192.168.1.35:3000/health" -TimeoutSec 3
    if ($health.success) {
        Write-Host "   ✅ Backend is running!" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ Backend is NOT running!" -ForegroundColor Red
    Write-Host "   Please start backend first: cd backend; npm run dev" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "2. Mobile app configuration:" -ForegroundColor Yellow
Write-Host "   ✅ API URL configured: http://192.168.1.35:3000/api" -ForegroundColor Green
Write-Host ""

Write-Host "3. Next steps:" -ForegroundColor Yellow
Write-Host "   a. cd mobile" -ForegroundColor White
Write-Host "   b. npm install (if not done)" -ForegroundColor White
Write-Host "   c. npm start" -ForegroundColor White
Write-Host "   d. Scan QR code with Expo Go on your phone" -ForegroundColor White
Write-Host ""

Write-Host "4. Test URLs to try:" -ForegroundColor Yellow
Write-Host "   YouTube (4 places):" -ForegroundColor White
Write-Host "   https://www.youtube.com/watch?v=bpknvpxqzlI" -ForegroundColor Gray
Write-Host ""
Write-Host "   Reddit (7 places):" -ForegroundColor White
Write-Host "   https://www.reddit.com/r/JapanTravelTips/comments/1n8qzji/wagyu_in_japan/" -ForegroundColor Gray
Write-Host ""

Write-Host "5. Troubleshooting:" -ForegroundColor Yellow
Write-Host "   • Ensure phone and computer on same WiFi" -ForegroundColor White
Write-Host "   • If firewall issues, see MOBILE_SETUP.md" -ForegroundColor White
Write-Host "   • Full guide: MOBILE_SETUP.md" -ForegroundColor White
Write-Host ""

Write-Host "Ready to start! 🚀" -ForegroundColor Green
Write-Host ""

