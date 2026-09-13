$Host.UI.RawUI.WindowTitle = "ThroughMyLens - Service Launcher"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$DockerDesktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"

function Test-DockerEngine {
    cmd.exe /c "docker info >nul 2>&1"
    return ($LASTEXITCODE -eq 0)
}

Write-Host "Checking Docker..."

if (-not (Test-DockerEngine)) {
    Write-Host "Docker Desktop is not running. Starting it..."

    if (-not (Test-Path -LiteralPath $DockerDesktop)) {
        throw "Docker Desktop executable was not found at: $DockerDesktop"
    }

    Start-Process -FilePath $DockerDesktop

    Write-Host "Waiting for Docker Engine to become ready..."

    $DockerReady = $false

    for ($i = 1; $i -le 60; $i++) {
        Start-Sleep -Seconds 2

        if (Test-DockerEngine) {
            $DockerReady = $true
            break
        }

        Write-Host "Waiting for Docker... ($($i * 2)s)"
    }

    if (-not $DockerReady) {
        throw "Docker Engine did not become ready within 120 seconds."
    }
}

Write-Host "Docker Engine is ready."

Write-Host "Starting Docker services..."
docker compose up -d postgres minio minio-init

if ($LASTEXITCODE -ne 0) {
    throw "Docker services failed to start."
}

Write-Host "Waiting for PostgreSQL and MinIO..."
Start-Sleep -Seconds 8

Write-Host "Starting FastAPI..."
Start-Process powershell.exe -ArgumentList `
    "-NoExit", `
    "-ExecutionPolicy", "Bypass", `
    "-File", "`"$PSScriptRoot\start-api.ps1`""

Start-Sleep -Seconds 5

Write-Host "Starting Cloudflare Tunnel..."
Start-Process powershell.exe -ArgumentList `
    "-NoExit", `
    "-ExecutionPolicy", "Bypass", `
    "-File", "`"$PSScriptRoot\start-tunnel.ps1`""

Write-Host ""
Write-Host "ThroughMyLens services started."
Write-Host "FastAPI: http://localhost:8000"
Write-Host "Swagger: http://localhost:8000/docs"