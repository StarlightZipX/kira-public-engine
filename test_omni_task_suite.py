import sys
import requests
import json

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("==================================================")
    print("📋 KIRA 2.2 - OMNI-TASK & AUTONOMOUS SUITE TESTS")
    print("==================================================\n")

    # 1. Health check
    print("[1/7] Testing Server Health...")
    r = requests.get(f"{BASE_URL}/api/health", timeout=5)
    assert r.status_code == 200, f"Health check failed: {r.status_code}"
    print("  ✅ Server is healthy and responsive (200 OK)")

    # 2. Public Intake Page
    print("\n[2/7] Testing GET /intake (Public Intake Portal)...")
    r = requests.get(f"{BASE_URL}/intake", timeout=5)
    assert r.status_code == 200, f"GET /intake failed: {r.status_code}"
    assert "Kira Service Intake" in r.text or "KIRA OMNI-INTAKE" in r.text
    print("  ✅ Public intake page rendered successfully (200 OK)")

    # 3. Create Task with Auto-Draft & Boardroom Evaluation
    print("\n[3/7] Testing POST /api/tasks with auto_draft & evaluate_boardroom...")
    payload = {
        "username": "boss",
        "title": "วางแผนกลยุทธ์การตลาดและเปิดตัวแอปพลิเคชัน Q4",
        "description": "ต้องการเพิ่มผู้ใช้งานใหม่ 10,000 คนภายใน 3 เดือน โดยใช้งบประมาณจำกัด และเน้น Organic Social Media",
        "source": "voice",
        "priority": "urgent_important",
        "requester": "👑 Boss (Owner)",
        "auto_draft": True,
        "evaluate_boardroom": True
    }
    r = requests.post(f"{BASE_URL}/api/tasks", json=payload, timeout=60)
    assert r.status_code == 200, f"Create task failed: {r.status_code}, {r.text}"
    data = r.json()
    assert data.get("status") == "success", f"Bad response: {data}"
    task_id = data.get("task_id")
    assert task_id, "No task_id returned"
    print(f"  ✅ Task created: {task_id}")
    print(f"     Priority: {data.get('priority')}, Score: {data.get('priority_score')}/100")
    print(f"     Has Deliverable: {data.get('has_deliverable')}, Type: {data.get('deliverable_type')}")

    # 4. List Tasks & Check Details
    print(f"\n[4/7] Testing GET /api/tasks?username=boss and GET /api/tasks/{task_id}...")
    r = requests.get(f"{BASE_URL}/api/tasks?username=boss", timeout=5)
    assert r.status_code == 200
    list_data = r.json()
    assert list_data.get("status") == "success"
    tasks = list_data.get("tasks", [])
    assert any(t["task_id"] == task_id for t in tasks), f"Created task {task_id} not in list"
    
    r_detail = requests.get(f"{BASE_URL}/api/tasks/{task_id}", timeout=5)
    assert r_detail.status_code == 200
    detail = r_detail.json().get("task", {})
    assert detail.get("deliverable"), "Deliverable is empty"
    print(f"  ✅ Task deliverable verified: {len(detail.get('deliverable'))} characters generated!")
    if detail.get("boardroom_review"):
        br = detail["boardroom_review"]
        print(f"  ✅ Boardroom evaluation verified: Score {br.get('priority_score')}, Quadrant: {br.get('eisenhower_quadrant')}")
        print(f"     Recommendation: {br.get('recommendation')}")

    # 5. Update Task Status
    print(f"\n[5/7] Testing PATCH /api/tasks/{task_id}/status...")
    r = requests.patch(f"{BASE_URL}/api/tasks/{task_id}/status", json={"username": "boss", "status": "in_progress"}, timeout=5)
    assert r.status_code == 200
    r_check = requests.get(f"{BASE_URL}/api/tasks/{task_id}", timeout=5)
    assert r_check.json().get("task", {}).get("status") == "in_progress"
    print("  ✅ Status successfully transitioned to 'in_progress'")

    # 6. External Public Intake Simulation
    print("\n[6/7] Testing POST /api/tasks/external-intake...")
    ext_payload = {
        "title": "ขอเชื่อมต่อ API ภายนอกกับระบบสต็อกสินค้า",
        "description": "ต้องการดึงข้อมูลสินค้าคงคลังแบบเรียลไทม์ผ่าน REST Webhook",
        "requester_name": "คุณวิศรุต (ลูกค้าภายนอก)",
        "requester_email": "wissarut@example.com",
        "department": "คลังสินค้า",
        "urgency": "urgent"
    }
    r = requests.post(f"{BASE_URL}/api/tasks/external-intake", json=ext_payload, timeout=60)
    assert r.status_code == 200
    ext_data = r.json()
    assert ext_data.get("status") == "success"
    ext_task_id = ext_data.get("task_id")
    print(f"  ✅ External task received and auto-processed: {ext_task_id}")

    # 7. Cleanup Test Tasks
    print("\n[7/7] Cleaning up test tasks...")
    requests.delete(f"{BASE_URL}/api/tasks/{task_id}", timeout=5)
    requests.delete(f"{BASE_URL}/api/tasks/{ext_task_id}", timeout=5)
    print("  ✅ Cleanup completed.")

    print("\n🎉 ALL 7 OMNI-TASK SUITE TESTS PASSED WITH 100% SUCCESS!")

if __name__ == "__main__":
    run_tests()
