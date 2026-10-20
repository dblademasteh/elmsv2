"""Quiz endpoints"""
import random
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.schemas.quiz import (
    QuizAttemptCreate,
    QuizAttemptResponse,
    QuizCreate,
    QuizManualGrade,
    QuizResponse,
    QuizResult,
    QuizUpdate,
)
from app.core.quiz_types import normalize_questions
from app.crud.quiz import (
    get_quiz_by_id,
    get_quizzes_by_lesson,
    get_quizzes_by_course,
    create_quiz,
    update_quiz,
    delete_quiz,
    get_attempt_by_id,
    get_attempts_for_user,
    get_attempts_for_quiz,
    create_quiz_attempt,
    grade_quiz,
    apply_manual_grade,
)
from app.crud.enrollment import get_enrollment_by_user_and_course
from app.crud.lesson import get_lesson_by_id
from app.crud.course import get_course_by_id_raw
from app.db.database import get_db
from app.api.v1.endpoints.users import get_current_user_from_token
from typing import Any, Dict, List, Optional
import uuid

router = APIRouter()
bearer = HTTPBearer(auto_error=False)

# Seconds of network/client grace after a quiz time limit before submissions are rejected
TIME_LIMIT_GRACE_SECONDS = 15


def _get_current_user(credentials: HTTPAuthorizationCredentials, db):
    """Resolve the authenticated user or raise 401."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return get_current_user_from_token(credentials, db)


def _is_staff(user) -> bool:
    """Whether the user may author quizzes or review attempts."""
    return user.role in ("admin", "instructor")


def _sanitize_questions(questions: Any) -> List[Dict[str, Any]]:
    """Strip answer keys so a quiz can be delivered to a student."""
    sanitized = []
    for question in questions or []:
        if not isinstance(question, dict):
            continue
        sanitized.append({k: v for k, v in question.items() if k != "correct_answer"})
    return sanitized


def _quiz_response(quiz, questions: Optional[List[Dict[str, Any]]] = None) -> QuizResponse:
    """Build a quiz response, defaulting to the stored questions."""
    return QuizResponse(
        id=quiz.id,
        lesson_id=quiz.lesson_id,
        title=quiz.title,
        description=quiz.description,
        questions=questions if questions is not None else (quiz.questions or []),
        time_limit_seconds=quiz.time_limit_seconds,
        max_attempts=quiz.max_attempts,
        passing_grade=quiz.passing_grade,
        randomize_questions=quiz.randomize_questions,
        show_results=quiz.show_results,
        allow_retry=quiz.allow_retry,
        quiz_type=quiz.quiz_type,
        created_at=quiz.created_at,
    )


async def _ensure_quiz_owner(user, quiz, db) -> None:
    """Raise 403 unless the user owns the quiz's course (admins always pass)."""
    from app.models.lesson import Lesson
    from app.models.course import Course

    lesson = await db.get(Lesson, quiz.lesson_id)
    if not lesson:
        return
    course = await db.get(Course, lesson.course_id)
    if course and course.instructor_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="You don't own this quiz")


async def _attempt_response(attempt, quiz, db, reveal: bool) -> QuizAttemptResponse:
    """Build an attempt response.

    Results are only revealed to the student when the quiz allows it; staff
    always see the full picture.
    """
    score = attempt.score
    grade = attempt.grade
    passed = attempt.passed

    if not reveal and quiz is not None and not quiz.show_results:
        score = None
        grade = None
        passed = False

    user_full_name = None
    if reveal:
        from app.models.user import User

        row = await db.get(User, attempt.user_id)
        user_full_name = row.full_name if row else None

    return QuizAttemptResponse(
        id=attempt.id,
        quiz_id=attempt.quiz_id,
        user_id=attempt.user_id,
        user_full_name=user_full_name,
        enrollment_id=attempt.enrollment_id,
        started_at=attempt.started_at,
        completed_at=attempt.completed_at,
        score=score,
        grade=grade,
        passed=passed,
        answers=attempt.answers,
        attempt_number=attempt.attempt_number,
        needs_review=attempt.needs_review,
        graded_by=attempt.graded_by,
        graded_at=attempt.graded_at,
        feedback=attempt.feedback,
    )


