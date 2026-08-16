param(
    [switch]$OpenPort,
    [switch]$ClosePort
)

# ==============================================================================
# Offline Hackathon Report Contest - Server Control Center
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$RuleName = "Offline Contest Server (Port 3000)"
$Port = 3000
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Test-IsAdmin {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-FirewallStatus {
    try {
        $rule = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
        if ($rule -and $rule.Enabled -eq 'True') {
            return $true
        }
    } catch {}
    return $false
}

function Invoke-OpenPortLogic {
    $nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $nodePath) { $nodePath = "C:\Program Files\nodejs\node.exe" }
    
    Get-NetFirewallRule -DisplayName "*Node.js*" -ErrorAction SilentlyContinue | Where-Object { $_.Action -eq 'Block' } | Remove-NetFirewallRule -ErrorAction SilentlyContinue
    Remove-NetFirewallRule -DisplayName "Node.js Server Runtime (Allow All)" -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName "Node.js Server Runtime (Allow All)" -Direction Inbound -Program $nodePath -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null
    Remove-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName $RuleName -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null
    Get-NetConnectionProfile -InterfaceAlias "*Wi-Fi*" -ErrorAction SilentlyContinue | Set-NetConnectionProfile -NetworkCategory Private -ErrorAction SilentlyContinue
    Write-Host "SUCCESS: Port $Port and Node.js are unblocked on all networks." -ForegroundColor Green
    Start-Sleep -Seconds 2
}

function Invoke-ClosePortLogic {
    Remove-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
    Remove-NetFirewallRule -DisplayName "Node.js Server Runtime (Allow All)" -ErrorAction SilentlyContinue
    Get-NetConnectionProfile -InterfaceAlias "*Wi-Fi*" -ErrorAction SilentlyContinue | Set-NetConnectionProfile -NetworkCategory Public -ErrorAction SilentlyContinue
    Write-Host "SUCCESS: Port $Port is closed. Machine locked down to original state." -ForegroundColor Green
    Start-Sleep -Seconds 2
}

# Handle standalone elevated execution directly from self
if ($OpenPort) {
    Invoke-OpenPortLogic
    exit
}

if ($ClosePort) {
    Invoke-ClosePortLogic
    exit
}

function Open-Port3000 {
    if (-not (Test-IsAdmin)) {
        Write-Host ""
        Write-Host "[!] Administrator privileges required. Prompting for permission..." -ForegroundColor Yellow
        Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`"", "-OpenPort" -Wait
    } else {
        Invoke-OpenPortLogic
    }
}

function Close-Port3000 {
    if (-not (Test-IsAdmin)) {
        Write-Host ""
        Write-Host "[!] Administrator privileges required. Prompting for permission..." -ForegroundColor Yellow
        Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`"", "-ClosePort" -Wait
    } else {
        Invoke-ClosePortLogic
    }
}

function Build-Client {
    Write-Host ""
    Write-Host "[*] Building optimized frontend client..." -ForegroundColor Cyan
    Set-Location $ScriptDir
    npm run build
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  -> Frontend build successful!" -ForegroundColor Green
    } else {
        Write-Host "  -> [ERROR] Frontend build failed." -ForegroundColor Red
    }
}

function Clean-Database {
    Write-Host ""
    Write-Host "[!] Resetting database to a clean contest state..." -ForegroundColor Yellow
    $confirm = Read-Host "Are you sure you want to delete all current participant submissions? (y/N)"
    if ($confirm -eq "y" -or $confirm -eq "Y") {
        Set-Location $ScriptDir
        node server/clean_db.js
        Write-Host "  -> Database reset complete." -ForegroundColor Green
    } else {
        Write-Host "  -> Database reset cancelled." -ForegroundColor DarkGray
    }
}

function Run-StressTest {
    Write-Host ""
    Write-Host "[*] Running 50-participant concurrency stress test..." -ForegroundColor Cyan
    Set-Location $ScriptDir
    npm run test:stress
}

