"""Authentication tests: register/login, lockout, password reset."""
import uuid


def test_register_and_login_me(client):
    email = f"user-{uuid.uuid4().hex[:8]}@test.com"
    register = client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "Reg User", "password": "Password123!"},
    )
    assert register.status_code in (200, 201), register.text

    login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "Password123!"}
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    me = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == email


def test_password_change_requires_the_current_password(client):
    """Changing a password has to prove ownership of the current one."""
    email = f"pw-{uuid.uuid4().hex[:8]}@test.com"
    register = client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "Pw User", "password": "Password123!"},
    )
    assert register.status_code in (200, 201), register.text
    login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "Password123!"}
    )
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # No current password at all
    response = client.put(
        "/api/v1/users/me", headers=headers, json={"password": "NewPassword123!"}
    )
    assert response.status_code == 400
    assert "current password" in response.json()["detail"].lower()

    # Wrong current password
    response = client.put(
        "/api/v1/users/me",
        headers=headers,
        json={"password": "NewPassword123!", "current_password": "NotThePassword1!"},
    )
    assert response.status_code == 400
    assert "current password" in response.json()["detail"].lower()

    # The old password still works, so the rejected attempts changed nothing
    assert client.post(
        "/api/v1/auth/login", json={"email": email, "password": "Password123!"}
    ).status_code == 200

    # Correct current password
    response = client.put(
        "/api/v1/users/me",
        headers=headers,
        json={"password": "NewPassword123!", "current_password": "Password123!"},
    )
    assert response.status_code == 200, response.text
    assert client.post(
        "/api/v1/auth/login", json={"email": email, "password": "NewPassword123!"}
    ).status_code == 200
    assert client.post(
        "/api/v1/auth/login", json={"email": email, "password": "Password123!"}
    ).status_code == 401


def test_login_wrong_password(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "student@test.com", "password": "wrong-password"},
    )
    assert response.status_code == 401


def test_login_unknown_email(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "ghost@test.com", "password": "whatever123"},
    )
    assert response.status_code == 401


def test_lockout_after_five_failures(client):
    email = f"locked-{uuid.uuid4().hex[:8]}@test.com"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "Lock User", "password": "Password123!"},
    )

    codes = []
    for _ in range(6):
        codes.append(
            client.post(
                "/api/v1/auth/login",
                json={"email": email, "password": "totally-wrong"},
            ).status_code
        )
    assert codes[:4] == [401, 401, 401, 401]
    assert codes[4] == 423  # locked on the 5th failure
    assert codes[5] == 423

    # Even the correct password is refused while locked
    locked = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "Password123!"}
    )
    assert locked.status_code == 423


def test_password_reset_flow(client):
    email = f"reset-{uuid.uuid4().hex[:8]}@test.com"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "Reset User", "password": "OldPass123!"},
    )

    request = client.post("/api/v1/auth/reset-password", json={"email": email})
    assert request.status_code == 200
    token = request.json().get("reset_token")
    assert token, "dev environment should return the reset token inline"

    # Token reuse must be rejected after use
    confirm = client.post(
        "/api/v1/auth/reset-password/confirm",
        json={"token": token, "new_password": "NewPass123!"},
    )
    assert confirm.status_code == 200

    reuse = client.post(
        "/api/v1/auth/reset-password/confirm",
        json={"token": token, "new_password": "Hacked123!"},
    )
    assert reuse.status_code == 400

    old_login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "OldPass123!"}
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "NewPass123!"}
    )
    assert new_login.status_code == 200


def test_unknown_email_reset_does_not_leak(client):
    known = client.post(
        "/api/v1/auth/reset-password", json={"email": "student@test.com"}
    )
    unknown = client.post(
        "/api/v1/auth/reset-password", json={"email": "ghost@test.com"}
    )
    assert known.status_code == unknown.status_code == 200
    assert known.json()["message"] == unknown.json()["message"]
    assert "reset_token" not in unknown.json()


def test_reset_token_is_not_disclosed_unless_opted_in(client, monkeypatch):
    """Without DEBUG_RESET_TOKEN the response must never carry a usable token."""
    from app.core.config import settings

    monkeypatch.setattr(settings, "DEBUG_RESET_TOKEN", False)
    email = f"noinline-{uuid.uuid4().hex[:8]}@test.com"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "No Inline", "password": "OldPass123!"},
    )

    request = client.post("/api/v1/auth/reset-password", json={"email": email})
    assert request.status_code == 200
    assert "reset_token" not in request.json()


def test_demo_accounts_are_development_only(client, monkeypatch):
    """The demo credentials may only be served outside production.

    The login page's "quick access" panel fetches them, so the endpoint is
    the only place they live — a deployment must not answer it.
    """
    from app.core.config import settings

    development = client.get("/api/v1/auth/demo-accounts")
    assert development.status_code == 200, development.text
    accounts = development.json()
    assert {a["email"] for a in accounts} == {
        "admin@lms.com",
        "instructor@lms.com",
        "student@lms.com",
    }
    assert all(a["password"] for a in accounts)

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    production = client.get("/api/v1/auth/demo-accounts")
    assert production.status_code == 404
    assert "Admin123" not in production.text
