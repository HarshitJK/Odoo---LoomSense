"""Short-lived JWT sessions. Roles are always read from the current user record."""
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app import database as dbm

bearer = HTTPBearer(auto_error=False)


def secret():
    key = os.getenv("JWT_SECRET", "")
    if len(key) < 32:
        raise HTTPException(503, "Configure JWT_SECRET with at least 32 characters")
    return key


def hash_password(password):
    salt = secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return f"scrypt${salt}${digest}"


def verify_password(password, encoded):
    try:
        scheme, salt, expected = encoded.split("$")
        actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
        return scheme == "scrypt" and hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def issue_token(user):
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": user["email"], "iat": now, "exp": now + timedelta(hours=8),
                       "iss": "loomsense", "aud": "loomsense-internal"}, secret(), algorithm="HS256")


def user_from_token(token):
    try:
        claims = jwt.decode(token, secret(), algorithms=["HS256"], audience="loomsense-internal",
                            issuer="loomsense", options={"require": ["sub", "exp", "iat"]})
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid or expired session")
    user = dbm.db.users.find_one({"email": claims["sub"], "active": True}, {"_id": 0, "passwordHash": 0})
    if not user:
        raise HTTPException(401, "Session no longer active")
    return user


def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    if not credentials:
        raise HTTPException(401, "Login required", headers={"WWW-Authenticate": "Bearer"})
    return user_from_token(credentials.credentials)


def roles(*allowed):
    def authorize(user=Depends(current_user)):
        if user["role"] not in allowed:
            raise HTTPException(403, "Your role cannot access this resource")
        return user
    return authorize


owner = roles("OWNER")
management = roles("OWNER", "PRODUCTION_MANAGER")
internal = roles("OWNER", "PRODUCTION_MANAGER", "WORKER_QC")
