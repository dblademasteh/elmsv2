"""Assignment CRUD operations"""
from sqlalchemy import select, and_, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.assignment import Assignment, AssignmentSubmission
from app.models.enrollment import Enrollment
from app.models.user import User
from typing import List, Optional
import uuid
from datetime import datetime


async def get_assignment_by_id(db: AsyncSession, assignment_id: uuid.UUID) -> Optional[Assignment]:
    """Get an assignment by ID."""
    result = await db.execute(select(Assignment).where(Assignment.id == assignment_id))
    return result.scalar_one_or_none()


async def get_assignments_by_lesson(db: AsyncSession, lesson_id: uuid.UUID) -> List[Assignment]:
    """Get all assignments for a lesson."""
    result = await db.execute(
        select(Assignment)
        .where(Assignment.lesson_id == lesson_id)
        .order_by(Assignment.created_at)
    )
    return result.scalars().all()


async def get_assignments_by_course(db: AsyncSession, course_id: uuid.UUID) -> List[tuple]:
    """Get all assignments for a course via lesson join, with submission counts."""
    from app.models.lesson import Lesson
    result = await db.execute(
        select(
            Assignment,
            func.count(AssignmentSubmission.id).label("submission_count"),
            func.sum(
                case(
                    (AssignmentSubmission.score.isnot(None), 1),
                    else_=0
                )
            ).label("graded_count"),
        )
        .join(Lesson, Assignment.lesson_id == Lesson.id)
        .outerjoin(
            AssignmentSubmission,
            AssignmentSubmission.assignment_id == Assignment.id
        )
        .where(Lesson.course_id == course_id)
        .group_by(Assignment.id)
        .order_by(Assignment.due_date.asc())
    )
    return result.fetchall()


async def create_assignment(
    db: AsyncSession,
    lesson_id: uuid.UUID,
    title: str,
    description: str = None,
    instructions: str = None,
    due_date: datetime = None,
    max_score: float = 100.0,
    max_file_size_mb: int = 10,
    allowed_file_types: List[str] = None,
    rubric_json: dict = None,
    is_required: bool = True,
    is_published: bool = False,
) -> Assignment:
    """Create a new assignment for a lesson."""
    db_assignment = Assignment(
        lesson_id=lesson_id,
        title=title,
        description=description,
        instructions=instructions,
        due_date=due_date,
        max_score=max_score,
        max_file_size_mb=max_file_size_mb,
        allowed_file_types=allowed_file_types or ["pdf", "doc", "docx", "zip"],
        rubric_json=rubric_json,
        is_required=is_required,
        is_published=is_published,
    )
    db.add(db_assignment)
    await db.commit()
    await db.refresh(db_assignment)
    return db_assignment


async def update_assignment(
    db: AsyncSession,
    assignment_id: uuid.UUID,
    title: str = None,
    description: str = None,
    instructions: str = None,
    due_date: datetime = None,
    max_score: float = None,
    max_file_size_mb: int = None,
    allowed_file_types: List[str] = None,
    rubric_json: dict = None,
    is_required: bool = None,
    is_published: bool = None,
) -> Optional[Assignment]:
    """Update an existing assignment."""
    assignment = await get_assignment_by_id(db, assignment_id)
    if not assignment:
        return None

    if title is not None:
        assignment.title = title
    if description is not None:
        assignment.description = description
    if instructions is not None:
        assignment.instructions = instructions
    if due_date is not None:
        assignment.due_date = due_date
    if max_score is not None:
        assignment.max_score = max_score
    if max_file_size_mb is not None:
        assignment.max_file_size_mb = max_file_size_mb
    if allowed_file_types is not None:
        assignment.allowed_file_types = allowed_file_types
    if rubric_json is not None:
        assignment.rubric_json = rubric_json
    if is_required is not None:
        assignment.is_required = is_required
    if is_published is not None:
        assignment.is_published = is_published

    await db.commit()
    await db.refresh(assignment)
    return assignment


async def delete_assignment(db: AsyncSession, assignment_id: uuid.UUID) -> bool:
    """Delete an assignment."""
    assignment = await get_assignment_by_id(db, assignment_id)
    if not assignment:
        return False
    await db.delete(assignment)
    await db.commit()
    return True


