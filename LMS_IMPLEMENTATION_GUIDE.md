# LMS Implementation Guide

## Getting Started

This guide provides step-by-step instructions to set up the LMS development environment and start building the MVP features.

---

## 1. Project Structure

```
lms/
├── README.md
├── docker-compose.yml
├── .env.example
├── packages/
│   ├── api/                    # Main API gateway
│   │   ├── cmd/
│   │   │   └── server/
│   │   ├── internal/
│   │   │   ├── user/           # User service
│   │   │   ├── course/         # Course service
│   │   │   ├── content/        # Content service
│   │   │   ├── quiz/           # Quiz service
│   │   │   ├── ecommerce/      # Payment service
│   │   │   └── messaging/      # Real-time messaging
│   │   ├── pkg/
│   │   │   ├── auth/
│   │   │   ├── database/
│   │   │   ├── redis/
│   │   │   └── grpc/
│   │   └── go.mod
│   ├── web/                    # Frontend app
│   │   ├── src/
│   │   │   ├── app/            # App Router pages
│   │   │   ├── components/   # Shared components
│   │   │   ├── lib/            # Utils, API client
│   │   │   ├── store/          # State management
│   │   │   └── types/          # TypeScript types
│   │   ├── public/
│   │   ├── next.config.js
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── mobile/                 # React Native mobile app
├── infra/
│   ├── terraform/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── kubernetes/
│       ├── deployments/
│       ├── services/
│       └── ingress/
├── docs/
│   ├── api-spec.yaml          # OpenAPI 3.1 spec
│   └── architecture.md        # Architecture docs
└── scripts/
    ├── setup-dev.sh
    ├── migrate-db.sh
    └── deploy.sh
```

---

## 2. Development Environment Setup

### Prerequisites
- Docker & Docker Compose
- Go 1.22+
- Node.js 18+ (with pnpm)
- PostgreSQL 15+
- Redis 7+
- Terraform 1.6+

### Local Development Setup

```bash
# Clone the starter template
git clone https://github.com/your-org/lms-starter.git lms
cd lms

# Create environment files
cp .env.example .env
# Edit .env with your configuration

# Start all services
docker-compose up -d

# Run database migrations
./scripts/migrate-db.sh

# Start the API server
cd packages/api
go run cmd/server/main.go

# Start the frontend
cd ../web
pnpm install
pnpm dev
```

### Docker Compose for Local Development

```yaml
# docker-compose.yml
version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: lms_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  api:
    build: 
      context: ./packages/api
      dockerfile: Dockerfile.dev
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgres://postgres:postgres@postgres:5432/lms_dev
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ./packages/api:/app
      - /app/node_modules
    command: bash -c "go run cmd/server/main.go"

  web:
    build:
      context: ./packages/web
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgres://postgres:postgres@postgres:5432/lms_dev
    volumes:
      - ./packages/web:/app
      - /app/node_modules
    command: pnpm dev

volumes:
  postgres_data:
  redis_data:
```

---

## 3. Database Schema Design

### PostgreSQL Schema (Migration Format)

```sql
-- migrations/000001_initial_schema.sql

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'instructor', 'admin')),
    avatar_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Courses table
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    instructor_id UUID REFERENCES users(id),
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_courses_instructor (instructor_id),
    INDEX idx_courses_status (status)
);

-- Course enrollments
CREATE TABLE enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    progress_percent DECIMAL(5,2) DEFAULT 0,
    completed_at TIMESTAMP WITH TIME ZONE,
    certificate_issued BOOLEAN DEFAULT FALSE,
    
    UNIQUE(user_id, course_id),
    INDEX idx_enrollments_user (user_id),
    INDEX idx_enrollments_course (course_id)
);

-- Lessons table
CREATE TABLE lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    position INTEGER NOT NULL,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('video', 'text', 'quiz', 'assignment')),
    video_url TEXT,
    content_json JSONB,
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_lessons_course (course_id),
    INDEX idx_lessons_position (course_id, position)
);

-- Quiz questions
CREATE TABLE quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    questions JSONB NOT NULL, -- Array of question objects
    time_limit_seconds INTEGER,
    max_attempts INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quiz attempts
CREATE TABLE quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    score DECIMAL(5,2),
    answers JSONB, -- User's answers
    
    INDEX idx_quiz_attempts_user (user_id),
    INDEX idx_quiz_attempts_quiz (quiz_id)
);

-- Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    stripe_payment_id VARCHAR(255),
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_payments_user (user_id),
    INDEX idx_payments_course (course_id),
    INDEX idx_payments_stripe (stripe_payment_id)
);

-- Discussion threads
CREATE TABLE discussion_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Forum posts
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID REFERENCES discussion_threads(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES posts(id) ON DELETE CASCADE, -- For replies
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity log (for analytics)
CREATE TABLE user_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_activities_user (user_id),
    INDEX idx_activities_course (course_id),
    INDEX idx_activities_type (activity_type),
    PARTITION BY RANGE (created_at) -- Partition by month for performance
);
```

