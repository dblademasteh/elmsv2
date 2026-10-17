# LMS Database Test Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "       LMS Database Test Script        " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test PostgreSQL Connection
Write-Host "Testing PostgreSQL Connection..." -ForegroundColor Yellow
$pgResult = docker exec lms-postgres pg_isready -U postgres 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ PostgreSQL is ready and accepting connections" -ForegroundColor Green
} else {
    Write-Host "❌ PostgreSQL connection failed" -ForegroundColor Red
    exit 1
}

# List Users
Write-Host "`n📋 USERS:" -ForegroundColor Yellow
Write-Host "--------" -ForegroundColor DarkGray
$users = docker exec lms-postgres psql -U postgres -d lms_dev -c "SELECT full_name, email, role FROM users;" -t 2>$null
Write-Host $users

# List Courses
Write-Host "`n📚 COURSES:" -ForegroundColor Yellow
Write-Host "----------" -ForegroundColor DarkGray
$courses = docker exec lms-postgres psql -U postgres -d lms_dev -c "SELECT title, price_cents, status FROM courses;" -t 2>$null
Write-Host $courses

# List Enrollments
Write-Host "`n👤 ENROLLMENTS:" -ForegroundColor Yellow
Write-Host "---------------" -ForegroundColor DarkGray
$enrollments = docker exec lms-postgres psql -U postgres -d lms_dev -c "SELECT u.full_name, c.title, e.progress_percent FROM enrollments e JOIN users u ON e.user_id = u.id JOIN courses c ON e.course_id = c.id;" -t 2>$null
Write-Host $enrollments

Write-Host ""
Write-Host "✅ Database test complete!" -ForegroundColor Green
Write-Host ""