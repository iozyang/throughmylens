from app.routers.auth import password_hasher, token_hash


def test_password_hashing_uses_verification() -> None:
    hashed = password_hasher.hash("a-strong-test-password")

    assert password_hasher.verify("a-strong-test-password", hashed)
    assert not password_hasher.verify("wrong-password", hashed)


def test_session_token_is_not_stored_in_plaintext() -> None:
    token = "opaque-session-token"

    assert token_hash(token) != token
    assert len(token_hash(token)) == 64
