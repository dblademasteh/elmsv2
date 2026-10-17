# Learning Management System (LMS)

A modern, scalable Learning Management System built from scratch with Go, React, and cloud-native technologies.

## 📚 Overview

This LMS platform provides a complete solution for creating, delivering, and tracking online education. Built with microservices architecture, it supports thousands of concurrent learners with robust performance, security, and accessibility features.

### Core Features

- **User Management**: Role-based access (Student, Instructor, Admin)
- **Course Catalog**: Create, publish, and organize courses with rich content
- **Content Delivery**: Video streaming, documents, quizzes, assignments
- **Enrollment & Progress**: Track student progress, award certificates
- **Assessments**: Auto-graded quizzes, assignments, peer review
- **E-commerce**: Course purchases, subscriptions, coupons
- **Communication**: Discussion forums, messaging, announcements
- **Analytics**: Detailed reports, usage metrics, insights
- **Mobile-first**: Responsive web and native mobile apps

## 🛠️ Tech Stack

### Backend
| Component | Technology | Reason |
|-----------|------------|--------|
| Language | **Go 1.22** | High performance, concurrency, simplicity |
| Framework | Fiber/Chi | Fast HTTP routing |
| API | gRPC + REST | Efficient internal services, external compatibility |
| Database | PostgreSQL 15 | ACID transactions, relational queries |
| Cache | Redis 7 | Session storage, rate limiting, caching |
| Search | Elasticsearch | Full-text search, faceted filtering |
| File Storage | S3/CloudFront | Scalable, global CDN |
| Video | Mux/Cloudflare Stream | Adaptive streaming |

### Frontend
| Component | Technology | Reason |
|-----------|------------|--------|
| Framework | React 18 + Next.js 14 | SSR for SEO, RSC for performance |
| Styling | Tailwind CSS + shadcn/ui | Rapid, accessible, customizable |
| State | Zustand + React Query | Lightweight, SSR-friendly |
| Forms | React Hook Form + Zod | Type-safe validation |
| Charts | Chart.js | Interactive data visualization |

### Infrastructure
| Component | Service | Reason |
|-----------|---------|--------|
| Hosting | AWS ECS/Fargate | Managed containers |
| Database | RDS PostgreSQL | Managed, automated backups |
| CDN | CloudFront | Global edge caching |
| Monitoring | Datadog/Prometheus | Full-stack observability |
| CI/CD | GitHub Actions + ArgoCD | GitOps deployment |

## 🚀 Getting Started

### Prerequisites

- Docker & Docker Compose
- Go 1.22+
- Node.js 18+
- pnpm 8+
- Terraform 1.6+

### Quick Start

```bash
# Clone and set up
git clone https://github.com/your-org/lms.git
cd lms

# Run setup script
./scripts/setup-dev.sh

# Or manually:
cp .env.example .env  # Edit values
docker compose up -d    # Start infrastructure
```

### Start Services

```bash
# API Server (Go)
cd packages/api
go run cmd/server/main.go

# Web Frontend (Next.js)
cd packages/web
pnpm install
pnpm dev
```

### Access the Application

| Service | URL |
|---------|-----|
| Web App | http://localhost:3001 |
| API | http://localhost:8080 |
| PGAdmin | http://localhost:5050 |
| Redis Commander | http://localhost:8081 |
| MailHog (emails) | http://localhost:8025 |
| MinIO (files) | http://localhost:9001 |

## 📁 Project Structure

```
lms/
├── packages/
│   ├── api/              # Backend services (Go)
│   │   ├── cmd/          # Entry points
│   │   ├── internal/     # Business logic
│   │   └── pkg/          # Shared packages
│   ├── web/              # Frontend (Next.js)
│   │   ├── app/          # App Router pages
│   │   ├── components/   # UI components
│   │   └── lib/          # Utilities
│   └── mobile/           # React Native app
├── infra/
│   ├── terraform/        # AWS infrastructure
│   └── kubernetes/       # Container orchestration
├── docs/
│   ├── api-spec.yaml     # OpenAPI 3.1 spec
│   └── architecture.md   # Architecture docs
├── scripts/
│   ├── setup-dev.sh      # Dev environment setup
│   └── migrate-db.sh     # Database migrations
└── docker-compose.yml    # Local development stack
```

## 📖 Documentation

- **[Architecture Design](./LMS_ARCHITECTURE.md)** - Detailed system architecture and tech stack
- **[Implementation Guide](./LMS_IMPLEMENTATION_GUIDE.md)** - Step-by-step development guide
- **[API Documentation](./docs/api-spec.yaml)** - OpenAPI 3.1 specification
- **[Architecture Decision Records](./docs/adr/)** - Design decisions and rationale

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Unit tests only
pnpm test:unit

# Integration tests
pnpm test:integration

# E2E tests (Cypress)
pnpm test:e2e
```

## 🚀 Deployment

### Production (AWS)

```bash
# Configure AWS credentials
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=xxx

# Deploy infrastructure
cd infra/terraform
terraform init
terraform plan
terraform apply

# Deploy services
./scripts/deploy.sh production
```

### Staging

```bash
./scripts/deploy.sh staging
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the code style (Prettier, ESLint, golangci-lint)
4. Write tests for new features
5. Submit a pull request

## 📜 License

MIT License - See LICENSE file for details.

## 🙏 Acknowledgments

- Built with ❤️ using modern web technologies
- Inspired by leading LMS platforms like Teachable, Coursera, and Udemy