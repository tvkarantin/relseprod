"""Shared Pydantic base models for the API layer."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class APIModel(BaseModel):
    """Base model for every request/response schema.

    Python code keeps ``snake_case`` field names, while the JSON representation
    uses ``camelCase`` aliases (``instagramUsername``, ``reelsCount``, ...).
    Requests accept both spellings thanks to ``populate_by_name``.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        extra="forbid",
        str_strip_whitespace=True,
        validate_assignment=True,
        use_enum_values=False,
    )

    def to_api_dict(self) -> dict[str, Any]:
        """Dump the model using camelCase aliases."""
        return self.model_dump(by_alias=True)


def empty_to_none(value: str | None) -> str | None:
    """Normalize empty/whitespace-only user text to ``None``.

    The project stores "no value" as ``NULL`` everywhere; this helper keeps that
    convention consistent between the API and the database.
    """
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None
