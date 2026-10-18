"""Announcement endpoints"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from app.db.database import get_db
from app.api.v1.endpoints.users import get_current_user_from_token
from app.crud import announcement as announcement_crud
from app.models.user import User

router = APIRouter()
bearer = HTTPBearer(auto_error=False)


class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    body: str = Field(..., min_length=3)
    course_id: Optional[str] = None  # None = platform-wide (admins only)


async def _get_current_user(credentials: HTTPAuthorizationCredentials, db) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return await get_current_user_from_token(credentials, db)


@router.get("/")
async def list_announcements(
    limit: int = 50,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Announcements visible to the current user (platform-wide, enrolled courses, own posts)."""
    user = await _get_current_user(credentials, db)

    enrolled_ids: list = []
    if user.role == "student":
        from sqlalchemy import select
        from app.models.enrollment import Enrollment
        result = await db.execute(
            select(Enrollment.course_id).where(Enrollment.user_id == user.id)
        )
        enrolled_ids = [row[0] for row in result.all()]

    rows = await announcement_crud.list_visible(
        db, enrolled_course_ids=enrolled_ids, author_id=user.id, limit=limit
    )
    return [
        {
            "id": str(a.id),
            "author_name": author_name,
            "course_id": str(a.course_id) if a.course_id else None,
            "course_title": course_title,
            "title": a.title,
            "body": a.body,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a, author_name, course_title in rows
    ]


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_announcement(
    announcement_in: AnnouncementCreate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Post an announcement. Admins may post platform-wide; instructors post to their own courses."""
    user = await _get_current_user(credentials, db)
    if user.role not in ("admin", "instructor"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only instructors and admins can post announcements",
        )

    course_id = None
    if announcement_in.course_id:
        from uuid import UUID as UUIDType
        from app.crud.course import get_course_by_id_raw

        try:
            course_id = UUIDType(announcement_in.course_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid course_id")
        course = await get_course_by_id_raw(db, course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        if user.role == "instructor" and course.instructor_id != user.id:
            raise HTTPException(
                status_code=403, detail="You can only post announcements to your own courses"
            )
    elif user.role == "instructor":
        raise HTTPException(
            status_code=400, detail="Instructors must target one of their courses"
        )

    announcement = await announcement_crud.create_announcement(
        db,
        author_id=user.id,
        title=announcement_in.title,
        body=announcement_in.body,
        course_id=course_id,
    )
    return {
        "message": "Announcement posted",
        "id": str(announcement.id),
        "course_id": str(announcement.course_id) if announcement.course_id else None,
    }


@router.delete("/{announcement_id}")
async def delete_announcement(
    announcement_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Delete an announcement (author or admin only)."""
    user = await _get_current_user(credentials, db)
    announcement = await announcement_crud.get_announcement_by_id(db, announcement_id)
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
    if announcement.author_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="You can only delete your own announcements")
    await announcement_crud.delete_announcement(db, announcement_id)
    return {"message": "Announcement deleted"}
