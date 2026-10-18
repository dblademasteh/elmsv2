"""Lesson model"""
from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.db.database import Base

class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, unique=True, index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    slug = Column(String(255), nullable=True)
    position = Column(Integer, nullable=False, default=0)
    content_type = Column(String(20), nullable=False, default="video")
    video_url = Column(Text, nullable=True)
    video_duration_seconds = Column(Integer, nullable=True)
    content_json = Column(Text, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    is_published = Column(Boolean, default=False)
    published_at = Column(DateTime, nullable=True)
    estimated_minutes = Column(Integer, default=5)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
