"""Authentication endpoint — simple username/password check, returns JWT."""
import os
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from jose import jwt

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-production-abc123")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours

VALID_USERNAME = os.getenv("AUTH_USERNAME", "UoS_EPE")
VALID_PASSWORD = os.getenv("AUTH_PASSWORD", "EPEEMAPP2031")


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest):
    if body.username != VALID_USERNAME or body.password != VALID_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    expires = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token = jwt.encode({"sub": body.username, "exp": expires}, SECRET_KEY, algorithm=ALGORITHM)
    return TokenResponse(access_token=token)
