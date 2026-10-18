"""Review model"""
from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.db.database import Base

class Review(Base):
    __tablename__ = "reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, unique=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    rating_content = Column(Integer, nullable=False)  # 1-5
    rating_instructor = Column(Integer, nullable=False)  # 1-5
    rating_value = Column(Integer, nullable=False)  # 1-5
    title = Column(String(255), nullable=True)
    review = Column(Text, nullable=True)
    is_approved = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "course_id", name="uq_review_user_course"),
    )
