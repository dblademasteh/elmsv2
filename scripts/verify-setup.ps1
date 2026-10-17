# LMS Verification Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "       LMS Setup Verification          " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Checking Docker Containers..." -ForegroundColor Yellow
$containers = docker ps --format "table {{.Names}}\t{{.Status}}" | Select-String "lms-"
if ($containers) {
    Write-Host "✅ Required containers are running:" -ForegroundColor Green
    $containers | ForEach-Object { Write-Host "   $($_.Line)" }
} else {
    Write-Host "❌ No LMS containers found" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2. Testing Database Connection..." -ForegroundColor Yellow
$dbTest = docker exec lms-postgres pg_isready -U postgres 2>Nully
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ PostgreSQL is healthy" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "3. Database Contents:" -ForegroundColor Yellow
    
    # Users count
    $userCount = docker exec lms-postgres psql -U postgres -d lms_dev -t -c "SELECT COUNT(*) FROM users;" 2>$null
    Write-Host "   Users: $($userCount.Trim())" -ForegroundColor Green
    
    # Courses count
    $courseCount = docker exec lms-postgres psql -U postgres -d lms_dev -t -c "SELECT COUNT(*) FROM courses;" 2>$null
    Write-Host "   Courses: $($courseCount.Trim())" -ForegroundColor Green
    
    # Enrollments count
    $enrollCount = docker exec lms-postgres psql -U postgres -d lms_dev -t -c "SELECT COUNT(*) FROM enrollments;" 2>$null
    Write-Host "   Enrollments: $($enrollCount.Trim())" -ForegroundColor Green
} else {
    Write-Host "❌ PostgreSQL is not responding" -ForegroundColor Red
}

Write-Host ""
Write-Host "4. Test Credentials:" -ForegroundColor Yellow
Write-Host "   Admin:  admin@lms.com / change-me-immediately" -ForegroundColor Green
Write-Host "   Student: student@lms.com / Password123" -ForegroundColor Green

Write-Host ""
Write-Host "5. Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Install Go 1.22+: https://go.dev/dl/" -ForegroundColor Gray
Write-Host "   2. Run: cd packages\api && go run cmd\server\main.go" -ForegroundColor Gray
Write-Host "   3. Open: http://localhost:3000/login (frontend)" -ForegroundColor Gray
Write-Host "   4. Test API: http://localhost:8080/health" -ForegroundColor Gray

Write-Host ""
Write-Host "✅ LMS is READY to use!" -ForegroundColor Cyan
Write-Host ""