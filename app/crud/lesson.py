"""Lesson CRUD operations"""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.lesson import Lesson
from typing import List, Optional
import uuid


async def get_lesson_by_id(db: AsyncSession, lesson_id: uuid.UUID) -> Optional[Lesson]:
    """Get a lesson by ID."""
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    return result.scalar_one_or_none()


async def get_lessons_by_course(db: AsyncSession, course_id: uuid.UUID) -> List[Lesson]:
    """Get all lessons for a course, ordered by position."""
    result = await db.execute(
        select(Lesson)
        .where(Lesson.course_id == course_id)
        .order_by(Lesson.position)
    )
    return result.scalars().all()


async def create_lesson(
    db: AsyncSession,
    course_id: uuid.UUID,
    title: str,
    description: str = None,
    position: int = 0,
    content_type: str = "video",
    video_url: str = None,
    video_duration_seconds: int = None,
    duration_seconds: int = None,
    content_json: str = None,
    estimated_minutes: int = 5,
) -> Lesson:
    """Create a new lesson for a course."""
    db_lesson = Lesson(
        course_id=course_id,
        title=title,
        description=description,
        position=position,
        content_type=content_type,
        video_url=video_url,
        video_duration_seconds=video_duration_seconds,
        duration_seconds=duration_seconds,
        content_json=content_json,
        estimated_minutes=estimated_minutes,
        is_published=False,
    )
    db.add(db_lesson)
    await db.commit()
    await db.refresh(db_lesson)
    return db_lesson


async def update_lesson(
    db: AsyncSession,
    lesson_id: uuid.UUID,
    title: str = None,
    description: str = None,
    position: int = None,
    content_type: str = None,
    video_url: str = None,
    video_duration_seconds: int = None,
    duration_seconds: int = None,
    content_json: str = None,
    estimated_minutes: int = None,
    is_published: bool = None,
) -> Optional[Lesson]:
    """Update an existing lesson."""
    lesson = await get_lesson_by_id(db, lesson_id)
    if not lesson:
        return None

    if title is not None:
        lesson.title = title
    if description is not None:
        lesson.description = description
    if position is not None:
        lesson.position = position
    if content_type is not None:
        lesson.content_type = content_type
    if video_url is not None:
        lesson.video_url = video_url
    if video_duration_seconds is not None:
        lesson.video_duration_seconds = video_duration_seconds
    if duration_seconds is not None:
        lesson.duration_seconds = duration_seconds
    if content_json is not None:
        lesson.content_json = content_json
    if estimated_minutes is not None:
        lesson.estimated_minutes = estimated_minutes
    if is_published is not None:
        lesson.is_published = is_published
        if is_published:
            lesson.published_at = func.now()

    await db.commit()
    await db.refresh(lesson)
    return lesson


async def delete_lesson(db: AsyncSession, lesson_id: uuid.UUID) -> bool:
    """Delete a lesson."""
    lesson = await get_lesson_by_id(db, lesson_id)
    if not lesson:
        return False
    await db.delete(lesson)
    await db.commit()
    return True


async def reorder_lessons(db: AsyncSession, course_id: uuid.UUID, lesson_ids: List[uuid.UUID]) -> bool:
    """Reorder lessons within a course by setting their positions."""
    for i, lid in enumerate(lesson_ids):
        await db.execute(
            "UPDATE lessons SET position = :position WHERE id = :id AND course_id = :course_id",
            {"position": i, "id": str(lid), "course_id": str(course_id)}
        )
    await db.commit()
    return True
