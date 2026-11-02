import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time

_SESSION_SECRET = os.getenv("ADMIN_SESSION_SECRET", "").encode() or secrets.token_bytes(32)
_PASSWORD_SCRYPT_N = 1 << 14


def normalize_admin_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if len(digits) == 10:
        digits = f"91{digits}"
    if len(digits) < 10 or len(digits) > 15:
        raise ValueError("Enter a valid phone number")
    return f"+{digits}"


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode(),
        salt=salt,
        n=_PASSWORD_SCRYPT_N,
        r=8,
        p=1,
    )
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_hex, digest_hex = stored_hash.split("$", 1)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
    except (ValueError, TypeError):
        return False
    actual = hashlib.scrypt(
        password.encode(),
        salt=salt,
        n=_PASSWORD_SCRYPT_N,
        r=8,
        p=1,
    )
    return hmac.compare_digest(actual, expected)


def hash_otp(phone: str, otp: str) -> str:
    return hmac.new(_SESSION_SECRET, f"{phone}:{otp}".encode(), hashlib.sha256).hexdigest()


def verify_otp(phone: str, otp: str, digest: str) -> bool:
    return hmac.compare_digest(hash_otp(phone, otp), digest)


def create_session_token(phone: str, token_version: int, lifetime_seconds: int) -> str:
    payload = json.dumps(
        {
            "phone": phone,
            "version": token_version,
            "expires": int(time.time()) + lifetime_seconds,
        },
        separators=(",", ":"),
    ).encode()
    encoded = base64.urlsafe_b64encode(payload).rstrip(b"=")
    signature = hmac.new(_SESSION_SECRET, encoded, hashlib.sha256).digest()
    return f"{encoded.decode()}.{base64.urlsafe_b64encode(signature).rstrip(b'=').decode()}"


def verify_session_token(token: str) -> dict | None:
    try:
        encoded, signature_text = token.split(".", 1)
        signature = base64.urlsafe_b64decode(signature_text + "=" * (-len(signature_text) % 4))
        expected = hmac.new(_SESSION_SECRET, encoded.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(signature, expected):
            return None
        payload_bytes = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
        payload = json.loads(payload_bytes)
    except (ValueError, TypeError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict) or payload.get("expires", 0) <= int(time.time()):
        return None
    if not isinstance(payload.get("phone"), str) or not isinstance(payload.get("version"), int):
        return None
    return payload
