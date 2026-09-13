$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$apiRoot = Join-Path $projectRoot 'apps\api'
$pythonPath = Join-Path $apiRoot '.venv\Scripts\python.exe'

if (-not (Test-Path -LiteralPath $pythonPath)) {
    throw 'API virtual environment is missing. Follow the installation instructions in README.md.'
}

Push-Location $apiRoot
try {
    & $pythonPath -m app.cli init-storage
    if ($LASTEXITCODE -ne 0) {
        throw 'Storage is not ready. Start MinIO and check the S3 settings in .env before retrying.'
    }
    & $pythonPath -m uvicorn app.main:app --app-dir $apiRoot --reload-dir (Join-Path $apiRoot 'app') --reload --host 127.0.0.1 --port 8000
} finally {
    Pop-Location
}
