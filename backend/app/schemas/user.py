from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    salt: str = Field(..., min_length=32)
    password_hash: str = Field(..., min_length=64)
    encrypted_private_key: str
    public_key: str


class UserResponse(BaseModel):
    id: str
    username: str
    public_key: str
    is_online: bool
    created_at: datetime
    last_seen: datetime

    class Config:
        from_attributes = True


class UserPublicKey(BaseModel):
    id: str
    username: str
    public_key: str

    class Config:
        from_attributes = True


class LoginInit(BaseModel):
    username: str


class LoginInitResponse(BaseModel):
    salt: str
    exists: bool = True


class LoginRequest(BaseModel):
    username: str
    password_hash: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse
    encrypted_private_key: str
    requires_key_migration: bool = False


class TokenRefresh(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
