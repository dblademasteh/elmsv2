"""Enrollment schemas"""
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime
import uuid

class EnrollmentResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    course_id: uuid.UUID
    enrolled_at: datetime
    progress_percent: float = 0.0
    status: str = "active"
    completed_at: Optional[datetime] = None
    total_minutes: int = 0
    last_accessed_at: Optional[datetime] = None
    created_at: datetime

    @field_validator("progress_percent", "total_minutes", mode="before")
    @classmethod
    def default_missing(cls, value):
        return value if value is not None else 0

    class Config:
        from_attributes = True


class StudentEnrollmentResponse(BaseModel):
    """Enrollment with nested user and course info for the student table."""
    id: uuid.UUID
    user_id: uuid.UUID
    user_full_name: str
    user_email: str
    user_avatar_url: Optional[str] = None
    course_id: uuid.UUID
    course_title: str
    course_level: str
    enrolled_at: datetime
    progress_percent: float = 0.0
    status: str = "active"
    completed_at: Optional[datetime] = None
    total_minutes: int = 0
    last_accessed_at: Optional[datetime] = None

    @field_validator("progress_percent", "total_minutes", mode="before")
    @classmethod
    def default_missing(cls, value):
        return value if value is not None else 0

    class Config:
        from_attributes = True


class EnrollmentCreate(BaseModel):
    """Schema for creating an enrollment (student enrolling in a course)."""
    course_id: uuid.UUID


class StudentEnrollmentDetailResponse(BaseModel):
    """Enrollment with course details for the student learning dashboard."""
    id: uuid.UUID
    course_id: uuid.UUID
    course_title: str
    course_level: str
    course_cover_image_url: Optional[str] = None
    enrolled_at: datetime
    progress_percent: float = 0.0
    status: str = "active"
    completed_at: Optional[datetime] = None
    total_minutes: int = 0
    last_accessed_at: Optional[datetime] = None

    @field_validator("progress_percent", "total_minutes", mode="before")
    @classmethod
    def default_missing(cls, value):
        return value if value is not None else 0

    class Config:
        from_attributes = True