async def get_submissions_by_assignment(
    db: AsyncSession,
    assignment_id: uuid.UUID,
) -> List[tuple]:
    """Get all submissions for an assignment with user details."""
    result = await db.execute(
        select(
            AssignmentSubmission,
            User.full_name.label("user_full_name"),
        )
        .join(User, AssignmentSubmission.user_id == User.id)
        .where(AssignmentSubmission.assignment_id == assignment_id)
        .order_by(AssignmentSubmission.submitted_at.desc())
    )
    return result.fetchall()


async def get_submission_by_id(db: AsyncSession, submission_id: uuid.UUID) -> Optional[AssignmentSubmission]:
    """Get a submission by ID."""
    result = await db.execute(select(AssignmentSubmission).where(AssignmentSubmission.id == submission_id))
    return result.scalar_one_or_none()


async def get_submission_by_user_and_assignment(
    db: AsyncSession, user_id: uuid.UUID, assignment_id: uuid.UUID
) -> Optional[AssignmentSubmission]:
    """Get a user's submission for a specific assignment."""
    result = await db.execute(
        select(AssignmentSubmission).where(
            and_(
                AssignmentSubmission.user_id == user_id,
                AssignmentSubmission.assignment_id == assignment_id,
            )
        )
    )
    return result.scalar_one_or_none()


async def create_submission(
    db: AsyncSession,
    user_id: uuid.UUID,
    assignment_id: uuid.UUID,
    file_url: str,
    file_name: str = None,
    file_size_bytes: int = 0,
    enrollment_id: uuid.UUID = None,
) -> AssignmentSubmission:
    """Create a new submission (student uploading a file)."""
    # Check if a submission already exists
    existing = await get_submission_by_user_and_assignment(db, user_id, assignment_id)
    if existing:
        # Update existing submission
        existing.file_url = file_url
        existing.file_name = file_name
        existing.file_size_bytes = file_size_bytes
        assignment = await get_assignment_by_id(db, assignment_id)
        if assignment:
            from datetime import datetime as dt
            existing.submitted_at = dt.now()
            if assignment.due_date and existing.submitted_at > assignment.due_date:
                existing.is_late = True
        existing.status = "submitted"
        await db.commit()
        await db.refresh(existing)
        return existing

    db_submission = AssignmentSubmission(
        user_id=user_id,
        assignment_id=assignment_id,
        file_url=file_url,
        file_name=file_name,
        file_size_bytes=file_size_bytes,
        enrollment_id=enrollment_id,
        status="submitted",
    )

    # Check if late
    assignment = await get_assignment_by_id(db, assignment_id)
    if assignment and assignment.due_date:
        from datetime import datetime as dt
        db_submission.submitted_at = dt.now()
        if db_submission.submitted_at > assignment.due_date:
            db_submission.is_late = True
    else:
        from datetime import datetime as dt
        db_submission.submitted_at = dt.now()

    db.add(db_submission)
    await db.commit()
    await db.refresh(db_submission)
    return db_submission


async def grade_submission(
    db: AsyncSession,
    submission_id: uuid.UUID,
    score: float,
    feedback: str = None,
    grader_id: uuid.UUID = None,
) -> Optional[AssignmentSubmission]:
    """Grade a submission."""
    submission = await get_submission_by_id(db, submission_id)
    if not submission:
        return None

    submission.score = score
    submission.feedback = feedback
    submission.grader_id = grader_id
    from datetime import datetime as dt
    submission.graded_at = dt.now()
    submission.status = "graded"

    await db.commit()
    await db.refresh(submission)
    return submission


async def get_submissions_by_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    course_id: uuid.UUID = None,
) -> List[tuple]:
    """Get all submissions for a user, optionally scoped to a course."""
    stmt = (
        select(
            AssignmentSubmission,
            Assignment.title.label("assignment_title"),
            Assignment.max_score,
            Assignment.lesson_id,
        )
        .join(Assignment, AssignmentSubmission.assignment_id == Assignment.id)
    )

    if course_id:
        # Join through lesson to course
        from app.models.lesson import Lesson
        stmt = stmt.join(Lesson, Assignment.lesson_id == Lesson.id).where(
            and_(
                AssignmentSubmission.user_id == user_id,
                Lesson.course_id == course_id,
            )
        )
    else:
        stmt = stmt.where(AssignmentSubmission.user_id == user_id)

    result = await db.execute(stmt)
    return result.fetchall()
