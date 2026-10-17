"""Database configuration and session management"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings
import databases
import logging

logger = logging.getLogger(__name__)

# Use async URL for databases library
DATABASE_URL_ASYNC = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

database = databases.Database(DATABASE_URL_ASYNC)

# SQLAlchemy engine (asyncpg doesn't support pool_size, max_overflow
# pool_pre_pinger, or pool_recycle - those are sync-only parameters)
engine = create_async_engine(
    DATABASE_URL_ASYNC,
)

AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    """Dependency for getting database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def get_database():
    """Get database connection"""
    return database