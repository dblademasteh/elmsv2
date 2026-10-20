"""Quiz CRUD operations"""
from sqlalchemy import select, and_, func as sql_func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.quiz import Quiz, QuizAttempt
from app.models.lesson import Lesson
from app.models.enrollment import Enrollment
from app.core.quiz_types import (
    MANUAL_GRADING_TYPES,
    MULTIPLE_CHOICE,
    TRUE_FALSE,
    accepted_answers,
    normalize_bool,
    normalize_points,
    normalize_question_type,
    normalize_text,
)
from typing import Any, Dict, List, Optional
import uuid


async def get_quiz_by_id(db: AsyncSession, quiz_id: uuid.UUID) -> Optional[Quiz]:
    """Get a quiz by ID."""
    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    return result.scalar_one_or_none()


async def get_quizzes_by_lesson(db: AsyncSession, lesson_id: uuid.UUID) -> List[Quiz]:
    """Get all quizzes for a lesson."""
    result = await db.execute(
        select(Quiz)
        .where(Quiz.lesson_id == lesson_id)
        .order_by(Quiz.created_at)
    )
    return result.scalars().all()


async def get_quizzes_by_course(db: AsyncSession, course_id: uuid.UUID) -> List[Quiz]:
    """Get all quizzes for a course (via lesson join)."""
    result = await db.execute(
        select(Quiz)
        .join(Lesson, Quiz.lesson_id == Lesson.id)
        .where(Lesson.course_id == course_id)
        .order_by(Lesson.position, Quiz.created_at)
    )
    return result.scalars().all()


async def create_quiz(
    db: AsyncSession,
    lesson_id: uuid.UUID,
    title: str,
    description: str = None,
    questions: List[dict] = None,
    time_limit_seconds: int = None,
    max_attempts: int = 3,
    passing_grade: float = 70.0,
    randomize_questions: bool = False,
    show_results: bool = True,
    allow_retry: bool = True,
    quiz_type: str = "multiple_choice",
) -> Quiz:
    """Create a new quiz for a lesson."""
    db_quiz = Quiz(
        lesson_id=lesson_id,
        title=title,
        description=description,
        questions=questions or [],
        time_limit_seconds=time_limit_seconds,
        max_attempts=max_attempts,
        passing_grade=passing_grade,
        randomize_questions=randomize_questions,
        show_results=show_results,
        allow_retry=allow_retry,
        quiz_type=quiz_type,
    )
    db.add(db_quiz)
    await db.commit()
    await db.refresh(db_quiz)
    return db_quiz


async def update_quiz(
    db: AsyncSession,
    quiz_id: uuid.UUID,
    title: str = None,
    description: str = None,
    questions: List[dict] = None,
    time_limit_seconds: int = None,
    max_attempts: int = None,
    passing_grade: float = None,
    randomize_questions: bool = None,
    show_results: bool = None,
    allow_retry: bool = None,
    quiz_type: str = None,
    clear_time_limit: bool = False,
) -> Optional[Quiz]:
    """Update an existing quiz."""
    quiz = await get_quiz_by_id(db, quiz_id)
    if not quiz:
        return None

    if title is not None:
        quiz.title = title
    if description is not None:
        quiz.description = description
    if questions is not None:
        quiz.questions = questions
    if clear_time_limit:
        quiz.time_limit_seconds = None
    elif time_limit_seconds is not None:
        quiz.time_limit_seconds = time_limit_seconds
    if max_attempts is not None:
        quiz.max_attempts = max_attempts
    if passing_grade is not None:
        quiz.passing_grade = passing_grade
    if randomize_questions is not None:
        quiz.randomize_questions = randomize_questions
    if show_results is not None:
        quiz.show_results = show_results
    if allow_retry is not None:
        quiz.allow_retry = allow_retry
    if quiz_type is not None:
        quiz.quiz_type = quiz_type

    await db.commit()
    await db.refresh(quiz)
    return quiz


async def delete_quiz(db: AsyncSession, quiz_id: uuid.UUID) -> bool:
    """Delete a quiz."""
    quiz = await get_quiz_by_id(db, quiz_id)
    if not quiz:
        return False
    await db.delete(quiz)
    await db.commit()
    return True


async def get_attempt_by_id(db: AsyncSession, attempt_id: uuid.UUID) -> Optional[QuizAttempt]:
    """Get a quiz attempt by ID."""
    result = await db.execute(select(QuizAttempt).where(QuizAttempt.id == attempt_id))
    return result.scalar_one_or_none()


async def get_attempts_for_user(db: AsyncSession, quiz_id: uuid.UUID, user_id: uuid.UUID) -> List[QuizAttempt]:
    """Get all attempts for a user on a specific quiz."""
    result = await db.execute(
        select(QuizAttempt)
        .where(and_(QuizAttempt.quiz_id == quiz_id, QuizAttempt.user_id == user_id))
        .order_by(QuizAttempt.attempt_number)
    )
    return result.scalars().all()


async def get_attempts_for_quiz(db: AsyncSession, quiz_id: uuid.UUID) -> List[QuizAttempt]:
    """Get every attempt submitted for a quiz (instructor review)."""
    result = await db.execute(
        select(QuizAttempt)
        .where(QuizAttempt.quiz_id == quiz_id)
        .order_by(QuizAttempt.attempt_number, QuizAttempt.started_at)
    )
    return result.scalars().all()


