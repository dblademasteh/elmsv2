"""Course model"""
from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.db.database import Base

class Course(Base):
    __tablename__ = "courses"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, unique=True, index=True)
    title = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    short_description = Column(String(500), nullable=True)
    price_cents = Column(Integer, default=0)
    currency = Column(String(3), default="USD")
    level = Column(String(20), default="beginner")
    status = Column(String(20), default="draft")
    cover_image_url = Column(String(500), nullable=True)
    learning_objectives = Column(Text, nullable=True)
    prerequisites = Column(Text, nullable=True)
    instructor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    published_at = Column(DateTime, nullable=True)
    is_featured = Column(Boolean, default=False)
    is_private = Column(Boolean, default=False)
    enrollment_count = Column(Integer, default=0)
    completion_rate = Column(Float, default=0.0)
    rating_average = Column(Float, default=0.0)
    rating_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())