---

## 4. Core Service Implementation

### User Service (Go)

```go
// internal/user/handler.go
package user

import (
    "context"
    "net/http"

    "github.com/gin-gonic/gin"
    "golang.org/x/crypto/bcrypt"
    "github.com/google/uuid"
)

type Handler struct {
    service Service
    db      *sql.DB
}

type RegisterRequest struct {
    Email     string `json:"email" binding:"required,email"`
    Password  string `json:"password" binding:"required,min(8)"`
    FullName  string `json:"full_name" binding:"required"`
    Role      string `json:"role" binding:"omitempty,oneof:student instructor"`
}

func (h *Handler) Register(c *gin.Context) {
    var req RegisterRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    // Hash password
    hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
        return
    }

    user := User{
        ID:           uuid.New(),
        Email:        req.Email,
        PasswordHash: string(hashedPassword),
        FullName:     req.FullName,
        Role:         req.Role,
        IsVerified:   false,
        CreatedAt:    time.Now(),
    }

    if err := h.service.Create(c.Request.Context(), &user); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
        return
    }

    // Send verification email
    go h.service.SendVerificationEmail(user)

    c.JSON(http.StatusCreated, gin.H{
        "message": "User registered successfully",
        "user": gin.H{
            "id":    user.ID,
            "email": user.Email,
        },
    })
}

func (h *Handler) Login(c *gin.Context) {
    var req struct {
        Email    string `json:"email" binding:"required,email"`
        Password string `json:"password" binding:"required"`
    }

    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    user, err := h.service.GetByEmail(c.Request.Context(), req.Email)
    if err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
        return
    }

    if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
        return
    }

    // Generate JWT tokens
    accessToken, refreshToken, err := h.service.GenerateTokens(user)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate tokens"})
        return
    }

    // Set secure cookies
    c.SetCookie("access_token", accessToken, 15*60, "/", "", true, true)
    c.SetCookie("refresh_token", refreshToken, 7*24*60*60, "/", "", true, true)

    c.JSON(http.StatusOK, gin.H{
        "message": "Login successful",
        "user": gin.H{
            "id":    user.ID,
            "email": user.Email,
            "role":  user.Role,
        },
    })
}
```

### Course Service (Go)

```go
// internal/course/service.go
package course

import (
    "context"
    "time"

    "github.com/google/uuid"
)

type Service struct {
    db     *sql.DB
    redis  *redis.Client
}

type Course struct {
    ID          uuid.UUID `json:"id"`
    Title       string    `json:"title"`
    Description string    `json:"description"`
    PriceCents  int       `json:"price_cents"`
    Currency    string    `json:"currency"`
    Status      string    `json:"status"`
    InstructorID uuid.UUID `json:"instructor_id"`
    PublishedAt *time.Time `json:"published_at,omitempty"`
    CreatedAt   time.Time `json:"created_at"`
}

func (s *Service) CreateCourse(ctx context.Context, course *Course) error {
    query := `
        INSERT INTO courses (id, title, description, price_cents, currency, instructor_id, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `
    
    _, err := s.db.ExecContext(ctx, query,
        course.ID, course.Title, course.Description,
        course.PriceCents, course.Currency,
        course.InstructorID, course.Status, course.CreatedAt,
    )
    
    return err
}

func (s *Service) EnrollUser(ctx context.Context, userID, courseID uuid.UUID) error {
    query := `
        INSERT INTO enrollments (id, user_id, course_id, enrolled_at, progress_percent)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, course_id) DO UPDATE SET
            enrolled_at = NOW(), progress_percent = 0
    `
    
    enrollmentID := uuid.New()
    _, err := s.db.ExecContext(ctx, query,
        enrollmentID, userID, courseID, time.Now(), 0.0,
    )
    
    if err == nil {
        // Cache enrollment in Redis
        cacheKey := fmt.Sprintf("user:%s:courses:%s", userID, courseID)
        s.redis.Set(ctx, cacheKey, "enrolled", time.Hour*24*30)
    }
    
    return err
}

func (s *Service) RecordProgress(ctx context.Context, userID, lessonID uuid.UUID, progress float64) error {
    // Update progress percentage
    query := `
        UPDATE enrollments 
        SET progress_percent = $1, updated_at = NOW()
        WHERE user_id = $2 AND course_id = (
            SELECT course_id FROM lessons WHERE id = $3
        )
    `
    
    _, err := s.db.ExecContext(ctx, query, progress, userID, lessonID)
    return err
}
```

