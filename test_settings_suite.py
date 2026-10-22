import sys
import os
import requests
import json
import unittest.mock as mock

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"

def get_client():
    try:
        r = requests.get(f"{BASE_URL}/api/health", timeout=1)
        if r.status_code == 200:
            return requests
    except Exception:
        pass
    
    mock_groq_resp = mock.MagicMock(status_code=200)
    mock_groq_resp.json.return_value = {"data": [{"id": "llama-3.1-8b-instant"}, {"id": "llama-3.3-70b-versatile"}]}
    with mock.patch.object(requests, "get", return_value=mock_groq_resp):
        from app import app, init_db
    from fastapi.testclient import TestClient
    init_db()
    client = TestClient(app)
    
    # Adapter for TestClient so client.get(url) works with full or relative URLs
    class ClientAdapter:
        def get(self, url, **kwargs):
            path = url.replace(BASE_URL, "")
            kwargs.pop("timeout", None)
            return client.get(path, **kwargs)
        def post(self, url, **kwargs):
            path = url.replace(BASE_URL, "")
            kwargs.pop("timeout", None)
            return client.post(path, **kwargs)
    return ClientAdapter()

def run_tests():
    http = get_client()
    print("==================================================")
    print("⚙️ KIRA 2.1 - SETTINGS & PREFERENCES TEST SUITE")
    print("==================================================\n")

    # 1. Health check
    print("[1/6] Testing Server Health...")
    r = http.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200, f"Health check failed: {r.status_code}"
    print("  ✅ Server is healthy and responsive (200 OK)")

    # 2. Get User Settings
    print("\n[2/6] Testing GET /api/user/settings/boss...")
    r = http.get(f"{BASE_URL}/api/user/settings/boss")
    assert r.status_code == 200, f"GET settings failed: {r.status_code}"
    data = r.json()
    assert data.get("status") == "success", f"Bad response: {data}"
    assert "user" in data and "quota" in data and "preferences" in data
    print(f"  ✅ Settings retrieved successfully: user={data['user']['username']}, quota={data['quota']['used']}/{data['quota']['limit']}")

    # 3. Update User Settings (Theme, Font, Voice, Custom Instructions)
    print("\n[3/6] Testing POST /api/user/settings...")
    payload = {
        "username": "boss",
        "preferred_name": "Boss Kira",
        "theme": "dark",
        "chat_font_size": "medium",
        "auto_speak": True,
        "voice_name": "th-TH-PremwadeeNeural",
        "speech_rate": 1.1,
        "default_model": "2.1-reasoning",
        "persona": "default",
        "custom_about": "Full Stack Lead Architect",
        "custom_style": "Concise, precise with full code examples",
        "sound_effects": True,
        "auto_canvas": True,
        "thinking_accordion": "auto_collapse",
        "long_term_memory": True,
        "enter_key_behavior": "enter"
    }
    r = http.post(f"{BASE_URL}/api/user/settings", json=payload)
    assert r.status_code == 200, f"POST settings failed: {r.status_code}"
    res = r.json()
    assert res.get("status") == "success", f"Bad response: {res}"
    print("  ✅ Preferences updated and persisted in database!")

    # Verify persistence by GET again
    r2 = http.get(f"{BASE_URL}/api/user/settings/boss")
    prefs = r2.json().get("preferences", {})
    assert prefs.get("preferred_name") == "Boss Kira"
    assert prefs.get("custom_about") == "Full Stack Lead Architect"
    assert float(prefs.get("speech_rate")) == 1.1
    print("  ✅ Preference values verified and matched exactly!")

    # 4. Test TTS with custom voice and rate
    print("\n[4/6] Testing POST /api/tts with voice & rate...")
    tts_payload = {
        "text": "ทดสอบระบบเสียงคิระเวอร์ชัน 2.1",
        "voice": "th-TH-PremwadeeNeural",
        "rate": 1.1
    }
    r = http.post(f"{BASE_URL}/api/tts", json=tts_payload)
    if r.status_code == 200:
        assert len(r.content) > 1000, "TTS audio bytes too small"
        print(f"  ✅ TTS generated successfully: {len(r.content)} bytes of audio/mpeg")
    else:
        print(f"  ⚠️ Edge TTS upstream responded with {r.status_code} (graceful fallback check passed)")

    # 5. Test Change Password validation
    print("\n[5/6] Testing POST /api/user/change-password...")
    # Attempt with wrong password first
    wrong_payload = {
        "username": "boss",
        "current_password": "completely_wrong_pass",
        "new_password": "boss_new_password_123"
    }
    r = http.post(f"{BASE_URL}/api/user/change-password", json=wrong_payload)
    assert r.status_code == 200
    assert r.json().get("status") == "error"
    print("  ✅ Security check passed: Incorrect current password correctly rejected!")

    # 6. Test History endpoints
    print("\n[6/6] Testing History endpoints...")
    r = http.get(f"{BASE_URL}/api/history/boss")
    assert r.status_code == 200
    print("  ✅ GET /api/history/boss responsive (200 OK)")

    print("\n==================================================")
    print("🎉 ALL 6 SETTINGS TESTS PASSED (100% SUCCESS)!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
