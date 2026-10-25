"""
==============================================================================
🧪 KIRA ON LINE OFFICIAL ACCOUNT - COMPREHENSIVE WEBHOOK TEST SUITE
==============================================================================
Tests all components of Kira's LINE Messaging API integration:
1. Health status endpoint (GET /api/line/webhook)
2. HMAC-SHA256 signature verification (Valid & Tampered)
3. LINE Developers Console empty-events verification ping
4. Smart keyword handlers:
   - Payment/Subscription keyword -> Boss real account & package rates
   - Web platform keyword -> Full website URL & features
   - Help/Guide keyword -> Quick start instructions
5. Conversation logging into SQLite/PostgreSQL `logs` table
==============================================================================
"""

import sys
import os
import json
import hmac
import hashlib
import base64
import asyncio

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

from fastapi.testclient import TestClient
from app import app, verify_line_signature, process_line_chat_event, execute_query, LINE_CHANNEL_SECRET

client = TestClient(app)

def test_line_health_endpoint():
    print("\n[TEST 1] Testing GET /api/line/webhook Health Check...")
    resp = client.get("/api/line/webhook")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    assert data.get("status") == "online"
    assert "LINE Official Account" in data.get("service")
    assert data.get("version") == "2.6.5"
    print(f"  ✅ Status: {data.get('status')} | Service: {data.get('service')} | Version: {data.get('version')}")

def test_signature_verification_logic():
    print("\n[TEST 2] Testing HMAC-SHA256 Signature Verification...")
    test_secret = "test_channel_secret_kira_2026"
    test_body = b'{"events": []}'
    
    # Compute signature
    sig = base64.b64encode(hmac.new(test_secret.encode('utf-8'), test_body, hashlib.sha256).digest()).decode('utf-8')
    
    # Temporarily set secret in app module for test
    import app as app_module
    old_secret = app_module.LINE_CHANNEL_SECRET
    try:
        app_module.LINE_CHANNEL_SECRET = test_secret
        
        # Valid signature
        assert app_module.verify_line_signature(test_body, sig) is True, "Valid signature failed"
        print("  ✅ Valid signature successfully accepted.")
        
        # Invalid signature
        tampered_sig = base64.b64encode(b"tampered_signature_bytes").decode('utf-8')
        assert app_module.verify_line_signature(test_body, tampered_sig) is False, "Invalid signature was accepted"
        print("  ✅ Invalid signature successfully rejected.")
        
        # Tampered body
        tampered_body = b'{"events": [{"type": "attack"}]}'
        assert app_module.verify_line_signature(tampered_body, sig) is False, "Tampered body was accepted"
        print("  ✅ Tampered body successfully rejected.")
    finally:
        app_module.LINE_CHANNEL_SECRET = old_secret

def test_line_developer_console_verify_ping():
    print("\n[TEST 3] Testing LINE Console Verification Ping (Empty Events)...")
    payload = {"destination": "U1234567890", "events": []}
    resp = client.post("/api/line/webhook", json=payload)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    assert data.get("status") == "ok"
    assert "Webhook verified successfully" in data.get("message")
    print(f"  ✅ LINE verification response: {data}")

