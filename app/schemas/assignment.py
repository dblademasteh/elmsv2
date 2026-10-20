"""Assignment schemas"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
import uuid

from app.core.urls import UnsafeUrlError, safe_external_url


class AssignmentBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    instructions: Optional[str] = None
    due_date: Optional[datetime] = None
    max_score: float = 100.0
    max_file_size_mb: int = 10
    allowed_file_types: List[str] = Field(default_factory=lambda: ["pdf", "doc", "docx", "zip"])
    rubric_json: Optional[List[dict]] = None
    is_required: bool = True
    is_published: bool = False


class AssignmentCreate(AssignmentBase):
    lesson_id: uuid.UUID


class AssignmentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    instructions: Optional[str] = None
    due_date: Optional[datetime] = None
    max_score: Optional[float] = None
    max_file_size_mb: Optional[int] = None
    allowed_file_types: Optional[List[str]] = None
    rubric_json: Optional[List[dict]] = None
    is_required: Optional[bool] = None
    is_published: Optional[bool] = None


class AssignmentResponse(AssignmentBase):
    id: uuid.UUID
    lesson_id: uuid.UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    submission_count: int = 0
    graded_count: int = 0

    class Config:
        from_attributes = True


class AssignmentSubmissionResponse(BaseModel):
    id: uuid.UUID
    assignment_id: uuid.UUID
    user_id: uuid.UUID
    user_full_name: str
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size_bytes: int = 0
    submitted_at: Optional[datetime] = None
    is_late: bool = False
    score: Optional[float] = None
    feedback: Optional[str] = None
    grader_id: Optional[uuid.UUID] = None
    grader_name: Optional[str] = None
    graded_at: Optional[datetime] = None
    status: str = "draft"
    max_score: float = 100.0
    score_percentage: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AssignmentSubmissionCreate(BaseModel):
    file_url: str
    file_name: str
    file_size_bytes: int = 0

    @field_validator("file_url")
    @classmethod
    def _validate_file_url(cls, value: str) -> str:
        """Reject URLs a staff member would later click as a "file".

        The submission URL is student-controlled and is rendered as a link
        in the instructor's grading view, so only http(s) URLs and
        same-origin paths are accepted.
        """
        try:
            safe = safe_external_url(value)
        except UnsafeUrlError as exc:
            raise ValueError(str(exc)) from exc
        if not safe:
            raise ValueError("A file URL is required")
        return safe


class AssignmentSubmissionGrade(BaseModel):
    score: float = Field(..., ge=0)
    feedback: Optional[str] = None
