#!/bin/bash

# LMS Development Environment Setup Script
# Run this script to set up your local development environment

set -e

echo "🚀 Setting up LMS Development Environment..."
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    OS="windows"
fi

echo "Detected OS: $OS"

# Check for required tools
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓ $1 is installed${NC}"
        return 0
    else
        echo -e "${RED}✗ $1 is not installed${NC}"
        return 1
    fi
}

echo ""
echo "📋 Checking prerequisites..."

MISSING_TOOLS=0

# Check Go
if ! check_command go; then
    MISSING_TOOLS=1
fi

# Check Node.js
if ! check_command node; then
    MISSING_TOOLS=1
fi

# Check pnpm
if ! check_command pnpm; then
    echo "Installing pnpm..."
    npm install -g pnpm
fi

# Check Docker
if ! check_command docker; then
    MISSING_TOOLS=1
fi

# Check Docker Compose
if ! check_command docker-compose && ! docker compose version &> /dev/null; then
    MISSING_TOOLS=1
fi

if [ $MISSING_TOOLS -eq 1 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Some tools are missing. Please install them before continuing.${NC}"
    echo ""
    echo "Installation commands:"
    echo "  macOS (with Homebrew):"
    echo "    brew install go node pnpm docker docker-compose"
    echo ""
    echo "  Ubuntu/Debian:"
    echo "    sudo apt update && sudo apt install -y golang-go nodejs npm docker.io docker-compose"
    echo "    npm install -g pnpm"
    echo ""
    echo "  Windows:"
    echo "    winget install Go.Nodejs Go.Pubgo Go.Docker"
    echo "    npm install -g pnpm"
    echo ""
    exit 1
fi

echo ""
echo "🔧 Creating environment files..."

# Create .env file from example
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}Created .env file from .env.example${NC}"
    echo -e "${YELLOW}⚠️  Please edit .env with your configuration${NC}"
else
    echo -e "${GREEN}.env file already exists${NC}"
fi

echo ""
echo "📁 Creating package directories..."

# Create directory structure
mkdir -p packages/{api,web,mobile}
mkdir -p docs/{api,adr,posts}
mkdir -p infra/{terraform,kubernetes}
mkdir -p scripts
mkdir -p tests/{unit,integration,e2e}

echo -e "${GREEN}📁 Created directory structure${NC}"

echo ""
echo "🐳 Starting Docker containers..."

# Start Docker containers
if command -v docker-compose &> /dev/null; then
    docker-compose up -d
else
    docker compose up -d
fi

echo "Waiting for containers to be healthy..."
sleep 5

# Wait for PostgreSQL
echo "Waiting for PostgreSQL..."
until docker exec lms-postgres pg_isready -U postgres > /dev/null 2>&1; do
    sleep 1
done
echo -e "${GREEN}✓ PostgreSQL is ready${NC}"

# Wait for Redis
echo "Waiting for Redis..."
until docker exec lms-redis redis-cli ping > /dev/null 2>&1; do
    sleep 1
done
echo -e "${GREEN}✓ Redis is ready${NC}"

echo ""
echo "📦 Installing dependencies..."

# Check if packages have package.json files (skip if they don't exist yet)
if [ -d "packages/web" ] && [ -f "packages/web/package.json" ]; then
    cd packages/web
    pnpm install
    cd ../..
fi

echo ""
echo "🎯 Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env file with your configuration"
echo "  2. Run database migrations (when available)"
echo "  3. Start development servers:"
echo "     - API:    cd packages/api && go run cmd/server/main.go"
echo "     - Web:    cd packages/web && pnpm dev"
echo ""
echo "Access points:"
echo "  - API:        http://localhost:8080"
echo "  - Web:        http://localhost:3000"
echo "  - PGAdmin:    http://localhost:5050"
echo "  - Redis Cmd:  http://localhost:8081"
echo "  - MailHog:    http://localhost:8025"
echo "  - MinIO:      http://localhost:9001 (minioadmin:minioadmin123)"
echo "  - Adminer:    http://localhost:8080"
echo ""
echo -e "${GREEN}Happy coding! 🎉${NC}"