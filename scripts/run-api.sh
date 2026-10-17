#!/bin/bash
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/lms_dev?sslmode=disable"
export REDIS_URL="redis://localhost:6379"
export JWT_SECRET="dev-jwt-secret-key-for-development"
export PORT=8080

cd "$(dirname "$0")/../packages/api"
go run cmd/server/main.go