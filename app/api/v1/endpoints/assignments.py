"""Assignment endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentUpdate,
    AssignmentResponse,
    AssignmentSubmissionResponse,
    AssignmentSubmissionCreate,
    AssignmentSubmissionGrade,
)
from app.crud.assignment import (
    get_assignment_by_id,
    get_assignments_by_lesson,
    get_assignments_by_course,
    create_assignment,
    update_assignment,
    delete_assignment,
    get_submissions_by_assignment,
    get_submission_by_id,
    create_submission,
    grade_submission,
    get_submissions_by_user,
)
from app.crud.enrollment import get_enrollment_by_user_and_course
from app.crud.lesson import get_lesson_by_id
from app.crud.course import get_course_by_id, get_course_by_id_raw
from app.db.database import get_db
from app.api.v1.endpoints.users import get_current_user_from_token
from app.schemas.user import UserResponse
from typing import List
import uuid

router = APIRouter()
bearer = HTTPBearer(auto_error=False)


async def _get_current_user(credentials: HTTPAuthorizationCredentials, db):
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return await get_current_user_from_token(credentials, db)


async def _get_submission_response(submission_id, db):
    """Build a full submission response with user + grader info."""
    submission = await get_submission_by_id(db, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    assignment = await get_assignment_by_id(db, submission.assignment_id)
    user = await db.get(type(submission), submission.user_id) if False else None
    # Fetch user and grader names directly
    from app.models.user import User as UserModel
    user_row = await db.get(UserModel, submission.user_id)
    grader_name = None
    if submission.grader_id:
        grader_row = await db.get(UserModel, submission.grader_id)
        grader_name = grader_row.full_name if grader_row else None

    return {
        "id": submission.id,
        "assignment_id": submission.assignment_id,
        "user_id": submission.user_id,
        "user_full_name": user_row.full_name if user_row else "Unknown",
        "file_url": submission.file_url,
        "file_name": submission.file_name,
        "file_size_bytes": submission.file_size_bytes or 0,
        "submitted_at": submission.submitted_at,
        "is_late": submission.is_late,
        "score": submission.score,
        "feedback": submission.feedback,
        "grader_id": submission.grader_id,
        "grader_name": grader_name,
        "graded_at": submission.graded_at,
        "status": submission.status,
        "max_score": assignment.max_score if assignment else 100.0,
        "score_percentage": round((submission.score / assignment.max_score) * 100, 1) if submission.score is not None and assignment else None,
        "created_at": submission.created_at,
        "updated_at": submission.updated_at,
    }


@router.get("/{course_id}/assignments", response_model=List[AssignmentResponse])
async def list_course_assignments(
    course_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Get all assignments for a course (instructor/admin + enrolled students)."""
    user = await _get_current_user(credentials, db)

    if user.role not in ("admin", "instructor"):
        enrollment = await get_enrollment_by_user_and_course(db, user.id, course_id)
        if not enrollment:
            raise HTTPException(status_code=403, detail="You must be enrolled in this course")

    rows = await get_assignments_by_course(db, course_id)
    result = []
    for row in rows:
        result.append({
            "id": row.Assignment.id,
            "lesson_id": row.Assignment.lesson_id,
            "title": row.Assignment.title,
            "description": row.Assignment.description,
            "instructions": row.Assignment.instructions,
            "due_date": row.Assignment.due_date,
            "max_score": row.Assignment.max_score,
            "max_file_size_mb": row.Assignment.max_file_size_mb,
            "allowed_file_types": row.Assignment.allowed_file_types or [],
            "rubric_json": row.Assignment.rubric_json,
            "is_required": row.Assignment.is_required,
            "is_published": row.Assignment.is_published,
            "created_at": row.Assignment.created_at,
            "updated_at": row.Assignment.updated_at,
            "submission_count": int(row.submission_count or 0),
            "graded_count": int(row.graded_count or 0),
        })
    return result


