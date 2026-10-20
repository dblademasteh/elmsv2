"""enforce quiz setting defaults

Backfills NULLs in the quiz/attempt settings columns and turns them into
NOT NULL columns with server defaults, so a legacy row can never break the
API with an unexpected 500.

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-10-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d3e4f5a6b7c8"
down_revision: Union[str, Sequence[str], None] = "c2d3e4f5a6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE quizzes SET max_attempts = 3 WHERE max_attempts IS NULL")
    op.execute("UPDATE quizzes SET passing_grade = 70 WHERE passing_grade IS NULL")
    op.execute("UPDATE quizzes SET randomize_questions = FALSE WHERE randomize_questions IS NULL")
    op.execute("UPDATE quizzes SET show_results = TRUE WHERE show_results IS NULL")
    op.execute("UPDATE quizzes SET allow_retry = TRUE WHERE allow_retry IS NULL")
    op.execute("UPDATE quizzes SET quiz_type = 'multiple_choice' WHERE quiz_type IS NULL")

    op.alter_column("quizzes", "max_attempts", nullable=False, server_default=sa.text("3"))
    op.alter_column("quizzes", "passing_grade", nullable=False, server_default=sa.text("70"))
    op.alter_column(
        "quizzes", "randomize_questions", nullable=False, server_default=sa.text("false")
    )
    op.alter_column("quizzes", "show_results", nullable=False, server_default=sa.text("true"))
    op.alter_column("quizzes", "allow_retry", nullable=False, server_default=sa.text("true"))
    op.alter_column(
        "quizzes", "quiz_type", nullable=False, server_default=sa.text("'multiple_choice'")
    )

    op.execute("UPDATE quiz_attempts SET started_at = NOW() WHERE started_at IS NULL")
    op.execute("UPDATE quiz_attempts SET passed = FALSE WHERE passed IS NULL")
    op.execute("UPDATE quiz_attempts SET attempt_number = 1 WHERE attempt_number IS NULL")
    op.execute("UPDATE quiz_attempts SET needs_review = FALSE WHERE needs_review IS NULL")

    op.alter_column(
        "quiz_attempts", "started_at", nullable=False, server_default=sa.text("now()")
    )
    op.alter_column(
        "quiz_attempts", "passed", nullable=False, server_default=sa.text("false")
    )
    op.alter_column(
        "quiz_attempts", "attempt_number", nullable=False, server_default=sa.text("1")
    )


def downgrade() -> None:
    op.alter_column("quizzes", "max_attempts", nullable=True, server_default=None)
    op.alter_column("quizzes", "passing_grade", nullable=True, server_default=None)
    op.alter_column("quizzes", "randomize_questions", nullable=True, server_default=None)
    op.alter_column("quizzes", "show_results", nullable=True, server_default=None)
    op.alter_column("quizzes", "allow_retry", nullable=True, server_default=None)
    op.alter_column("quizzes", "quiz_type", nullable=True, server_default=None)

    op.alter_column("quiz_attempts", "started_at", nullable=True, server_default=None)
    op.alter_column("quiz_attempts", "passed", nullable=True, server_default=None)
    op.alter_column("quiz_attempts", "attempt_number", nullable=True, server_default=None)
