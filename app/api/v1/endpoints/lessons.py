"""Lesson endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.schemas.lesson import LessonResponse, LessonCreate, LessonUpdate
from app.crud.lesson import (
    get_lesson_by_id,
    get_lessons_by_course,
    create_lesson,
    update_lesson,
    delete_lesson,
    reorder_lessons,
)
from app.crud.enrollment import get_enrollment_by_user_and_course
from app.crud.lesson_progress import mark_lesson_complete, get_course_progress as get_progress
from app.db.database import get_db
from app.api.v1.endpoints.users import get_current_user_from_token
from typing import List
import uuid

router = APIRouter()
bearer = HTTPBearer(auto_error=False)


async def _get_current_user(credentials: HTTPAuthorizationCredentials, db):
    """Resolve the authenticated user or raise 401."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return await get_current_user_from_token(credentials, db)


@router.get("/lessons/course/{course_id}", response_model=List[LessonResponse])
async def list_course_lessons(
    course_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Get all lessons for a course (instructors/admins see unpublished, others see published only)."""
    user = await _get_current_user(credentials, db)

    lessons = await get_lessons_by_course(db, course_id)
    # Students can only see published lessons
    if user.role == "student":
        lessons = [l for l in lessons if l.is_published]

    return [
        LessonResponse(
            id=l.id,
            course_id=l.course_id,
            title=l.title,
            description=l.description,
            slug=l.slug,
            position=l.position,
            content_type=l.content_type,
            video_url=l.video_url,
            video_duration_seconds=l.video_duration_seconds,
            content_json=l.content_json,
            duration_seconds=l.duration_seconds,
            is_published=l.is_published,
            published_at=l.published_at,
            estimated_minutes=l.estimated_minutes,
            created_at=l.created_at,
        )
        for l in lessons
    ]


@router.post("/lessons", response_model=LessonResponse, status_code=status.HTTP_201_CREATED)
async def create_new_lesson(
    lesson_data: LessonCreate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Create a new lesson (instructor/admin only)."""
    user = await _get_current_user(credentials, db)
    if user.role not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # Verify course ownership
    from app.crud.course import get_course_by_id_raw
    course = await get_course_by_id_raw(db, lesson_data.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.instructor_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="You don't own this course")

    lesson = await create_lesson(
        db=db,
        course_id=lesson_data.course_id,
        title=lesson_data.title,
        description=lesson_data.description,
        position=lesson_data.position,
        content_type=lesson_data.content_type,
        video_url=lesson_data.video_url,
        video_duration_seconds=lesson_data.video_duration_seconds,
        duration_seconds=lesson_data.duration_seconds,
        content_json=lesson_data.content_json,
        estimated_minutes=lesson_data.estimated_minutes,
    )

    return LessonResponse(
        id=lesson.id,
        course_id=lesson.course_id,
        title=lesson.title,
        description=lesson.description,
        slug=lesson.slug,
        position=lesson.position,
        content_type=lesson.content_type,
        video_url=lesson.video_url,
        video_duration_seconds=lesson.video_duration_seconds,
        content_json=lesson.content_json,
        duration_seconds=lesson.duration_seconds,
        is_published=lesson.is_published,
        published_at=lesson.published_at,
        estimated_minutes=lesson.estimated_minutes,
        created_at=lesson.created_at,
    )


@router.put("/lessons/{lesson_id}", response_model=LessonResponse)
async def update_existing_lesson(
    lesson_id: uuid.UUID,
    lesson_data: LessonUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Update a lesson (owner/admin only)."""
    user = await _get_current_user(credentials, db)
    if user.role not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    lesson = await get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Check course ownership
    from app.crud.course import get_course_by_id_raw
    course = await get_course_by_id_raw(db, lesson.course_id)
    if course and course.instructor_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="You don't own this lesson")

    updated = await update_lesson(
        db=db,
        lesson_id=lesson_id,
        title=lesson_data.title,
        description=lesson_data.description,
        position=lesson_data.position,
        content_type=lesson_data.content_type,
        video_url=lesson_data.video_url,
        video_duration_seconds=lesson_data.video_duration_seconds,
        duration_seconds=lesson_data.duration_seconds,
        content_json=lesson_data.content_json,
        estimated_minutes=lesson_data.estimated_minutes,
        is_published=lesson_data.is_published,
    )

    return LessonResponse(
        id=updated.id,
        course_id=updated.course_id,
        title=updated.title,
        description=updated.description,
        slug=updated.slug,
        position=updated.position,
        content_type=updated.content_type,
        video_url=updated.video_url,
        video_duration_seconds=updated.video_duration_seconds,
        content_json=updated.content_json,
        duration_seconds=updated.duration_seconds,
        is_published=updated.is_published,
        published_at=updated.published_at,
        estimated_minutes=updated.estimated_minutes,
        created_at=updated.created_at,
    )


@router.delete("/lessons/{lesson_id}", response_model=dict)
async def delete_lesson_endpoint(
    lesson_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Delete a lesson (owner/admin only)."""
    user = await _get_current_user(credentials, db)
    if user.role not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    lesson = await get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    from app.crud.course import get_course_by_id_raw
    course = await get_course_by_id_raw(db, lesson.course_id)
    if course and course.instructor_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="You don't own this lesson")

    await delete_lesson(db, lesson_id)
    return {"message": "Lesson deleted successfully", "lesson_id": str(lesson_id)}


@router.post("/lessons/reorder", response_model=dict)
async def reorder_course_lessons(
    reorder_data: dict,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Reorder lessons within a course."""
    user = await _get_current_user(credentials, db)
    if user.role not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    course_id = reorder_data.get("course_id")
    lesson_ids = reorder_data.get("lesson_ids")
    if not course_id or not lesson_ids:
        raise HTTPException(status_code=400, detail="course_id and lesson_ids are required")

    from app.crud.course import get_course_by_id_raw
    course = await get_course_by_id_raw(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.instructor_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="You don't own this course")

    try:
        lesson_ids = [uuid.UUID(lid) for lid in lesson_ids]
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid lesson_ids")

    await reorder_lessons(db, course_id, lesson_ids)
    return {"message": "Lessons reordered successfully", "course_id": str(course_id)}


@router.post("/lessons/{lesson_id}/complete", response_model=dict)
async def mark_lesson_completed(
    lesson_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Mark a lesson as completed and persist course progress (enrolled students)."""
    user = await _get_current_user(credentials, db)

    lesson = await get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    if not lesson.is_published and user.role == "student":
        raise HTTPException(status_code=403, detail="This lesson is not available")

    enrollment = await get_enrollment_by_user_and_course(db, user.id, lesson.course_id)
    if not enrollment:
        raise HTTPException(status_code=403, detail="You must be enrolled in this course")

    result = await mark_lesson_complete(db, enrollment.id, lesson_id)
    if not result:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    return result


@router.get("/{course_id}/progress", response_model=dict)
async def get_course_progress_endpoint(
    course_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Get the current user's persisted progress for a course."""
    user = await _get_current_user(credentials, db)

    enrollment = await get_enrollment_by_user_and_course(db, user.id, course_id)
    if not enrollment:
        raise HTTPException(status_code=403, detail="You must be enrolled in this course")

    progress = await get_progress(db, enrollment.id, course_id)
    return {
        "course_id": str(course_id),
        "enrollment_id": str(enrollment.id),
        "progress_percent": enrollment.progress_percent or 0.0,
        "completed_lessons": progress["completed_lessons"],
        "total_lessons": progress["total_lessons"],
        "completed_lesson_ids": [str(lid) for lid in progress["completed_lesson_ids"]],
        "status": enrollment.status,
        "last_accessed_at": enrollment.last_accessed_at.isoformat() if enrollment.last_accessed_at else None,
    }
