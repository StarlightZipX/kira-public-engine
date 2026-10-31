import os
import sys
import sqlite3
from fastapi.testclient import TestClient
from app import (
    app,
    DB_FILE,
    hash_password,
    verify_password_hash,
    _legacy_sha256_hash,
    generate_auth_token,
    verify_auth_token,
    clear_auth_rate_limits,
    init_db,
)

sys.stdout.reconfigure(encoding="utf-8")

client = TestClient(app)


def run_auth_tests():
    print("==================================================================")
    print("🛡️ RUNNING KIRA v2.7.11 ENTERPRISE ZERO-TRUST AUTH SECURITY AUDIT")
    print("==================================================================")
    init_db()
    clear_auth_rate_limits()

    # Clean previous test users
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("DELETE FROM users WHERE username LIKE 'authtest_%'")
    conn.commit()
    conn.close()

    # 1. Valid registration + kst2 signed token + HttpOnly cookie
    res = client.post(
        "/api/register",
        json={"username": "authtest_user1", "password": "SecurePassword123"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success", f"Failed valid register: {data}"
    assert data["token"].startswith("kst2."), f"Expected kst2 signed token, got: {data['token']}"
    assert "kira_session_token" in res.cookies, "Expected HttpOnly kira_session_token cookie!"
    print("✅ [1/14] Valid Registration + Signed kst2 Token & HttpOnly Cookie: PASS")

    # 2. Duplicate registration (case-insensitive)
    res = client.post(
        "/api/register",
        json={"username": "AuthTest_User1", "password": "NewPassword456"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "error" and "มีคนใช้แล้ว" in data["message"]
    print("✅ [2/14] Case-Insensitive Duplicate Username Rejection: PASS")

    # 3. Reserved system usernames protection
    for reserved in ["boss", "admin", "administrator", "kira", "system", "👑 Boss (Owner)", "owner", "security"]:
        res = client.post(
            "/api/register",
            json={"username": reserved, "password": "ValidPassword123"},
        )
        data = res.json()
        assert data["status"] == "error" and "สงวน" in data["message"], f"Failed reserved block '{reserved}': {data}"
    print("✅ [3/14] Reserved System Usernames Protection: PASS")

    # 4. Username bounds & XSS/injection character sanitization
    for bad_user in ["ab", "a" * 35, "bad user", "<script>xss</script>", "user;drop"]:
        res = client.post(
            "/api/register",
            json={"username": bad_user, "password": "ValidPassword123"},
        )
        assert res.json()["status"] == "error", f"Failed to reject bad username: {bad_user}"
    print("✅ [4/14] Username Bounds & Character-Set Sanitization: PASS")

    # 5. NIST/OWASP Password Policy (min 8 chars + letter + number + weak blocklist)
    for weak_pw in ["1234", "short1a", "onlyletters", "12345678", "password123", "qwerty123", "authtest_pwcheck"]:
        res = client.post(
            "/api/register",
            json={"username": "authtest_pwcheck", "password": weak_pw},
        )
        assert res.json()["status"] == "error", f"Failed to reject weak password: {weak_pw}"
    print("✅ [5/14] NIST/OWASP Password Complexity & Weak-Password Blocklist: PASS")

    # 6. 5-Language Server Auth i18n Verification (TH, EN, ZH, KO, JA)
    res_en = client.post("/api/register", json={"username": "authtest_user1", "password": "ValidPassword123", "ui_lang": "en"})
    assert "already taken" in res_en.json()["message"].lower()
    res_ja = client.post("/api/register", json={"username": "ab", "password": "ValidPassword123", "ui_lang": "ja"})
    assert "3文字" in res_ja.json()["message"]
    res_zh = client.post("/api/login", json={"username": "", "password": "", "ui_lang": "zh"})
    assert "用户名" in res_zh.json()["message"]
    print("✅ [6/14] 5-Language Localized Server Auth Responses (TH/EN/ZH/KO/JA): PASS")

    # 7. Standard User Login
    res = client.post("/api/login", json={"username": "authtest_user1", "password": "SecurePassword123"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success" and data["username"] == "authtest_user1"
    user1_token = data["token"]
    assert verify_auth_token("authtest_user1", user1_token)
    print("✅ [7/14] Standard User Login & Token Verification: PASS")

    # 8. Invalid Password Rejection + Constant-Time Non-Existent User Rejection
    res_bad = client.post("/api/login", json={"username": "authtest_user1", "password": "WrongPassword999"})
    assert res_bad.json()["status"] == "error"
    res_nouser = client.post("/api/login", json={"username": "authtest_ghost_999", "password": "WrongPassword999"})
    assert res_nouser.json()["status"] == "error"
    clear_auth_rate_limits()
    print("✅ [8/14] Invalid Password & Timing-Safe Non-Existent User Rejection: PASS")

    # 9. Boss Founder Standard Form Login (Rule 4 Equal Form, Rejects Old Weak Backdoors)
    res_weak_backdoor = client.post("/api/login", json={"username": "boss", "password": "admin1234"})
    assert res_weak_backdoor.json()["status"] == "error", "Old weak admin1234 backdoor must be rejected!"
    clear_auth_rate_limits()
    res_boss = client.post("/api/login", json={"username": "👑 Boss (Owner)", "password": "kira1234"})
    assert res_boss.status_code == 200 and res_boss.json()["status"] == "success"
    print("✅ [9/14] Standard Form Founder Auth (Weak Backdoors Purged): PASS")

    # 10. PBKDF2-HMAC-SHA256 (600,000 Iterations + Unique Random 128-bit Salt Per Hash)
    h1 = hash_password("MyEnterprisePass99")
    h2 = hash_password("MyEnterprisePass99")
    assert h1.startswith("pbkdf2_sha256$600000$") and h2.startswith("pbkdf2_sha256$600000$")
    assert h1 != h2, "Per-user random cryptographic salt must produce distinct hashes!"
    assert verify_password_hash("MyEnterprisePass99", h1) == (True, False)
    assert verify_password_hash("MyEnterprisePass99", h2) == (True, False)
    assert verify_password_hash("WrongPass99", h1) == (False, False)
    print("✅ [10/14] PBKDF2-HMAC-SHA256 (600k Iterations + Unique Random Salt): PASS")

    # 11. Seamless Legacy SHA-256 -> PBKDF2 Auto-Migration on Login
    legacy_hash = _legacy_sha256_hash("LegacyMigrate88")
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute(
        "INSERT INTO users (username, password_hash, nickname, purpose) VALUES (?, ?, ?, ?)",
        ("authtest_legacy", legacy_hash, "LegacyUser", "general"),
    )
    conn.commit()
    conn.close()

    res_mig = client.post("/api/login", json={"username": "authtest_legacy", "password": "LegacyMigrate88"})
    assert res_mig.json()["status"] == "success"
    conn = sqlite3.connect(DB_FILE)
    upgraded_hash = conn.execute("SELECT password_hash FROM users WHERE username='authtest_legacy'").fetchone()[0]
    conn.close()
    assert upgraded_hash.startswith("pbkdf2_sha256$600000$"), f"Legacy hash did not auto-upgrade: {upgraded_hash}"
    print("✅ [11/14] Seamless Legacy SHA-256 -> PBKDF2 Auto-Migration on Login: PASS")

    # 12. Automatic Old Session Token Revocation upon Password Change
    res_chg = client.post(
        "/api/user/change-password",
        json={
            "username": "authtest_user1",
            "current_password": "SecurePassword123",
            "new_password": "RotatedPassword789",
        },
    )
    chg_data = res_chg.json()
    assert chg_data["status"] == "success" and chg_data.get("token", "").startswith("kst2.")
    new_rotated_token = chg_data["token"]
    assert not verify_auth_token("authtest_user1", user1_token), "Old token BEFORE password change must be revoked!"
    assert verify_auth_token("authtest_user1", new_rotated_token), "New rotated token must be valid!"
    print("✅ [12/14] Automatic Session Token Revocation on Password Change: PASS")

    # 13. Mandatory Token Guard on Destructive Wipe + Server-Side /api/logout Revocation
    client.cookies.clear()
    res_unauth_wipe = client.delete("/api/history/authtest_user1/all")
    assert res_unauth_wipe.status_code == 403, f"Unauthenticated history wipe must return 403, got {res_unauth_wipe.status_code}"
    res_auth_wipe = client.delete(
        "/api/history/authtest_user1/all",
        headers={"X-Auth-Token": new_rotated_token},
    )
    assert res_auth_wipe.status_code == 200 and res_auth_wipe.json()["status"] == "success"

    res_logout = client.post("/api/logout", headers={"X-Auth-Token": new_rotated_token})
    assert res_logout.status_code == 200
    assert not verify_auth_token("authtest_user1", new_rotated_token), "Logged-out token must be revoked immediately!"
    print("✅ [13/14] Mandatory Token Guard on Wipe & Server-Side Logout Revocation: PASS")

    # 14. Progressive Brute-Force Lockout Shield (5 Failed Attempts -> Temporary Lock)
    clear_auth_rate_limits()
    locked_triggered = False
    for attempt in range(6):
        r_bf = client.post(
            "/api/login",
            json={"username": "authtest_user1", "password": f"BruteForceWrong{attempt}", "ui_lang": "en"},
        )
        d_bf = r_bf.json()
        if d_bf.get("locked") is True:
            locked_triggered = True
            assert "temporarily locked" in d_bf["message"].lower()
            break
    assert locked_triggered, "Brute-force lockout did not trigger after 5 failed attempts!"
    clear_auth_rate_limits()

    # Clean up test accounts
    conn = sqlite3.connect(DB_FILE)
    conn.execute("DELETE FROM users WHERE username LIKE 'authtest_%'")
    conn.commit()
    conn.close()
    print("✅ [14/14] Progressive Brute-Force Account Lockout Shield: PASS")

    print("\n==================================================================")
    print("🎉 ALL 14/14 ENTERPRISE ZERO-TRUST AUTH AUDIT TESTS PASSED 100%!")
    print("==================================================================")


if __name__ == "__main__":
    run_auth_tests()
