"""Announcement CRUD operations"""
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.announcement import Announcement
from app.models.user import User
from app.models.course import Course
from typing import List, Optional, Tuple
import uuid


async def create_announcement(
    db: AsyncSession,
    author_id: uuid.UUID,
    title: str,
    body: str,
    course_id: Optional[uuid.UUID] = None,
) -> Announcement:
    db_announcement = Announcement(
        author_id=author_id,
        course_id=course_id,
        title=title,
        body=body,
    )
    db.add(db_announcement)
    await db.commit()
    await db.refresh(db_announcement)
    return db_announcement


async def get_announcement_by_id(db: AsyncSession, announcement_id: uuid.UUID) -> Optional[Announcement]:
    result = await db.execute(select(Announcement).where(Announcement.id == announcement_id))
    return result.scalar_one_or_none()


async def list_visible(
    db: AsyncSession,
    enrolled_course_ids: List[uuid.UUID],
    author_id: uuid.UUID,
    limit: int = 50,
) -> List[Tuple[Announcement, str, Optional[str]]]:
    """Announcements visible to a user: platform-wide, enrolled courses, or own posts.

    Returns (announcement, author_name, course_title) tuples, newest first.
    """
    visible = [Announcement.course_id.is_(None), Announcement.author_id == author_id]
    if enrolled_course_ids:
        visible.append(Announcement.course_id.in_(enrolled_course_ids))

    stmt = (
        select(Announcement, User.full_name, Course.title)
        .join(User, Announcement.author_id == User.id)
        .outerjoin(Course, Announcement.course_id == Course.id)
        .where(or_(*visible))
        .order_by(Announcement.created_at.desc())
        .limit(min(max(limit, 1), 100))
    )
    result = await db.execute(stmt)
    return [(row[0], row[1], row[2]) for row in result.all()]


async def delete_announcement(db: AsyncSession, announcement_id: uuid.UUID) -> bool:
    announcement = await get_announcement_by_id(db, announcement_id)
    if not announcement:
        return False
    await db.delete(announcement)
    await db.commit()
    return True
