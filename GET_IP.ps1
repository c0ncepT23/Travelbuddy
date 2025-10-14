# Get your local IP address for mobile testing
Write-Host "`n=== FIND YOUR IP ADDRESS FOR MOBILE ===" -ForegroundColor Cyan
Write-Host ""

$ipAddresses = Get-NetIPAddress -AddressFamily IPv4 | 
    Where-Object {$_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -eq "Dhcp"} | 
    Select-Object IPAddress, InterfaceAlias

if ($ipAddresses.Count -gt 0) {
    Write-Host "Your local IP address(es):" -ForegroundColor Green
    foreach ($ip in $ipAddresses) {
        Write-Host "  • $($ip.IPAddress) ($($ip.InterfaceAlias))" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "Use the IP from your active WiFi/Ethernet connection" -ForegroundColor White
    Write-Host ""
    Write-Host "Backend URL should be: http://YOUR-IP:3000" -ForegroundColor Cyan
    Write-Host "Example: http://192.168.1.100:3000" -ForegroundColor Gray
} else {
    Write-Host "Could not find local IP. Try running: ipconfig" -ForegroundColor Red
}

Write-Host ""

