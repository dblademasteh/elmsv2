"""Quiz models"""
from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey, func, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from app.db.database import Base

class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, unique=True, index=True)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    questions = Column(JSONB, nullable=False)  # Structured question data
    time_limit_seconds = Column(Integer, nullable=True)
    max_attempts = Column(Integer, default=3)
    passing_grade = Column(Float, default=70.0)
    randomize_questions = Column(Boolean, default=False)
    show_results = Column(Boolean, default=True)
    allow_retry = Column(Boolean, default=True)
    quiz_type = Column(String(50), default="multiple_choice")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, unique=True, index=True)
    quiz_id = Column(UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    enrollment_id = Column(UUID(as_uuid=True), ForeignKey("enrollments.id", ondelete="CASCADE"), nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    score = Column(Float, nullable=True)
    grade = Column(Float, nullable=True)
    passed = Column(Boolean, default=False)
    answers = Column(JSONB, nullable=True)
    attempt_number = Column(Integer, default=1)
    needs_review = Column(Boolean, default=False, nullable=False, server_default=text("false"))
    graded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    graded_at = Column(DateTime(timezone=True), nullable=True)
    feedback = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