async def create_quiz_attempt(
    db: AsyncSession,
    quiz_id: uuid.UUID,
    user_id: uuid.UUID,
    enrollment_id: uuid.UUID = None,
    answers: List[dict] = None,
    attempt_number: int = 1,
) -> QuizAttempt:
    """Create a new quiz attempt."""
    db_attempt = QuizAttempt(
        quiz_id=quiz_id,
        user_id=user_id,
        enrollment_id=enrollment_id,
        answers=answers or [],
        attempt_number=attempt_number,
    )
    db.add(db_attempt)
    await db.commit()
    await db.refresh(db_attempt)
    return db_attempt


def _index_questions(questions: Any) -> List[Dict[str, Any]]:
    """Return questions with a canonical type and point value, keeping their ids."""
    indexed: List[Dict[str, Any]] = []
    for raw in questions or []:
        if not isinstance(raw, dict):
            continue
        question = dict(raw)
        question["type"] = normalize_question_type(question.get("type"))
        question["points"] = normalize_points(question.get("points"))
        indexed.append(question)
    return indexed


def _answer_lookup(answers: Any) -> Dict[str, Dict[str, Any]]:
    """Index a student's answers by question id (first answer wins)."""
    lookup: Dict[str, Dict[str, Any]] = {}
    for row in answers or []:
        if not isinstance(row, dict):
            continue
        qid = row.get("question_id")
        if qid is None:
            continue
        lookup.setdefault(str(qid), row)
    return lookup


def _student_answer(answer_row: Optional[Dict[str, Any]], q_type: str) -> Any:
    """Pull the submitted answer for a question out of an answer row."""
    if answer_row is None:
        return None
    if q_type == MULTIPLE_CHOICE and answer_row.get("answer_index") is not None:
        return answer_row.get("answer_index")
    value = answer_row.get("answer")
    if value is None:
        value = answer_row.get("answer_index")
    return value


def _is_correct(q_type: str, student_answer: Any, correct: Any) -> bool:
    """Compare a submitted answer with the answer key for its question type."""
    if student_answer is None or correct is None:
        return False

    if q_type == MULTIPLE_CHOICE:
        try:
            return int(student_answer) == int(correct)
        except (TypeError, ValueError):
            return normalize_text(student_answer) == normalize_text(correct)

    if q_type == TRUE_FALSE:
        return normalize_bool(student_answer) == normalize_bool(correct)

    accepted = accepted_answers(correct)
    if not accepted:
        return False
    return normalize_text(student_answer) in accepted


def _passing_grade(quiz: Quiz) -> float:
    """The quiz's passing grade, tolerating a missing value."""
    if quiz.passing_grade is None:
        return 70.0
    return float(quiz.passing_grade)


def grade_quiz(quiz: Quiz, attempt: QuizAttempt) -> dict:
    """Grade a quiz attempt based on the quiz's questions and the attempt's answers.

    Automatically graded types contribute to the score immediately. Essay
    questions need a human grader, so the attempt is flagged for review and no
    final score is produced until an instructor grades it.
    """
    questions = _index_questions(quiz.questions)
    answers = _answer_lookup(attempt.answers)

    total_points = 0
    auto_points = 0
    manual_points = 0
    earned_points = 0
    needs_review = False

    for question in questions:
        points = question["points"]
        total_points += points
        q_type = question["type"]

        if q_type in MANUAL_GRADING_TYPES:
            manual_points += points
            needs_review = True
            continue

        auto_points += points
        student_answer = _student_answer(
            answers.get(str(question.get("id"))), q_type
        )
        if _is_correct(q_type, student_answer, question.get("correct_answer")):
            earned_points += points

    if needs_review:
        return {
            "score": None,
            "grade": None,
            "passed": False,
            "total_points": total_points,
            "earned_points": earned_points,
            "auto_points": auto_points,
            "manual_points": manual_points,
            "needs_review": True,
        }

    score = round(earned_points / auto_points * 100, 2) if auto_points > 0 else 0.0
    return {
        "score": score,
        "grade": score,
        "passed": score >= _passing_grade(quiz),
        "total_points": total_points,
        "earned_points": earned_points,
        "auto_points": auto_points,
        "manual_points": manual_points,
        "needs_review": False,
    }


def apply_manual_grade(
    quiz: Quiz, attempt: QuizAttempt, awarded_points: float, feedback: Optional[str] = None
) -> dict:
    """Apply an instructor's award for the manually graded part of an attempt.

    The automatically graded part is recomputed from the stored answers and
    combined with the awarded points to produce the final score.
    """
    auto = grade_quiz(quiz, attempt)
    manual_points = auto["manual_points"]

    awarded = max(0.0, float(awarded_points))
    if manual_points:
        awarded = min(awarded, float(manual_points))

    earned_points = auto["earned_points"] + awarded
    total_points = auto["total_points"]
    score = round(earned_points / total_points * 100, 2) if total_points > 0 else 0.0

    return {
        "score": score,
        "grade": score,
        "passed": score >= _passing_grade(quiz),
        "total_points": total_points,
        "earned_points": earned_points,
        "auto_points": auto["auto_points"],
        "manual_points": manual_points,
        "manual_awarded": awarded,
        "needs_review": False,
        "feedback": feedback,
    }

