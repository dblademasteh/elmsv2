"""Quiz schemas"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
import uuid

from app.core.quiz_types import QUIZ_TYPES, is_valid_quiz_type


class QuizQuestion(BaseModel):
    """A single quiz question."""
    id: str = Field(default_factory=lambda: f"q_{uuid.uuid4().hex[:8]}")
    type: str = Field(
        default="multiple_choice",
        description=f"Question type: {', '.join(QUIZ_TYPES)}",
    )
    question: str = Field(..., min_length=1)
    options: Optional[List[str]] = None  # For multiple_choice
    correct_answer: Optional[Union[str, int, List[str]]] = None  # The correct answer
    points: int = Field(default=1, ge=0, le=1000)

    @field_validator("type")
    @classmethod
    def _validate_type(cls, value: str) -> str:
        if not is_valid_quiz_type(value) and value != "short_answer":
            raise ValueError(
                f"Unsupported question type: {value}. Supported types: {', '.join(QUIZ_TYPES)}"
            )
        return value


class QuizAnswer(BaseModel):
    """A student's answer to a quiz question."""
    question_id: str
    answer: Optional[str] = None
    answer_index: Optional[int] = None  # For multiple choice (selected option index)


class QuizBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    questions: List[Dict[str, Any]] = Field(default_factory=list)
    time_limit_seconds: Optional[int] = Field(None, ge=1)
    max_attempts: int = Field(3, ge=1, le=100)
    passing_grade: float = Field(70.0, ge=0, le=100)
    randomize_questions: bool = False
    show_results: bool = True
    allow_retry: bool = True
    quiz_type: str = Field(
        default="multiple_choice",
        description=f"Exam type: {', '.join(QUIZ_TYPES)}",
    )

    @field_validator("quiz_type")
    @classmethod
    def _validate_quiz_type(cls, value: str) -> str:
        if not is_valid_quiz_type(value):
            raise ValueError(
                f"Unsupported quiz type: {value}. Supported types: {', '.join(QUIZ_TYPES)}"
            )
        return value


class QuizCreate(QuizBase):
    lesson_id: uuid.UUID
    questions: List[QuizQuestion] = Field(default_factory=list)


class QuizUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = None
    questions: Optional[List[QuizQuestion]] = None
    time_limit_seconds: Optional[int] = Field(None, ge=1)
    max_attempts: Optional[int] = Field(None, ge=1, le=100)
    passing_grade: Optional[float] = Field(None, ge=0, le=100)
    randomize_questions: Optional[bool] = None
    show_results: Optional[bool] = None
    allow_retry: Optional[bool] = None
    quiz_type: Optional[str] = None

    @field_validator("quiz_type")
    @classmethod
    def _validate_quiz_type(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if not is_valid_quiz_type(value):
            raise ValueError(
                f"Unsupported quiz type: {value}. Supported types: {', '.join(QUIZ_TYPES)}"
            )
        return value


class QuizResponse(QuizBase):
    id: uuid.UUID
    lesson_id: uuid.UUID
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class QuizAttemptCreate(BaseModel):
    answers: List[QuizAnswer] = Field(default_factory=list)
    attempt_id: Optional[uuid.UUID] = None


class QuizAttemptResponse(BaseModel):
    id: uuid.UUID
    quiz_id: uuid.UUID
    user_id: uuid.UUID
    user_full_name: Optional[str] = None
    enrollment_id: Optional[uuid.UUID] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    score: Optional[float] = None
    grade: Optional[float] = None
    passed: bool = False
    answers: Optional[List[Dict[str, Any]]] = None
    attempt_number: int = 1
    needs_review: bool = False
    graded_by: Optional[uuid.UUID] = None
    graded_at: Optional[datetime] = None
    feedback: Optional[str] = None

    class Config:
        from_attributes = True


class QuizManualGrade(BaseModel):
    """Instructor award for the manually graded part of an attempt."""
    points: float = Field(..., ge=0)
    feedback: Optional[str] = None


class QuizResult(BaseModel):
    """Result returned after a quiz attempt is graded."""
    attempt_id: uuid.UUID
    score: Optional[float] = None
    grade: Optional[float] = None
    passed: bool = False
    passing_grade: float = 0.0
    total_points: int = 0
    earned_points: int = 0
    answers: List[Dict[str, Any]] = Field(default_factory=list)
    feedback: Optional[str] = None
    needs_review: bool = False
    results_hidden: bool = False
