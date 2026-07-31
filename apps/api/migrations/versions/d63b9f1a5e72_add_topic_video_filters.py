"""Add video filtering and sorting settings to monitoring topics.

Revision ID: d63b9f1a5e72
Revises: c52a8e6d104b
Create Date: 2026-07-31 11:18:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d63b9f1a5e72"
down_revision: str | None = "c52a8e6d104b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("monitoring_topics") as batch_op:
        batch_op.add_column(
            sa.Column("content_filter", sa.String(length=16), server_default="all", nullable=False)
        )
        batch_op.add_column(
            sa.Column("min_view_count", sa.Integer(), server_default="0", nullable=False)
        )
        batch_op.add_column(sa.Column("published_within_days", sa.Integer(), nullable=True))
        batch_op.add_column(
            sa.Column("sort_by", sa.String(length=16), server_default="score", nullable=False)
        )


def downgrade() -> None:
    with op.batch_alter_table("monitoring_topics") as batch_op:
        batch_op.drop_column("sort_by")
        batch_op.drop_column("published_within_days")
        batch_op.drop_column("min_view_count")
        batch_op.drop_column("content_filter")
