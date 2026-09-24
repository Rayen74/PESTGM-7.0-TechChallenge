"""
Comprehensive Test Suite for JWT Email Token:
1. Use once: success
2. Reuse: TokenAlreadyUsed
3. Expired: TokenExpired
4. Resend, then use the old token: rejected (TokenInvalid / revoked)
5. Tampered token, wrong secret, alg: none: TokenInvalid
6. Two simultaneous uses: exactly one succeeds
"""

import sys
import time
import uuid
import threading
from pathlib import Path
from datetime import datetime, timedelta, timezone

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from api.database import get_db, execute_write, query_one, init_db
from api.email_tokens import (
    issue_token,
    consume_token,
    _encode_jwt,
    _decode_jwt,
    TokenExpired,
    TokenInvalid,
    TokenAlreadyUsed,
    EMAIL_JWT_SECRET,
)


def run_all_tests():
    print("==================================================================")
    print("STARTING JWT EMAIL TOKEN VERIFICATION TEST SUITE")
    print("==================================================================")

    init_db()

    # Create dummy user for test
    test_email = f"test_token_user_{uuid.uuid4().hex[:8]}@steg.tn"
    with get_db() as conn:
        execute_write(
            conn,
            "INSERT INTO users (email, password_hash, full_name, role, is_verified) VALUES (%s, %s, %s, %s, FALSE)",
            (test_email, "hash123", "Citoyen Test", "CITIZEN"),
        )
        user = query_one(conn, "SELECT id, email, is_verified FROM users WHERE email = %s", (test_email,))
        user_id = user["id"]

    print(f"[Setup] Created test user id: {user_id}, email: {test_email}")

    # -------------------------------------------------------------------------
    # Test 1: Use once: success
    # -------------------------------------------------------------------------
    print("\n--- Test 1: Single Use (Success) ---")
    with get_db() as conn:
        token1 = issue_token(conn, user_id=user_id, purpose="verify_email")
    print("Issued token successfully (exp = now + 4 min).")

    with get_db() as conn:
        consumed_uid = consume_token(conn, token1, purpose="verify_email")
        assert consumed_uid == user_id, f"Expected {user_id}, got {consumed_uid}"
        # Mark user verified
        execute_write(conn, "UPDATE users SET is_verified = TRUE WHERE id = %s", (consumed_uid,))
        usr = query_one(conn, "SELECT is_verified FROM users WHERE id = %s", (user_id,))
        assert bool(usr["is_verified"]) is True, "User should be verified"

    print("PASS: Test 1 - Token redeemed once and user verified successfully.")

    # -------------------------------------------------------------------------
    # Test 2: Reuse: TokenAlreadyUsed
    # -------------------------------------------------------------------------
    print("\n--- Test 2: Token Reuse ---")
    reused_ok = False
    try:
        with get_db() as conn:
            consume_token(conn, token1, purpose="verify_email")
    except TokenAlreadyUsed as e:
        reused_ok = True
        print(f"Caught expected TokenAlreadyUsed: {e}")

    assert reused_ok, "Expected TokenAlreadyUsed upon second consumption"
    print("PASS: Test 2 - Reusing consumed token raises TokenAlreadyUsed.")

    # -------------------------------------------------------------------------
    # Test 3: Expired: TokenExpired
    # -------------------------------------------------------------------------
    print("\n--- Test 3: Expired Token ---")
    expired_jti = str(uuid.uuid4())
    past_now = datetime.now(timezone.utc) - timedelta(minutes=10)
    past_exp = past_now + timedelta(minutes=4)  # Expired 6 minutes ago

    with get_db() as conn:
        execute_write(
            conn,
            "INSERT INTO email_tokens (jti, user_id, purpose, expires_at, used_at) VALUES (%s, %s, %s, %s, NULL)",
            (expired_jti, user_id, "verify_email", past_exp),
        )

    expired_payload = {
        "sub": str(user_id),
        "jti": expired_jti,
        "purpose": "verify_email",
        "iat": int(past_now.timestamp()),
        "exp": int(past_exp.timestamp()),
    }
    expired_token = _encode_jwt(expired_payload, EMAIL_JWT_SECRET)

    expired_ok = False
    try:
        with get_db() as conn:
            consume_token(conn, expired_token, purpose="verify_email")
    except TokenExpired as e:
        expired_ok = True
        print(f"Caught expected TokenExpired: {e}")

    assert expired_ok, "Expected TokenExpired exception for token past exp"
    print("PASS: Test 3 - Expired token was correctly rejected.")

    # -------------------------------------------------------------------------
    # Test 4: Resend, then use the old token: rejected
    # -------------------------------------------------------------------------
    print("\n--- Test 4: Resend Invalidates Old Unused Token ---")
    with get_db() as conn:
        first_token = issue_token(conn, user_id=user_id, purpose="verify_email")

    # Resend: issue new token for same user & purpose
    with get_db() as conn:
        second_token = issue_token(conn, user_id=user_id, purpose="verify_email")

    # Trying to consume first_token should be rejected
    old_rejected = False
    try:
        with get_db() as conn:
            consume_token(conn, first_token, purpose="verify_email")
    except (TokenAlreadyUsed, TokenInvalid) as e:
        old_rejected = True
        print(f"Caught expected rejection for invalidated old token: {e}")

    assert old_rejected, "Old token was not rejected after resend"

    # Consuming the second (new) token should succeed
    with get_db() as conn:
        res_uid = consume_token(conn, second_token, purpose="verify_email")
        assert res_uid == user_id

    print("PASS: Test 4 - Resending invalidated older token; new token redeemed successfully.")

    # -------------------------------------------------------------------------
    # Test 5: Tampered token, wrong secret, alg: none: TokenInvalid
    # -------------------------------------------------------------------------
    print("\n--- Test 5: Tampering, Wrong Secret, and alg: none ---")
    # 5a: Wrong Secret
    wrong_secret_token = _encode_jwt(
        {
            "sub": str(user_id),
            "jti": str(uuid.uuid4()),
            "purpose": "verify_email",
            "iat": int(datetime.now(timezone.utc).timestamp()),
            "exp": int((datetime.now(timezone.utc) + timedelta(minutes=4)).timestamp()),
        },
        "wrong-secret-key-000",
    )
    wrong_secret_ok = False
    try:
        with get_db() as conn:
            consume_token(conn, wrong_secret_token, purpose="verify_email")
    except TokenInvalid as e:
        wrong_secret_ok = True
        print(f"5a. Wrong secret rejected as expected: {e}")
    assert wrong_secret_ok, "Wrong secret was not rejected"

    # 5b: Tampered payload
    parts = second_token.split(".")
    tampered_token = f"{parts[0]}.eyJhZG1pbiI6dHJ1ZX0.{parts[2]}"
    tampered_ok = False
    try:
        with get_db() as conn:
            consume_token(conn, tampered_token, purpose="verify_email")
    except TokenInvalid as e:
        tampered_ok = True
        print(f"5b. Tampered payload rejected as expected: {e}")
    assert tampered_ok, "Tampered token was not rejected"

    # 5c: alg: none attack
    import base64
    def b64url(s: str) -> str:
        return base64.urlsafe_b64encode(s.encode()).decode().rstrip("=")
    none_header = b64url('{"alg":"none","typ":"JWT"}')
    none_payload = b64url(f'{{"sub":"{user_id}","jti":"{uuid.uuid4()}","purpose":"verify_email"}}')
    alg_none_token = f"{none_header}.{none_payload}."

    none_ok = False
    try:
        with get_db() as conn:
            consume_token(conn, alg_none_token, purpose="verify_email")
    except TokenInvalid as e:
        none_ok = True
        print(f"5c. alg: none attack rejected as expected: {e}")
    assert none_ok, "alg: none attack was not rejected"

    # 5d: Purpose mismatch
    with get_db() as conn:
        pwd_token = issue_token(conn, user_id=user_id, purpose="password_reset")
    mismatch_ok = False
    try:
        with get_db() as conn:
            consume_token(conn, pwd_token, purpose="verify_email")
    except TokenInvalid as e:
        mismatch_ok = True
        print(f"5d. Purpose mismatch rejected as expected: {e}")
    assert mismatch_ok, "Purpose mismatch was not rejected"

    print("PASS: Test 5 - Tampered token, wrong secret, alg: none, and purpose mismatch all raise TokenInvalid.")

    # -------------------------------------------------------------------------
    # Test 6: Two simultaneous uses: exactly one succeeds
    # -------------------------------------------------------------------------
    print("\n--- Test 6: Concurrency Race Condition (Two simultaneous uses) ---")
    with get_db() as conn:
        race_token = issue_token(conn, user_id=user_id, purpose="verify_email")

    results = []
    errors = []

    def attempt_consume():
        try:
            with get_db() as conn:
                uid = consume_token(conn, race_token, purpose="verify_email")
                results.append(uid)
        except Exception as err:
            errors.append(err)

    t1 = threading.Thread(target=attempt_consume)
    t2 = threading.Thread(target=attempt_consume)

    t1.start()
    t2.start()

    t1.join()
    t2.join()

    print(f"Concurrent attempt results: {len(results)} success, {len(errors)} error(s)")
    for err in errors:
        print(f"  Concurrent caught error: {type(err).__name__}: {err}")

    assert len(results) == 1, f"Expected exactly 1 success, got {len(results)}"
    assert len(errors) == 1, f"Expected exactly 1 error, got {len(errors)}"
    assert isinstance(errors[0], TokenAlreadyUsed), f"Expected TokenAlreadyUsed, got {errors[0]}"

    print("PASS: Test 6 - Exactly one thread consumed token; second raised TokenAlreadyUsed.")

    print("\n==================================================================")
    print("ALL TESTS PASSED WITH 100% SUCCESS!")
    print("==================================================================")


if __name__ == "__main__":
    run_all_tests()
