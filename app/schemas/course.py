"""Course schemas"""
from pydantic import BaseModel, Field
from pydantic import field_validator
from typing import Optional, List
from datetime import datetime
import uuid

class CourseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    price_cents: int = 0

class CourseResponse(BaseModel):
    id: uuid.UUID
    title: str
    slug: str
    description: Optional[str] = None
    price_cents: int
    currency: str
    level: str
    status: str
    enrollment_count: int
    rating_average: float = 0
    rating_count: int = 0
    learning_objectives: Optional[str] = None
    created_at: datetime

    @field_validator("rating_average", "rating_count", mode="before")
    @classmethod
    def default_missing_ratings(cls, value):
        return value if value is not None else 0

    class Config:
        from_attributes = True

class CourseListResponse(BaseModel):
    id: uuid.UUID
    title: str
    slug: str
    price_cents: int
    currency: str
    enrollment_count: int
    short_description: Optional[str] = None
    description: Optional[str] = None
    level: str
    rating_average: float = 0
    cover_image_url: Optional[str] = None
    is_featured: bool = False
    instructor_name: Optional[str] = None
    status: str = "draft"

    class Config:
        from_attributes = True


class CourseDetailResponse(BaseModel):
    """Detailed course info for the learning interface."""
    id: uuid.UUID
    title: str
    slug: str
    description: Optional[str] = None
    short_description: Optional[str] = None
    price_cents: int
    currency: str
    level: str
    status: str
    cover_image_url: Optional[str] = None
    learning_objectives: Optional[str] = None
    prerequisites: Optional[str] = None
    instructor_id: Optional[uuid.UUID] = None
    published_at: Optional[datetime] = None
    is_featured: bool = False
    is_private: bool = False
    enrollment_count: int = 0
    completion_rate: float = 0
    rating_average: float = 0
    rating_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class CourseCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    short_description: Optional[str] = None
    price_cents: int = 0
    currency: str = "USD"
    level: str = "beginner"
    cover_image_url: Optional[str] = None
    learning_objectives: Optional[str] = None
    prerequisites: Optional[str] = None
    is_private: bool = False
    is_featured: bool = False


class CourseUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = None
    short_description: Optional[str] = None
    price_cents: Optional[int] = None
    currency: Optional[str] = None
    level: Optional[str] = None
    status: Optional[str] = None
    cover_image_url: Optional[str] = None
    learning_objectives: Optional[str] = None
    prerequisites: Optional[str] = None
    is_private: Optional[bool] = None
    is_featured: Optional[bool] = None
    published_at: Optional[datetime] = None
