# PowerShell script to run LMS API locally

Write-Host "🚀 Starting LMS API Local Development Environment" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# Check if Python is available
$pythonCmd = $(if (Get-Command python -ErrorAction SilentlyContinue) { "python" } elseif (Get-Command python3 -ErrorAction SilentlyContinue) { "python3" } else { $null })
if ($null -eq $pythonCmd) {
    Write-Host "❌ Python not found. Please install Python 3.8+ first." -ForegroundColor Red
    exit 1
}

# Create virtual environment
if (-not (Test-Path -Path ".venv")) {
    Write-Host "🐍 Creating virtual environment..." -ForegroundColor Yellow
    & $pythonCmd -m venv .venv
}

# Activate virtual environment
Write-Host "🔧 Activating virtual environment..." -ForegroundColor Yellow
& .venv\Scripts\Activate.ps1

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
pip install -e . 2>nul || pip install -e ".[dev]"
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Installing basic dependencies..." -ForegroundColor Yellow
    pip install fastapi uvicorn python-jose[cryptography] passlib[bcrypt] databases[postgresql] python-dotenv httpx[async] pydantic[dotenv]
}

# Check if PostgreSQL is running
Write-Host "`n🔍 Checking PostgreSQL..." -ForegroundColor Yellow
$pgContainer = docker ps -qf "name=lms-postgres-dev" 2>$null
if ($pgContainer -ne $null -and $pgContainer -ne "") {
    Write-Host "✅ PostgreSQL container found" -ForegroundColor Green
} else {
    Write-Host "🐳 Starting PostgreSQL..." -ForegroundColor Yellow
    docker-compose up -d postgres redis
    Start-Sleep -Seconds 3
}

# Initialize database
Write-Host "`n🌱 Initializing database..." -ForegroundColor Yellow
python scripts/init_db.py

# Start the server
Write-Host "`n🚀 Starting API server..." -ForegroundColor Yellow
Write-Host "📍 Access the API at: http://localhost:8080" -ForegroundColor Green
Write-Host "📍 API Docs: http://localhost:8080/docs" -ForegroundColor Green
Write-Host "📍 Health Check: http://localhost:8080/health" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Cyan
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload