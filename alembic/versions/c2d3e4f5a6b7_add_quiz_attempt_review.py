"""add quiz attempt manual review columns

Revision ID: c2d3e4f5a6b7
Revises: a1b2c3d4e5f6
Create Date: 2026-10-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c2d3e4f5a6b7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "quiz_attempts",
        sa.Column(
            "needs_review",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "quiz_attempts",
        sa.Column("graded_by", sa.UUID(), nullable=True),
    )
    op.add_column(
        "quiz_attempts",
        sa.Column("graded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "quiz_attempts",
        sa.Column("feedback", sa.Text(), nullable=True),
    )
    op.create_foreign_key(
        "fk_quiz_attempts_graded_by_users",
        "quiz_attempts",
        "users",
        ["graded_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_quiz_attempts_graded_by_users",
        "quiz_attempts",
        type_="foreignkey",
    )
    op.drop_column("quiz_attempts", "feedback")
    op.drop_column("quiz_attempts", "graded_at")
    op.drop_column("quiz_attempts", "graded_by")
    op.drop_column("quiz_attempts", "needs_review")