@router.get("/quizzes/course/{course_id}", response_model=List[QuizResponse])
async def list_course_quizzes(
    course_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Get all quizzes for a course (instructor/admin only)."""
    user = await _get_current_user(credentials, db)
    staff = _is_staff(user)

    # Allow enrolled students to see their course's quizzes
    if not staff:
        enrollment = await get_enrollment_by_user_and_course(db, user.id, course_id)
        if not enrollment:
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    quizzes = await get_quizzes_by_course(db, course_id)
    return [
        _quiz_response(
            q,
            q.questions if staff else _sanitize_questions(q.questions),
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
    if not _is_staff(user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    quizzes = await get_quizzes_by_lesson(db, lesson_id)
    return [_quiz_response(q) for q in quizzes]


@router.post("/quizzes", response_model=QuizResponse, status_code=status.HTTP_201_CREATED)
async def create_new_quiz(
    quiz_data: QuizCreate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Create a new quiz for a lesson (instructor/admin only)."""
    user = await _get_current_user(credentials, db)
    if not _is_staff(user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # Verify the lesson exists and belongs to a course the instructor owns
    lesson = await get_lesson_by_id(db, quiz_data.lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    course = await get_course_by_id_raw(db, lesson.course_id)
    if course and course.instructor_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="You don't own this course")

    quiz = await create_quiz(
        db=db,
        lesson_id=quiz_data.lesson_id,
        title=quiz_data.title,
        description=quiz_data.description,
        questions=normalize_questions([q.model_dump() for q in quiz_data.questions]),
        time_limit_seconds=quiz_data.time_limit_seconds,
        max_attempts=quiz_data.max_attempts,
        passing_grade=quiz_data.passing_grade,
        randomize_questions=quiz_data.randomize_questions,
        show_results=quiz_data.show_results,
        allow_retry=quiz_data.allow_retry,
        quiz_type=quiz_data.quiz_type,
    )

    return _quiz_response(quiz)


@router.put("/quizzes/{quiz_id}", response_model=QuizResponse)
async def update_existing_quiz(
    quiz_id: uuid.UUID,
    quiz_data: QuizUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Update an existing quiz (owner/admin only)."""
    user = await _get_current_user(credentials, db)
    if not _is_staff(user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    quiz = await get_quiz_by_id(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    await _ensure_quiz_owner(user, quiz, db)

    updates: Dict[str, Any] = {}
    if quiz_data.title is not None:
        updates["title"] = quiz_data.title
    if quiz_data.description is not None:
        updates["description"] = quiz_data.description
    if quiz_data.questions is not None:
        updates["questions"] = normalize_questions(
            [q.model_dump() for q in quiz_data.questions]
        )
    if quiz_data.time_limit_seconds is not None:
        updates["time_limit_seconds"] = quiz_data.time_limit_seconds
    elif "time_limit_seconds" in quiz_data.model_fields_set:
        # The instructor explicitly removed the time limit
        updates["clear_time_limit"] = True
    if quiz_data.max_attempts is not None:
        updates["max_attempts"] = quiz_data.max_attempts
    if quiz_data.passing_grade is not None:
        updates["passing_grade"] = quiz_data.passing_grade
    if quiz_data.randomize_questions is not None:
        updates["randomize_questions"] = quiz_data.randomize_questions
    if quiz_data.show_results is not None:
        updates["show_results"] = quiz_data.show_results
    if quiz_data.allow_retry is not None:
        updates["allow_retry"] = quiz_data.allow_retry
    if quiz_data.quiz_type is not None:
        updates["quiz_type"] = quiz_data.quiz_type

    updated = await update_quiz(db=db, quiz_id=quiz_id, **updates)

    return _quiz_response(updated)


@router.delete("/quizzes/{quiz_id}", response_model=dict)
async def delete_quiz_endpoint(
    quiz_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Delete a quiz (owner/admin only)."""
    user = await _get_current_user(credentials, db)
    if not _is_staff(user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    quiz = await get_quiz_by_id(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    await _ensure_quiz_owner(user, quiz, db)

    await delete_quiz(db, quiz_id)
    return {"message": "Quiz deleted successfully", "quiz_id": str(quiz_id)}


@router.post("/quizzes/{quiz_id}/start", response_model=dict)
async def start_quiz_attempt(
    quiz_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Start (or resume) an attempt at a quiz. Returns the attempt id and
    remaining seconds when the quiz has a time limit."""
    user = await _get_current_user(credentials, db)

    quiz = await get_quiz_by_id(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    lesson = await get_lesson_by_id(db, quiz.lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Quiz's lesson not found")

    enrollment = await get_enrollment_by_user_and_course(db, user.id, lesson.course_id)
    if not enrollment:
        raise HTTPException(status_code=403, detail="You must be enrolled in the course to take this quiz")

    now = datetime.now(timezone.utc)
    attempts = await get_attempts_for_user(db, quiz_id, user.id)

    def _aware(dt):
        if dt is None:
            return None
        return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)

    # Resume an in-progress attempt, closing it first if its time limit has passed
    open_attempt = next((a for a in attempts if a.completed_at is None), None)
    if open_attempt and quiz.time_limit_seconds:
        started = _aware(open_attempt.started_at)
        elapsed = (now - started).total_seconds() if started else 0
        if elapsed > quiz.time_limit_seconds + TIME_LIMIT_GRACE_SECONDS:
            open_attempt.completed_at = now
            open_attempt.score = 0.0
            open_attempt.grade = 0.0
            open_attempt.passed = False
            open_attempt.needs_review = False
            await db.commit()
            open_attempt = None

    if open_attempt is None:
        # A fresh attempt is needed - enforce attempt limits
        if not quiz.allow_retry and len(attempts) > 0:
            raise HTTPException(status_code=409, detail="Retry is not allowed for this quiz")
        if len(attempts) >= quiz.max_attempts:
            raise HTTPException(
                status_code=409,
                detail=f"You have reached the maximum of {quiz.max_attempts} attempts",
            )
        open_attempt = await create_quiz_attempt(
            db=db,
            quiz_id=quiz_id,
            user_id=user.id,
            enrollment_id=enrollment.id,
            answers=[],
            attempt_number=len(attempts) + 1,
        )

    remaining_seconds = None
    if quiz.time_limit_seconds:
        started = _aware(open_attempt.started_at) or now
        remaining_seconds = max(0, int(quiz.time_limit_seconds - (now - started).total_seconds()))

    return {
        "attempt_id": str(open_attempt.id),
        "attempt_number": open_attempt.attempt_number,
        "started_at": (_aware(open_attempt.started_at) or now).isoformat(),
        "time_limit_seconds": quiz.time_limit_seconds,
        "remaining_seconds": remaining_seconds,
        "max_attempts": quiz.max_attempts,
        "attempts_used": len(attempts),
    }


@router.post("/quizzes/{quiz_id}/attempt", response_model=QuizResult)
async def submit_quiz_attempt(
    quiz_id: uuid.UUID,
    attempt_data: QuizAttemptCreate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Submit a quiz attempt and get graded results.

    Pass `attempt_id` (from POST /quizzes/{quiz_id}/start) so the server can
    enforce the quiz time limit. Legacy submissions without an attempt_id are
    still accepted for quizzes without a time limit.
    """
    user = await _get_current_user(credentials, db)

    quiz = await get_quiz_by_id(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Check enrollment
    from app.models.lesson import Lesson
    lesson = await db.get(Lesson, quiz.lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Quiz's lesson not found")

    enrollment = await get_enrollment_by_user_and_course(db, user.id, lesson.course_id)
    if not enrollment:
        raise HTTPException(status_code=403, detail="You must be enrolled in the course to take this quiz")

    answers = [
        {
            "question_id": a.question_id,
            "answer": a.answer,
            "answer_index": a.answer_index,
        }
        for a in attempt_data.answers
    ]

    if attempt_data.attempt_id:
        # Submit an attempt started earlier (time limits apply)
        attempt = await get_attempt_by_id(db, attempt_data.attempt_id)
        if not attempt or attempt.quiz_id != quiz_id or attempt.user_id != user.id:
            raise HTTPException(status_code=404, detail="Attempt not found")
        if attempt.completed_at is not None:
            raise HTTPException(status_code=409, detail="This attempt has already been submitted")

        if quiz.time_limit_seconds and attempt.started_at:
            started = (
                attempt.started_at
                if attempt.started_at.tzinfo is not None
                else attempt.started_at.replace(tzinfo=timezone.utc)
            )
            elapsed = (datetime.now(timezone.utc) - started).total_seconds()
            if elapsed > quiz.time_limit_seconds + TIME_LIMIT_GRACE_SECONDS:
                attempt.completed_at = datetime.now(timezone.utc)
                attempt.score = 0.0
                attempt.grade = 0.0
                attempt.passed = False
                attempt.needs_review = False
                await db.commit()
                raise HTTPException(
                    status_code=400,
                    detail="Time limit exceeded for this attempt",
                )
    else:
        # Legacy path: no attempt started - create and grade immediately.
        # A time limit cannot be enforced without a start time, so reject it.
        if quiz.time_limit_seconds:
            raise HTTPException(
                status_code=400,
                detail="This quiz has a time limit; start the attempt first",
            )
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

        attempt = await create_quiz_attempt(
            db=db,
            quiz_id=quiz_id,
            user_id=user.id,
            enrollment_id=enrollment.id,
            answers=answers,
            attempt_number=attempt_number,
        )

    # Grade the attempt
    attempt.answers = answers
    result = grade_quiz(quiz, attempt)

    attempt.score = result["score"]
    attempt.grade = result["grade"]
    attempt.passed = result["passed"]
    attempt.needs_review = result["needs_review"]
    attempt.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(attempt)

    passing_grade = quiz.passing_grade if quiz.passing_grade is not None else 0.0

    # The quiz may hide results from students
    if not quiz.show_results:
        return QuizResult(
            attempt_id=attempt.id,
            score=None,
            grade=None,
            passed=False,
            passing_grade=passing_grade,
            total_points=0,
            earned_points=0,
            answers=answers,
            feedback="Results for this quiz are not published.",
            needs_review=result["needs_review"],
            results_hidden=True,
        )

    # Manually graded questions are not final until an instructor reviews them
    if result["needs_review"]:
        return QuizResult(
            attempt_id=attempt.id,
            score=None,
            grade=None,
            passed=False,
            passing_grade=passing_grade,
            total_points=result["total_points"],
            earned_points=0,
            answers=answers,
            feedback="Your submission was received and is awaiting instructor review.",
            needs_review=True,
            results_hidden=False,
        )

    return QuizResult(
        attempt_id=attempt.id,
        score=result["score"],
        grade=result["grade"],
        passed=result["passed"],
        passing_grade=passing_grade,
        total_points=result["total_points"],
        earned_points=result["earned_points"],
        answers=answers,
        feedback="Great job!" if result["passed"] else "Keep studying!",
        needs_review=False,
        results_hidden=False,
    )


@router.get("/quizzes/{quiz_id}/attempts", response_model=List[QuizAttemptResponse])
async def list_quiz_attempts(
    quiz_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """List attempts for a quiz.

    Students see their own attempts; instructors and admins see every attempt
    for the quiz so they can review and grade manual questions.
    """
    user = await _get_current_user(credentials, db)

    quiz = await get_quiz_by_id(db, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if _is_staff(user):
        await _ensure_quiz_owner(user, quiz, db)
        attempts = await get_attempts_for_quiz(db, quiz_id)
    else:
        attempts = await get_attempts_for_user(db, quiz_id, user.id)

    return [
        await _attempt_response(a, quiz, db, reveal=_is_staff(user))
        for a in attempts
    ]


@router.put("/quizzes/attempts/{attempt_id}/grade", response_model=QuizAttemptResponse)
async def grade_quiz_attempt(
    attempt_id: uuid.UUID,
    grade_data: QuizManualGrade,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Grade the manually graded part of an attempt (instructor/admin only)."""
    user = await _get_current_user(credentials, db)
    if not _is_staff(user):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    attempt = await get_attempt_by_id(db, attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    quiz = await get_quiz_by_id(db, attempt.quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    await _ensure_quiz_owner(user, quiz, db)

    if attempt.completed_at is None:
        raise HTTPException(status_code=409, detail="This attempt has not been submitted yet")

    result = apply_manual_grade(quiz, attempt, grade_data.points, grade_data.feedback)

    attempt.score = result["score"]
    attempt.grade = result["grade"]
    attempt.passed = result["passed"]
    attempt.needs_review = False
    attempt.graded_by = user.id
    attempt.graded_at = datetime.now(timezone.utc)
    attempt.feedback = grade_data.feedback
    await db.commit()
    await db.refresh(attempt)

    try:
        from app.crud.notification import create_notification

        await create_notification(
            db,
            user_id=attempt.user_id,
            type="grade",
            title=f"Exam graded: {quiz.title}",
            body=f"Your exam scored {result['score']:g}%.",
            link_url="/dashboard/learning",
        )
    except Exception:  # notification failures must not fail the grading
        pass

    return await _attempt_response(attempt, quiz, db, reveal=True)


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

    staff = _is_staff(user)

    # For students, verify they're enrolled in the course
    if not staff:
        from app.models.lesson import Lesson
        lesson = await db.get(Lesson, quiz.lesson_id)
        if lesson:
            enrollment = await get_enrollment_by_user_and_course(db, user.id, lesson.course_id)
            if not enrollment:
                raise HTTPException(status_code=403, detail="You must be enrolled in the course to view this quiz")

    # Apply question randomization server-side (question ids keep grading stable)
    questions = quiz.questions or []
    if quiz.randomize_questions and questions:
        questions = random.sample(questions, len(questions))

    # Never expose the answer key to students
    if not staff:
        questions = _sanitize_questions(questions)

    return _quiz_response(quiz, questions)
