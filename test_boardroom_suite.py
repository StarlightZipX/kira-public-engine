import sys
import requests
import json
import re

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("==================================================")
    print("🏛️ KIRA 2.2 - VIRTUAL BOARDROOM TEST SUITE")
    print("==================================================\n")

    # 1. Health check
    print("[1/4] Testing Server Health...")
    r = requests.get(f"{BASE_URL}/api/health", timeout=5)
    assert r.status_code == 200, f"Health check failed: {r.status_code}"
    print("  ✅ Server is healthy and responsive (200 OK)")

    # 2. Test Executives API
    print("\n[2/4] Testing GET /api/boardroom/executives...")
    r = requests.get(f"{BASE_URL}/api/boardroom/executives", timeout=5)
    assert r.status_code == 200, f"Executives API failed: {r.status_code}"
    data = r.json()
    assert data.get("status") == "success"
    execs = data.get("executives", [])
    assert len(execs) == 4, f"Expected 4 executives, got {len(execs)}"
    roles = [e["id"] for e in execs]
    assert set(roles) == {"CEO", "CFO", "CPO", "CTO"}
    print(f"  ✅ 4 Executives verified: {', '.join(roles)}")
    for e in execs:
        print(f"     - {e['avatar']} {e['name']}: {e['title']} ({e['badge']})")

    # 3. Test Boardroom Streaming Chat
    print("\n[3/4] Testing POST /api/chat with boardroom_mode=True...", flush=True)
    payload = {
        "message": "เราควรสร้างแอปพลิเคชัน AI ผู้ช่วยวางแผนธุรกิจสำหรับผู้ประกอบการ SME หรือไม่?",
        "username": "boss",
        "model_version": "boardroom",
        "boardroom_mode": True
    }
    r = requests.post(f"{BASE_URL}/api/chat", json=payload, stream=True, timeout=90)
    assert r.status_code == 200, f"Boardroom chat failed: {r.status_code}"

    full_text = ""
    for chunk in r.iter_content(chunk_size=None, decode_unicode=True):
        if chunk:
            full_text += chunk
            sys.stdout.write(".")
            sys.stdout.flush()

    print(f"\n  ✅ Stream completed! Received {len(full_text)} characters.", flush=True)

    # Validate Boardroom Protocol Tags
    assert "[BOARDROOM_START]" in full_text, "Missing [BOARDROOM_START] tag"
    print("  ✅ Protocol verified: [BOARDROOM_START] received")

    for role in ["CEO", "CFO", "CPO", "CTO"]:
        assert f"[BOARDROOM_SPEAKER:{role}" in full_text, f"Missing {role} speaker tag"
        print(f"  ✅ Executive speaker verified: {role}")

    assert "[BOARDROOM_DEBATE" in full_text, "Missing [BOARDROOM_DEBATE] tag"
    print("  ✅ Protocol verified: [BOARDROOM_DEBATE] cross-examination received")

    assert "[BOARDROOM_CONSENSUS" in full_text, "Missing [BOARDROOM_CONSENSUS] tag"
    print("  ✅ Protocol verified: [BOARDROOM_CONSENSUS] resolution received")

    assert "[BOARDROOM_DONE]" in full_text, "Missing [BOARDROOM_DONE] tag"
    print("  ✅ Protocol verified: [BOARDROOM_DONE] meeting closed cleanly")

    # 4. Test History Logs for Boardroom
    print("\n[4/4] Testing History Logs for Boardroom Session...")
    r = requests.get(f"{BASE_URL}/api/history/boss", timeout=5)
    assert r.status_code == 200
    history = r.json().get("history", [])
    has_boardroom = any(h.get("role") in ["Boardroom", "User (Boardroom)"] for h in history)
    assert has_boardroom, "Boardroom session was not persisted in database logs"
    print("  ✅ Boardroom session successfully persisted in SQLite logs!")

    print("\n==================================================")
    print("🎉 ALL 4 BOARDROOM TESTS PASSED (100% SUCCESS)!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
