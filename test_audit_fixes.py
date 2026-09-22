import sys
import requests
import sqlite3

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("==================================================")
    print("🔍 KIRA 2.1 - SYSTEM AUDIT & OPTIMIZATION TEST SUITE")
    print("==================================================\n")

    # 1. Health check
    print("[1/5] Testing Server Health...")
    r = requests.get(f"{BASE_URL}/api/health", timeout=5)
    assert r.status_code == 200, f"Health check failed: {r.status_code}"
    print("  ✅ Server is healthy (200 OK)")

    # 2. Test /admin redirect to /admin_boss
    print("\n[2/5] Testing GET /admin Redirect...")
    r_admin = requests.get(f"{BASE_URL}/admin", allow_redirects=False, timeout=5)
    assert r_admin.status_code in (302, 307), f"Expected redirect, got {r_admin.status_code}"
    assert r_admin.headers.get("Location") == "/admin_boss", f"Unexpected location: {r_admin.headers.get('Location')}"
    print(f"  ✅ /admin successfully redirects (HTTP {r_admin.status_code}) to /admin_boss")

    # 3. Test clear_chat without session_id DOES NOT wipe user's existing database logs!
    print("\n[3/5] Testing POST /api/clear_chat Safety Guard (No Accidental History Wipe)...")
    test_user = "audit_test_user_safe"
    session_1 = "sess_001"
    
    # Insert test logs directly in database
    conn = sqlite3.connect("chat_logs.db")
    cur = conn.cursor()
    cur.execute("DELETE FROM logs WHERE username=?", (test_user,))
    cur.execute("INSERT INTO logs (username, session_id, timestamp, role, content) VALUES (?, ?, '2026-09-22 10:00:00', 'User', 'Hello session 1')", (test_user, session_1))
    cur.execute("INSERT INTO logs (username, session_id, timestamp, role, content) VALUES (?, ?, '2026-09-22 10:00:01', 'AI', 'Response session 1')", (test_user, session_1))
    conn.commit()

    # Verify logs exist
    cur.execute("SELECT count(*) FROM logs WHERE username=?", (test_user,))
    assert cur.fetchone()[0] == 2, "Failed to insert test logs"
    
    # Call /api/clear_chat WITHOUT session_id (which used to wipe everything!)
    r_clear = requests.post(f"{BASE_URL}/api/clear_chat", json={"message": "", "username": test_user}, timeout=5)
    assert r_clear.status_code == 200, f"clear_chat failed: {r_clear.status_code}"

    # Verify logs STILL exist in the database!
    cur.execute("SELECT count(*) FROM logs WHERE username=?", (test_user,))
    count_after = cur.fetchone()[0]
    conn.close()
    
    assert count_after == 2, f"CRITICAL FAILURE: clear_chat wiped logs! Found {count_after} rows instead of 2"
    print(f"  ✅ Safety Guard Verified: Existing {count_after} logs preserved when starting new chat!")

    # 4. Test Multi-Brain Router for Creative Flavor
    print("\n[4/5] Testing Multi-Brain Router (No Decommissioned Models)...")
    from app import _route_brain, BRAIN_PROFILES
    model_name, b_type, desc = _route_brain(flavor="creative")
    assert "mixtral" not in model_name, f"Decommissioned mixtral model still returned: {model_name}"
    print(f"  ✅ Creative flavor routed to modern model: {model_name} ({desc})")

    model_name_t, _, desc_t = _route_brain(flavor="fast")
    assert "gemma2" not in model_name_t, f"Decommissioned gemma2 model returned: {model_name_t}"
    print(f"  ✅ Fast flavor routed to modern model: {model_name_t} ({desc_t})")

    # 5. Clean up test user
    conn = sqlite3.connect("chat_logs.db")
    conn.execute("DELETE FROM logs WHERE username=?", (test_user,))
    conn.commit()
    conn.close()
    print("\n[5/5] Test Cleanup Complete.")

    print("\n==================================================")
    print("🎉 ALL 5 AUDIT & OPTIMIZATION TESTS PASSED (100%)!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
