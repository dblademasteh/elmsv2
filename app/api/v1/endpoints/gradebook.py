"""Gradebook endpoints: aggregated quiz + assignment scores per enrollment."""
import csv
import io
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.responses import Response
from sqlalchemy import select, func as sql_func

from app.db.database import get_db
from app.api.v1.endpoints.users import get_current_user_from_token
from app.models.user import User
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.quiz import QuizAttempt
from app.models.assignment import Assignment, AssignmentSubmission

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


async def _collect_gradebook(
    user: User, course_id: Optional[uuid.UUID], db
) -> List[dict]:
    """Build gradebook rows for the visible enrollments.

    Instructors see their courses, admins see everything, students see their
    own enrollments. Overall grade = mean of quiz-average grade and
    assignment-average percent (only over components that have grades).
    """
    stmt = (
        select(
            Enrollment.id.label("enrollment_id"),
            Enrollment.course_id.label("course_id"),
            Course.title.label("course_title"),
            Enrollment.user_id.label("student_id"),
            Enrollment.progress_percent.label("progress_percent"),
            Enrollment.status.label("status"),
            User.full_name.label("student_name"),
            User.email.label("student_email"),
        )
        .join(Course, Enrollment.course_id == Course.id)
        .join(User, Enrollment.user_id == User.id)
    )

    if user.role == "student":
        stmt = stmt.where(Enrollment.user_id == user.id)
    elif user.role == "instructor":
        stmt = stmt.where(Course.instructor_id == user.id)

    if course_id is not None:
        stmt = stmt.where(Enrollment.course_id == course_id)

    stmt = stmt.order_by(Course.title, User.full_name)
    rows = (await db.execute(stmt)).fetchall()
    enrollment_ids = [r.enrollment_id for r in rows]

    quiz_stats = {}
    assignment_stats = {}
    if enrollment_ids:
        q_rows = (
            await db.execute(
                select(
                    QuizAttempt.enrollment_id,
                    sql_func.count(QuizAttempt.id).label("cnt"),
                    sql_func.avg(QuizAttempt.grade).label("avg_grade"),
                    sql_func.max(QuizAttempt.grade).label("best_grade"),
                )
                .where(
                    QuizAttempt.enrollment_id.in_(enrollment_ids),
                    QuizAttempt.completed_at.isnot(None),
                    QuizAttempt.grade.isnot(None),
                )
                .group_by(QuizAttempt.enrollment_id)
            )
        ).fetchall()
        quiz_stats = {r.enrollment_id: r for r in q_rows}

        a_rows = (
            await db.execute(
                select(
                    AssignmentSubmission.enrollment_id,
                    sql_func.count(AssignmentSubmission.id).label("cnt"),
                    sql_func.avg(
                        AssignmentSubmission.score * 100.0
                        / sql_func.nullif(Assignment.max_score, 0)
                    ).label("avg_pct"),
                )
                .join(Assignment, AssignmentSubmission.assignment_id == Assignment.id)
                .where(
                    AssignmentSubmission.enrollment_id.in_(enrollment_ids),
                    AssignmentSubmission.status == "graded",
                    AssignmentSubmission.score.isnot(None),
                )
                .group_by(AssignmentSubmission.enrollment_id)
            )
        ).fetchall()
        assignment_stats = {r.enrollment_id: r for r in a_rows}

    result = []
    for r in rows:
        q = quiz_stats.get(r.enrollment_id)
        a = assignment_stats.get(r.enrollment_id)
        quiz_avg = round(float(q.avg_grade), 1) if q and q.avg_grade is not None else None
        assignment_avg = (
            round(float(a.avg_pct), 1) if a and a.avg_pct is not None else None
        )
        if quiz_avg is not None and assignment_avg is not None:
            overall = round((quiz_avg + assignment_avg) / 2, 1)
        elif quiz_avg is not None:
            overall = quiz_avg
        elif assignment_avg is not None:
            overall = assignment_avg
        else:
            overall = None

        result.append(
            {
                "enrollment_id": str(r.enrollment_id),
                "course_id": str(r.course_id),
                "course_title": r.course_title,
                "student_id": str(r.student_id),
                "student_name": r.student_name,
                "student_email": r.student_email,
                "progress_percent": float(r.progress_percent or 0),
                "status": r.status,
                "graded_quiz_count": int(q.cnt) if q else 0,
                "quiz_avg_grade": quiz_avg,
                "quiz_best_grade": (
                    round(float(q.best_grade), 1)
                    if q and q.best_grade is not None
                    else None
                ),
                "graded_assignment_count": int(a.cnt) if a else 0,
                "assignment_avg_percent": assignment_avg,
                "overall_grade": overall,
            }
        )
    return result


@router.get("/gradebook")
async def get_gradebook(
    course_id: Optional[uuid.UUID] = None,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Role-aware gradebook: aggregated quiz + assignment scores per enrollment."""
    user = await _get_current_user(credentials, db)
    return await _collect_gradebook(user, course_id, db)


@router.get("/gradebook/export")
async def export_gradebook_csv(
    course_id: Optional[uuid.UUID] = None,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """CSV export of the gradebook (instructors and admins only)."""
    user = await _get_current_user(credentials, db)
    if user.role == "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only instructors and admins can export the gradebook",
        )

    rows = await _collect_gradebook(user, course_id, db)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "Student",
            "Email",
            "Course",
            "Progress %",
            "Graded Quizzes",
            "Quiz Avg %",
            "Quiz Best %",
            "Graded Assignments",
            "Assignment Avg %",
            "Overall %",
            "Status",
        ]
    )
    for r in rows:
        writer.writerow(
            [
                r["student_name"],
                r["student_email"],
                r["course_title"],
                r["progress_percent"],
                r["graded_quiz_count"],
                r["quiz_avg_grade"] if r["quiz_avg_grade"] is not None else "",
                r["quiz_best_grade"] if r["quiz_best_grade"] is not None else "",
                r["graded_assignment_count"],
                r["assignment_avg_percent"]
                if r["assignment_avg_percent"] is not None
                else "",
                r["overall_grade"] if r["overall_grade"] is not None else "",
                r["status"],
            ]
        )

    scope = "all-courses"
    if course_id is not None:
        scope = str(course_id)
    filename = f"gradebook-{scope}-{datetime.now(timezone.utc).date().isoformat()}.csv"

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
