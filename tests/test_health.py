"""Health and root endpoint tests."""


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert body["database"] == "connected"


def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "message" in response.json()
