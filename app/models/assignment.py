"""Assignment models"""
from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from app.db.database import Base


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, unique=True, index=True)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    instructions = Column(Text, nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    max_score = Column(Float, default=100.0)
    max_file_size_mb = Column(Integer, default=10)
    allowed_file_types = Column(JSONB, default=list)  # e.g., ["pdf", "doc", "docx", "zip"]
    rubric_json = Column(JSONB, nullable=True)  # Grading rubric
    is_required = Column(Boolean, default=True)
    is_published = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AssignmentSubmission(Base):
    __tablename__ = "assignment_submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, unique=True, index=True)
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    enrollment_id = Column(UUID(as_uuid=True), ForeignKey("enrollments.id", ondelete="CASCADE"), nullable=True)
    file_url = Column(Text, nullable=True)
    file_name = Column(String(255), nullable=True)
    file_size_bytes = Column(Integer, default=0)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    is_late = Column(Boolean, default=False)
    score = Column(Float, nullable=True)
    feedback = Column(Text, nullable=True)
    grader_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    graded_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), default="draft")  # draft, submitted, graded, returned
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
