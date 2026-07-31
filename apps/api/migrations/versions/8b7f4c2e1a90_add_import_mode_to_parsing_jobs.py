"""Add import mode to parsing jobs.

Revision ID: 8b7f4c2e1a90
Revises: 531cddffad16
Create Date: 2026-07-30 23:30:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "8b7f4c2e1a90"
down_revision: str | None = "531cddffad16"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("parsing_jobs") as batch_op:
        batch_op.add_column(
            sa.Column(
                "import_mode",
                sa.Enum(
                    "popular",
                    "latest",
                    name="reel_import_mode",
                    native_enum=False,
                    length=16,
                ),
                server_default="popular",
                nullable=False,
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("parsing_jobs") as batch_op:
        batch_op.drop_column("import_mode")
