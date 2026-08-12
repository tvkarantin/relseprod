"""Use JSONB for monitored video list metadata on PostgreSQL.

Revision ID: f89c2a71b4d6
Revises: e4a7c9b2d105
Create Date: 2026-08-12 15:55:00
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "f89c2a71b4d6"
down_revision: str | None = "e4a7c9b2d105"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            "alter table monitored_videos alter column why_it_works "
            "type jsonb using why_it_works::jsonb"
        )


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute(
            "alter table monitored_videos alter column why_it_works "
            "type json using why_it_works::json"
        )