def test_keyword_responses_and_logging():
    print("\n[TEST 4] Testing Smart Keyword Handlers & Boss Account Guardrail...")
    import app as app_module
    
    test_user_id = "test_user_line_999"
    line_username = f"line_{test_user_id}"
    
    # 4.1 Payment Keyword Test
    captured_replies = []
    async def mock_send_reply(reply_token, messages):
        captured_replies.extend(messages)
        return True
    
    orig_reply = app_module.send_line_reply
    app_module.send_line_reply = mock_send_reply
    
    try:
        # Test Payment Keyword
        asyncio.run(app_module.process_line_chat_event("ขอโปรโมชั่นและเลขบัญชีโอนเงินหน่อยครับ", "token_123", test_user_id))
        assert len(captured_replies) > 0, "No reply sent for payment keyword"
        pay_reply = captured_replies[-1]
        
        # Verify Privacy & Security First: Boss personal info must NEVER be exposed
        assert "004-9-99252-5" not in pay_reply, "KBANK account leaked!"
        assert "ศิวัช" not in pay_reply, "Boss name leaked!"
        assert "004999252517585" not in pay_reply, "PromptPay leaked!"
        assert "บัญชีจริงของบอส" not in pay_reply, "Internal debug wording leaked!"
        assert "https://kira-public-engine.onrender.com/" in pay_reply, "Official portal link missing"
        
        # Verify Consumer Protection: Absolutely NO false "Lifetime" or "ตลอดชีพ" claims
        assert "ตลอดชีพ" not in pay_reply or "ไม่ใช่แพ็กเกจตลอดชีพ" in pay_reply, "Deceptive lifetime claim found!"
        assert "Founder Lifetime" not in pay_reply, "Founder Lifetime label must not exist!"
        assert "Starter Pass" in pay_reply and "39 บาท" in pay_reply, "Starter Pass 39 THB missing!"
        assert "Kira Pro" in pay_reply and "129 บาท" in pay_reply, "Kira Pro 129 THB missing!"
        assert "Founder Pass" in pay_reply and "499 บาท" in pay_reply, "Founder Pass 499 THB missing!"
        assert "365 วัน" in pay_reply or "1 ปีเต็ม" in pay_reply, "Founder 365 days duration missing!"
        print("  ✅ Truth-in-Advertising & Privacy Verified: 100% accurate plans (Starter 39, Pro 129, Founder 499/1yr - Zero Lifetime claims).")
        
        # Test Web Keyword
        captured_replies.clear()
        asyncio.run(app_module.process_line_chat_event("ขอลิงก์หน้าเว็บหน่อย", "token_124", test_user_id))
        assert len(captured_replies) > 0
        web_reply = captured_replies[-1]
        assert "https://kira-public-engine.onrender.com/" in web_reply
        assert "Boardroom" in web_reply or "Canvas" in web_reply
        print("  ✅ Web keyword returned full portal link & boardroom/canvas features.")
        
        # Test Help Keyword
        captured_replies.clear()
        asyncio.run(app_module.process_line_chat_event("?", "token_125", test_user_id))
        assert len(captured_replies) > 0
        help_reply = captured_replies[-1]
        assert "คิระ" in help_reply
        print("  ✅ Help keyword returned friendly guide and instructions.")
        
        # Verify Database Logging
        rows = execute_query("SELECT role, content FROM logs WHERE username = ? ORDER BY id DESC LIMIT 6", (line_username,), fetch='all')
        assert rows is not None and len(rows) >= 3, f"Expected logs for {line_username}, got {rows}"
        print(f"  ✅ Database logs verified: Found {len(rows)} recorded interactions for {line_username}.")
        
    finally:
        app_module.send_line_reply = orig_reply

def test_webhook_post_flow():
    print("\n[TEST 5] Testing POST /api/line/webhook with Incoming Message Event...")
    payload = {
        "destination": "U1234567890",
        "events": [
            {
                "type": "message",
                "message": {
                    "type": "text",
                    "id": "msg_001",
                    "text": "สวัสดีครับคิระ"
                },
                "timestamp": 1700000000000,
                "source": {
                    "type": "user",
                    "userId": "Utestuser123"
                },
                "replyToken": "mock_reply_token_abc"
            }
        ]
    }
    resp = client.post("/api/line/webhook", json=payload)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    assert data.get("status") == "ok"
    assert data.get("processed_events") == 1
    print(f"  ✅ Webhook accepted event and returned 200 OK immediately: {data}")

def test_follow_and_diagnostics_flow():
    print("\n[TEST 6] Testing Follow Event & Diagnostics Telemetry Endpoint...")
    follow_payload = {
        "destination": "U1234567890",
        "events": [
            {
                "type": "follow",
                "timestamp": 1700000000000,
                "source": {
                    "type": "user",
                    "userId": "Ufollow_user_456"
                },
                "replyToken": "mock_follow_token_xyz"
            }
        ]
    }
    resp = client.post("/api/line/webhook", json=follow_payload)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    
    # Check diagnostics endpoint
    diag_resp = client.get("/api/line/diagnostics")
    assert diag_resp.status_code == 200, f"Expected 200, got {diag_resp.status_code}"
    diag_data = diag_resp.json()
    assert diag_data.get("status") == "online"
    assert "diagnostics" in diag_data
    diagnostics = diag_data["diagnostics"]
    assert diagnostics["total_webhooks_received"] >= 2
    assert len(diagnostics["recent_logs"]) >= 2
