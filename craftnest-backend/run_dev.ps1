param (
    [switch]$lan
)

# Activate the virtual environment
if (Test-Path ".venv\Scripts\Activate.ps1") {
    .venv\Scripts\Activate.ps1
} else {
    Write-Warning "Virtual environment not found at .venv\Scripts\Activate.ps1. Attempting to run uvicorn directly."
}

# Determine host and certificate files
if ($lan) {
    $host = "0.0.0.0"
    $certFile = "certs/lan.pem"
    $keyFile = "certs/lan-key.pem"
    Write-Host "Starting server in LAN mode (host=$host) using LAN certificate."
} else {
    $host = "127.0.0.1"
    $certFile = "certs/localhost.pem"
    $keyFile = "certs/localhost-key.pem"
    Write-Host "Starting server in localhost mode (host=$host) using default certificate."
}

uvicorn app.main:app --reload `
    --host $host --port 8443 `
    --ssl-keyfile $keyFile `
    --ssl-certfile $certFile
