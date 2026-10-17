# LMS Development Environment Setup Script (Windows)
# Run this script in PowerShell

param(
    [switch]$SkipChecks = $false
)

Write-Host "🚀 Setting up LMS Development Environment..." -ForegroundColor Cyan
Write-Host "=============================================="

function Check-Command {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

Write-Host ""
Write-Host "📋 Checking prerequisites..." -ForegroundColor Yellow

$MissingTools = @()

# Check Go
if (Check-Command "go") {
    Write-Host "✓ Go is installed" -ForegroundColor Green
} else {
    Write-Host "✗ Go is not installed" -ForegroundColor Red
    $MissingTools += "Go"
}

# Check Node.js
if (Check-Command "node") {
    Write-Host "✓ Node.js is installed" -ForegroundColor Green
} else {
    Write-Host "✗ Node.js is not installed" -ForegroundColor Red
    $MissingTools += "Node.js"
}

# Check pnpm
if (Check-Command "pnpm") {
    Write-Host "✓ pnpm is installed" -ForegroundColor Green
} else {
    Write-Host "⚠ pnpm not found, will install during setup" -ForegroundColor Yellow
}

# Check Docker
if (Check-Command "docker") {
    Write-Host "✓ Docker is installed" -ForegroundColor Green
} else {
    Write-Host "✗ Docker is not installed" -ForegroundColor Red
    $MissingTools += "Docker"
}

if ($MissingTools.Count -gt 0) {
    Write-Host ""
    Write-Host "⚠️ Some tools are missing: $($MissingTools -join ', ')" -ForegroundColor Red
    Write-Host ""
    Write-Host "Install instructions:"
    Write-Host "  Go:        winget install Go.Labs"
    Write-Host "  Node.js:   winget install OpenJS.NodeJS"
    Write-Host "  pnpm:      npm install -g pnpm"
    Write-Host "  Docker:    winget install Docker.DockerDesktop"
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "🔧 Setting up environment..." -ForegroundColor Yellow

# Create .env file
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" -Destination ".env"
    Write-Host "Created .env file from .env.example" -ForegroundColor Green
    Write-Host "⚠️  Please edit .env with your configuration" -ForegroundColor Yellow
} else {
    Write-Host ".env file already exists" -ForegroundColor Green
}

# Create directory structure
Write-Host "📁 Creating directory structure..." -ForegroundColor Yellow
$dirs = @("packages/api", "packages/web", "packages/mobile", "docs/api", "docs/adr", "docs/posts", "infra/terraform", "infra/kubernetes", "scripts", "tests/unit", "tests/integration", "tests/e2e")
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}
Write-Host "✓ Created directory structure" -ForegroundColor Green

# Install pnpm if needed
if (-not (Check-Command "pnpm")) {
    Write-Host "Installing pnpm..." -ForegroundColor Yellow
    npm install -g pnpm
}

# Start Docker containers
Write-Host ""
Write-Host "🐳 Starting Docker containers..." -ForegroundColor Yellow
docker-compose up -d

Write-Host "Waiting for containers to be healthy..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Wait for PostgreSQL
Write-Host "Waiting for PostgreSQL..." -ForegroundColor Yellow
do {
    Start-Sleep -Milliseconds 500
    $result = docker exec lms-postgres pg_isready -U postgres 2>&1
} while ($LASTEXITCODE -ne 0)
Write-Host "✓ PostgreSQL is ready" -ForegroundColor Green

# Wait for Redis
Write-Host "Waiting for Redis..." -ForegroundColor Yellow
do {
    Start-Sleep -Milliseconds 500
    $result = docker exec lms-redis redis-cli ping 2>&1
} while ($LASTEXITCODE -ne 0)
Write-Host "✓ Redis is ready" -ForegroundColor Green

Write-Host ""
Write-Host "🎯 Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Edit .env file with your configuration"
Write-Host "  2. Run database migrations (when available)"
Write-Host "  3. Start development servers:"
Write-Host "     - API:    cd packages/api; go run cmd/server/main.go"
Write-Host "     - Web:    cd packages/web; pnpm install; pnpm dev"
Write-Host ""
Write-Host "Access points:" -ForegroundColor Cyan
Write-Host "  Web:        http://localhost:3000"
Write-Host "  API:        http://localhost:8080"
Write-Host "  PGAdmin:    http://localhost:5050"
Write-Host "  Redis Cmd:  http://localhost:8081"
Write-Host "  MailHog:    http://localhost:8025"
Write-Host "  MinIO:      http://localhost:9001 (minioadmin:minioadmin123)"
Write-Host ""
Write-Host "Happy coding! 🎉" -ForegroundColor Green