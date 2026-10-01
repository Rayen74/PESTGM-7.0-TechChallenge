"""
Authentication and JWT helpers for the Battery Module.
Supports Citizen and STEG Admin roles.
Utilizes passlib (bcrypt) with SHA-256 fallback and python-jose with RFC 7519 HMAC fallback.
"""

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional, Dict, Any
from uuid import UUID

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

SECRET_KEY = os.getenv("JWT_SECRET") or os.getenv("STEG_JWT_SECRET")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET must be configured; refusing to start with an insecure default key.")
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
    # Tokens signed with removed/default keys are intentionally rejected.
    keys_to_try = [SECRET_KEY]

    for key in keys_to_try:
        if HAS_JOSE:
            try:
                payload = jwt.decode(token, key, algorithms=[ALGORITHM])
                return payload
            except Exception:
                pass

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
                continue
            enc_h, enc_p, enc_s = parts
            signing_input = f"{enc_h}.{enc_p}".encode('utf-8')
            sig = hmac.new(key.encode('utf-8'), signing_input, hashlib.sha256).digest()
            expected_sig = base64.urlsafe_b64encode(sig).decode('utf-8').rstrip('=')
            if not hmac.compare_digest(enc_s, expected_sig):
                continue

            payload = json.loads(b64url_decode(enc_p).decode('utf-8'))
            if "exp" in payload and payload["exp"] < datetime.now(timezone.utc).timestamp():
                continue
            return payload
        except Exception:
            continue
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
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token manquant")
    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide ou expiré")

    raw_user_id = payload.get("sub")
    user_id = str(raw_user_id)

    with get_db() as conn:
        # Validate UUIDs before querying PostgreSQL. This turns stale numeric
        # tokens into a normal auth failure instead of an unhandled 500.
        user = None
        try:
            UUID(user_id)
        except (ValueError, TypeError, AttributeError):
            pass
        else:
            user = query_one(
                conn,
                "SELECT id, email, full_name, role, steg_contract_no, is_verified FROM users WHERE id = %s",
                (user_id,)
            )
        if not user and isinstance(raw_user_id, str) and "@" in raw_user_id:
            user = query_one(
                conn,
                "SELECT id, email, full_name, role, steg_contract_no, is_verified FROM users WHERE LOWER(email) = %s",
                (raw_user_id.lower(),)
            )
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur non trouvé")
        user["id"] = str(user["id"])
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
_resend_cooldowns: Dict[str, float] = {}
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


# ---------------------------------------------------------------------------
# Password Reset Endpoints (Port 465 SMTP_SSL & 4-min single-use JWT)
# ---------------------------------------------------------------------------
from api.reset_password import send_password_reset_email

# Rate limiting for forgot-password: max 3 requests per 10 minutes per email/IP
_reset_rate_limit: Dict[str, list[float]] = {}
RESET_RATE_WINDOW_SECONDS = 600  # 10 minutes
RESET_MAX_ATTEMPTS = 3


def _check_rate_limit(key: str) -> bool:
    now_ts = datetime.now(timezone.utc).timestamp()
    timestamps = _reset_rate_limit.get(key, [])
    # Filter only timestamps within the window
    valid_timestamps = [ts for ts in timestamps if (now_ts - ts) < RESET_RATE_WINDOW_SECONDS]
    if len(valid_timestamps) >= RESET_MAX_ATTEMPTS:
        _reset_rate_limit[key] = valid_timestamps
        return False
    valid_timestamps.append(now_ts)
    _reset_rate_limit[key] = valid_timestamps
    return True


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@auth_router.post("/forgot-password")
def forgot_password_handler(req: ForgotPasswordRequest):
    """
    Initiates password recovery over SMTP Port 465 (Implicit SSL/TLS per RFC 8314).
    Issues a single-use JWT stored in the email_tokens table (4-minute expiry).
    Enforces rate limiting (3 requests per 10 minutes).
    Always returns the exact same generic response to prevent user enumeration.
    """
    email_clean = req.email.strip().lower()

    # Rate limiting
    if not _check_rate_limit(email_clean):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Trop de demandes de réinitialisation. Veuillez patienter 10 minutes avant de réessayer.",
        )

    # Generic response returned regardless of user existence
    generic_response = {
        "message": "If that email exists, a reset link has been sent.",
        "status": "success",
        "expires_in_minutes": 4,
    }

    with get_db() as conn:
        user = query_one(conn, "SELECT id, email, full_name FROM users WHERE LOWER(email) = %s", (email_clean,))
        if not user:
            print(f"[AUTH FORGOT-PASSWORD] Email '{email_clean}' not found in database. Returning generic response.")
            return generic_response

        print(f"[AUTH FORGOT-PASSWORD] User found (id={user['id']}, email={user['email']}). Generating single-use 4-min token...")
        # Issue single-use 4-minute token (stored in DB email_tokens table)
        token = issue_token(conn, user_id=user["id"], purpose="pwd_reset")

    # Construct frontend reset URL
    frontend_base = os.getenv("FRONTEND_RESET_URL") or os.getenv("FRONTENDURL") or os.getenv("FRONTEND_URL") or "http://localhost:3000"
    frontend_base = frontend_base.rstrip("/")
    if not frontend_base.endswith("/reset-password") and not frontend_base.endswith("/forgot-password"):
        reset_url = f"{frontend_base}/reset-password?token={token}"
    else:
        reset_url = f"{frontend_base}?token={token}"

    print(f"[AUTH FORGOT-PASSWORD] Reset URL constructed: {reset_url}")

    # Send email over SMTP_SSL (Port 465)
    success, send_info = send_password_reset_email(to_email=user["email"], reset_url=reset_url, recipient_name=user.get("full_name"))
    print(f"[AUTH FORGOT-PASSWORD] send_password_reset_email result: success={success}, info={send_info}")

    return {
        **generic_response,
        "email_delivered": success,
        "debug_info": send_info if not success else None,
        "reset_url": reset_url,  # Included as developer fallback
    }


@auth_router.post("/reset-password")
def reset_password_handler(req: ResetPasswordRequest):
    """
    Validates single-use 4-minute reset token, consumes it atomically from email_tokens,
    and updates user's password in database.
    """
    if len(req.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le mot de passe doit comporter au moins 6 caractères.",
        )

    with get_db() as conn:
        try:
            user_id = consume_token(conn, token=req.token, purpose="pwd_reset")
        except TokenExpired:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset link",
            )
        except TokenAlreadyUsed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset link",
            )
        except TokenInvalid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset link",
            )

        new_pw_hash = hash_password(req.new_password)
        execute_write(conn, "UPDATE users SET password_hash = %s WHERE id = %s", (new_pw_hash, user_id))

    return {
        "status": "success",
        "message": "Votre mot de passe a été mis à jour avec succès. Vous pouvez maintenant vous connecter.",
    }


