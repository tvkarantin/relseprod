"""Add internal service secrets used by server-to-server integrations.

Revision ID: e4a7c9b2d105
Revises: d63b9f1a5e72
Create Date: 2026-08-12 15:52:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e4a7c9b2d105"
down_revision: str | None = "d63b9f1a5e72"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "internal_service_secrets",
        sa.Column("key", sa.Text(), primary_key=True),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    if op.get_bind().dialect.name == "postgresql":
        op.execute("alter table internal_service_secrets enable row level security")
        op.execute("revoke all on table internal_service_secrets from anon, authenticated")


def downgrade() -> None:
    op.drop_table("internal_service_secrets")
