"""Certificate Authority API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from ..database import get_db
from ..models import User
from ..utils.security import get_current_user
from ..utils.certificate import (
    get_ca_certificate_pem,
    verify_certificate,
    verify_csr_matches_cert,
    extract_certificate_info,
    is_certificate_expired,
)

router = APIRouter()


class CACertificateResponse(BaseModel):
    certificate: str


class CSRResponse(BaseModel):
    csr: str
    username: str


class CertificateUpload(BaseModel):
    certificate: str  # PEM-encoded signed certificate


class CertificateStatusResponse(BaseModel):
    status: str  # none, pending, active, expired, revoked
    expires_at: Optional[datetime] = None
    serial: Optional[str] = None
    subject: Optional[str] = None


class UserCertificateResponse(BaseModel):
    user_id: str
    username: str
    certificate: str
    status: str
    expires_at: Optional[datetime] = None


@router.get("/ca", response_model=CACertificateResponse)
async def get_ca_certificate():
    """
    Download the CA certificate (public).
    This is needed by clients to verify other users' certificates.
    """
    try:
        cert_pem = get_ca_certificate_pem()
        return CACertificateResponse(certificate=cert_pem)
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="CA certificate not found on server"
        )


@router.get("/my-csr", response_model=CSRResponse)
async def get_my_csr(
    current_user: User = Depends(get_current_user),
):
    """
    Get the current user's CSR.
    Returns 404 if no CSR exists.
    """
    if not current_user.csr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No CSR found for this user"
        )

    return CSRResponse(
        csr=current_user.csr,
        username=current_user.username
    )


@router.post("/upload", response_model=CertificateStatusResponse)
async def upload_certificate(
    data: CertificateUpload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a signed certificate for the current user.

    Validates:
    - Certificate is signed by the CA
    - Certificate matches the user's CSR (public key match)
    - Certificate is not expired

    Updates user's certificate status to 'active'.
    """
    cert_pem = data.certificate

    # Verify certificate is signed by CA
    if not verify_certificate(cert_pem):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Certificate is not signed by the CA"
        )

    # Verify certificate matches user's CSR
    if not current_user.csr:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No CSR found for this user. Cannot verify certificate."
        )

    if not verify_csr_matches_cert(current_user.csr, cert_pem):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Certificate does not match your CSR"
        )

    # Check expiration
    if is_certificate_expired(cert_pem):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Certificate has expired"
        )

    # Extract certificate info
    cert_info = extract_certificate_info(cert_pem)

    # Update user record
    current_user.certificate = cert_pem
    current_user.certificate_status = "active"
    current_user.certificate_expires_at = cert_info["not_after"]
    current_user.certificate_serial = cert_info["serial"]

    await db.commit()
    await db.refresh(current_user)

    return CertificateStatusResponse(
        status="active",
        expires_at=cert_info["not_after"],
        serial=cert_info["serial"],
        subject=cert_info["subject"],
    )


@router.get("/status", response_model=CertificateStatusResponse)
async def get_certificate_status(
    current_user: User = Depends(get_current_user),
):
    """Get the current user's certificate status."""
    # Check if certificate has expired since last check
    if (
        current_user.certificate_status == "active"
        and current_user.certificate
        and is_certificate_expired(current_user.certificate)
    ):
        # Note: We don't update the DB here to avoid side effects on GET
        return CertificateStatusResponse(
            status="expired",
            expires_at=current_user.certificate_expires_at,
            serial=current_user.certificate_serial,
        )

    return CertificateStatusResponse(
        status=current_user.certificate_status or "none",
        expires_at=current_user.certificate_expires_at,
        serial=current_user.certificate_serial,
    )


@router.get("/user/{user_id}", response_model=UserCertificateResponse)
async def get_user_certificate(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get another user's certificate.
    Used for encrypting messages to the recipient and verifying signatures.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if not user.certificate or user.certificate_status != "active":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User does not have an active certificate"
        )

    # Check expiration
    status_str = user.certificate_status
    if is_certificate_expired(user.certificate):
        status_str = "expired"

    return UserCertificateResponse(
        user_id=user.id,
        username=user.username,
        certificate=user.certificate,
        status=status_str,
        expires_at=user.certificate_expires_at,
    )
