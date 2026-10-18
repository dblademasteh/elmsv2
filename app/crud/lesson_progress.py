"""Lesson progress CRUD operations"""
from sqlalchemy import select, func as sql_func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.lesson_progress import LessonProgress
from app.models.lesson import Lesson
from app.models.enrollment import Enrollment
from app.crud.enrollment import update_enrollment_progress
from typing import Dict, List, Optional
import uuid


async def get_completed_lesson_ids(db: AsyncSession, enrollment_id: uuid.UUID) -> List[uuid.UUID]:
    """Get the lesson IDs completed for an enrollment."""
    result = await db.execute(
        select(LessonProgress.lesson_id).where(LessonProgress.enrollment_id == enrollment_id)
    )
    return [row[0] for row in result.fetchall()]


async def get_course_progress(
    db: AsyncSession, enrollment_id: uuid.UUID, course_id: uuid.UUID
) -> Dict:
    """Compute progress for an enrollment against the course's published lessons."""
    completed_result = await db.execute(
        select(sql_func.count(LessonProgress.id))
        .join(Lesson, Lesson.id == LessonProgress.lesson_id)
        .where(
            and_(
                LessonProgress.enrollment_id == enrollment_id,
                Lesson.course_id == course_id,
                Lesson.is_published.is_(True),
            )
        )
    )
    completed_lessons = int(completed_result.scalar() or 0)

    total_result = await db.execute(
        select(sql_func.count(Lesson.id)).where(
            and_(Lesson.course_id == course_id, Lesson.is_published.is_(True))
        )
    )
    total_lessons = int(total_result.scalar() or 0)

    completed_ids = await get_completed_lesson_ids(db, enrollment_id)
    return {
        "completed_lessons": completed_lessons,
        "total_lessons": total_lessons,
        "completed_lesson_ids": completed_ids,
    }


async def mark_lesson_complete(
    db: AsyncSession, enrollment_id: uuid.UUID, lesson_id: uuid.UUID
) -> Optional[Dict]:
    """Mark a lesson as completed for an enrollment and persist course progress."""
    # Idempotent upsert
    existing = await db.execute(
        select(LessonProgress).where(
            and_(
                LessonProgress.enrollment_id == enrollment_id,
                LessonProgress.lesson_id == lesson_id,
            )
        )
    )
    if not existing.scalar_one_or_none():
        db.add(LessonProgress(enrollment_id=enrollment_id, lesson_id=lesson_id))
        await db.commit()

    enrollment = await db.get(Enrollment, enrollment_id)
    if not enrollment:
        return None

    progress = await get_course_progress(db, enrollment_id, enrollment.course_id)
    progress_percent = (
        round(progress["completed_lessons"] / progress["total_lessons"] * 100, 2)
        if progress["total_lessons"]
        else 0.0
    )

    updated = await update_enrollment_progress(db, enrollment_id, progress_percent)

    return {
        "course_id": str(enrollment.course_id),
        "enrollment_id": str(enrollment_id),
        "lesson_id": str(lesson_id),
        "progress_percent": updated.progress_percent if updated else progress_percent,
        "completed_lessons": progress["completed_lessons"],
        "total_lessons": progress["total_lessons"],
        "completed_lesson_ids": [str(lid) for lid in progress["completed_lesson_ids"]],
        "status": updated.status if updated else enrollment.status,
    }
