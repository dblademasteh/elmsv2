"""Quiz schemas"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

class QuizQuestion(BaseModel):
    """A single quiz question."""
    id: str = Field(default_factory=lambda: f"q_{uuid.uuid4().hex[:8]}")
    type: str = Field(..., description="Question type: multiple_choice, true_false, short_answer")
    question: str
    options: Optional[List[str]] = None  # For multiple_choice
    correct_answer: Optional[str] = None  # The correct answer
    points: int = 1


class QuizAnswer(BaseModel):
    """A student's answer to a quiz question."""
    question_id: str
    answer: Optional[str] = None
    answer_index: Optional[int] = None  # For multiple choice (selected option index)


class QuizBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    questions: List[Dict[str, Any]] = Field(default_factory=list)
    time_limit_seconds: Optional[int] = None
    max_attempts: int = 3
    passing_grade: float = 70.0
    randomize_questions: bool = False
    show_results: bool = True
    allow_retry: bool = True


class QuizCreate(QuizBase):
    lesson_id: uuid.UUID


class QuizUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = None
    questions: Optional[List[Dict[str, Any]]] = None
    time_limit_seconds: Optional[int] = None
    max_attempts: Optional[int] = None
    passing_grade: Optional[float] = None
    randomize_questions: Optional[bool] = None
    show_results: Optional[bool] = None
    allow_retry: Optional[bool] = None


class QuizResponse(QuizBase):
    id: uuid.UUID
    lesson_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True


class QuizAttemptCreate(BaseModel):
    answers: List[Dict[str, Any]]  # List of {question_id, answer, answer_index}


class QuizAttemptResponse(BaseModel):
    id: uuid.UUID
    quiz_id: uuid.UUID
    user_id: uuid.UUID
    enrollment_id: Optional[uuid.UUID] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    score: Optional[float] = None
    grade: Optional[float] = None
    passed: bool = False
    answers: Optional[List[Dict[str, Any]]] = None
    attempt_number: int = 1

    class Config:
        from_attributes = True


class QuizResult(BaseModel):
    """Result returned after a quiz attempt is graded."""
    attempt_id: uuid.UUID
    score: float
    grade: float
    passed: bool
    passing_grade: float
    total_points: int
    earned_points: int
    answers: List[Dict[str, Any]]
    feedback: Optional[str] = None