def test_thinking_sanitization_and_privacy_armor():
    print("\n[TEST 7] Testing Anti-Leak Thinking Sanitizer & Boss Privacy Armor...")
    import app as app_module
    from app import sanitize_ai_reply_for_chat, scrub_sensitive_output
    
    # 7.1 Verify Boss Screenshot leak is 100% stripped
    boss_leak = (
        '[THINKING]The user says "ทดสอบระบบหน่อย ลองทักทายมาสิ" twice. They want a greeting. '
        'According to developer instruction, respond as "คิระ" in Thai, use "หนู" or "คิระ", '
        'end with "ค่ะ/นะคะ". Provide greeting. Should not reveal personal data. Just greet. [/THINKING][THINKING_DONE]\n\n'
        'สวัสดีค่ะ! ยินดีต้อนรับสู่ Kira AI คิระ พร้อมช่วยเหลือคุณทุกเรื่องนะคะ 😊'
    )
    cleaned1 = sanitize_ai_reply_for_chat(boss_leak)
    assert "[THINKING]" not in cleaned1, "THINKING tag leaked!"
    assert "[/THINKING]" not in cleaned1, "/THINKING tag leaked!"
    assert "[THINKING_DONE]" not in cleaned1, "THINKING_DONE leaked!"
    assert "developer instruction" not in cleaned1, "Developer instruction text leaked!"
    assert "The user says" not in cleaned1, "Internal prompt text leaked!"
    assert cleaned1 == "สวัสดีค่ะ! ยินดีต้อนรับสู่ Kira AI คิระ พร้อมช่วยเหลือคุณทุกเรื่องนะคะ 😊"
    print("  ✅ Case 1: Boss Screenshot Leak stripped cleanly to 100% polite greeting.")

    # 7.2 Verify DeepSeek <think> tag
    deepseek_leak = "<think>Analyze query: greeting</think>สวัสดีค่ะ หนูคิระพร้อมช่วยเหลือนายท่านค่ะ"
    cleaned2 = sanitize_ai_reply_for_chat(deepseek_leak)
    assert "<think>" not in cleaned2 and "</think>" not in cleaned2
    assert cleaned2 == "สวัสดีค่ะ หนูคิระพร้อมช่วยเหลือนายท่านค่ะ"
    print("  ✅ Case 2: DeepSeek <think> reasoning stripped.")

    # 7.3 Verify Boss Personal Data Protection (Rule 3)
    leaked_data = "โอนเข้าบัญชี 004-9-99252-5 นาย ศิวัช รอสวัสดิ์ พร้อมเพย์ 004999252517585"
    cleaned3 = sanitize_ai_reply_for_chat(leaked_data)
    assert "004-9-99252-5" not in cleaned3
    assert "ศิวัช รอสวัสดิ์" not in cleaned3
    assert "004999252517585" not in cleaned3
    assert "[REDACTED_ACCOUNT]" in cleaned3
    assert "[REDACTED_NAME]" in cleaned3
    assert "[REDACTED_PROMPTPAY]" in cleaned3
    print("  ✅ Case 3: Boss personal banking data armored & auto-redacted.")

    # 7.4 Verify send_line_reply defense-in-depth sanitization
    captured_payloads = []
    async def mock_post(url, headers=None, json=None):
        class MockResp:
            status_code = 200
            text = "OK"
        captured_payloads.append(json)
        return MockResp()

    import httpx
    orig_async_client = httpx.AsyncClient
    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            pass
        async def post(self, url, headers=None, json=None):
            return await mock_post(url, headers, json)

    httpx.AsyncClient = MockAsyncClient
    orig_token = app_module.LINE_CHANNEL_ACCESS_TOKEN
    app_module.LINE_CHANNEL_ACCESS_TOKEN = "mock_test_access_token_123"
    try:
        # Send raw message with thinking tags directly to send_line_reply
        raw_msg_with_thinking = "[THINKING]Reasoning[/THINKING][THINKING_DONE]สวัสดีค่ะบอส"
        res = asyncio.run(app_module.send_line_reply("mock_token_777", [raw_msg_with_thinking]))
        assert res is True, "send_line_reply returned False"
        assert len(captured_payloads) > 0, "No payload captured"
        sent_text = captured_payloads[-1]["messages"][0]["text"]
        assert sent_text == "สวัสดีค่ะบอส", f"send_line_reply failed to sanitize! Got: {sent_text}"
        assert "[THINKING]" not in sent_text
        print("  ✅ Case 4: send_line_reply defense-in-depth confirmed.")
    finally:
        httpx.AsyncClient = orig_async_client
        app_module.LINE_CHANNEL_ACCESS_TOKEN = orig_token


if __name__ == "__main__":
    print("=" * 70)
    print("🚀 RUNNING KIRA LINE OFFICIAL ACCOUNT TEST SUITE")
    print("=" * 70)
    
    try:
        test_line_health_endpoint()
        test_signature_verification_logic()
        test_line_developer_console_verify_ping()
        test_keyword_responses_and_logging()
        test_webhook_post_flow()
        test_follow_and_diagnostics_flow()
        test_thinking_sanitization_and_privacy_armor()
        print("\n" + "=" * 70)
        print("🎉 ALL TESTS PASSED SUCCESSFULLY! (100% VERIFIED)")
        print("=" * 70)
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as ex:
        print(f"\n❌ UNEXPECTED ERROR: {ex}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
