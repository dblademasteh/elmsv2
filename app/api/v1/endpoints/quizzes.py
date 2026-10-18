"""Quiz endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.schemas.quiz import QuizResponse, QuizAttemptResponse, QuizResult
from app.crud.quiz import (
    get_quiz_by_id,
    get_quizzes_by_lesson,
    get_quizzes_by_course,
    create_quiz,
    update_quiz,
    delete_quiz,
    get_attempts_for_user,
    create_quiz_attempt,
    grade_quiz,
)
from app.crud.enrollment import get_enrollment_by_user_and_course
from app.db.database import get_db
from app.api.v1.endpoints.users import get_current_user_from_token
from typing import List
import uuid

router = APIRouter()
bearer = HTTPBearer(auto_error=False)


def _get_current_user(credentials: HTTPAuthorizationCredentials, db):
    """Resolve the authenticated user or raise 401."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return get_current_user_from_token(credentials, db)


@router.get("/quizzes/course/{course_id}", response_model=List[QuizResponse])
async def list_course_quizzes(
    course_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Get all quizzes for a course (instructor/admin only)."""
    user = await _get_current_user(credentials, db)

    # Allow enrolled students to see their course's quizzes
    if user.role not in ("admin", "instructor"):
        enrollment = await get_enrollment_by_user_and_course(db, user.id, course_id)
        if not enrollment:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    quizzes = await get_quizzes_by_course(db, course_id)
    return [
        QuizResponse(
            id=q.id,
            lesson_id=q.lesson_id,
            title=q.title,
            description=q.description,
            questions=q.questions or [],
            time_limit_seconds=q.time_limit_seconds,
            max_attempts=q.max_attempts,
            passing_grade=q.passing_grade,
            randomize_questions=q.randomize_questions,
            show_results=q.show_results,
            allow_retry=q.allow_retry,
            created_at=q.created_at,
        )
        for q in quizzes
    ]


@router.get("/quizzes/lesson/{lesson_id}", response_model=List[QuizResponse])
async def list_lesson_quizzes(
    lesson_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Get all quizzes for a lesson (instructor/admin only)."""
    user = await _get_current_user(credentials, db)
    if user.role not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    quizzes = await get_quizzes_by_lesson(db, lesson_id)
    return [
        QuizResponse(
            id=q.id,
            lesson_id=q.lesson_id,
            title=q.title,
            description=q.description,
            questions=q.questions or [],
            time_limit_seconds=q.time_limit_seconds,
            max_attempts=q.max_attempts,
            passing_grade=q.passing_grade,
            randomize_questions=q.randomize_questions,
            show_results=q.show_results,
            allow_retry=q.allow_retry,
            created_at=q.created_at,
        )
        for q in quizzes
    ]


@router.post("/quizzes", response_model=QuizResponse, status_code=status.HTTP_201_CREATED)
async def create_new_quiz(
    quiz_data: dict,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Create a new quiz for a lesson (instructor/admin only)."""
    user = await _get_current_user(credentials, db)
    if user.role not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    lesson_id = quiz_data.get("lesson_id")
    if not lesson_id:
        raise HTTPException(status_code=400, detail="lesson_id is required")

    try:
        lesson_id = uuid.UUID(lesson_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid lesson_id")

    quiz = await create_quiz(
        db=db,
        lesson_id=lesson_id,
        title=quiz_data.get("title", "Untitled Quiz"),
        description=quiz_data.get("description"),
        questions=quiz_data.get("questions", []),
        time_limit_seconds=quiz_data.get("time_limit_seconds"),
        max_attempts=quiz_data.get("max_attempts", 3),
        passing_grade=quiz_data.get("passing_grade", 70.0),
        randomize_questions=quiz_data.get("randomize_questions", False),
        show_results=quiz_data.get("show_results", True),
        allow_retry=quiz_data.get("allow_retry", True),
    )

    return QuizResponse(
        id=quiz.id,
        lesson_id=quiz.lesson_id,
        title=quiz.title,
        description=quiz.description,
        questions=quiz.questions or [],
        time_limit_seconds=quiz.time_limit_seconds,
        max_attempts=quiz.max_attempts,
        passing_grade=quiz.passing_grade,
        randomize_questions=quiz.randomize_questions,
        show_results=quiz.show_results,
        allow_retry=quiz.allow_retry,
        created_at=quiz.created_at,
    )


@router.put("/quizzes/{quiz_id}", response_model=QuizResponse)
async def update_existing_quiz(
    quiz_id: uuid.UUID,
    quiz_data: dict,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Update an existing quiz (owner/admin only)."""
    user = await _get_current_user(credentials, db)
    if user.role not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    quiz = await get_quiz_by_id(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Check ownership via lesson -> course -> instructor
    from app.models.lesson import Lesson
    from app.models.course import Course
    lesson = await db.get(Lesson, quiz.lesson_id)
    if lesson:
        course = await db.get(Course, lesson.course_id)
        if course and course.instructor_id != user.id and user.role != "admin":
            raise HTTPException(status_code=403, detail="You don't own this quiz")

    updated = await update_quiz(
        db=db,
        quiz_id=quiz_id,
        title=quiz_data.get("title"),
        description=quiz_data.get("description"),
        questions=quiz_data.get("questions"),
        time_limit_seconds=quiz_data.get("time_limit_seconds"),
        max_attempts=quiz_data.get("max_attempts"),
        passing_grade=quiz_data.get("passing_grade"),
        randomize_questions=quiz_data.get("randomize_questions"),
        show_results=quiz_data.get("show_results"),
        allow_retry=quiz_data.get("allow_retry"),
    )

    return QuizResponse(
        id=updated.id,
        lesson_id=updated.lesson_id,
        title=updated.title,
        description=updated.description,
        questions=updated.questions or [],
        time_limit_seconds=updated.time_limit_seconds,
        max_attempts=updated.max_attempts,
        passing_grade=updated.passing_grade,
        randomize_questions=updated.randomize_questions,
        show_results=updated.show_results,
        allow_retry=updated.allow_retry,
        created_at=updated.created_at,
    )


@router.delete("/quizzes/{quiz_id}", response_model=dict)
async def delete_quiz_endpoint(
    quiz_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Delete a quiz (owner/admin only)."""
    user = await _get_current_user(credentials, db)
    if user.role not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    quiz = await get_quiz_by_id(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    await delete_quiz(db, quiz_id)
    return {"message": "Quiz deleted successfully", "quiz_id": str(quiz_id)}


@router.post("/quizzes/{quiz_id}/attempt", response_model=QuizResult)
async def submit_quiz_attempt(
    quiz_id: uuid.UUID,
    attempt_data: dict,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Submit a quiz attempt and get graded results."""
    user = await _get_current_user(credentials, db)

    quiz = await get_quiz_by_id(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Check enrollment
    from app.models.lesson import Lesson
    lesson = await db.get(Lesson, quiz.lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Quiz's lesson not found")

    from app.crud.enrollment import get_enrollment_by_user_and_course
    enrollment = await get_enrollment_by_user_and_course(db, user.id, lesson.course_id)
    if not enrollment:
        raise HTTPException(status_code=403, detail="You must be enrolled in the course to take this quiz")

    # Check attempt limits
    attempts = await get_attempts_for_user(db, quiz_id, user.id)
    attempt_number = len(attempts) + 1

    if not quiz.allow_retry and len(attempts) > 0:
        raise HTTPException(
            status_code=409,
            detail="Retry is not allowed for this quiz",
        )
    if len(attempts) >= quiz.max_attempts:
        raise HTTPException(
            status_code=409,
            detail=f"You have reached the maximum of {quiz.max_attempts} attempts",
        )

    answers = attempt_data.get("answers", [])
    enrollment_id = enrollment.id if enrollment else None

    attempt = await create_quiz_attempt(
        db=db,
        quiz_id=quiz_id,
        user_id=user.id,
        enrollment_id=enrollment_id,
        answers=answers,
        attempt_number=attempt_number,
    )

    # Grade the quiz
    result = grade_quiz(quiz, attempt)

    attempt.score = result["score"]
    attempt.grade = result["grade"]
    attempt.passed = result["passed"]
    await db.commit()
    await db.refresh(attempt)

    return QuizResult(
        attempt_id=attempt.id,
        score=result["score"],
        grade=result["grade"],
        passed=result["passed"],
        passing_grade=quiz.passing_grade,
        total_points=result["total_points"],
        earned_points=result["earned_points"],
        answers=answers,
        feedback="Great job!" if result["passed"] else "Keep studying!",
    )


@router.get("/quizzes/{quiz_id}/attempts", response_model=List[QuizAttemptResponse])
async def list_quiz_attempts(
    quiz_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Get all attempts for the current user on a quiz."""
    user = await _get_current_user(credentials, db)

    quiz = await get_quiz_by_id(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    attempts = await get_attempts_for_user(db, quiz_id, user.id)
    return [
        QuizAttemptResponse(
            id=a.id,
            quiz_id=a.quiz_id,
            user_id=a.user_id,
            enrollment_id=a.enrollment_id,
            started_at=a.started_at,
            completed_at=a.completed_at,
            score=a.score,
            grade=a.grade,
            passed=a.passed,
            answers=a.answers,
            attempt_number=a.attempt_number,
        )
        for a in attempts
    ]


@router.get("/quizzes/{quiz_id}", response_model=QuizResponse)
async def get_quiz(
    quiz_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Get a single quiz by ID (students must be enrolled in the course)."""
    user = await _get_current_user(credentials, db)

    quiz = await get_quiz_by_id(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # For students, verify they're enrolled in the course
    if user.role == "student":
        from app.models.lesson import Lesson
        lesson = await db.get(Lesson, quiz.lesson_id)
        if lesson:
            from app.crud.enrollment import get_enrollment_by_user_and_course
            enrollment = await get_enrollment_by_user_and_course(db, user.id, lesson.course_id)
            if not enrollment:
                raise HTTPException(status_code=403, detail="You must be enrolled in the course to view this quiz")

    return QuizResponse(
        id=quiz.id,
        lesson_id=quiz.lesson_id,
        title=quiz.title,
        description=quiz.description,
        questions=quiz.questions or [],
        time_limit_seconds=quiz.time_limit_seconds,
        max_attempts=quiz.max_attempts,
        passing_grade=quiz.passing_grade,
        randomize_questions=quiz.randomize_questions,
        show_results=quiz.show_results,
        allow_retry=quiz.allow_retry,
        created_at=quiz.created_at,
    )
