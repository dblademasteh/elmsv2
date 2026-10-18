"""Enrollment CRUD operations"""
from sqlalchemy import select, cast, String, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased
from app.models.enrollment import Enrollment
from app.models.user import User
from app.models.course import Course
from app.crud.course import get_course_by_id_raw
from app.core.security import get_password_hash
from typing import List, Optional
import uuid
from datetime import datetime

async def get_enrollments(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    course_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
) -> List[tuple]:
    """Get enrollments with joined user and course data."""
    users_alias = aliased(User)
    courses_alias = aliased(Course)

    stmt = (
        select(
            Enrollment.id,
            Enrollment.user_id,
            users_alias.full_name.label("user_full_name"),
            users_alias.email.label("user_email"),
            users_alias.avatar_url.label("user_avatar_url"),
            Enrollment.course_id,
            courses_alias.title.label("course_title"),
            courses_alias.level.label("course_level"),
            Enrollment.enrolled_at,
            Enrollment.progress_percent,
            Enrollment.status,
            Enrollment.completed_at,
            Enrollment.total_minutes,
            Enrollment.last_accessed_at,
        )
        .join(users_alias, Enrollment.user_id == users_alias.id)
        .join(courses_alias, Enrollment.course_id == courses_alias.id)
        .order_by(Enrollment.enrolled_at.desc())
    )

    if course_id:
        stmt = stmt.where(Enrollment.course_id == course_id)
    if status:
        stmt = stmt.where(Enrollment.status == status)

    stmt = stmt.offset(skip).limit(min(max(limit, 1), 100))
    result = await db.execute(stmt)
    return result.fetchall()


async def get_student_enrollments(db: AsyncSession, student_id: uuid.UUID) -> List[Enrollment]:
    """Get all enrollments for a specific student."""
    result = await db.execute(
        select(Enrollment)
        .where(Enrollment.user_id == student_id)
        .order_by(Enrollment.enrolled_at.desc())
    )
    return result.scalars().all()


async def get_student_enrollments_with_details(db: AsyncSession, student_id: uuid.UUID) -> List[tuple]:
    """Get all enrollments for a student with course details."""
    result = await db.execute(
        select(
            Enrollment.id,
            Enrollment.course_id,
            Course.title.label("course_title"),
            Course.level.label("course_level"),
            Course.cover_image_url.label("course_cover_image_url"),
            Enrollment.enrolled_at,
            Enrollment.progress_percent,
            Enrollment.status,
            Enrollment.completed_at,
            Enrollment.total_minutes,
            Enrollment.last_accessed_at,
        )
        .join(Course, Enrollment.course_id == Course.id)
        .where(Enrollment.user_id == student_id)
        .order_by(Enrollment.enrolled_at.desc())
    )
    return result.fetchall()


async def get_enrollment_by_user_and_course(
    db: AsyncSession, user_id: uuid.UUID, course_id: uuid.UUID
) -> Optional[Enrollment]:
    """Check if a user is already enrolled in a course."""
    result = await db.execute(
        select(Enrollment).where(
            and_(
                Enrollment.user_id == user_id,
                Enrollment.course_id == course_id,
            )
        )
    )
    return result.scalar_one_or_none()


async def create_enrollment(db: AsyncSession, user_id: uuid.UUID, course_id: uuid.UUID) -> Enrollment:
    """Create a new enrollment for a student in a course."""
    db_enrollment = Enrollment(
        user_id=user_id,
        course_id=course_id,
        status="active",
        progress_percent=0.0,
    )
    db.add(db_enrollment)

    # Increment course enrollment_count
    course = await get_course_by_id_raw(db, course_id)
    if course:
        course.enrollment_count = (course.enrollment_count or 0) + 1
        await db.commit()
        await db.refresh(course)

    await db.commit()
    await db.refresh(db_enrollment)
    return db_enrollment


async def update_enrollment_progress(
    db: AsyncSession,
    enrollment_id: uuid.UUID,
    progress_percent: float,
    total_minutes: int = None,
):
    """Update progress for an enrollment."""
    enrollment = await db.get(Enrollment, enrollment_id)
    if not enrollment:
        return None
    enrollment.progress_percent = min(max(progress_percent, 0.0), 100.0)
    if total_minutes is not None:
        enrollment.total_minutes = total_minutes
    enrollment.last_accessed_at = datetime.utcnow()

    if enrollment.progress_percent >= 100 and enrollment.status != "completed":
        enrollment.status = "completed"
        enrollment.completed_at = datetime.utcnow()

    await db.commit()
    await db.refresh(enrollment)
    return enrollment