---

## 5. Frontend Architecture

### Next.js App Router Structure

```tsx
// src/app/courses/page.tsx
import { getCourses } from '@/lib/api/courses'
import { CourseCard } from '@/components/course-card'

export const revalidate = 0 // Client-side rendering for dynamic data

export default async function CoursesPage() {
  const courses = await getCourses()

  return (
    <main className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Explore Courses</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </main>
  )
}

// src/app/courses/[id]/page.tsx
export default async function CoursePage({ params }: { params: { id: string } }) {
  const course = await getCourse(params.id)
  const { user } = await getCurrentUser()

  if (!course) {
    return <NotFound />
  }

  const isEnrolled = user?.enrollments?.some(e => e.courseId === course.id)

  return (
    <CourseLayout course={course} isEnrolled={isEnrolled} />
  )
}
```

### Course Layout Component

```tsx
// src/components/course-layout.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { LessonNav } from '@/components/lesson-nav'
import { VideoPlayer } from '@/components/video-player'

interface CourseLayoutProps {
  course: Course
  isEnrolled: boolean
}

export function CourseLayout({ course, isEnrolled }: CourseLayoutProps) {
  const [currentLesson, setCurrentLesson] = useState(course.lessons?.[0])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Video Player */}
      <div className="lg:col-span-8">
        <div className="bg-black aspect-video rounded-lg overflow-hidden">
          {currentLesson?.videoUrl ? (
            <VideoPlayer src={currentLesson.videoUrl} title={currentLesson.title} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-white">No video available</p>
            </div>
          )}
        </div>
        
        <div className="mt-4">
          <h2 className="text-2xl font-bold">{currentLesson?.title}</h2>
          <p className="text-gray-600 mt-2">{currentLesson?.description}</p>
        </div>
      </div>

      {/* Lesson Navigation */}
      <div className="lg:col-span-4">
        <LessonNav 
          lessons={course.lessons} 
          currentLesson={currentLesson}
          onLessonSelect={setCurrentLesson}
        />
        
        <Progress 
          value={isEnrolled ? course.progressPercent : 0} 
          className="mt-6"
        />
        <p className="text-sm text-gray-500 mt-2">
          {Math.round((course.progressPercent || 0))}% Complete
        </p>
      </div>
    </div>
  )
}
```

---

## 6. API Design (OpenAPI 3.1)

```yaml
# docs/api-spec.yaml
openapi: 3.1.0
info:
  title: LMS API
  version: 1.0.0
  description: Learning Management System REST API

servers:
  - url: https://api.lms.com/v1
  - url: http://localhost:8080/v1

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        fullName:
          type: string
        role:
          type: string
          enum: [student, instructor, admin]
        avatarUrl:
          type: string
          nullable: true
        
    Course:
      type: object
      properties:
        id:
          type: string
          format: uuid
        title:
          type: string
        description:
          type: string
        priceCents:
          type: integer
        currency:
          type: string
        status:
          type: string
          enum: [draft, published, archived]
        instructorId:
          type: string
          format: uuid
        publishedAt:
          type: string
          format: date-time
          nullable: true
        createdAt:
          type: string
          format: date-time

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

security:
  - bearerAuth: []

paths:
  /auth/register:
    post:
      summary: Register new user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email, password, fullName, role]
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
                  minLength: 8
                fullName:
                  type: string
                role:
                  type: string
                  enum: [student, instructor]
      responses:
        '201':
          description: User created
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
                  user:
                    $ref: '#/components/schemas/User'
        '400':
          description: Validation error

  /courses:
    get:
      summary: List courses
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [draft, published, archived]
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: List of courses
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Course'
                  total:
                    type: integer
                  page:
                    type: integer

    post:
      summary: Create new course
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [title, description]
              properties:
                title:
                  type: string
                description:
                  type: string
                priceCents:
                  type: integer
                  default: 0
      responses:
        '201':
          description: Course created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Course'

  /courses/{id}/enroll:
    post:
      summary: Enroll in course
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Enrollment successful
```

