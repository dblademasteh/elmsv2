"""Discussion CRUD operations"""
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.discussion import DiscussionThread, DiscussionPost
from app.models.user import User
from typing import List, Optional, Tuple
import uuid


async def get_thread(db: AsyncSession, thread_id: uuid.UUID) -> Optional[DiscussionThread]:
    result = await db.execute(select(DiscussionThread).where(DiscussionThread.id == thread_id))
    return result.scalar_one_or_none()


async def list_threads(
    db: AsyncSession, course_id: uuid.UUID
) -> List[Tuple[DiscussionThread, str, int]]:
    """Threads for a course with author names and reply counts, pinned first."""
    reply_counts = (
        select(
            DiscussionPost.thread_id.label("thread_id"),
            func.count(DiscussionPost.id).label("reply_count"),
        )
        .group_by(DiscussionPost.thread_id)
        .subquery()
    )
    stmt = (
        select(
            DiscussionThread,
            User.full_name,
            func.coalesce(reply_counts.c.reply_count, 0),
        )
        .join(User, DiscussionThread.author_id == User.id)
        .outerjoin(reply_counts, DiscussionThread.id == reply_counts.c.thread_id)
        .where(DiscussionThread.course_id == course_id)
        .order_by(DiscussionThread.is_pinned.desc(), DiscussionThread.created_at.desc())
    )
    result = await db.execute(stmt)
    return [(row[0], row[1], int(row[2])) for row in result.all()]


async def create_thread(
    db: AsyncSession,
    course_id: uuid.UUID,
    author_id: uuid.UUID,
    title: str,
    body: str = None,
    lesson_id: Optional[uuid.UUID] = None,
) -> Tuple[DiscussionThread, Optional[DiscussionPost]]:
    thread = DiscussionThread(
        course_id=course_id,
        author_id=author_id,
        title=title,
        lesson_id=lesson_id,
    )
    db.add(thread)
    await db.flush()

    first_post = None
    if body:
        first_post = DiscussionPost(thread_id=thread.id, author_id=author_id, body=body)
        db.add(first_post)

    await db.commit()
    await db.refresh(thread)
    return thread, first_post


async def list_posts(
    db: AsyncSession, thread_id: uuid.UUID
) -> List[Tuple[DiscussionPost, str, str]]:
    """Posts for a thread with author names and roles, oldest first."""
    stmt = (
        select(DiscussionPost, User.full_name, User.role)
        .join(User, DiscussionPost.author_id == User.id)
        .where(DiscussionPost.thread_id == thread_id)
        .order_by(DiscussionPost.created_at.asc())
    )
    result = await db.execute(stmt)
    return [(row[0], row[1], row[2]) for row in result.all()]


async def add_post(
    db: AsyncSession, thread_id: uuid.UUID, author_id: uuid.UUID, body: str
) -> DiscussionPost:
    post = DiscussionPost(thread_id=thread_id, author_id=author_id, body=body)
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post


async def delete_thread(db: AsyncSession, thread_id: uuid.UUID) -> bool:
    thread = await get_thread(db, thread_id)
    if not thread:
        return False
    await db.delete(thread)
    await db.commit()
    return True


async def get_post(db: AsyncSession, post_id: uuid.UUID) -> Optional[DiscussionPost]:
    result = await db.execute(select(DiscussionPost).where(DiscussionPost.id == post_id))
    return result.scalar_one_or_none()


async def delete_post(db: AsyncSession, post_id: uuid.UUID) -> bool:
    post = await get_post(db, post_id)
    if not post:
        return False
    await db.delete(post)
    await db.commit()
    return True
