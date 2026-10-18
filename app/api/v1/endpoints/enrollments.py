"""Enrollment endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.schemas.enrollment import StudentEnrollmentResponse, StudentEnrollmentDetailResponse, EnrollmentCreate
from app.schemas.assignment import AssignmentSubmissionResponse
from app.schemas.course import CourseListResponse
from app.crud.enrollment import (
    get_enrollments,
    get_student_enrollments_with_details,
    get_enrollment_by_user_and_course,
    create_enrollment,
)
from app.crud.course import get_course_by_id, get_course_by_id_raw
from app.db.database import get_db
from app.api.v1.endpoints.users import get_current_user_from_token
from typing import List, Optional
import uuid

router = APIRouter()
bearer = HTTPBearer(auto_error=False)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer), db: get_db = Depends()):
    """Resolve the authenticated user."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return await get_current_user_from_token(credentials, db)


@router.get("/", response_model=List[StudentEnrollmentResponse])
async def list_enrollments(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
    course_id: Optional[uuid.UUID] = Query(default=None),
    enrollment_status: Optional[str] = Query(default=None),
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """List all student enrollments with user and course details (admin/instructor only)."""
    user = await get_current_user(credentials, db)

    if user.role not in ("admin", "instructor"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    rows = await get_enrollments(db, skip=skip, limit=limit, course_id=course_id, status=enrollment_status)

    return [
        StudentEnrollmentResponse(
            id=row.id,
            user_id=row.user_id,
            user_full_name=row.user_full_name,
            user_email=row.user_email,
            user_avatar_url=row.user_avatar_url,
            course_id=row.course_id,
            course_title=row.course_title,
            course_level=row.course_level,
            enrolled_at=row.enrolled_at,
            progress_percent=row.progress_percent or 0,
            status=row.status,
            completed_at=row.completed_at,
            total_minutes=row.total_minutes or 0,
            last_accessed_at=row.last_accessed_at,
        )
        for row in rows
    ]


@router.get("/me", response_model=List[StudentEnrollmentDetailResponse])
async def get_my_enrollments(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Get the current student's enrollments with course details."""
    user = await get_current_user(credentials, db)
    rows = await get_student_enrollments_with_details(db, user.id)
    return [
        StudentEnrollmentDetailResponse(
            id=row.id,
            course_id=row.course_id,
            course_title=row.course_title,
            course_level=row.course_level,
            course_cover_image_url=row.course_cover_image_url,
            enrolled_at=row.enrolled_at,
            progress_percent=row.progress_percent or 0,
            status=row.status,
            completed_at=row.completed_at,
            total_minutes=row.total_minutes or 0,
            last_accessed_at=row.last_accessed_at,
        )
        for row in rows
    ]


@router.get("/my-assignments", response_model=List[AssignmentSubmissionResponse])
async def get_my_submissions(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Get all assignments and the current student's submissions."""
    user = await get_current_user(credentials, db)
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Only students have assignments")

    from app.crud.assignment import get_submissions_by_user
    from app.models.user import User as UserModel
    rows = await get_submissions_by_user(db, user.id)
    result = []
    for row in rows:
        submission = row[0]
        assignment_title = row[1]
        max_score = row[2] if len(row) > 2 else 100.0
        grader_name = None
        if submission.grader_id:
            grader_row = await db.get(UserModel, submission.grader_id)
            grader_name = grader_row.full_name if grader_row else None
        result.append({
            "id": submission.id,
            "assignment_id": submission.assignment_id,
            "user_id": submission.user_id,
            "user_full_name": user.full_name,
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
            "max_score": max_score,
            "score_percentage": round((submission.score / max_score) * 100, 1) if submission.score is not None else None,
            "created_at": submission.created_at,
            "updated_at": submission.updated_at,
        })
    return result


@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_enrollment_endpoint(
    enrollment_in: EnrollmentCreate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Enroll the current student in a course."""
    user = await get_current_user(credentials, db)

    # Only students can enroll
    if user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can enroll in courses",
        )

    # Verify the course exists and is published
    course = await get_course_by_id(db, enrollment_in.course_id)
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )
    if course.status != "published" or course.is_private:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This course is not available for enrollment",
        )

    # Check for existing enrollment
    existing = await get_enrollment_by_user_and_course(db, user.id, enrollment_in.course_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already enrolled in this course",
        )

    new_enrollment = await create_enrollment(db, user.id, enrollment_in.course_id)
    return {
        "message": "Successfully enrolled in course",
        "enrollment_id": str(new_enrollment.id),
        "course_id": str(enrollment_in.course_id),
    }
