"""Add persistent progress fields for YouTube monitoring runs.

Revision ID: b41f0d7e2c63
Revises: 9d2e6f4a1b30
Create Date: 2026-07-31 10:28:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b41f0d7e2c63"
down_revision: str | None = "9d2e6f4a1b30"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("monitoring_topics") as batch_op:
        batch_op.add_column(
            sa.Column("run_status", sa.String(length=16), server_default="idle", nullable=False)
        )
        batch_op.add_column(
            sa.Column("run_stage", sa.String(length=32), server_default="idle", nullable=False)
        )
        batch_op.add_column(
            sa.Column("run_progress", sa.Integer(), server_default="0", nullable=False)
        )
        batch_op.add_column(sa.Column("run_message", sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column("run_error", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("run_started_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("run_finished_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("monitoring_topics") as batch_op:
        batch_op.drop_column("run_finished_at")
        batch_op.drop_column("run_started_at")
        batch_op.drop_column("run_error")
        batch_op.drop_column("run_message")
        batch_op.drop_column("run_progress")
        batch_op.drop_column("run_stage")
        batch_op.drop_column("run_status")
