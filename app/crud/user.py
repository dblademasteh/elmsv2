"""User CRUD operations"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.core.security import get_password_hash, verify_password
from typing import Optional
import uuid

async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()

async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()

async def create_user(db: AsyncSession, email: str, full_name: str, password: str, role: str = "student"):
    hashed_password = get_password_hash(password)
    db_user = User(
        email=email,
        full_name=full_name,
        hashed_password=hashed_password,
        role=role
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user

async def authenticate_user(db: AsyncSession, email: str, password: str) -> Optional[User]:
    user = await get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user

async def update_user(db: AsyncSession, user_id: uuid.UUID, full_name: str = None, avatar_url: str = None):
    user = await get_user_by_id(db, user_id)
    if not user:
        return None
    if full_name:
        user.full_name = full_name
    if avatar_url:
        user.avatar_url = avatar_url
    await db.commit()
    await db.refresh(user)
    return user