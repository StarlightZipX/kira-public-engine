import sys
import requests
import json
import base64

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"

# Dummy base64 1x1 png image
DUMMY_SLIP = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

def run_tests():
    print("==================================================")
    print("👑 KIRA 2.1 - SUBSCRIPTION & MONETIZATION TEST SUITE")
    print("==================================================\n")

    # 1. Health check
    print("[1/10] Testing Server Health...")
    r = requests.get(f"{BASE_URL}/api/health", timeout=5)
    assert r.status_code == 200, f"Health check failed: {r.status_code}"
    print("  ✅ Server is healthy (200 OK)")

    # 2. Get Subscription Plans
    print("\n[2/10] Testing GET /api/subscription/plans...")
    r = requests.get(f"{BASE_URL}/api/subscription/plans", timeout=5)
    assert r.status_code == 200, f"Failed GET /api/subscription/plans: {r.status_code}"
    data = r.json()
    assert data.get("status") == "success", f"Bad plans response: {data}"
    plans_list = data.get("plans", [])
    plans = {p["plan_id"]: p for p in plans_list}
    assert "trial" in plans and "pro" in plans and "founder" in plans, f"Missing plans: {plans.keys()}"
    assert plans["trial"]["price"] == 39
    assert plans["pro"]["price"] == 129
    assert plans["founder"]["price"] == 499
    print(f"  ✅ Plans validated: Trial (39฿), Pro (129฿), Founder (499฿)")
    print(f"  PromptPay: {data.get('promptpay_number')} ({data.get('promptpay_name')})")

    # 3. Test Subscription Status for Normal Free User & Boss
    print("\n[3/10] Testing GET /api/subscription/status for free user and boss...")
    r_free = requests.get(f"{BASE_URL}/api/subscription/status/sub_test_user_free", timeout=5)
    assert r_free.status_code == 200
    sub_free = r_free.json()["subscription"]
    assert sub_free["plan"] == "free"
    assert sub_free["is_active_pro"] is False
    assert sub_free["daily_quota"] == 15
    print(f"  ✅ Free user status: {sub_free['badge']} (Quota: {sub_free['daily_quota']}/day, Pro: {sub_free['is_active_pro']})")

    r_boss = requests.get(f"{BASE_URL}/api/subscription/status/boss", timeout=5)
    assert r_boss.status_code == 200
    sub_boss = r_boss.json()["subscription"]
    assert sub_boss["is_boss"] is True
    assert sub_boss["is_active_pro"] is True
    assert sub_boss["can_access_boardroom"] is True
    assert sub_boss["can_auto_draft"] is True
    print(f"  ✅ Boss status: {sub_boss['badge']} (God Mode VIP Unlimited)")

    # 4. Create Order for Pro Plan
    print("\n[4/10] Testing POST /api/subscription/create-order for 'sub_alice' (Pro Plan)...")
    order_payload = {
        "username": "sub_alice",
        "plan_id": "pro"
    }
    r_order = requests.post(f"{BASE_URL}/api/subscription/create-order", json=order_payload, timeout=5)
    assert r_order.status_code == 200, f"Order creation failed: {r_order.text}"
    order_data = r_order.json()
    assert order_data.get("status") == "success"
    order_id = order_data["order_id"]
    assert order_data["amount"] == 129
    assert order_data["days"] == 30
    print(f"  ✅ Order created successfully: {order_id} (129฿ / 30 Days)")

    # 5. Upload Slip
    print(f"\n[5/10] Testing POST /api/subscription/upload-slip for Order {order_id}...")
    slip_payload = {
        "order_id": order_id,
        "slip_image_base64": DUMMY_SLIP,
        "transfer_note": "โอนจาก SCB เวลา 14:30 น."
    }
    r_slip = requests.post(f"{BASE_URL}/api/subscription/upload-slip", json=slip_payload, timeout=5)
    assert r_slip.status_code == 200, f"Slip upload failed: {r_slip.text}"
    slip_data = r_slip.json()
    assert slip_data.get("status") == "success"
    assert slip_data.get("order_status") == "pending"
    print(f"  ✅ Slip uploaded and pending Boss approval: {order_id}")

    # 6. Admin Listing of Orders
    print("\n[6/10] Testing GET /api/admin/subscription/orders...")
    r_admin = requests.get(f"{BASE_URL}/api/admin/subscription/orders", timeout=5)
    assert r_admin.status_code == 200, f"Admin orders failed: {r_admin.text}"
    admin_data = r_admin.json()
    assert admin_data.get("status") == "success"
    orders_list = admin_data.get("orders", [])
    matched = [o for o in orders_list if o["order_id"] == order_id]
    assert len(matched) == 1, f"Order {order_id} not found in admin orders"
    assert matched[0]["status"] == "pending"
    assert matched[0]["amount"] == 129
    print(f"  ✅ Admin surveillance verified order {order_id} is in pending queue")

    # 7. Admin Approves Order
    print(f"\n[7/10] Testing POST /api/admin/subscription/approve for Order {order_id}...")
    r_approve = requests.post(f"{BASE_URL}/api/admin/subscription/approve", json={"order_id": order_id, "note": "Approved by boss test"}, timeout=5)
    assert r_approve.status_code == 200, f"Approval failed: {r_approve.text}"
    appr_data = r_approve.json()
    assert appr_data.get("status") == "success"
    print(f"  ✅ Order approved: new plan={appr_data.get('plan')}, expires={appr_data.get('expire_date')}")

    # 8. Verify User Plan & Quota Upgrade
    print("\n[8/10] Verifying 'sub_alice' user status and quota after approval...")
    r_alice = requests.get(f"{BASE_URL}/api/subscription/status/sub_alice", timeout=5)
    assert r_alice.status_code == 200
    alice_sub = r_alice.json()["subscription"]
    assert alice_sub["plan"] == "pro", f"Expected 'pro', got {alice_sub['plan']}"
    assert alice_sub["is_active_pro"] is True
    assert alice_sub["daily_quota"] == 500
    assert alice_sub["can_access_boardroom"] is True
    assert alice_sub["can_auto_draft"] is True
    print(f"  ✅ VIP Status Confirmed: badge={alice_sub['badge']}, Quota={alice_sub['daily_quota']}/day, Expire={alice_sub['expire_date']}")

    # 9. Test Order Rejection Workflow
    print("\n[9/10] Testing Rejection Workflow for another order...")
    r_ord2 = requests.post(f"{BASE_URL}/api/subscription/create-order", json={"username": "sub_bob", "plan_id": "trial"}, timeout=5)
    ord2_id = r_ord2.json()["order_id"]
    requests.post(f"{BASE_URL}/api/subscription/upload-slip", json={"order_id": ord2_id, "slip_image_base64": DUMMY_SLIP, "transfer_note": "Fake slip test"}, timeout=5)
    
    r_reject = requests.post(f"{BASE_URL}/api/admin/subscription/reject", json={"order_id": ord2_id, "reason": "ยอดเงินในสลิปไม่ตรง"}, timeout=5)
    assert r_reject.status_code == 200
    rej_data = r_reject.json()
    assert rej_data.get("status") == "success"
    assert rej_data.get("order_status") == "rejected"
    
    r_bob = requests.get(f"{BASE_URL}/api/subscription/status/sub_bob", timeout=5)
    assert r_bob.json()["subscription"]["plan"] == "free"
    print(f"  ✅ Order {ord2_id} rejected cleanly and user remains on Free tier")

    # 10. Test Access Guards (Boardroom paywall for free user)
    print("\n[10/10] Testing Access Guards (Virtual Boardroom Paywall for Free User)...")
    chat_payload = {
        "username": "sub_test_free_guard",
        "message": "ประเมินงบประมาณและแผนการตลาดสำหรับไตรมาส 4 หน่อยครับ",
        "model_version": "boardroom",
        "boardroom_mode": True
    }
    r_chat = requests.post(f"{BASE_URL}/api/chat", json=chat_payload, timeout=10)
    assert r_chat.status_code == 200
    chat_resp_text = r_chat.text
    assert "สิทธิพิเศษเฉพาะสมาชิก Kira Pro" in chat_resp_text or "Virtual Boardroom" in chat_resp_text, f"Unexpected response: {chat_resp_text}"
    print("  ✅ Virtual Boardroom correctly paywalled for free users with upgrade recommendation")

    print("\n==================================================")
    print("🎉 ALL 10 SUBSCRIPTION & MONETIZATION TESTS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
