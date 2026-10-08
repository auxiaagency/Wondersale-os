"""
Two-Factor Authentication (TOTP) Service for Wondersale.
Generates provisioning URIs, verifies TOTP codes, and manages recovery codes.
"""
import pyotp
import secrets
from django.contrib.auth.hashers import make_password, check_password


def generate_totp_secret() -> str:
    """Generates a base32 encoded random secret for TOTP setup."""
    return pyotp.random_base32()


def get_totp_uri(secret: str, staff_id: str, issuer: str = "Wondersale") -> str:
    """Constructs the otpauth:// URI for QR code scanning in Google Authenticator / Authy."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=staff_id, issuer_name=issuer)


def verify_totp_code(secret: str, code: str, valid_window: int = 1) -> bool:
    """
    Validates a 6-digit TOTP code against the secret.
    Allows valid_window intervals (+/- 30 seconds) to accommodate clock drift.
    """
    if not secret or not code:
        return False
    clean_code = str(code).strip()
    totp = pyotp.TOTP(secret)
    return totp.verify(clean_code, valid_window=valid_window)


def generate_recovery_codes(count: int = 8) -> tuple[list[str], list[str]]:
    """
    Generates a set of single-use recovery codes.
    Returns (plain_codes, hashed_codes) so only hashed codes are stored at rest.
    """
    plain_codes = [secrets.token_hex(4).upper() for _ in range(count)]
    hashed_codes = [make_password(c) for c in plain_codes]
    return plain_codes, hashed_codes


def verify_and_consume_recovery_code(entered_code: str, hashed_codes: list[str]) -> tuple[bool, list[str]]:
    """
    Verifies if an entered code matches one of the hashed recovery codes.
    If valid, returns (True, remaining_hashed_codes) with the consumed code removed.
    """
    clean = str(entered_code).strip().upper()
    for idx, h in enumerate(hashed_codes):
        if check_password(clean, h):
            remaining = hashed_codes[:idx] + hashed_codes[idx+1:]
            return True, remaining
    return False, hashed_codes
