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
            "SELECT id, email, full_name, role, steg_contract_no, is_verified FROM users WHERE id = %s",
            (user_id,)
        )
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur non trouvé")
        return user


def get_current_admin(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if user.get("role") != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accès réservé aux administrateurs STEG")
    return user


# ---------------------------------------------------------------------------
# Email Token Router & Endpoints
# ---------------------------------------------------------------------------
from fastapi import APIRouter
from pydantic import BaseModel, EmailStr
from api.database import execute_write
from api.email_tokens import (
    issue_token,
    consume_token,
    TokenExpired,
    TokenAlreadyUsed,
    TokenInvalid,
)

auth_router = APIRouter(prefix="/auth", tags=["Authentication & Verification"])

# In-memory cooldown tracking for resend-email: {user_id: timestamp}
_resend_cooldowns: Dict[int, float] = {}
COOLDOWN_SECONDS = 30


class ResendEmailRequest(BaseModel):
    email: EmailStr


class VerifyEmailRequest(BaseModel):
    token: str


@auth_router.post("/resend-email")
def resend_email(req: ResendEmailRequest):
    """
    Issues a new single-use verification email JWT with a 4-minute lifespan.
    Enforces a 30-second cooldown per user.
    Invalidates any older unused tokens for that user.
    Never logs the raw token.
    """
    now = datetime.now(timezone.utc)
    now_ts = now.timestamp()

    with get_db() as conn:
        user = query_one(conn, "SELECT id, email, full_name FROM users WHERE email = %s", (req.email,))
        if not user:
            # Prevent user enumeration with generic success message
            return {
                "status": "success",
                "message": "Si l'adresse email existe, un nouveau lien de validation a été envoyé.",
                "cooldown_seconds": COOLDOWN_SECONDS,
            }

        user_id = user["id"]

        # Check 30-second cooldown
        last_sent = _resend_cooldowns.get(user_id)
        if last_sent is not None and (now_ts - last_sent) < COOLDOWN_SECONDS:
            remaining = int(COOLDOWN_SECONDS - (now_ts - last_sent))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Veuillez patienter encore {remaining} secondes avant de renvoyer un email.",
            )

        # Issue token (invalidates old unused tokens, saves new jti)
        token = issue_token(conn, user_id=user_id, purpose="verify_email")
        _resend_cooldowns[user_id] = now_ts

    # Construct frontend verification link (never log raw token)
    frontend_base = os.getenv("FRONTEND_URL", "http://localhost:3000")
    verification_url = f"{frontend_base}/verify-email?token={token}"

    return {
        "status": "success",
        "message": "Un nouveau lien de vérification a été généré et envoyé.",
        "verification_url": verification_url,
        "token": token,
        "expires_in_minutes": 4,
        "cooldown_seconds": COOLDOWN_SECONDS,
    }


@auth_router.post("/verify-email")
def verify_email(req: VerifyEmailRequest):
    """
    Validates and redeems a single-use email verification token via POST.
    Redeems the token before marking the user verified.
    Maps each exception to a clear, unambiguous HTTP error.
    """
    with get_db() as conn:
        try:
            # 1. Redeem token first
            user_id = consume_token(conn, token=req.token, purpose="verify_email")
        except TokenExpired:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le jeton de validation a expiré (durée de validité : 4 minutes).",
            )
        except TokenAlreadyUsed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ce jeton a déjà été utilisé.",
            )
        except TokenInvalid as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e) or "Jeton de validation invalide.",
            )

        # 2. Mark user verified after successful token redemption
        execute_write(conn, "UPDATE users SET is_verified = TRUE WHERE id = %s", (user_id,))
        user = query_one(conn, "SELECT id, email, full_name, role, is_verified FROM users WHERE id = %s", (user_id,))

    return {
        "status": "success",
        "message": "Votre adresse email a été vérifiée avec succès.",
        "user": user,
    }

