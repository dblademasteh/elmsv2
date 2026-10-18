"""Dashboard statistics endpoints (real aggregation, role-aware)"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, func as sql_func, and_
from app.db.database import get_db
from app.api.v1.endpoints.users import get_current_user_from_token
from app.models.user import User
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.lesson import Lesson
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


async def _scalar(db, stmt) -> float:
    result = await db.execute(stmt)
    value = result.scalar()
    return float(value) if value is not None else 0.0


@router.get("/stats", response_model=dict)
async def get_dashboard_stats(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Aggregated dashboard stats for the current user's role."""
    user = await _get_current_user(credentials, db)
    stats: dict = {"role": user.role}

    if user.role == "admin":
        stats["total_users"] = int(await _scalar(db, select(sql_func.count(User.id))))
        stats["active_users"] = int(
            await _scalar(db, select(sql_func.count(User.id)).where(User.is_active.is_(True)))
        )
        stats["total_courses"] = int(await _scalar(db, select(sql_func.count(Course.id))))
        stats["published_courses"] = int(
            await _scalar(db, select(sql_func.count(Course.id)).where(Course.status == "published"))
        )
        stats["total_enrollments"] = int(
            await _scalar(db, select(sql_func.count(Enrollment.id)))
        )
        stats["completed_enrollments"] = int(
            await _scalar(
                db, select(sql_func.count(Enrollment.id)).where(Enrollment.status == "completed")
            )
        )
        stats["avg_progress"] = round(
            await _scalar(db, select(sql_func.avg(Enrollment.progress_percent))), 1
        )
        # Value of all paid-course enrollments (no payment flow yet)
        stats["revenue_cents"] = int(
            await _scalar(
                db,
                select(sql_func.coalesce(sql_func.sum(Course.price_cents), 0))
                .select_from(Enrollment)
                .join(Course, Enrollment.course_id == Course.id)
                .where(Course.price_cents > 0),
            )
        )

    elif user.role == "instructor":
        my_courses = select(Course.id).where(Course.instructor_id == user.id)
        stats["total_courses"] = int(await _scalar(db, select(sql_func.count()).select_from(my_courses.subquery())))
        stats["published_courses"] = int(
            await _scalar(
                db,
                select(sql_func.count(Course.id)).where(
                    and_(Course.instructor_id == user.id, Course.status == "published")
                ),
            )
        )
        stats["students_taught"] = int(
            await _scalar(
                db,
                select(sql_func.count(sql_func.distinct(Enrollment.user_id)))
                .select_from(Enrollment)
                .join(Course, Enrollment.course_id == Course.id)
                .where(Course.instructor_id == user.id),
            )
        )
        stats["total_enrollments"] = int(
            await _scalar(
                db,
                select(sql_func.count(Enrollment.id))
                .select_from(Enrollment)
                .join(Course, Enrollment.course_id == Course.id)
                .where(Course.instructor_id == user.id),
            )
        )
        stats["completed_enrollments"] = int(
            await _scalar(
                db,
                select(sql_func.count(Enrollment.id))
                .select_from(Enrollment)
                .join(Course, Enrollment.course_id == Course.id)
                .where(
                    and_(
                        Course.instructor_id == user.id,
                        Enrollment.status == "completed",
                    )
                ),
            )
        )
        stats["avg_progress"] = round(
            await _scalar(
                db,
                select(sql_func.avg(Enrollment.progress_percent))
                .select_from(Enrollment)
                .join(Course, Enrollment.course_id == Course.id)
                .where(Course.instructor_id == user.id),
            ),
            1,
        )
        stats["avg_rating"] = round(
            await _scalar(
                db,
                select(sql_func.avg(Course.rating_average)).where(
                    and_(Course.instructor_id == user.id, Course.rating_count > 0)
                ),
            ),
            1,
        )
        stats["pending_submissions"] = int(
            await _scalar(
                db,
                select(sql_func.count(AssignmentSubmission.id))
                .select_from(AssignmentSubmission)
                .join(Assignment, AssignmentSubmission.assignment_id == Assignment.id)
                .join(Lesson, Assignment.lesson_id == Lesson.id)
                .join(Course, Lesson.course_id == Course.id)
                .where(
                    and_(
                        Course.instructor_id == user.id,
                        AssignmentSubmission.score.is_(None),
                        AssignmentSubmission.status != "draft",
                    )
                ),
            )
        )

    else:  # student
        stats["enrolled_courses"] = int(
            await _scalar(
                db,
                select(sql_func.count(Enrollment.id)).where(Enrollment.user_id == user.id),
            )
        )
        stats["completed_courses"] = int(
            await _scalar(
                db,
                select(sql_func.count(Enrollment.id)).where(
                    and_(Enrollment.user_id == user.id, Enrollment.status == "completed")
                ),
            )
        )
        stats["avg_progress"] = round(
            await _scalar(
                db,
                select(sql_func.avg(Enrollment.progress_percent)).where(
                    Enrollment.user_id == user.id
                ),
            ),
            1,
        )
        total_minutes = await _scalar(
            db,
            select(sql_func.coalesce(sql_func.sum(Enrollment.total_minutes), 0)).where(
                Enrollment.user_id == user.id
            ),
        )
        stats["hours_learned"] = round(total_minutes / 60.0, 1)
        stats["pending_assignments"] = int(
            await _scalar(
                db,
                select(sql_func.count(AssignmentSubmission.id)).where(
                    and_(
                        AssignmentSubmission.user_id == user.id,
                        AssignmentSubmission.score.is_(None),
                        AssignmentSubmission.status != "draft",
                    )
                ),
            )
        )

    return stats


@router.get("/platform", response_model=dict)
async def get_platform_stats(db: get_db = Depends()):
    """Public platform statistics for the landing page (no auth required)."""
    published_courses = await _scalar(
        db,
        select(sql_func.count(Course.id)).where(
            Course.status == "published", Course.is_private.is_(False)
        ),
    )
    learners = await _scalar(
        db,
        select(sql_func.count(User.id)).where(User.role == "student"),
    )
    enrollments = await _scalar(db, select(sql_func.count(Enrollment.id)))
    return {
        "published_courses": int(published_courses),
        "learners": int(learners),
        "enrollments": int(enrollments),
    }
