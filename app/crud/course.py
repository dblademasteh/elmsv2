"""Course CRUD operations"""
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.course import Course
from typing import List, Optional
import uuid

async def get_course_by_slug(db: AsyncSession, slug: str) -> Optional[Course]:
    result = await db.execute(select(Course).where(Course.slug == slug))
    return result.scalar_one_or_none()

async def get_course_by_id(db: AsyncSession, course_id: uuid.UUID) -> Optional[Course]:
    result = await db.execute(
        select(Course).where(
            Course.id == course_id,
            Course.status == "published",
            Course.is_private.is_(False),
        )
    )
    return result.scalar_one_or_none()

async def get_courses(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[Course]:
    result = await db.execute(
        select(Course)
        .where(Course.status == "published", Course.is_private.is_(False))
        .order_by(desc(Course.enrollment_count), Course.title)
        .offset(max(skip, 0))
        .limit(min(max(limit, 1), 100))
    )
    return result.scalars().all()

async def create_course(db: AsyncSession, title: str, instructor_id: uuid.UUID = None):
    slug = title.lower().replace(' ', '-').replace('/', '-').replace('_', '-')
    db_course = Course(title=title, slug=slug, instructor_id=instructor_id)
    db.add(db_course)
    await db.commit()
    await db.refresh(db_course)
    return db_course
