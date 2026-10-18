"""Review schemas"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
import uuid


class ReviewCreate(BaseModel):
    """Schema for creating a review with multi-criterion ratings."""
    rating_content: int = Field(..., ge=1, le=5)
    rating_instructor: int = Field(..., ge=1, le=5)
    rating_value: int = Field(..., ge=1, le=5)
    title: Optional[str] = Field(None, max_length=255)
    review: Optional[str] = Field(None, max_length=2000)

    @field_validator("rating_content", "rating_instructor", "rating_value")
    @classmethod
    def validate_ratings(cls, v):
        if v < 1 or v > 5:
            raise ValueError("Rating must be between 1 and 5")
        return v


class ReviewUpdate(BaseModel):
    rating_content: Optional[int] = Field(None, ge=1, le=5)
    rating_instructor: Optional[int] = Field(None, ge=1, le=5)
    rating_value: Optional[int] = Field(None, ge=1, le=5)
    title: Optional[str] = Field(None, max_length=255)
    review: Optional[str] = Field(None, max_length=2000)
    is_approved: Optional[bool] = None
    is_featured: Optional[bool] = None


class ReviewResponse(BaseModel):
    """Schema returned to clients for a single review."""
    id: uuid.UUID
    user_id: uuid.UUID
    user_full_name: str
    user_avatar_url: Optional[str] = None
    user_role: str
    course_id: uuid.UUID
    rating_content: int
    rating_instructor: int
    rating_value: int
    average_rating: float
    title: Optional[str] = None
    review: Optional[str] = None
    is_approved: bool
    is_featured: bool
    created_at: datetime

    class Config:
        from_attributes = True


class FeaturedReviewResponse(BaseModel):
    """Public review for landing-page testimonials."""
    id: uuid.UUID
    user_full_name: str
    user_avatar_url: Optional[str] = None
    user_role: str
    course_id: uuid.UUID
    course_title: str
    average_rating: float
    title: Optional[str] = None
    review: Optional[str] = None
    created_at: datetime


class CourseRatingSummary(BaseModel):
    """Aggregate rating summary for a course."""
    course_id: uuid.UUID
    average_content: float = 0.0
    average_instructor: float = 0.0
    average_value: float = 0.0
    overall_average: float = 0.0
    total_reviews: int = 0
    rating_distribution: dict = Field(default_factory=lambda: {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0})
