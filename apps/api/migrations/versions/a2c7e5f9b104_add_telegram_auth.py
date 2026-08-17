"""Add Telegram-backed users, login challenges and browser sessions.

Revision ID: a2c7e5f9b104
Revises: f89c2a71b4d6
Create Date: 2026-08-17 14:10:00
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a2c7e5f9b104"
down_revision: str | None = "f89c2a71b4d6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "app_users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False),
        sa.Column("telegram_username", sa.String(length=64), nullable=True),
        sa.Column("first_name", sa.String(length=128), nullable=False),
        sa.Column("last_name", sa.String(length=128), nullable=True),
        sa.Column("language_code", sa.String(length=16), nullable=True),
        sa.Column("telegram_avatar_file_id", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("telegram_id"),
    )
    op.create_index("ix_app_users_telegram_id", "app_users", ["telegram_id"], unique=True)

    op.create_table(
        "telegram_login_challenges",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False),
        sa.Column("telegram_username", sa.String(length=64), nullable=True),
        sa.Column("first_name", sa.String(length=128), nullable=False),
        sa.Column("last_name", sa.String(length=128), nullable=True),
        sa.Column("language_code", sa.String(length=16), nullable=True),
        sa.Column("telegram_avatar_file_id", sa.String(length=512), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(
        "ix_telegram_login_challenges_token_hash",
        "telegram_login_challenges",
        ["token_hash"],
        unique=True,
    )
    op.create_index(
        "ix_telegram_login_challenges_telegram_id",
        "telegram_login_challenges",
        ["telegram_id"],
        unique=False,
    )
    op.create_index(
        "ix_telegram_login_challenges_expires_at",
        "telegram_login_challenges",
        ["expires_at"],
        unique=False,
    )

    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["app_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"], unique=False)
    op.create_index("ix_auth_sessions_token_hash", "auth_sessions", ["token_hash"], unique=True)
    op.create_index("ix_auth_sessions_expires_at", "auth_sessions", ["expires_at"], unique=False)

    if op.get_bind().dialect.name == "postgresql":
        for table in ("app_users", "telegram_login_challenges", "auth_sessions"):
            op.execute(f"alter table {table} enable row level security")
            op.execute(f"revoke all on table {table} from anon, authenticated")


def downgrade() -> None:
    op.drop_table("auth_sessions")
    op.drop_table("telegram_login_challenges")
    op.drop_table("app_users")