---

## 7. Testing Strategy

### Test Structure

```bash
packages/api/
├── internal/
│   ├── user/
│   │   ├── service_test.go
│   │   ├── handler_test.go
│   │   └── mocks/
│   ├── course/
│   │   ├── service_test.go
│   │   └── handler_test.go
│   └── ...
├── tests/
│   ├── integration/
│   │   └── api_test.go
│   └── e2e/
│       └── lms_e2e_test.go
```

### Example Test (Go)

```go
// internal/user/service_test.go
func TestUserService_Create(t *testing.T) {
    tests := map[string]struct{
        name string
        user User
        expectErr bool
    }{
        "valid user": {
            user: User{
                Email: "test@example.com",
                FullName: "Test User",
                Role: "student",
            },
            expectErr: false,
        },
        "duplicate email": {
            user: User{
                Email: "existing@example.com",
                FullName: "Another User",
            },
            expectErr: true,
        },
    }

    for name, tt := range tests {
        t.Run(name, func(t *testing.T) {
            // Setup mock DB
            repo := &mockUserRepo{}
            svc := &Service{repo: repo}
            
            err := svc.Create(context.Background(), &tt.user)
            
            if tt.expectErr && err == nil {
                t.Error("expected error, got nil")
            }
            if !tt.expectErr && err != nil {
                t.Errorf("unexpected error: %v", err)
            }
        })
    }
}
```

### Frontend Tests (Jest/Cypress)

```tsx
// src/__tests__/components/course-card.test.tsx
import { render, screen } from '@testing-library/react'
import { CourseCard } from '@/components/course-card'

describe('CourseCard', () => {
  const mockCourse = {
    id: '123',
    title: 'Introduction to React',
    description: 'Learn React from scratch',
    priceCents: 9900,
  }

  it('renders course information correctly', () => {
    render(<CourseCard course={mockCourse} />)
    
    expect(screen.getByText('Introduction to React')).toBeInTheDocument()
    expect(screen.getByText('Learn React from scratch')).toBeInTheDocument()
    expect(screen.getByText('$99.00')).toBeInTheDocument()
  })

  it('enrolls user when Enroll button clicked', async () => {
    const mockEnroll = jest.fn()
    render(<CourseCard course={mockCourse} onEnroll={mockEnroll} />)
    
    await userEvent.click(screen.getByText('Enroll Now'))
    expect(mockEnroll).toHaveBeenCalledWith(mockCourse.id)
  })
})
```

---

## 8. CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.22'
      
      - name: Run backend tests
        run: |
          cd packages/api
          go test -v -race ./...
      
      - name: Run frontend tests
        run: |
          cd packages/web
          pnpm install --frozen-lockfile
          pnpm test
      
      - name: Security scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: 'packages'

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Docker images
        run: |
          docker build -t ${{ secrets.REGISTRY }}/lms-api:${{ github.sha }} packages/api
          docker build -t ${{ secrets.REGISTRY }}/lms-web:${{ github.sha }} packages/web
      
      - name: Push images
        run: |
          echo ${{ secrets.GITHUB_TOKEN }} | docker login -u ${{ github.actor }} --password-stdin ${{ secrets.REGISTRY }}
          docker push ${{ secrets.REGISTRY }}/lms-api:${{ githubsha }}
          docker push ${{ secrets.REGISTRY }}/lms-web:${{ github.sha }}

  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to AWS
        run: |
          cd infra
          terraform init
          terraform apply -var="image_tag=${{ github.sha }}" -auto-approve
