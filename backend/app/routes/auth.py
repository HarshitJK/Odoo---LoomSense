from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app import database as dbm
from app.services.auth import current_user, hash_password, issue_token, verify_password

router = APIRouter()
_dummy_hash = hash_password("invalid-account-timing-placeholder")


class Login(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=1024)


@router.post("/login")
def login(body: Login):
    user = dbm.db.users.find_one({"email": body.email.strip().lower(), "active": True})
    valid = verify_password(body.password, user["passwordHash"] if user else _dummy_hash)
    if not user or not valid:
        raise HTTPException(401, "Invalid email or password")
    return {"accessToken": issue_token(user), "tokenType": "bearer"}


@router.get("/me")
def me(user=Depends(current_user)):
    return user
