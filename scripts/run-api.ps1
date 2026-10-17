# PowerShell script to run the LMS API server
param(
    [int]$Port = 8080
)

# Set environment variables
$env:DATABASE_URL = "postgres://postgres:postgres@localhost:5432/lms_dev?sslmode=disable"
$env:REDIS_URL = "redis://localhost:6379"
$env:JWT_SECRET = "dev-jwt-secret-key-for-development"
$env:PORT = $Port

# Change to API directory
Set-Location "C:\Users\EngrBry\Desktop\New folder\packages\api"

# Run the Go server
Write-Host "Starting LMS API Server on port $Port..." -ForegroundColor Green
& "C:\Program Files\Go\bin\go.exe" run cmd\server\main.go