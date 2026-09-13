from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from pwdlib import PasswordHash
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.models.auth import AuthSession, FailedLoginAttempt
from app.models.enums import UserRole
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["authentication"])
password_hasher = PasswordHash.recommended()
MAX_FAILED_LOGINS = 5
FAILED_LOGIN_WINDOW = timedelta(minutes=15)


class LoginRequest(BaseModel):
    email: str
    password: str


class CurrentUserResponse(BaseModel):
    email: str
    role: UserRole


def normalize_email(email: str) -> str:
    try:
        return validate_email(email, check_deliverability=False).normalized.lower()
    except EmailNotValidError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        ) from error


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def request_ip_hash(request: Request) -> str:
    client_ip = request.client.host if request.client else "unknown"
    secret = get_settings().auth_secret_key.get_secret_value()
    return hashlib.sha256(f"{client_ip}:{secret}".encode()).hexdigest()


def get_current_admin(request: Request, db: Session = Depends(get_db)) -> User:
    settings = get_settings()
    token = request.cookies.get(settings.auth_session_cookie_name)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )

    now = datetime.now(UTC)
    auth_session = db.scalar(
        select(AuthSession).where(
            AuthSession.token_hash == token_hash(token),
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > now,
        )
    )
    if (
        not auth_session
        or not auth_session.user.is_active
        or auth_session.user.role != UserRole.ADMIN
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )
    return auth_session.user


def require_csrf(
    request: Request,
    x_csrf_token: str | None = Header(default=None),
) -> None:
    csrf_cookie = request.cookies.get(get_settings().auth_csrf_cookie_name)
    if not csrf_cookie or not x_csrf_token or not hmac.compare_digest(csrf_cookie, x_csrf_token):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid CSRF token")


@router.post("/login", response_model=CurrentUserResponse)
def login(
    payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)
) -> CurrentUserResponse:
    email = normalize_email(payload.email)
    ip_hash = request_ip_hash(request)
    window_start = datetime.now(UTC) - FAILED_LOGIN_WINDOW
    recent_attempts = db.scalar(
        select(func.count(FailedLoginAttempt.id)).where(
            FailedLoginAttempt.email == email,
            FailedLoginAttempt.ip_hash == ip_hash,
            FailedLoginAttempt.attempted_at >= window_start,
        )
    )
    if recent_attempts and recent_attempts >= MAX_FAILED_LOGINS:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Try again later")

    user = db.scalar(select(User).where(User.email == email))
    if (
        not user
        or not user.is_active
        or not password_hasher.verify(payload.password, user.password_hash)
    ):
        db.add(FailedLoginAttempt(email=email, ip_hash=ip_hash))
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    now = datetime.now(UTC)
    session_token = secrets.token_urlsafe(32)
    auth_session = AuthSession(
        user_id=user.id,
        token_hash=token_hash(session_token),
        ip_hash=ip_hash,
        user_agent=(request.headers.get("user-agent") or "")[:512] or None,
        expires_at=now + timedelta(hours=get_settings().auth_session_ttl_hours),
    )
    user.last_login_at = now
    db.add(auth_session)
    db.execute(
        delete(FailedLoginAttempt).where(
            FailedLoginAttempt.email == email,
            FailedLoginAttempt.ip_hash == ip_hash,
        )
    )
    db.commit()

    settings = get_settings()
    response.set_cookie(
        key=settings.auth_session_cookie_name,
        value=session_token,
        max_age=settings.auth_session_ttl_hours * 3600,
        httponly=True,
        secure=settings.auth_session_cookie_secure,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        key=settings.auth_csrf_cookie_name,
        value=secrets.token_urlsafe(24),
        max_age=settings.auth_session_ttl_hours * 3600,
        httponly=False,
        secure=settings.auth_session_cookie_secure,
        samesite="lax",
        path="/",
    )
    return CurrentUserResponse(email=user.email, role=user.role)


@router.get("/me", response_model=CurrentUserResponse)
def me(current_user: User = Depends(get_current_admin)) -> CurrentUserResponse:
    return CurrentUserResponse(email=current_user.email, role=current_user.role)


@router.post(
    "/logout", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_csrf)]
)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
) -> Response:
    del current_user
    token = request.cookies.get(get_settings().auth_session_cookie_name)
    if token:
        auth_session = db.scalar(
            select(AuthSession).where(AuthSession.token_hash == token_hash(token))
        )
        if auth_session:
            auth_session.revoked_at = datetime.now(UTC)
            db.commit()
    settings = get_settings()
    response.delete_cookie(settings.auth_session_cookie_name, path="/")
    response.delete_cookie(settings.auth_csrf_cookie_name, path="/")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
