"""Tests for the Supabase Edge Instagram fallback."""

from __future__ import annotations

import httpx
from sqlalchemy import text

from app.services.instagram_edge import InstagramEdgeService


def test_fetch_profile_reels_uses_database_backed_token(db_session, settings) -> None:
    db_session.execute(
        text(
            "insert into internal_service_secrets(key, value) "
            "values ('instagram_edge_token', 'test-token')"
        )
    )
    db_session.commit()

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["x-internal-token"] == "test-token"
        assert request.url == httpx.URL("https://edge.example.test/instagram-reels")
        return httpx.Response(
            200,
            json={
                "items": [
                    {
                        "id": "123",
                        "shortCode": "ABC123",
                        "url": "https://www.instagram.com/reel/ABC123/",
                    }
                ]
            },
        )

    edge_settings = settings.model_copy(
        update={"instagram_edge_url": "https://edge.example.test/instagram-reels"}
    )
    client = httpx.Client(transport=httpx.MockTransport(handler))
    try:
        service = InstagramEdgeService(db_session, edge_settings, client=client)
        assert service.is_configured() is True
        items = service.fetch_profile_reels("example", limit=5)
        assert items == [
            {
                "id": "123",
                "shortCode": "ABC123",
                "url": "https://www.instagram.com/reel/ABC123/",
            }
        ]
    finally:
        client.close()
        db_session.execute(
            text("delete from internal_service_secrets where key = 'instagram_edge_token'")
        )
        db_session.commit()
