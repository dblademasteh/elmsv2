# Agent Guide

## ⚠️ Critical: Actual Stack

The README describes a **Go backend**; the **actual API is Python/FastAPI** at `app/` (root-level, NOT `packages/api/`). Ignore all Go references in `packages/api/` and README.md.

- **API**: Python/FastAPI (`app/`)
- **Frontend**: Next.js 14 App Router (`packages/web/`)
- **Database**: PostgreSQL 15 + asyncpg
- **Cache**: Redis 7
- **Auth**: JWT + bcrypt

## Running the System

### 1. Start all services (API + PostgreSQL + Redis)
```bash
docker compose up --build -d
```

### 2. Start the Web UI (separate, not in Docker)
```bash
cd packages/web
npm install          # one-time setup
npm run dev          # then visit http://localhost:3000
```

### 3. Verify
| Service | URL |
|---------|-----|
| API | http://localhost:8080/health |
| API Docs | http://localhost:8080/docs |
| Web UI | http://localhost:3000 |

## Seed Users

| Email | Password | Role |
|-------|----------|------|
| admin@lms.com | Admin123!@# | admin |
| instructor@lms.com | Instructor123!@# | instructor |
| student@lms.com | Student123!@# | student |

## Common Pitfalls

### Docker Compose
- **Do NOT add `env_file: .env`** — the `.env` file has `localhost` URLs that fail inside containers. Environment variables are set inline in the compose file.
- All services **must share the `lms-network`** network for inter-container DNS resolution.
- `init_db.py` runs on every container start and re-creates tables/seeds users (idempotent).
- If `docker compose up` fails to build, run `docker compose build --no-cache`.

### Python / FastAPI
- Pin `bcrypt>=3.2.0,<4.0.0` — passlib 1.7.x is incompatible with bcrypt 4.x.
- `asyncpg` engine params: do NOT pass `pool_size`, `pool_pre_pinger`, or `pool_recycle` to `create_async_engine()` (PostgreSQL dialect rejects them).
- Pydantic Settings: set `extra = "ignore"` to tolerate extra env vars.
- `app/main.py` uses deprecated `@app.on_event` — acceptable for now, consider lifespan context manager for production.

### Next.js / Web UI
- **`npm install` must run before** `npm run dev` — node_modules are not committed.
- `@/` alias needs three places: `jsconfig.json`, `tsconfig.json` (paths), and `next.config.js` (webpack alias).
- `postcss.config.js` **must exist** for Tailwind CSS to process `@tailwind` directives.
- Components using React hooks (`useAuthStore`, `useForm`, etc.) **must have `'use client';`** at the top (Next.js App Router requirement).
- Login page: `/login` renders the form; the API endpoint is `POST /api/v1/auth/login`.
- `next.config.js` sets `NEXT_PUBLIC_API_URL` via `env` — update for production deployments.

### Dependency quirks (already fixed in package.json)
- `@radix-ui/react-slot`: use 1.1.2 (1.0.4 does not exist on npm).
- `@hookform/resolvers`: must be installed manually for `zodResolver`.

## Project Structure

```
.
├── app/                    # FastAPI application (root-level, NOT packages/api)
│   ├── api/v1/             #   api.py (router), endpoints/auth.py, users.py, courses.py
│   ├── core/               #   config.py, security.py
│   ├── crud/               #   user.py, course.py
│   ├── db/                 #   database.py (async SQLAlchemy + databases lib)
│   ├── models/             #   user.py, course.py, enrollment.py
│   └── schemas/            #   Pydantic models
├── scripts/
│   └── init_db.py          # Creates tables + seeds 3 users on startup
├── packages/web/           # Next.js 14 frontend
│   ├── src/app/            #   page.tsx (home), layout.tsx, globals.css, login/page.tsx
│   ├── src/lib/api.ts      # API client (points to localhost:8080)
│   ├── src/store/auth.ts   # Zustand auth store
│   ├── src/types/index.ts  # TypeScript types
│   ├── src/components/     # (empty - UI components go here)
│   ├── next.config.js
│   ├── tsconfig.json
│   ├── jsconfig.json
│   ├── postcss.config.js
│   └── tailwind.config.js
├── packages/api/           # Legacy Go stub (ignore - actual API is Python at app/)
├── migrations/
│   ├── 000001_initial_schema.sql
│   └── seed_data.sql
├── infra/
│   └── postgres/
├── Dockerfile              # Python API container
├── Dockerfile.local        # Python API container (local)
├── docker-compose.yml      # postgres, redis, api
├── requirements.txt        # Python deps
├── .env                    # Local-only config (NOT used by Docker)
└── .env.example            # Template for local config
```

