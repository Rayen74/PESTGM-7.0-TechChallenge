"""
Authentication and JWT helpers for the Battery Module.
Supports Citizen and STEG Admin roles.
Utilizes passlib (bcrypt) with SHA-256 fallback and python-jose with RFC 7519 HMAC fallback.
"""

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional, Dict, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Load .env if present
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
except ImportError:
    pass

SECRET_KEY = os.getenv("STEG_JWT_SECRET", "tunisia-solar-steg-super-secret-key-production-grade")
ALGORITHM = "HS256"
security = HTTPBearer(auto_error=False)

# ---------------------------------------------------------------------------
# Password Hashing & Verification
# ---------------------------------------------------------------------------
try:
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    HAS_PASSLIB = True
except ImportError:
    pwd_context = None
    HAS_PASSLIB = False


def hash_password(password: str) -> str:
    """Hashes password using bcrypt (or salted sha256 fallback if passlib is not installed)."""
    if HAS_PASSLIB and pwd_context:
        return pwd_context.hash(password)
    import hashlib
    salt = "steg_tunisia_salt"
    return "sha256$" + hashlib.sha256((password + salt).encode()).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies plain password against stored hash."""
    if not hashed_password:
        return False
    # If legacy or fallback sha256
    if hashed_password.startswith("sha256$"):
        import hashlib
        salt = "steg_tunisia_salt"
        expected = "sha256$" + hashlib.sha256((plain_password + salt).encode()).hexdigest()
        return hashed_password == expected
    # If plain 64-char sha256 (pre-migration)
    if len(hashed_password) == 64 and not hashed_password.startswith("$2"):
        import hashlib
        salt = "steg_tunisia_salt"
        expected = hashlib.sha256((plain_password + salt).encode()).hexdigest()
        return hashed_password == expected

    if HAS_PASSLIB and pwd_context:
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            return False
    return False


# ---------------------------------------------------------------------------
# JWT Creation and Decoding
# ---------------------------------------------------------------------------
try:
    from jose import jwt, JWTError
    HAS_JOSE = True
except ImportError:
    HAS_JOSE = False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=24))
    to_encode.update({"exp": int(expire.timestamp())})

    if HAS_JOSE:
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    # Fallback standard manual JWT RFC 7519
    import json
    import hmac
    import hashlib
    import base64

    def b64url(d: bytes) -> str:
        return base64.urlsafe_b64encode(d).decode('utf-8').rstrip('=')

    header = {"alg": "HS256", "typ": "JWT"}
    enc_h = b64url(json.dumps(header).encode('utf-8'))
    enc_p = b64url(json.dumps(to_encode).encode('utf-8'))
    signing_input = f"{enc_h}.{enc_p}".encode('utf-8')
    sig = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
    return f"{enc_h}.{enc_p}.{b64url(sig)}"


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    if HAS_JOSE:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except Exception:
            return None

    # Fallback decoder
    import json
    import hmac
    import hashlib
    import base64

    def b64url_decode(d: str) -> bytes:
        rem = len(d) % 4
        if rem > 0:
            d += '=' * (4 - rem)
        return base64.urlsafe_b64decode(d.encode('utf-8'))

    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        enc_h, enc_p, enc_s = parts
        signing_input = f"{enc_h}.{enc_p}".encode('utf-8')
        sig = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
        expected_sig = base64.urlsafe_b64encode(sig).decode('utf-8').rstrip('=')
        if not hmac.compare_digest(enc_s, expected_sig):
            return None

        payload = json.loads(b64url_decode(enc_p).decode('utf-8'))
        if "exp" in payload and payload["exp"] < datetime.now(timezone.utc).timestamp():
            return None
        return payload
    except Exception:
        return None


def create_password_reset_token(email: str) -> str:
    """Generates a secure 1-hour expiration JWT specifically for password recovery."""
    return create_access_token({"sub_reset": email, "purpose": "pwd_reset"}, expires_delta=timedelta(hours=1))


def verify_password_reset_token(token: str) -> Optional[str]:
    """Verifies reset token and returns email if valid."""
    payload = decode_access_token(token)
    if not payload or payload.get("purpose") != "pwd_reset" or "sub_reset" not in payload:
        return None
    return payload.get("sub_reset")


# ---------------------------------------------------------------------------
# FastAPI Auth Dependencies
# ---------------------------------------------------------------------------
from api.database import get_db, query_one


def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token manquant")
    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide ou expiré")

    user_id = payload.get("sub")
    with get_db() as conn:
        user = query_one(
            conn,
            "SELECT id, email, full_name, role, steg_contract_no FROM users WHERE id = %s",
            (user_id,)
        )
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur non trouvé")
        return user


def get_current_admin(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès réservé aux administrateurs STEG")
    return user
