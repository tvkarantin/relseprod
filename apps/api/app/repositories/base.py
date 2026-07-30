"""Generic repository helpers.

The repository layer owns all database access. It works with ORM objects and
returns them (or ``None``) — it never raises ``HTTPException`` and never knows
about the HTTP layer.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Generic, TypeVar

from sqlalchemy import select

from app.database.base import Base

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    """Shared CRUD primitives for a single ORM model."""

    model: type[ModelT]

    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, entity_id: int) -> ModelT | None:
        """Return an entity by primary key, or ``None``."""
        return self.db.get(self.model, entity_id)

    def list_all(self, *, limit: int = 100, offset: int = 0) -> list[ModelT]:
        """Return entities ordered by primary key."""
        stmt = select(self.model).order_by(self.model.id).limit(limit).offset(offset)  # type: ignore[attr-defined]
        return list(self.db.scalars(stmt))

    def add(self, entity: ModelT) -> ModelT:
        """Stage a new entity for insertion and flush it to get its id."""
        self.db.add(entity)
        self.db.flush()
        return entity

    def delete(self, entity: ModelT) -> None:
        """Stage an entity for deletion."""
        self.db.delete(entity)
        self.db.flush()

    def commit(self) -> None:
        """Commit the current transaction."""
        self.db.commit()

    def refresh(self, entity: ModelT) -> ModelT:
        """Reload an entity from the database."""
        self.db.refresh(entity)
        return entity
