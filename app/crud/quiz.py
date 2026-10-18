"""Quiz CRUD operations"""
from sqlalchemy import select, and_, func as sql_func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.quiz import Quiz, QuizAttempt
from app.models.lesson import Lesson
from app.models.enrollment import Enrollment
from typing import List, Optional
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
    if time_limit_seconds is not None:
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


def grade_quiz(quiz: Quiz, attempt: QuizAttempt) -> dict:
    """Grade a quiz attempt based on the quiz's questions and the attempt's answers."""
    questions = quiz.questions or []
    answers = attempt.answers or []

    # Build a lookup of question -> correct answer
    total_points = 0
    earned_points = 0

    for q in questions:
        qid = q.get("id")
        q_points = q.get("points", 1)
        total_points += q_points

        correct = q.get("correct_answer")
        q_type = q.get("type", "multiple_choice")

        # Find the student's answer for this question
        student_answer = None
        for a in answers:
            if a.get("question_id") == qid:
                student_answer = a.get("answer") or a.get("answer_index")
                break

        if student_answer is not None:
            if q_type == "multiple_choice":
                # Correct answer can be a string or an index
                if correct is not None:
                    try:
                        correct_idx = int(correct)
                        if int(student_answer) == correct_idx:
                            earned_points += q_points
                    except (ValueError, TypeError):
                        if str(student_answer) == str(correct):
                            earned_points += q_points
            elif q_type == "true_false":
                if str(student_answer).lower() == str(correct).lower():
                    earned_points += q_points
            elif q_type == "short_answer":
                # Case-insensitive comparison with trimmed whitespace
                if str(student_answer).strip().lower() == str(correct).strip().lower():
                    earned_points += q_points

    score = round((earned_points / total_points * 100), 2) if total_points > 0 else 0.0
    grade = score
    passed = score >= (quiz.passing_grade or 70.0)

    return {
        "score": score,
        "grade": grade,
        "passed": passed,
        "total_points": total_points,
        "earned_points": earned_points,
    }