@router.get("/lessons/{lesson_id}/assignments", response_model=List[AssignmentResponse])
async def list_lesson_assignments(
    lesson_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Get all assignments for a lesson."""
    user = await _get_current_user(credentials, db)

    lesson = await get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if user.role not in ("admin", "instructor"):
        enrollment = await get_enrollment_by_user_and_course(db, user.id, lesson.course_id)
        if not enrollment:
            raise HTTPException(status_code=403, detail="You must be enrolled in the course")

    assignments = await get_assignments_by_lesson(db, lesson_id)
    result = []
    for a in assignments:
        from app.crud.assignment import get_submissions_by_assignment
        subs = await get_submissions_by_assignment(db, a.id)
        result.append({
            "id": a.id,
            "lesson_id": a.lesson_id,
            "title": a.title,
            "description": a.description,
            "instructions": a.instructions,
            "due_date": a.due_date,
            "max_score": a.max_score,
            "max_file_size_mb": a.max_file_size_mb,
            "allowed_file_types": a.allowed_file_types or [],
            "rubric_json": a.rubric_json,
            "is_required": a.is_required,
            "is_published": a.is_published,
            "created_at": a.created_at,
            "updated_at": a.updated_at,
            "submission_count": len(subs),
            "graded_count": len([s for s in subs if s[0].score is not None]),
        })
    return result


@router.post("/assignments", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
async def create_new_assignment(
    assignment_in: AssignmentCreate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Create a new assignment (instructor/admin only)."""
    user = await _get_current_user(credentials, db)
    if user.role not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    lesson = await get_lesson_by_id(db, assignment_in.lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    course = await get_course_by_id_raw(db, lesson.course_id)
    if course and course.instructor_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="You don't own this course")

    assignment = await create_assignment(
        db=db,
        lesson_id=assignment_in.lesson_id,
        title=assignment_in.title,
        description=assignment_in.description,
        instructions=assignment_in.instructions,
        due_date=assignment_in.due_date,
        max_score=assignment_in.max_score,
        max_file_size_mb=assignment_in.max_file_size_mb,
        allowed_file_types=assignment_in.allowed_file_types,
        rubric_json=assignment_in.rubric_json,
        is_required=assignment_in.is_required,
        is_published=assignment_in.is_published,
    )

    return {
        "id": assignment.id,
        "lesson_id": assignment.lesson_id,
        "title": assignment.title,
        "description": assignment.description,
        "instructions": assignment.instructions,
        "due_date": assignment.due_date,
        "max_score": assignment.max_score,
        "max_file_size_mb": assignment.max_file_size_mb,
        "allowed_file_types": assignment.allowed_file_types or [],
        "rubric_json": assignment.rubric_json,
        "is_required": assignment.is_required,
        "is_published": assignment.is_published,
        "created_at": assignment.created_at,
        "updated_at": assignment.updated_at,
        "submission_count": 0,
        "graded_count": 0,
    }


@router.put("/assignments/{assignment_id}", response_model=AssignmentResponse)
async def update_existing_assignment(
    assignment_id: uuid.UUID,
    assignment_in: AssignmentUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Update an assignment (owner/admin only)."""
    user = await _get_current_user(credentials, db)
    if user.role not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    assignment = await get_assignment_by_id(db, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    lesson = await get_lesson_by_id(db, assignment.lesson_id)
    if lesson:
        course = await get_course_by_id_raw(db, lesson.course_id)
        if course and course.instructor_id != user.id and user.role != "admin":
            raise HTTPException(status_code=403, detail="You don't own this assignment")

    update_data = {}
    if assignment_in.title is not None: update_data["title"] = assignment_in.title
    if assignment_in.description is not None: update_data["description"] = assignment_in.description
    if assignment_in.instructions is not None: update_data["instructions"] = assignment_in.instructions
    if assignment_in.due_date is not None: update_data["due_date"] = assignment_in.due_date
    if assignment_in.max_score is not None: update_data["max_score"] = assignment_in.max_score
    if assignment_in.max_file_size_mb is not None: update_data["max_file_size_mb"] = assignment_in.max_file_size_mb
    if assignment_in.allowed_file_types is not None: update_data["allowed_file_types"] = assignment_in.allowed_file_types
    if assignment_in.rubric_json is not None: update_data["rubric_json"] = assignment_in.rubric_json
    if assignment_in.is_required is not None: update_data["is_required"] = assignment_in.is_required
    if assignment_in.is_published is not None: update_data["is_published"] = assignment_in.is_published

    updated = await update_assignment(db, assignment_id, **update_data) if update_data else assignment

    from app.crud.assignment import get_submissions_by_assignment
    subs = await get_submissions_by_assignment(db, assignment_id)

    return {
        "id": updated.id,
        "lesson_id": updated.lesson_id,
        "title": updated.title,
        "description": updated.description,
        "instructions": updated.instructions,
        "due_date": updated.due_date,
        "max_score": updated.max_score,
        "max_file_size_mb": updated.max_file_size_mb,
        "allowed_file_types": updated.allowed_file_types or [],
        "rubric_json": updated.rubric_json,
        "is_required": updated.is_required,
        "is_published": updated.is_published,
        "created_at": updated.created_at,
        "updated_at": updated.updated_at,
        "submission_count": len(subs),
        "graded_count": len([s for s in subs if s[0].score is not None]),
    }


@router.delete("/assignments/{assignment_id}", response_model=dict)
async def delete_existing_assignment(
    assignment_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Delete an assignment (owner/admin only)."""
    user = await _get_current_user(credentials, db)
    if user.role not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    assignment = await get_assignment_by_id(db, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    lesson = await get_lesson_by_id(db, assignment.lesson_id)
    if lesson:
        course = await get_course_by_id_raw(db, lesson.course_id)
        if course and course.instructor_id != user.id and user.role != "admin":
            raise HTTPException(status_code=403, detail="You don't own this assignment")

    await delete_assignment(db, assignment_id)
    return {"message": "Assignment deleted successfully", "assignment_id": str(assignment_id)}


@router.post("/assignments/{assignment_id}/submit", response_model=AssignmentSubmissionResponse)
async def submit_assignment(
    assignment_id: uuid.UUID,
    submission_data: AssignmentSubmissionCreate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Submit an assignment (students only)."""
    user = await _get_current_user(credentials, db)
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can submit assignments")

    assignment = await get_assignment_by_id(db, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if not assignment.is_published:
        raise HTTPException(status_code=400, detail="Assignment is not published")

    lesson = await get_lesson_by_id(db, assignment.lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Assignment's lesson not found")

    enrollment = await get_enrollment_by_user_and_course(db, user.id, lesson.course_id)
    if not enrollment:
        raise HTTPException(status_code=403, detail="You must be enrolled in the course")

    submission = await create_submission(
        db=db,
        user_id=user.id,
        assignment_id=assignment_id,
        file_url=submission_data.file_url,
        file_name=submission_data.file_name,
        file_size_bytes=submission_data.file_size_bytes,
        enrollment_id=enrollment.id,
    )

    return await _get_submission_response(submission.id, db)


@router.get("/assignments/{assignment_id}/submissions", response_model=List[AssignmentSubmissionResponse])
async def list_assignment_submissions(
    assignment_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Get all submissions for an assignment (instructor/admin only)."""
    user = await _get_current_user(credentials, db)
    if user.role not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    assignment = await get_assignment_by_id(db, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    rows = await get_submissions_by_assignment(db, assignment_id)
    result = []
    for row in rows:
        resp = await _get_submission_response(row[0].id, db)
        result.append(resp)
    return result


@router.put("/submissions/{submission_id}/grade", response_model=AssignmentSubmissionResponse)
async def grade_assignment_submission(
    submission_id: uuid.UUID,
    grade_data: AssignmentSubmissionGrade,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Grade a submission (instructor/admin only)."""
    user = await _get_current_user(credentials, db)
    if user.role not in ("admin", "instructor"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    submission = await get_submission_by_id(db, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    assignment = await get_assignment_by_id(db, submission.assignment_id)
    if assignment:
        lesson = await get_lesson_by_id(db, assignment.lesson_id)
        if lesson:
            course = await get_course_by_id_raw(db, lesson.course_id)
            if course and course.instructor_id != user.id and user.role != "admin":
                raise HTTPException(status_code=403, detail="You don't own this course")

    graded = await grade_submission(
        db=db,
        submission_id=submission_id,
        score=grade_data.score,
        feedback=grade_data.feedback,
        grader_id=user.id,
    )

    # Notify the student that their work was graded
    if assignment:
        from app.crud.notification import create_notification
        percent = (
            round(grade_data.score / assignment.max_score * 100, 1)
            if assignment.max_score
            else grade_data.score
        )
        await create_notification(
            db,
            user_id=submission.user_id,
            type="grade",
            title=f"Assignment graded: {assignment.title}",
            body=f"You scored {grade_data.score:g}/{assignment.max_score:g} ({percent}%).",
            link_url="/dashboard/assignments",
        )

    return await _get_submission_response(graded.id, db)
