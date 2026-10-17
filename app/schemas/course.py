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