function Start-Server {
    Set-Location $ScriptDir
    
    # 1. Check if client is built
    $distPath = Join-Path $ScriptDir "client\dist\index.html"
    if (-not (Test-Path $distPath)) {
        Write-Host ""
        Write-Host "[!] Frontend build not found. Running build first..." -ForegroundColor Yellow
        Build-Client
    }

    # 2. Check firewall status and advise
    $isOpen = Get-FirewallStatus
    if (-not $isOpen) {
        Write-Host ""
        Write-Host "[*] Note: Firewall Port $Port is currently CLOSED. Opening now..." -ForegroundColor Yellow
        Open-Port3000
    }

    Write-Host ""
    Write-Host "==============================================================" -ForegroundColor Cyan
    Write-Host "  Launching Offline Contest Server..." -ForegroundColor Green
    Write-Host "  (Press Ctrl + C anytime in this window to stop the server)" -ForegroundColor DarkGray
    Write-Host "==============================================================`n" -ForegroundColor Cyan

    # Launch browser after 2 seconds in background
    Start-Job -ScriptBlock {
        Start-Sleep -Seconds 2
        Start-Process "http://localhost:3000/#/admin"
    } | Out-Null

    # Start the server process with auto-cleanup on exit
    try {
        node server/server.js
    } finally {
        Write-Host ""
        Write-Host "==============================================================" -ForegroundColor Yellow
        Write-Host "  Offline Contest Server has stopped." -ForegroundColor Yellow
        Write-Host "==============================================================" -ForegroundColor Yellow
        $closeAns = Read-Host "Do you want to CLOSE Firewall Port $Port and LOCK DOWN your laptop now? (Y/n)"
        if ($closeAns -ne "n" -and $closeAns -ne "N") {
            Close-Port3000
        }
    }
}

function Show-Menu {
    Clear-Host
    $isOpen = Get-FirewallStatus
    $statusColor = "Red"
    $statusText = "CLOSED (Localhost Only)"
    if ($isOpen) {
        $statusColor = "Green"
        $statusText = "OPEN (Participants Can Connect)"
    }

    Write-Host "==============================================================" -ForegroundColor Cyan
    Write-Host "     OFFLINE REPORT CONTEST - SERVER CONTROL CENTER           " -ForegroundColor Yellow
    Write-Host "==============================================================" -ForegroundColor Cyan
    Write-Host " Current Host Port 3000 Status: " -NoNewline
    Write-Host "[$statusText]" -ForegroundColor $statusColor
    Write-Host "==============================================================" -ForegroundColor Cyan
    Write-Host " [1] Start Contest Server (Launches Admin Dashboard)" -ForegroundColor Green
    Write-Host " [2] Open Firewall Port 3000 (Allow Other Laptops to Connect)" -ForegroundColor Cyan
    Write-Host " [3] Close Firewall Port 3000 (Lockdown Port After Contest)" -ForegroundColor Yellow
    Write-Host " [4] Rebuild Frontend Client (npm run build)" -ForegroundColor White
    Write-Host " [5] Reset / Clean Database (Start Fresh Contest)" -ForegroundColor DarkYellow
    Write-Host " [6] Run Pre-Flight Concurrency Stress Test" -ForegroundColor Magenta
    Write-Host " [7] Exit" -ForegroundColor DarkGray
    Write-Host "==============================================================" -ForegroundColor Cyan
}

# --- Main Interaction Loop ---
$running = $true
while ($running) {
    Show-Menu
    $choice = Read-Host "Enter your choice (1-7)"
    switch ($choice) {
        "1" { Start-Server; $running = $false }
        "2" { Open-Port3000; Start-Sleep -Seconds 2 }
        "3" { Close-Port3000; Start-Sleep -Seconds 2 }
        "4" { Build-Client; Read-Host "Press Enter to return to menu..." | Out-Null }
        "5" { Clean-Database; Read-Host "Press Enter to return to menu..." | Out-Null }
        "6" { Run-StressTest; Read-Host "Press Enter to return to menu..." | Out-Null }
        "7" { Write-Host "Goodbye!"; $running = $false }
        Default { Write-Host "Invalid option. Please choose between 1 and 7." -ForegroundColor Red; Start-Sleep -Seconds 1 }
    }
}
