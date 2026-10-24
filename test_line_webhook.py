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
        
        # Verify Boss Account info (Rule 3)
        assert "004-9-99252-5" in pay_reply, "KBANK account missing"
        assert "ศิวัช รอสวัสดิ์" in pay_reply, "Boss name missing"
        assert "004999252517585" in pay_reply, "PromptPay missing"
        assert "Starter Plan" in pay_reply and "Founder Lifetime" in pay_reply, "Packages missing"
        print("  ✅ Payment keyword returned Boss's verified account (Rule 3) and package rates.")
        
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
