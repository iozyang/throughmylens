# One-command mobile device testing for the public homepage.
#
# Usage (from the project root):
#   powershell -ExecutionPolicy Bypass -File .\scripts\dev-mobile.ps1
#
# Starts `next dev` bound to 0.0.0.0 so a phone on the same Wi-Fi can reach it,
# prints the LAN URLs to open, and ensures the Windows firewall allows inbound
# TCP on port 3000. See docs/mobile-testing.md for the manual checklist.

param([ValidateRange(1, 65535)][int]$Port = 3000)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$webRoot = Join-Path $projectRoot 'apps\web'
$ruleName = "throughmylens-web-dev-$Port"

$next = Join-Path $webRoot 'node_modules\.bin\next.cmd'
if (-not (Test-Path -LiteralPath $next)) {
    throw "Next.js is not installed in $webRoot. Run 'corepack pnpm install' first (see README.md)."
}

$addresses = @(
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
        Select-Object -ExpandProperty IPAddress
)

Write-Host ''
Write-Host 'Mobile device testing' -ForegroundColor Cyan
Write-Host '=====================' -ForegroundColor Cyan

if ($addresses.Count -eq 0) {
    Write-Host 'No LAN IPv4 address detected. Run `ipconfig` and use the WLAN IPv4 address manually.' -ForegroundColor Yellow
} else {
    Write-Host 'On a phone connected to the same Wi-Fi, open:'
    foreach ($ip in $addresses) {
        Write-Host "  http://${ip}:${port}/zh   (Chinese)" -ForegroundColor Green
        Write-Host "  http://${ip}:${port}/en   (English)" -ForegroundColor Green
    }
    Write-Host "Pick the address in your phone's subnet (usually 192.168.x.x or 10.x.x.x)."
}

if (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue) {
    Write-Host "Firewall rule '$ruleName' already present." -ForegroundColor Green
} else {
    try {
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow | Out-Null
        Write-Host "Firewall rule '$ruleName' created." -ForegroundColor Green
    } catch {
        Write-Host 'Could not create the firewall rule (requires Administrator). Run once as Administrator:' -ForegroundColor Yellow
        Write-Host "  New-NetFirewallRule -DisplayName '$ruleName' -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow" -ForegroundColor Yellow
    }
}

Write-Host 'Press Ctrl+C to stop.' -ForegroundColor Cyan
Write-Host ''

Push-Location $webRoot
try {
    & $next dev -p $port -H 0.0.0.0
} finally {
    Pop-Location
}
