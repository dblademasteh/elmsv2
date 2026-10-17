"""Enrollment model"""
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, func, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.db.database import Base

class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("user_id", "course_id", name="unique_enrollment"),)
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, unique=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False)
    enrolled_at = Column(DateTime(timezone=True), server_default=func.now())
    progress_percent = Column(Float, default=0.0)
    status = Column(String(20), default="active")
    completed_at = Column(DateTime, nullable=True)
    certificate_issued = Column(Boolean, default=False)
    certificate_token = Column(String(255), unique=True, nullable=True)
    total_minutes = Column(Integer, default=0)
    last_accessed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())