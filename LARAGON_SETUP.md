# Local Development Setup (Without Docker)

This guide explains how to run the LMS locally using your existing development tools (Docker Desktop replaced by local services — works with Laragon or standalone).

## Prerequisites

| Tool | Minimum Version | Check Command |
|------|----------------|---------------|
| Python | 3.11+ | `python --version` |
| Node.js | 18+ | `node --version` |
| npm | 10+ | `npm --version` |
| PostgreSQL | 15+ | `psql --version` |
| Redis | 7+ | `redis-cli ping` |

> If using **Laragon**: enable PostgreSQL and Redis via Laragon's service manager, or install them as Windows services separately.

## Quick Start

### 1. Clone and set up

```bash
git clone <your-repo-url>
cd lms
```

### 2. Install Python dependencies

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # macOS/Linux

pip install -r requirements.txt
```

### 3. Set up PostgreSQL

```sql
-- Connect to PostgreSQL as a superuser (e.g., your Windows username)
psql -U <your-windows-username> -d postgres

-- Create the database and user
CREATE ROLE postgres WITH SUPERUSER LOGIN PASSWORD 'postgres';
CREATE DATABASE lms_dev OWNER postgres;
```

### 4. Configure environment

```bash
# Copy the example (already configured for localhost)
cp .env.example .env
# Edit .env if needed — default values point to localhost
```

The `.env` file should point to **localhost** (not Docker container names):

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lms_dev
REDIS_URL=redis://localhost:6379
```

### 5. Initialize the database

```bash
python scripts/init_db.py
```

Output:
```
✅ Tables created successfully!
✅ Admin: admin@lms.com / Admin123!@#
✅ Instructor: instructor@lms.com / Instructor123!@#
✅ Student: student@lms.com / Student123!@#
```

### 6. Start the API server

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```

Visit: http://localhost:8080/health

### 7. Install web dependencies and start dev server

```powershell
cd packages/web
npm install
npm run dev
```

Visit: http://localhost:3000

## Seed Users

| Email | Password | Role |
|-------|----------|------|
| admin@lms.com | Admin123!@# | admin |
| instructor@lms.com | Instructor123!@# | instructor |
| student@lms.com | Student123!@# | student |

## Running Services

### API (FastAPI)
- **Port**: 8080
- **Command**: `uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload`
- **Health**: http://localhost:8080/health
- **Docs**: http://localhost:8080/docs

### Web UI (Next.js)
- **Port**: 3000
- **Command**: `cd packages/web && npm run dev`
- **URL**: http://localhost:3000

### PostgreSQL
- **Port**: 5432
- **User**: postgres
- **Password**: postgres
- **Database**: lms_dev

### Redis
- **Port**: 6379
- **Test**: `redis-cli ping`

## Laragon Integration (Optional)

If you use **Laragon**, you can manage PostgreSQL and Redis through its service manager:

1. Open Laragon
2. Enable PostgreSQL and Redis services
3. If the `postgres` role doesn't exist, create it:
   ```sql
   psql -U <your-windows-username> -d postgres
   CREATE ROLE postgres WITH SUPERUSER LOGIN PASSWORD 'postgres';
   CREATE DATABASE lms_dev OWNER postgres;
   ```
4. Run the API and Web UI as shown above

## Useful Commands

| Task | Command |
|------|---------|
| Start API | `uvicorn app.main:app --reload --port 8080` |
| Start Web | `cd packages/web && npm run dev` |
| Re-seed DB | `python scripts/init_db.py` |
| Create venv | `python -m venv .venv` |
| Activate venv | `.venv\Scripts\activate` |
| Run tests (API) | `pytest` |
| Lint web | `cd packages/web && npm run lint` |
| Build web | `cd packages/web && npm run build` |