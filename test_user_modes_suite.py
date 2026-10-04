import sqlite3
import json
import pytest
from fastapi.testclient import TestClient
from app import app, DB_FILE, init_db
DB_PATH = DB_FILE

def test_database_schema_has_user_mode():
    init_db()
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(user_preferences)")
        columns = [row[1] for row in cursor.fetchall()]
        assert "user_mode" in columns, f"Column 'user_mode' missing from user_preferences: {columns}"

def test_settings_user_mode_persistence():
    init_db()
    test_user = "test_mode_user"
    
    # Ensure test user exists
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)", (test_user, "fakehash"))
        conn.commit()

    client = TestClient(app)
    
    # Test GET settings default
    get_res = client.get(f"/api/user/settings/{test_user}")
    assert get_res.status_code == 200
    get_data = get_res.json()
    assert get_data["status"] == "success"
    assert "user_mode" in get_data["preferences"]
    
    # Test POST save settings with silver_care mode
    save_payload = {
        "username": test_user,
        "user_mode": "silver_care",
        "chat_font_size": "extra_large"
    }
    save_res = client.post("/api/user/settings", json=save_payload)
    assert save_res.status_code == 200
    save_data = save_res.json()
    assert save_data["status"] == "success"
    
    # Verify in DB
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT user_mode, font_size FROM user_preferences WHERE username = ?", (test_user,))
        row = cursor.fetchone()
        assert row is not None
        assert row[0] == "silver_care"
        assert row[1] == "extra_large"

def test_template_and_static_assets_contain_mode_elements():
    with open("templates/index.html", "r", encoding="utf-8") as f:
        html = f.read()
    assert "user-mode-switcher-wrapper" in html
    assert "silver-voice-pill" in html
    assert "setting-user-mode" in html
    assert "extra_large" in html

    with open("static/style.css", "r", encoding="utf-8") as f:
        css = f.read()
    assert ".user-mode-pill-group" in css
    assert ".silver-voice-pill" in css
    assert "body.mode-silver-care" in css
    assert "body.chat-font-extra_large" in css

    with open("static/script.js", "r", encoding="utf-8") as f:
        js = f.read()
    assert "MODE_QUICK_PROMPTS" in js
    assert "renderQuickPromptsForMode" in js
    assert "setUserMode" in js
    assert "initUserModeController" in js
    assert "silver-voice-pill" in js

if __name__ == "__main__":
    print("Running Age-Adaptive User Modes Test Suite...")
    test_database_schema_has_user_mode()
    print("PASS: Database schema includes user_mode")
    test_settings_user_mode_persistence()
    print("PASS: Settings user_mode persistence verified")
    test_template_and_static_assets_contain_mode_elements()
    print("PASS: Template, CSS, and JS assets verified")
    print("ALL TESTS PASSED SUCCESSFULLY! 🚀")
