"""Align video statistics snapshots with the ORM timestamp mixin.

Revision ID: c52a8e6d104b
Revises: b41f0d7e2c63
Create Date: 2026-07-31 10:32:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c52a8e6d104b"
down_revision: str | None = "b41f0d7e2c63"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("video_statistics_snapshots") as batch_op:
        batch_op.add_column(
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("video_statistics_snapshots") as batch_op:
        batch_op.drop_column("created_at")
