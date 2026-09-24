"""
JWT Email Token management module.
Features:
- HS256 algorithm pinned on decode
- Standard claims: sub, jti, purpose, iat, exp
- Expiry: 4 minutes
- Single-use with atomic database marking
- Invalidation of older unused tokens on resend
- Timezone-aware UTC everywhere
"""

import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional, Dict, Any

# Load .env if present
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
except ImportError:
    pass

from api.database import execute_write, query_one

# JWT Secret: dedicated EMAIL_JWT_SECRET with fallback to STEG_JWT_SECRET
EMAIL_JWT_SECRET = os.getenv("EMAIL_JWT_SECRET") or os.getenv("STEG_JWT_SECRET", "steg-email-token-secret-fallback-key-2026")
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRY_MINUTES = 4

# Import PyJWT with RFC 7519 fallback if PyJWT is not yet installed
try:
    import jwt as pyjwt
    HAS_PYJWT = True
except ImportError:
    HAS_PYJWT = False


# Custom Exceptions
class TokenError(Exception):
    """Base exception for email token errors."""
    pass


class TokenExpired(TokenError):
    """Raised when token is expired."""
    pass


class TokenInvalid(TokenError):
    """Raised when token signature, structure, or purpose is invalid."""
    pass


class TokenAlreadyUsed(TokenError):
    """Raised when token jti has already been consumed."""
    pass


def _encode_jwt(payload: Dict[str, Any], secret: str) -> str:
    """Encodes JWT using PyJWT with HS256."""
    if HAS_PYJWT:
        return pyjwt.encode(payload, secret, algorithm=JWT_ALGORITHM)

    # Standard HS256 RFC 7519 implementation
    import json
    import hmac
    import hashlib
    import base64

    def b64url(d: bytes) -> str:
        return base64.urlsafe_b64encode(d).decode("utf-8").rstrip("=")

    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    enc_h = b64url(json.dumps(header).encode("utf-8"))
    enc_p = b64url(json.dumps(payload).encode("utf-8"))
    signing_input = f"{enc_h}.{enc_p}".encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{enc_h}.{enc_p}.{b64url(sig)}"


def _decode_jwt(token: str, secret: str) -> Dict[str, Any]:
    """Decodes JWT strictly pinning algorithm to HS256."""
    if HAS_PYJWT:
        try:
            return pyjwt.decode(token, secret, algorithms=[JWT_ALGORITHM])
        except pyjwt.ExpiredSignatureError:
            raise TokenExpired("Le jeton de validation a expiré.")
        except pyjwt.InvalidTokenError:
            raise TokenInvalid("Jeton de validation invalide ou corrompu.")

    # Standard fallback verification
    import json
    import hmac
    import hashlib
    import base64

    def b64url_decode(d: str) -> bytes:
        rem = len(d) % 4
        if rem > 0:
            d += "=" * (4 - rem)
        return base64.urlsafe_b64decode(d.encode("utf-8"))

    parts = token.split(".")
    if len(parts) != 3:
        raise TokenInvalid("Format de jeton invalide.")

    enc_h, enc_p, enc_s = parts
    try:
        header = json.loads(b64url_decode(enc_h).decode("utf-8"))
        if header.get("alg") != JWT_ALGORITHM:
            raise TokenInvalid("Algorithme de signature non autorisé.")
    except Exception as e:
        if isinstance(e, TokenInvalid):
            raise
        raise TokenInvalid("En-tête de jeton invalide.")

    signing_input = f"{enc_h}.{enc_p}".encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    expected_sig = base64.urlsafe_b64encode(sig).decode("utf-8").rstrip("=")

    if not hmac.compare_digest(enc_s, expected_sig):
        raise TokenInvalid("Signature de jeton invalide.")

    try:
        payload = json.loads(b64url_decode(enc_p).decode("utf-8"))
    except Exception:
        raise TokenInvalid("Charge utile de jeton invalide.")

    exp = payload.get("exp")
    if exp is not None:
        now_ts = int(datetime.now(timezone.utc).timestamp())
        if now_ts > exp:
            raise TokenExpired("Le jeton de validation a expiré.")

    return payload


def issue_token(db, user_id: int, purpose: str = "verify_email") -> str:
    """
    Issues a new single-use email JWT token valid for 4 minutes.
    1. Invalidates all old unused tokens for the user and purpose.
    2. Inserts new jti record in email_tokens table.
    3. Returns signed HS256 JWT string.
    """
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=TOKEN_EXPIRY_MINUTES)

    # 1. Invalidate old unused tokens for this user & purpose
    execute_write(
        db,
        "UPDATE email_tokens SET used_at = %s WHERE user_id = %s AND purpose = %s AND used_at IS NULL",
        (now, user_id, purpose),
    )

    # 2. Insert new jti row
    jti = str(uuid.uuid4())
    execute_write(
        db,
        "INSERT INTO email_tokens (jti, user_id, purpose, expires_at, used_at) VALUES (%s, %s, %s, %s, NULL)",
        (jti, user_id, purpose, expires_at),
    )

    # 3. Create claims and sign JWT
    payload = {
        "sub": str(user_id),
        "jti": jti,
        "purpose": purpose,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }

    return _encode_jwt(payload, EMAIL_JWT_SECRET)


def consume_token(db, token: str, purpose: str = "verify_email") -> int:
    """
    Validates and atomically consumes a single-use JWT email token.
    1. Pinned decode HS256 and checks exp claim.
    2. Validates purpose claim.
    3. Atomic UPDATE ... SET used_at=now WHERE jti=%s AND used_at IS NULL.
    4. If rowcount != 1: check if jti exists and is already used -> TokenAlreadyUsed, else TokenInvalid.
    5. Returns integer user_id.
    """
    if not token or not isinstance(token, str):
        raise TokenInvalid("Jeton absent ou vide.")

    # 1. Decode & verify signature + exp claim
    payload = _decode_jwt(token, EMAIL_JWT_SECRET)

    # 2. Check purpose claim
    claim_purpose = payload.get("purpose")
    if claim_purpose != purpose:
        raise TokenInvalid(f"Jeton destiné à un autre usage ('{claim_purpose}' au lieu de '{purpose}').")

    jti = payload.get("jti")
    sub = payload.get("sub")
    if not jti or not sub:
        raise TokenInvalid("Jeton incomplet : identifiant ou sujet manquant.")

    try:
        user_id = int(sub)
    except (ValueError, TypeError):
        raise TokenInvalid("Identifiant utilisateur invalide dans le jeton.")

    # 3. Atomic consume
    now = datetime.now(timezone.utc)
    rows_affected = execute_write(
        db,
        "UPDATE email_tokens SET used_at = %s WHERE jti = %s AND used_at IS NULL",
        (now, jti),
    )

    # 4. rowcount check
    if rows_affected != 1:
        # Check why it failed
        existing = query_one(db, "SELECT jti, used_at FROM email_tokens WHERE jti = %s", (jti,))
        if existing and existing.get("used_at") is not None:
            raise TokenAlreadyUsed("Ce jeton a déjà été utilisé.")
        raise TokenInvalid("Jeton introuvable ou révoqué.")

    return user_id
