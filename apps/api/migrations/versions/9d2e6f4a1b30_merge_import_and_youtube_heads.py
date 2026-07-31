"""Merge the import-mode and YouTube-monitoring migration branches.

Revision ID: 9d2e6f4a1b30
Revises: 8b7f4c2e1a90, 8c0b2e1a4f7d
Create Date: 2026-07-31 10:16:00
"""

from __future__ import annotations

from collections.abc import Sequence

revision: str = "9d2e6f4a1b30"
down_revision: tuple[str, str] = ("8b7f4c2e1a90", "8c0b2e1a4f7d")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Join both schema branches without additional database changes."""


def downgrade() -> None:
    """Split the migration graph back into its two parent branches."""
