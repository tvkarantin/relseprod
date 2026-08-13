"""Regression tests for the production Vercel CORS policy."""

from fastapi.testclient import TestClient


def test_realsfinder_vercel_frontend_origin_is_allowed(client: TestClient) -> None:
    origin = "https://realsfinder-github.vercel.app"
    response = client.get("/", headers={"Origin": origin})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["access-control-allow-credentials"] == "true"


def test_unrelated_vercel_origin_is_not_allowed(client: TestClient) -> None:
    response = client.get("/", headers={"Origin": "https://unrelated-project.vercel.app"})

    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers
