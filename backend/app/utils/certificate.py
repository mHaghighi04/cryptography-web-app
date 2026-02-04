"""Certificate Authority utilities for certificate verification and management."""

from datetime import datetime
from typing import Optional, Tuple
from pathlib import Path
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.x509.oid import NameOID
from cryptography.exceptions import InvalidSignature

# Path to CA certificate - relative to backend directory
CA_CERT_PATH = Path(__file__).parent.parent.parent.parent.parent / "AC1" / "ac1cert.pem"

_ca_certificate: Optional[x509.Certificate] = None


def load_ca_certificate() -> x509.Certificate:
    """Load and cache the CA certificate."""
    global _ca_certificate
    if _ca_certificate is None:
        with open(CA_CERT_PATH, "rb") as f:
            _ca_certificate = x509.load_pem_x509_certificate(f.read())
    return _ca_certificate


def get_ca_certificate_pem() -> str:
    """Get the CA certificate as PEM string."""
    with open(CA_CERT_PATH, "rb") as f:
        return f.read().decode("utf-8")


def verify_certificate(cert_pem: str, ca_cert: Optional[x509.Certificate] = None) -> bool:
    """
    Verify that a certificate was signed by the CA.

    Args:
        cert_pem: PEM-encoded certificate to verify
        ca_cert: CA certificate to verify against (loads default if None)

    Returns:
        True if certificate is valid and signed by CA
    """
    if ca_cert is None:
        ca_cert = load_ca_certificate()

    try:
        cert = x509.load_pem_x509_certificate(cert_pem.encode())
        ca_public_key = ca_cert.public_key()

        # Verify signature
        ca_public_key.verify(
            cert.signature,
            cert.tbs_certificate_bytes,
            padding.PKCS1v15(),
            cert.signature_hash_algorithm,
        )
        return True
    except (InvalidSignature, Exception):
        return False


def is_certificate_expired(cert_pem: str) -> bool:
    """Check if a certificate has expired."""
    cert = x509.load_pem_x509_certificate(cert_pem.encode())
    return datetime.utcnow() > cert.not_valid_after_utc.replace(tzinfo=None)


def extract_certificate_info(cert_pem: str) -> dict:
    """
    Extract information from a certificate.

    Returns:
        dict with: serial, subject, issuer, not_before, not_after, is_expired
    """
    cert = x509.load_pem_x509_certificate(cert_pem.encode())

    # Extract subject common name
    subject_cn = None
    for attr in cert.subject:
        if attr.oid == NameOID.COMMON_NAME:
            subject_cn = attr.value
            break

    # Extract issuer common name
    issuer_cn = None
    for attr in cert.issuer:
        if attr.oid == NameOID.COMMON_NAME:
            issuer_cn = attr.value
            break

    return {
        "serial": format(cert.serial_number, "x"),
        "subject": subject_cn,
        "issuer": issuer_cn,
        "not_before": cert.not_valid_before_utc.replace(tzinfo=None),
        "not_after": cert.not_valid_after_utc.replace(tzinfo=None),
        "is_expired": datetime.utcnow() > cert.not_valid_after_utc.replace(tzinfo=None),
    }


def verify_csr_matches_cert(csr_pem: str, cert_pem: str) -> bool:
    """
    Verify that a certificate was issued from a specific CSR.
    Checks that the public keys match.

    Args:
        csr_pem: PEM-encoded CSR
        cert_pem: PEM-encoded certificate

    Returns:
        True if the certificate's public key matches the CSR's public key
    """
    try:
        csr = x509.load_pem_x509_csr(csr_pem.encode())
        cert = x509.load_pem_x509_certificate(cert_pem.encode())

        # Compare public keys by serializing them
        csr_pub_bytes = csr.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        cert_pub_bytes = cert.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )

        return csr_pub_bytes == cert_pub_bytes
    except Exception:
        return False


def get_public_key_from_certificate(cert_pem: str) -> str:
    """Extract the public key from a certificate as PEM string."""
    cert = x509.load_pem_x509_certificate(cert_pem.encode())
    return cert.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode("utf-8")
