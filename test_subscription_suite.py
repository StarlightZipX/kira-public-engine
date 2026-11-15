import sys
import time
import json
import base64
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app import app, verify_slip_data

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

client = TestClient(app)

# Dummy base64 1x1 png image
DUMMY_SLIP = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

def run_tests():
    run_id = int(time.time() * 1000) % 1000000
    print("==================================================")
    print("👑 KIRA v2.9.8 - SUBSCRIPTION & MONETIZATION TEST SUITE")
    print("==================================================\n")

    # 1. Health check
    print("[1/10] Testing Server Health...")
    r = client.get("/api/health")
    assert r.status_code == 200, f"Health check failed: {r.status_code}"
    print("  ✅ Server is healthy (200 OK)")

    # 2. Get Subscription Plans & Verify Boss Real Account Details
    print("\n[2/10] Testing GET /api/subscription/plans...")
    r = client.get("/api/subscription/plans")
    assert r.status_code == 200, f"Failed GET /api/subscription/plans: {r.status_code}"
    data = r.json()
    assert data.get("status") == "success", f"Bad plans response: {data}"
    plans_list = data.get("plans", [])
    plans = {p["plan_id"]: p for p in plans_list}
    assert "trial" in plans and "pro" in plans and "founder" in plans, f"Missing plans: {plans.keys()}"
    assert plans["trial"]["price"] == 39
    assert plans["pro"]["price"] == 129
    assert plans["founder"]["price"] == 499
    print("  ✅ Plans validated: Starter (39฿), Pro (129฿), Founder (499฿)")
    assert data.get('promptpay_name') == "นาย ศิวัช รอสวัสดิ์", f"Expected Boss name, got {data.get('promptpay_name')}"
    assert data.get('promptpay_number') == "004999252517585", f"Expected Boss PromptPay number, got {data.get('promptpay_number')}"
    assert data.get('promptpay_account') == "xxx-x-xx252-5", f"Expected Boss Account Number, got {data.get('promptpay_account')}"
    print(f"  PromptPay Real Account Verified: {data.get('promptpay_number')} ({data.get('promptpay_name')}) - {data.get('promptpay_bank')} • Acc: {data.get('promptpay_account')}")

    # Deterministic anti-fraud receiver & amount validation checks
    ok_slip, ok_reason, _ = verify_slip_data(
        {"is_bank_slip": True, "receiver_name": "นาย ศิวัช รอสวัสดิ์", "receiver_account": "004-9-99252-5", "amount": 129.0, "trans_ref": f"KBANK{run_id}"},
        expected_amount=129.0
    )
    assert ok_slip is True, f"Valid Boss slip rejected unexpectedly: {ok_reason}"
    bad_slip, bad_reason, _ = verify_slip_data(
        {"is_bank_slip": True, "receiver_name": "นาย สมชาย ปลอมแปลง", "receiver_account": "999-9-99999-9", "amount": 129.0, "trans_ref": f"BAD{run_id}"},
        expected_amount=129.0
    )
    assert bad_slip is False, "Fraudulent recipient slip should be rejected"

    # 3. Test Subscription Status for Normal Free User & Boss
    free_user = f"sub_free_{run_id}"
    print("\n[3/10] Testing GET /api/subscription/status for free user and boss...")
    r_free = client.get(f"/api/subscription/status/{free_user}")
    assert r_free.status_code == 200
    sub_free = r_free.json()["subscription"]
    assert sub_free["plan"] == "free"
    assert sub_free["is_active_pro"] is False
    assert sub_free["daily_quota"] == 15
    print(f"  ✅ Free user status: {sub_free['badge']} (Quota: {sub_free['daily_quota']}/day, Pro: {sub_free['is_active_pro']})")

    r_boss = client.get("/api/subscription/status/boss")
    assert r_boss.status_code == 200
    sub_boss = r_boss.json()["subscription"]
    assert sub_boss["is_boss"] is True
    assert sub_boss["is_active_pro"] is True
    assert sub_boss["can_access_boardroom"] is True
    assert sub_boss["can_auto_draft"] is True
    print(f"  ✅ Boss status: {sub_boss['badge']} (Executive Admin VIP Unlimited)")

    # 4. Create Order for Pro Plan
    alice_user = f"sub_alice_{run_id}"
    print(f"\n[4/10] Testing POST /api/subscription/create-order for '{alice_user}' (Pro Plan)...")
    r_order = client.post("/api/subscription/create-order", json={"username": alice_user, "plan_id": "pro"})
    assert r_order.status_code == 200, f"Order creation failed: {r_order.text}"
    order_data = r_order.json()
    assert order_data.get("status") == "success"
    order_id = order_data["order_id"]
    assert order_data["amount"] == 129
    assert order_data["days"] == 30
    assert order_data["promptpay_name"] == "นาย ศิวัช รอสวัสดิ์"
    assert order_data["promptpay_account"] == "xxx-x-xx252-5"
    print(f"  ✅ Order created cleanly: {order_id} (129฿ / 30 Days) -> QR target: {order_data['promptpay_name']} • Acc: {order_data['promptpay_account']}")

    # 5. Test Fraud Rejection Guard & Verified Instant Auto-Activation
    print(f"\n[5/10] Testing Slip Fraud Rejection & AI-Verified Instant Auto-Activation for Order {order_id}...")
    fraud_user = f"sub_fraud_{run_id}"
    r_ord_fraud = client.post("/api/subscription/create-order", json={"username": fraud_user, "plan_id": "pro"})
    fraud_order_id = r_ord_fraud.json()["order_id"]
    with patch("app._verify_slip_with_ai", new=AsyncMock(return_value={
        "status": "rejected",
        "is_valid": False,
        "reason": "ภาพที่แนบไม่ใช่สลิปการโอนเงินของธนาคารที่ถูกต้อง",
        "confidence": 0.99,
        "trans_ref": "",
        "details": {"is_bank_slip": False}
    })):
        r_fraud = client.post("/api/subscription/upload-slip", json={
            "order_id": fraud_order_id,
            "slip_image_base64": DUMMY_SLIP,
            "transfer_note": "Non-slip test"
        })
        assert r_fraud.status_code == 400, f"Expected 400 on rejected non-bank slip, got {r_fraud.status_code}"

    with patch("app._verify_slip_with_ai", new=AsyncMock(return_value={
        "status": "approved",
        "is_valid": True,
        "reason": "OK",
        "confidence": 0.98,
        "trans_ref": f"KBPAY{run_id}",
        "details": {"receiver_name": "นาย ศิวัช รอสวัสดิ์", "receiver_account": "004-9-99252-5", "amount": 129.0}
    })):
        r_slip = client.post("/api/subscription/upload-slip", json={
            "order_id": order_id,
            "slip_image_base64": DUMMY_SLIP,
            "transfer_note": "โอนจาก KBANK เวลา 14:30 น."
        })
        assert r_slip.status_code == 200, f"Slip upload failed: {r_slip.text}"
        slip_data = r_slip.json()
        assert slip_data.get("status") == "success"
        assert slip_data.get("order_status") == "approved", f"Expected auto-approved, got {slip_data.get('order_status')}"
        assert slip_data.get("ai_verified") is True
        assert "ยินดีต้อนรับสู่" in slip_data.get("welcome_message", "")
        print(f"  ✅ Validated slip blocked fake DUMMY_SLIP & activated AI-verified Order {order_id} (Plan: {slip_data.get('plan')})")

    # 6. Pending Review + Admin Listing + Manual Approval Flow
    pend_user = f"sub_pend_{run_id}"
    print(f"\n[6/10] Testing pending_review slip flow & GET /api/admin/subscription/orders...")
    r_pend_ord = client.post("/api/subscription/create-order", json={"username": pend_user, "plan_id": "trial"})
    pend_order_id = r_pend_ord.json()["order_id"]
    with patch("app._verify_slip_with_ai", new=AsyncMock(return_value={
        "status": "pending_review",
        "is_valid": False,
        "reason": "Low resolution slip queued for manual review",
        "confidence": 0.45,
        "trans_ref": f"PEND{run_id}",
        "details": {"error": "low_confidence"}
    })):
        r_pend_slip = client.post("/api/subscription/upload-slip", json={
            "order_id": pend_order_id,
            "slip_image_base64": DUMMY_SLIP,
            "transfer_note": "Needs manual check"
        })
        assert r_pend_slip.status_code == 200, f"Pending review upload failed: {r_pend_slip.text}"
        pend_res = r_pend_slip.json()
        assert pend_res.get("status") == "pending_review", f"Expected status='pending_review', got {pend_res}"
        assert pend_res.get("order_status") == "pending_review", f"Expected order_status='pending_review', got {pend_res}"
        assert pend_res.get("welcome_message") == "", "Pending review should not emit instant welcome activation message"
        assert pend_res.get("ai_verified") is False

    # User must still be free while pending_review!
    r_pend_status_before = client.get(f"/api/subscription/status/{pend_user}")
    assert r_pend_status_before.json()["subscription"]["plan"] == "free"

    r_admin = client.get("/api/admin/subscription/orders")
    assert r_admin.status_code == 200, f"Admin orders failed: {r_admin.text}"
    admin_data = r_admin.json()
    assert admin_data.get("status") == "success"
    orders_list = admin_data.get("orders", [])
    matched_alice = [o for o in orders_list if o["order_id"] == order_id]
    matched_pend = [o for o in orders_list if o["order_id"] == pend_order_id]
    assert len(matched_alice) == 1 and matched_alice[0]["status"] == "approved"
    assert len(matched_pend) == 1 and matched_pend[0]["status"] == "pending_review"
    print(f"  ✅ Admin orders logged approved={order_id} and pending_review={pend_order_id}")

    # 7. Admin Manual Approval on Pending Review Order
    print(f"\n[7/10] Testing POST /api/admin/subscription/approve for Pending Order {pend_order_id}...")
    r_approve = client.post("/api/admin/subscription/approve", json={"order_id": pend_order_id, "note": "Verified manually by boss"})
    assert r_approve.status_code == 200, f"Approval failed: {r_approve.text}"
    appr_data = r_approve.json()
    assert appr_data.get("status") == "success"
    assert appr_data.get("plan") == "trial"
    r_pend_status_after = client.get(f"/api/subscription/status/{pend_user}")
    assert r_pend_status_after.json()["subscription"]["plan"] == "trial"
    print(f"  ✅ Pending order {pend_order_id} approved manually -> plan={appr_data.get('plan')}, expires={appr_data.get('expire_date')}")

    # 8. Verify Pro User Plan & Quota Upgrade
    print(f"\n[8/10] Verifying '{alice_user}' Pro status and quota after auto-activation...")
    r_alice = client.get(f"/api/subscription/status/{alice_user}")
    assert r_alice.status_code == 200
    alice_sub = r_alice.json()["subscription"]
    assert alice_sub["plan"] == "pro", f"Expected 'pro', got {alice_sub['plan']}"
    assert alice_sub["is_active_pro"] is True
    assert alice_sub["daily_quota"] == 500
    assert alice_sub["can_access_boardroom"] is True
    assert alice_sub["can_auto_draft"] is True
    print(f"  ✅ VIP Status Confirmed: badge={alice_sub['badge']}, Quota={alice_sub['daily_quota']}/day, Expire={alice_sub['expire_date']}")

    # 9. Test Order Rejection Workflow
    bob_user = f"sub_bob_{run_id}"
    print("\n[9/10] Testing Rejection Workflow for pending_review order...")
    r_ord2 = client.post("/api/subscription/create-order", json={"username": bob_user, "plan_id": "trial"})
    ord2_id = r_ord2.json()["order_id"]
    with patch("app._verify_slip_with_ai", new=AsyncMock(return_value={
        "status": "pending_review",
        "is_valid": False,
        "reason": "Manual verification needed",
        "confidence": 0.4,
        "trans_ref": "",
        "details": {}
    })):
        client.post("/api/subscription/upload-slip", json={"order_id": ord2_id, "slip_image_base64": DUMMY_SLIP, "transfer_note": "Fake slip test"})

    r_reject = client.post("/api/admin/subscription/reject", json={"order_id": ord2_id, "reason": "ยอดเงินในสลิปไม่ตรง"})
    assert r_reject.status_code == 200
    rej_data = r_reject.json()
    assert rej_data.get("status") == "success"
    assert rej_data.get("order_status") == "rejected"

    r_bob = client.get(f"/api/subscription/status/{bob_user}")
    assert r_bob.json()["subscription"]["plan"] == "free"
    print(f"  ✅ Order {ord2_id} rejected cleanly and user remains on Free tier")

    # 10. Test Access Guards (Boardroom paywall for free user)
    print("\n[10/10] Testing Access Guards (Virtual Boardroom Paywall for Free User)...")
    chat_payload = {
        "username": free_user,
        "message": "ประเมินงบประมาณและแผนการตลาดสำหรับไตรมาส 4 หน่อยครับ",
        "model_version": "boardroom",
        "boardroom_mode": True
    }
    r_chat = client.post("/api/chat", json=chat_payload)
    assert r_chat.status_code == 200
    chat_resp_text = r_chat.text
    assert "สิทธิพิเศษเฉพาะสมาชิก Kira Pro" in chat_resp_text or "Virtual Boardroom" in chat_resp_text, f"Unexpected response: {chat_resp_text}"
    print("  ✅ Virtual Boardroom correctly paywalled for free users with upgrade recommendation")

    print("\n==================================================")
    print("🎉 ALL 10 SUBSCRIPTION & MONETIZATION TESTS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
