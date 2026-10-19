"""add quiz type

Revision ID: a1b2c3d4e5f6
Revises: b058fbae7355
Create Date: 2026-10-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "b058fbae7355"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "quizzes",
        sa.Column(
            "quiz_type",
            sa.String(length=50),
            nullable=False,
            server_default="multiple_choice",
        ),
    )


def downgrade() -> None:
    op.drop_column("quizzes", "quiz_type")
