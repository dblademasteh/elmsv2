#!/bin/bash

# Exit on error
set -e

echo "🚀 LMS API Startup Script"
echo "=========================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Creating from example..."
    cp .env.example .env 2>/dev | || true
    echo "✅ Please edit .env file with your database credentials"
    exit 1
fi

# Check if required services are available
echo "🔍 Checking services..."

# Check PostgreSQL
if docker ps 2>/dev/null | grep -q "lms-postgres\|postgres"; then
    echo "✅ PostgreSQL is running"
else
    echo "🔄 Starting PostgreSQL..."
    docker-compose up -d postgres redis
    sleep 3
fi

# Initialize database
echo "🌱 Initializing database..."
python scripts/init_db.py || python3 scripts/init_db.py

# Start API server
echo ""
echo "🚀 Starting LMS API Server..."
echo "=============================="
echo ""

# Try using uvicorn directly
export $(grep -v '^#' .env | xargs)
uvicorn app.main:app \
    --host 0.0.0.0 \
    --port ${PORT:-8080} \
    --reload \
    --log-level info \
    --workers 1

echo "✅ LMS API Server started successfully!"