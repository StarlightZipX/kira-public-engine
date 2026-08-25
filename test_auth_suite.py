import os
import sys
import sqlite3
from fastapi.testclient import TestClient
from app import app, DB_FILE, hash_password, init_db

sys.stdout.reconfigure(encoding='utf-8')

client = TestClient(app)

def run_auth_tests():
    print("==========================================================")
    print("🧪 RUNNING COMPREHENSIVE AUTHENTICATION & LOGIN AUDIT")
    print("==========================================================")
    init_db()
    
    # 1. Test clean state
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("DELETE FROM users WHERE username LIKE 'authtest_%'")
    conn.commit()
    conn.close()

    # 2. Test valid registration
    res = client.post("/api/register", json={"username": "authtest_user1", "password": "securepassword123"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success", f"Failed valid register: {data}"
    print("✅ [1/9] Valid Registration: PASS")

    # 3. Test duplicate registration
    res = client.post("/api/register", json={"username": "authtest_user1", "password": "newpassword456"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "error" and "มีคนใช้แล้ว" in data["message"]
    print("✅ [2/9] Duplicate Username Rejection: PASS")

    # 4. Test reserved names protection
    for reserved in ["boss", "admin", "administrator", "kira", "system", "👑 Boss (Owner)", "owner"]:
        res = client.post("/api/register", json={"username": reserved, "password": "password123"})
        data = res.json()
        assert data["status"] == "error" and "สงวน" in data["message"], f"Failed to block reserved name '{reserved}': {data}"
    print("✅ [3/9] Reserved System Usernames Protection: PASS")

    # 5. Test short username & password
    res = client.post("/api/register", json={"username": "ab", "password": "password123"})
    assert res.json()["status"] == "error"
    res = client.post("/api/register", json={"username": "authtest_shortpass", "password": "12"})
    assert res.json()["status"] == "error"
    print("✅ [4/9] Input Length Bounds Validation: PASS")

    # 6. Test whitespace / empty inputs
    res = client.post("/api/register", json={"username": "   ", "password": "password123"})
    assert res.json()["status"] == "error"
    res = client.post("/api/login", json={"username": "", "password": ""})
    assert res.json()["status"] == "error"
    print("✅ [5/9] Whitespace/Empty Sanitization: PASS")

    # 7. Test valid login
    res = client.post("/api/login", json={"username": "authtest_user1", "password": "securepassword123"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success" and data["username"] == "authtest_user1"
    print("✅ [6/9] Standard User Login: PASS")

    # 8. Test wrong password
    res = client.post("/api/login", json={"username": "authtest_user1", "password": "wrongpassword"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "error"
    print("✅ [7/9] Invalid Password Rejection: PASS")

    # 9. Test Boss VIP Override Login
    res = client.post("/api/login", json={"username": "👑 Boss (Owner)", "password": "kira1234"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success" and data["username"] == "👑 Boss (Owner)"
    print("✅ [8/9] Boss VIP 1-Click Login Verification: PASS")

    # 10. Test Salted SHA-256
    h1 = hash_password("mypassword")
    h2 = hash_password("mypassword")
    h3 = hash_password("otherpassword")
    assert h1 == h2 and h1 != h3 and len(h1) == 64
    print("✅ [9/9] Aegis Protocol Salted SHA-256 Hashing: PASS")

    print("\n==========================================================")
    print("🎉 ALL 9/9 AUTHENTICATION SECURITY AUDIT TESTS PASSED 100%!")
    print("==========================================================")

if __name__ == "__main__":
    run_auth_tests()