## File Ownership

- **API entry**: `app/main.py` (FastAPI app with `/health`, `/docs`)
- **Database models**: `app/models/` → `app/db/database.py` uses SQLAlchemy + `databases` library
- **Auth**: `app/core/security.py` (JWT + bcrypt), `app/api/v1/endpoints/auth.py`
- **CRUD**: `app/crud/user.py`, `app/crud/course.py`
- **Schemas**: `app/schemas/auth.py`, `app/schemas/user.py`, `app/schemas/course.py`
- **Frontend entry**: `packages/web/src/app/page.tsx` (home), `packages/web/src/app/login/page.tsx`
- **API client**: `packages/web/src/lib/api.ts`
- **Auth store**: `packages/web/src/store/auth.ts`

## Production Readiness Checklist

Before deploying to production, complete the following:

### Security
- [ ] Change `CORS allow_origins=["*"]` in `app/main.py:26` to specific frontend domain
- [ ] Replace `JWT_SECRET_KEY` and `SECRET_KEY` in `.env` with strong random values (min 256 bits)
- [ ] Set `ENVIRONMENT=production` to hide error details in `app/main.py:79`
- [ ] Use HTTPS-only cookies and `Secure` flag in production
- [ ] Add rate limiting on auth endpoints
- [ ] Validate all inputs with Pydantic schemas (already in place)

### Environment
- [ ] Copy `.env.example` to `.env` and update all values for production
- [ ] Never commit `.env` — add to `.gitignore`
- [ ] Use secrets manager (AWS Secrets Manager, etc.) in production, not `.env`

### Docker / Deployment
- [ ] Remove `--reload` flag from uvicorn command in Dockerfile and docker-compose.yml for production
- [ ] Use multi-stage Docker build to reduce image size
- [ ] Pin base image digest (e.g., `python:3.11-slim@sha256:...`)
- [ ] Run as non-root user in container

### Database
- [ ] Run migrations (`alembic`) instead of `create_all` for schema changes
- [ ] Configure connection pooling for production load
- [ ] Enable `pg_stat_statements` for query monitoring
- [ ] Set up automated backups

### Frontend
- [ ] Run `npm run build` and verify no TypeScript errors
- [ ] Run `npm run lint` and fix all ESLint errors
- [ ] Update `NEXT_PUBLIC_API_URL` in `next.config.js` for production domain
- [ ] Add `next.config.js` `output: 'standalone'` for Docker deployment
- [ ] Configure security headers (already partially in `next.config.js`)

### Testing
- [ ] Write unit tests for CRUD operations (`app/crud/`)
- [ ] Write integration tests for auth endpoints (`app/api/v1/endpoints/auth.py`)
- [ ] Write frontend tests for login page and course catalog
- [ ] Run E2E tests against staging before production deploy

## Commands Reference

| Task | Command |
|------|---------|
| Start all services (Docker) | `docker compose up --build -d` |
| Stop all services | `docker compose down` |
| Rebuild API only | `docker compose build --no-cache api` |
| Start web UI | `cd packages/web && npm run dev` |
| Build web UI | `cd packages/web && npm run build` |
| Lint web UI | `cd packages/web && npm run lint` |
| Test web UI | `cd packages/web && npm run test` |
| Start API locally | `cd app && uvicorn app.main:app --host 0.0.0.0 --port 8080` |
| Re-seed database | `python scripts/init_db.py` |
