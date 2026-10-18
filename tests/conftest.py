"""Shared test fixtures.

Creates an isolated `lms_test` database, migrates it to head with Alembic
(exercising the real migrations), seeds core users, and exposes a FastAPI
TestClient. DATABASE_URL is pointed at the test database before the app is
imported.
"""
import os
import uuid

import pytest
import sqlalchemy as sa

TEST_DB = "lms_test"
ASYNC_URL = f"postgresql+asyncpg://postgres:postgres@localhost:5432/{TEST_DB}"
SYNC_URL = f"postgresql+psycopg2://postgres:postgres@localhost:5432/{TEST_DB}"
ADMIN_URL = "postgresql+psycopg2://postgres:postgres@localhost:5432/postgres"

# Point the application at the test database before any app import.
os.environ["DATABASE_URL"] = ASYNC_URL
os.environ["ALEMBIC_DATABASE_URL"] = SYNC_URL

USERS = {
    "admin": {"email": "admin@test.com", "password": "AdminPass123!", "role": "admin", "full_name": "Test Admin"},
    "instructor": {"email": "instructor@test.com", "password": "InstructorPass123!", "role": "instructor", "full_name": "Test Instructor"},
    "student": {"email": "student@test.com", "password": "StudentPass123!", "role": "student", "full_name": "Test Student"},
    "outsider": {"email": "outsider@test.com", "password": "OutsiderPass123!", "role": "student", "full_name": "Test Outsider"},
}


def _database_exists(engine, name) -> bool:
    with engine.connect() as conn:
        row = conn.execute(
            sa.text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": name}
        ).fetchone()
    return row is not None


@pytest.fixture(scope="session")
def test_database():
    """Create/migrate the test database; drop it when the session ends."""
    admin_engine = sa.create_engine(ADMIN_URL)
    if _database_exists(admin_engine, TEST_DB):
        with admin_engine.connect() as conn:
            conn.execution_options(isolation_level="AUTOCOMMIT")
            conn.execute(sa.text(f'DROP DATABASE "{TEST_DB}"'))
    with admin_engine.connect() as conn:
        conn.execution_options(isolation_level="AUTOCOMMIT")
        conn.execute(sa.text(f'CREATE DATABASE "{TEST_DB}"'))
    admin_engine.dispose()

    # Migrate the fresh database to head using the real Alembic migrations.
    from alembic import command
    from alembic.config import Config

    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cfg = Config(os.path.join(repo_root, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(repo_root, "alembic"))
    command.upgrade(cfg, "head")

    # Seed core users (sync engine; bcrypt hashing is synchronous).
    from app.core.security import get_password_hash

    engine = sa.create_engine(SYNC_URL)
    with engine.begin() as conn:
        for spec in USERS.values():
            conn.execute(
                sa.text(
                    "INSERT INTO users (id, email, full_name, hashed_password, role, is_active) "
                    "VALUES (:id, :email, :full_name, :hashed_password, :role, TRUE)"
                ),
                {
                    "id": str(uuid.uuid4()),
                    "email": spec["email"],
                    "full_name": spec["full_name"],
                    "hashed_password": get_password_hash(spec["password"]),
                    "role": spec["role"],
                },
            )
    engine.dispose()

    yield

    # Close the application's pooled connections before dropping the database.
    import asyncio

    from app.db.database import engine as app_engine, database as app_database

    asyncio.run(app_engine.dispose())
    try:
        asyncio.run(app_database.disconnect())
    except Exception:
        pass

    admin_engine = sa.create_engine(ADMIN_URL)
    with admin_engine.connect() as conn:
        conn.execution_options(isolation_level="AUTOCOMMIT")
        conn.execute(
            sa.text(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                "WHERE datname = :name AND pid <> pg_backend_pid()"
            ),
            {"name": TEST_DB},
        )
        conn.execute(sa.text(f'DROP DATABASE "{TEST_DB}"'))
    admin_engine.dispose()


@pytest.fixture(scope="session")
def client(test_database):
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


def login(client, email: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


@pytest.fixture(scope="session")
def admin_token(client):
    return login(client, USERS["admin"]["email"], USERS["admin"]["password"])


@pytest.fixture(scope="session")
def instructor_token(client):
    return login(client, USERS["instructor"]["email"], USERS["instructor"]["password"])


@pytest.fixture(scope="session")
def student_token(client):
    return login(client, USERS["student"]["email"], USERS["student"]["password"])


@pytest.fixture(scope="session")
def outsider_token(client):
    return login(client, USERS["outsider"]["email"], USERS["outsider"]["password"])


@pytest.fixture(scope="session")
def auth_headers(admin_token, instructor_token, student_token, outsider_token):
    return {
        "admin": {"Authorization": f"Bearer {admin_token}"},
        "instructor": {"Authorization": f"Bearer {instructor_token}"},
        "student": {"Authorization": f"Bearer {student_token}"},
        "outsider": {"Authorization": f"Bearer {outsider_token}"},
    }
