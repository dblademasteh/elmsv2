"""Discussion endpoints (course forums)"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from app.db.database import get_db
from app.api.v1.endpoints.users import get_current_user_from_token
from app.crud import discussion as discussion_crud
from app.crud.course import get_course_by_id_raw
from app.crud.enrollment import get_enrollment_by_user_and_course
from app.crud.notification import create_notification
from app.models.user import User

router = APIRouter()
bearer = HTTPBearer(auto_error=False)


class ThreadCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=500)
    body: str = Field(..., min_length=1)
    lesson_id: Optional[str] = None


class PostCreate(BaseModel):
    body: str = Field(..., min_length=1)


async def _get_current_user(credentials: HTTPAuthorizationCredentials, db) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return await get_current_user_from_token(credentials, db)


async def _require_course_access(user: User, course_id: uuid.UUID, db) -> None:
    """Enrolled students, the course instructor, and admins can use discussions."""
    course = await get_course_by_id_raw(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if user.role == "admin":
        return
    if user.role == "instructor" and course.instructor_id == user.id:
        return
    enrollment = await get_enrollment_by_user_and_course(db, user.id, course_id)
    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Enroll in this course to join the discussion",
        )


@router.get("/course/{course_id}")
async def list_threads(
    course_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """List discussion threads for a course."""
    user = await _get_current_user(credentials, db)
    await _require_course_access(user, course_id, db)
    rows = await discussion_crud.list_threads(db, course_id)
    return [
        {
            "id": str(t.id),
            "title": t.title,
            "author_id": str(t.author_id),
            "author_name": author_name,
            "is_pinned": t.is_pinned,
            "is_locked": t.is_locked,
            "reply_count": reply_count,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t, author_name, reply_count in rows
    ]


@router.post("/course/{course_id}", status_code=status.HTTP_201_CREATED)
async def create_thread(
    course_id: uuid.UUID,
    thread_in: ThreadCreate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Start a discussion thread in a course."""
    user = await _get_current_user(credentials, db)
    await _require_course_access(user, course_id, db)

    lesson_id = None
    if thread_in.lesson_id:
        try:
            lesson_id = uuid.UUID(thread_in.lesson_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid lesson_id")

    thread, _first_post = await discussion_crud.create_thread(
        db,
        course_id=course_id,
        author_id=user.id,
        title=thread_in.title,
        body=thread_in.body,
        lesson_id=lesson_id,
    )
    return {"message": "Thread created", "id": str(thread.id)}


async def _load_thread_context(user: User, thread_id: uuid.UUID, db):
    thread = await discussion_crud.get_thread(db, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    await _require_course_access(user, thread.course_id, db)
    return thread


@router.get("/{thread_id}")
async def get_thread(
    thread_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Thread detail with all posts."""
    user = await _get_current_user(credentials, db)
    thread = await _load_thread_context(user, thread_id, db)
    posts = await discussion_crud.list_posts(db, thread.id)
    return {
        "id": str(thread.id),
        "course_id": str(thread.course_id),
        "title": thread.title,
        "is_locked": thread.is_locked,
        "is_pinned": thread.is_pinned,
        "created_at": thread.created_at.isoformat() if thread.created_at else None,
        "posts": [
            {
                "id": str(p.id),
                "author_id": str(p.author_id),
                "author_name": author_name,
                "author_role": author_role,
                "body": p.body,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p, author_name, author_role in posts
        ],
    }


@router.post("/{thread_id}/posts", status_code=status.HTTP_201_CREATED)
async def reply_to_thread(
    thread_id: uuid.UUID,
    post_in: PostCreate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Reply to a discussion thread."""
    user = await _get_current_user(credentials, db)
    thread = await _load_thread_context(user, thread_id, db)
    if thread.is_locked:
        raise HTTPException(status_code=423, detail="This thread is locked")

    post = await discussion_crud.add_post(db, thread.id, user.id, post_in.body)

    if thread.author_id != user.id:
        await create_notification(
            db,
            user_id=thread.author_id,
            type="discussion",
            title=f"New reply: {thread.title}",
            body=f"{user.full_name} replied to your thread.",
            link_url=f"/courses/{thread.course_id}",
        )

    return {"message": "Reply posted", "id": str(post.id)}


@router.delete("/{thread_id}")
async def delete_thread(
    thread_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Delete a thread (thread author, course instructor, or admin)."""
    user = await _get_current_user(credentials, db)
    thread = await discussion_crud.get_thread(db, thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    course = await get_course_by_id_raw(db, thread.course_id)
    is_instructor = (
        user.role == "instructor" and course and course.instructor_id == user.id
    )
    if thread.author_id != user.id and not is_instructor and user.role != "admin":
        raise HTTPException(status_code=403, detail="You cannot delete this thread")

    await discussion_crud.delete_thread(db, thread_id)
    return {"message": "Thread deleted"}


@router.delete("/posts/{post_id}")
async def delete_post(
    post_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: get_db = Depends(),
):
    """Delete a post (post author, course instructor, or admin)."""
    user = await _get_current_user(credentials, db)
    post = await discussion_crud.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    thread = await discussion_crud.get_thread(db, post.thread_id)
    course = await get_course_by_id_raw(db, thread.course_id) if thread else None
    is_instructor = (
        user.role == "instructor" and course and course.instructor_id == user.id
    )
    if post.author_id != user.id and not is_instructor and user.role != "admin":
        raise HTTPException(status_code=403, detail="You cannot delete this post")

    await discussion_crud.delete_post(db, post_id)
    return {"message": "Post deleted"}
