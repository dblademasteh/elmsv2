"""Notification CRUD operations"""
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.notification import Notification
from typing import List, Optional
import uuid
from datetime import datetime, timezone


async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    type: str,
    title: str,
    body: str = None,
    link_url: str = None,
) -> Notification:
    db_notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        link_url=link_url,
    )
    db.add(db_notification)
    await db.commit()
    await db.refresh(db_notification)
    return db_notification


async def list_for_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    unread_only: bool = False,
    skip: int = 0,
    limit: int = 50,
) -> List[Notification]:
    stmt = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .offset(max(skip, 0))
        .limit(min(max(limit, 1), 100))
    )
    if unread_only:
        stmt = stmt.where(Notification.read_at.is_(None))
    result = await db.execute(stmt)
    return result.scalars().all()


async def unread_count(db: AsyncSession, user_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count(Notification.id)).where(
            and_(Notification.user_id == user_id, Notification.read_at.is_(None))
        )
    )
    return int(result.scalar() or 0)


async def mark_read(db: AsyncSession, notification_id: uuid.UUID, user_id: uuid.UUID) -> Optional[Notification]:
    result = await db.execute(
        select(Notification).where(
            and_(Notification.id == notification_id, Notification.user_id == user_id)
        )
    )
    notification = result.scalar_one_or_none()
    if not notification or notification.read_at is not None:
        return notification
    notification.read_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(notification)
    return notification


async def mark_all_read(db: AsyncSession, user_id: uuid.UUID) -> int:
    result = await db.execute(
        select(Notification).where(
            and_(Notification.user_id == user_id, Notification.read_at.is_(None))
        )
    )
    notifications = result.scalars().all()
    now = datetime.now(timezone.utc)
    for notification in notifications:
        notification.read_at = now
    await db.commit()
    return len(notifications)
