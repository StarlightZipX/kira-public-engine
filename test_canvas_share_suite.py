import sys
import os
import json
import unittest.mock as mock

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# Mock requests.get during app import to skip Groq network probe
mock_groq_resp = mock.MagicMock()
mock_groq_resp.status_code = 200
mock_groq_resp.json.return_value = {"data": [{"id": "llama3-8b-8192"}, {"id": "llama3-70b-8192"}]}

with mock.patch("requests.get", return_value=mock_groq_resp):
    from app import app, init_db, execute_query

from fastapi.testclient import TestClient
client = TestClient(app)

def run_tests():
    print("==================================================")
    print("🚀 KIRA AI - CANVAS SPLIT & VIRAL SHARE TEST SUITE")
    print("==================================================\n")

    # 1. Database table verification
    print("[1/6] Verifying shared_snapshots Database Table...")
    init_db()
    table_check = execute_query("SELECT count(*) FROM shared_snapshots", fetch='one')
    assert table_check is not None, "shared_snapshots table does not exist"
    print(f"  ✅ Table 'shared_snapshots' is active and queryable (count={table_check[0]})")

    # 2. Test POST /api/share/create (Chat Snapshot)
    print("\n[2/6] Testing POST /api/share/create (Chat Snapshot)...")
    chat_payload = {
        "username": "boss",
        "title": "แผนงานเปิดตัวฟีเจอร์ใหม่ Kira Canvas & Viral Share",
        "share_type": "chat",
        "content": [
            {"role": "user", "content": "ช่วยวางแผนเปิดตัวระบบ Interactive Canvas และ Viral Share ให้หน่อยครับ"},
            {"role": "assistant", "content": "รับทราบค่ะบอส! คิระขอเสนอแผนงาน 3 สเต็ป: 1. Split Workspace 2. Social Card Generator 3. Public SEO Page ค่ะ 🌸"}
        ],
        "author_display_name": "👑 Boss (Owner)"
    }
    r = client.post("/api/share/create", json=chat_payload)
    assert r.status_code == 200, f"Chat share creation failed: {r.status_code}, {r.text}"
    chat_res = r.json()
    assert chat_res.get("status") == "success", f"Invalid response: {chat_res}"
    chat_share_id = chat_res.get("share_id")
    chat_share_url = chat_res.get("share_url")
    assert chat_share_id and chat_share_id.startswith("sh_"), "Invalid share_id"
    assert chat_share_url == f"/share/{chat_share_id}", "Invalid share_url"
    print(f"  ✅ Chat Snapshot Created: ID={chat_share_id}, URL={chat_share_url}")

    # 3. Test POST /api/share/create (Canvas Artifact Snapshot)
    print("\n[3/6] Testing POST /api/share/create (Canvas Artifact Snapshot)...")
    canvas_payload = {
        "username": "boss",
        "title": "Kira Executive Financial Dashboard",
        "share_type": "canvas",
        "content": {
            "title": "Kira Executive Financial Dashboard",
            "code": "<div class='p-6 bg-slate-900 text-white rounded-xl'><h2>Q4 Revenue Target</h2><p>1,250,000 THB</p></div>",
            "version": 1
        },
        "author_display_name": "ศิวัช รอสวัสดิ์"
    }
    r = client.post("/api/share/create", json=canvas_payload)
    assert r.status_code == 200
    canvas_res = r.json()
    assert canvas_res.get("status") == "success"
    canvas_share_id = canvas_res.get("share_id")
    print(f"  ✅ Canvas Artifact Snapshot Created: ID={canvas_share_id}")

    # 4. Test GET /api/share/{share_id} (API Data & View Count Increment)
    print(f"\n[4/6] Testing GET /api/share/{chat_share_id} (JSON API Data)...")
    r_api = client.get(f"/api/share/{chat_share_id}")
    assert r_api.status_code == 200
    api_data = r_api.json()
    assert api_data.get("status") == "success"
    assert api_data.get("title") == chat_payload["title"]
    assert api_data.get("author_display_name") == "👑 Boss (Owner)"
    assert api_data.get("views_count") >= 1, "View counter did not increment"
    print(f"  ✅ API returned data correctly, Views Count = {api_data.get('views_count')}")

    # 5. Test GET /share/{share_id} (HTML Public Web Rendering & OpenGraph Tags)
    print(f"\n[5/6] Testing GET /share/{chat_share_id} (HTML Public Web Page)...")
    r_html = client.get(f"/share/{chat_share_id}")
    assert r_html.status_code == 200
    html_text = r_html.text
    assert "og:title" in html_text, "Missing og:title meta tag"
    assert "og:image" in html_text, "Missing og:image meta tag"
    assert "twitter:card" in html_text, "Missing twitter:card meta tag"
    assert "Kira AI" in html_text, "Missing Kira AI branding"
    import html
    assert html.escape(chat_payload["title"]) in html_text, "Missing title in HTML"
    print("  ✅ Public Share Page rendered with OpenGraph Social Cards & Branding (200 OK)")

    # Test Canvas Public HTML
    r_canvas_html = client.get(f"/share/{canvas_share_id}")
    assert r_canvas_html.status_code == 200
    assert "shared-canvas-iframe" in r_canvas_html.text, "Missing iframe in canvas share page"
    assert "shared-code-block" in r_canvas_html.text, "Missing code view in canvas share page"
    print("  ✅ Canvas Public Page rendered with Live Preview & Code View (200 OK)")

    # Test 404 for invalid share_id
    r_404 = client.get("/share/sh_non_existent_id")
    assert r_404.status_code == 404
    assert "ไม่พบข้อมูลที่แชร์" in r_404.text
    print("  ✅ Non-existent share ID returns friendly 404 page (404 Not Found)")

    # 6. Verify Frontend UI Elements in index.html
    print("\n[6/6] Verifying Frontend UI Elements in index.html...")
    with open("templates/index.html", "r", encoding="utf-8") as f:
        index_html = f.read()

    assert "btn-share-chat" in index_html, "Missing btn-share-chat in index.html"
    assert "share-modal" in index_html, "Missing share-modal in index.html"
    assert "viral-card-canvas" in index_html, "Missing viral-card-canvas in index.html"
    assert "btn-canvas-split" in index_html, "Missing btn-canvas-split in index.html"
    assert "btn-tab-code" in index_html, "Missing btn-tab-code in index.html"
    assert "canvas-ai-prompt-bar" in index_html, "Missing canvas-ai-prompt-bar in index.html"
    assert "btn-tools-viral-share" in index_html, "Missing btn-tools-viral-share in index.html"
    print("  ✅ All Interactive Canvas & Viral Share UI components verified in index.html")

    print("\n==================================================")
    print("🎉 ALL TESTS PASSED SUCCESSFULLY! (100% VERIFIED)")
    print("==================================================")

if __name__ == '__main__':
    run_tests()
