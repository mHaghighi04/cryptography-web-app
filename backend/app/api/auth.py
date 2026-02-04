from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import secrets

from ..database import get_db
from ..models import User
from ..schemas import (
    UserCreate,
    UserResponse,
    LoginInit,
    LoginInitResponse,
    LoginRequest,
    LoginResponse,
    TokenRefresh,
    TokenResponse,
)
from ..utils.security import create_access_token, create_refresh_token, verify_token

router = APIRouter()


@router.post("/signup", response_model=LoginResponse)
async def signup(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """
    Register a new user.
    Client generates RSA keypair and encrypts private key before sending.
    """
    # Check if username exists
    result = await db.execute(select(User).where(User.username == user_data.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    # Create user
    user = User(
        username=user_data.username,
        salt=user_data.salt,
        password_hash=user_data.password_hash,
        encrypted_private_key=user_data.encrypted_private_key,
        public_key=user_data.public_key,
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Generate tokens
    access_token = create_access_token(data={"sub": user.id})
    refresh_token = create_refresh_token(data={"sub": user.id})

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
        encrypted_private_key=user.encrypted_private_key,
    )


@router.post("/login/init", response_model=LoginInitResponse)
async def login_init(data: LoginInit, db: AsyncSession = Depends(get_db)):
    """
    Initialize login by returning the user's salt for client-side password hashing.
    """
    result = await db.execute(select(User).where(User.username == data.username))
    user = result.scalar_one_or_none()

    if not user:
        # Return fake salt to prevent username enumeration
        fake_salt = secrets.token_hex(16)
        return LoginInitResponse(salt=fake_salt, exists=False)

    return LoginInitResponse(salt=user.salt)


@router.post("/login", response_model=LoginResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticate user and return JWT tokens + encrypted private key.
    """
    result = await db.execute(select(User).where(User.username == data.username))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    # Compare password hashes (timing-safe comparison)
    if not secrets.compare_digest(user.password_hash, data.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    # Generate tokens
    access_token = create_access_token(data={"sub": user.id})
    refresh_token = create_refresh_token(data={"sub": user.id})

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
        encrypted_private_key=user.encrypted_private_key,
        requires_key_migration=user.requires_key_migration,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: TokenRefresh, db: AsyncSession = Depends(get_db)):
    """
    Refresh access token using refresh token.
    """
    payload = verify_token(data.refresh_token, "refresh")
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    user_id = payload.get("sub")

    # Verify user still exists
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # Generate new tokens
    access_token = create_access_token(data={"sub": user.id})
    new_refresh_token = create_refresh_token(data={"sub": user.id})

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
    )
