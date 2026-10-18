"""Lesson schemas"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid


class LessonBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    position: int = 0
    content_type: str = Field(default="video", pattern="^(video|text|quiz|assignment|download)$")
    video_url: Optional[str] = None
    video_duration_seconds: Optional[int] = None
    duration_seconds: Optional[int] = None
    content_json: Optional[str] = None
    estimated_minutes: int = 5
    is_published: Optional[bool] = None
    section_title: Optional[str] = Field(None, max_length=255)


class LessonCreate(LessonBase):
    course_id: uuid.UUID


class LessonUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    position: Optional[int] = None
    content_type: Optional[str] = Field(None, pattern="^(video|text|quiz|assignment|download)$")
    video_url: Optional[str] = None
    video_duration_seconds: Optional[int] = None
    duration_seconds: Optional[int] = None
    content_json: Optional[str] = None
    estimated_minutes: Optional[int] = None
    is_published: Optional[bool] = None
    section_title: Optional[str] = Field(None, max_length=255)


class LessonResponse(LessonBase):
    id: uuid.UUID
    course_id: uuid.UUID
    slug: Optional[str] = None
    published_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