```

---

## 9. Monitoring & Observability

### Prometheus Metrics

```go
// pkg/metrics/metrics.go
package metrics

import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
    httpRequestsTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "http_requests_total",
            Help: "Total number of HTTP requests",
        },
        []string{"method", "endpoint", "status"},
    )

    httpRequestDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "http_request_duration_seconds",
            Help: "HTTP request latencies in seconds",
        },
        []string{"method", "endpoint"},
    )

    databaseConnections = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "db_connections",
            Help: "Number of database connections",
        },
    )
)

func InitMetric() {
    prometheus.MustRegister(httpRequestsTotal, httpRequestDuration, databaseConnections)
}

func InstrumentationMiddleware() gin.FuncOfResponseWriter {
    return func(c *gin.Context) {
        start := time.Now()
        path := c.FullPath()
        
        c.Next()
        
        httpRequestsTotal.WithLabelValues(c.Request.Method, path, strconv.Itoa(c.Writer.Status())).Inc()
        httpRequestDuration.WithLabelValues(c.Request.Method, path).Observe(time.Since(start).Seconds())
    }
}
```

### Grafana Dashboard Example

```json
{
  "dashboard": {
    "title": "LMS - API Overview",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m]))",
            "legendFormat": "{{method}} {{endpoint}}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m])) * 100",
            "legendFormat": "Error Rate %"
          }
        ]
      },
      {
        "title": "Database Connections",
        "type": "stat",
        "targets": [
          {
            "expr": "db_connections",
            "legendFormat": "Active Connections"
          }
        ]
      }
    ]
  }
}
```

---

## 10. Deployment Configuration

### Terraform (AWS)

```hcl
# infra/terraform/main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  
  name = "${var.project_name}-vpc"
  cidr = "10.0.0.0/16"
  
  azs             = data.aws_availability_zones.available.names
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

# RDS PostgreSQL
resource "aws_db_instance" "lms" {
  identifier              = "${var.project_name}-db"
  engine                  = "postgres"
  engine_version          = "15"
  instance_class          = "db.t3.medium"
  allocated_storage       = 100
  db_name                 = "lms"
  username                = var.db_username
  password                = var.db_password
  multi_az                = true
  skip_final_snapshot     = true
  vpc_security_group_ids  = [aws_security_group.rds.id]
}

# ECS Cluster
resource "aws_ecs_cluster" "lms" {
  name = "${var.project_name}-cluster"
}

# Application Load Balancer
resource "aws_lb" "lms" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  subnets            = module.vpc.public_subnets
  security_groups    = [aws_security_group.lb.id]
}
```

---

## 11. Quick Start Commands

```bash
# Development setup
./scripts/setup-dev.sh

# Run migrations
./scripts/migrate-db.sh

# Start development servers
pnpm dev          # Web frontend
pnpm dev:api      # API server
pnpm dev:db       # Database studio

# Run tests
pnpm test         # All tests
pnpm test:unit    # Unit tests only
pnpm test:api     # API tests only
pnpm test:e2e     # End-to-end tests

# Build for production
pnpm build        # Build web app
docker build -t lms-api .  # Build API image

# Deploy
pnpm deploy:staging   # Deploy to staging
pnpm deploy:prod      # Deploy to production

# Monitoring
open http://localhost:9090     # Prometheus
open http://localhost:3000     # Grafana dashboards
open http://localhost:5000     # Kibana logs
```

---

## 12. Documentation

Each service includes comprehensive documentation:

- **Architecture Decision Records (ADRs)** - `/docs/adr/`
- **API Documentation** - `/docs/api/` (Swagger UI)
- **Developer Guide** - `/docs/developer-guide.md`
- **Deployment Guide** - `/docs/deployment.md`
- **Security Guide** - `/docs/security.md`

---

## Next Steps

1. ✅ Review architecture and tech stack
2. ✅ Set up development environment
3. ⏳ Implement User Service (auth flows)
4. ⏳ Build Course Service API
5. ⏳ Create basic frontend UI
6. ⏳ Set up CI/CD pipeline
7. ⏳ Configure monitoring & observability
8. ⏳ Write comprehensive tests

---

*This guide will be updated as the project progresses. Check `/docs/` for the latest documentation.*