import os
import json
import re
from fastapi.testclient import TestClient
from app import app

def test_pwa_endpoints():
    client = TestClient(app)
    
    # 1. Test /sw.js
    res_sw = client.get("/sw.js")
    assert res_sw.status_code == 200, f"/sw.js failed with status {res_sw.status_code}"
    assert "javascript" in res_sw.headers.get("content-type", "").lower()
    assert res_sw.headers.get("Service-Worker-Allowed") == "/"
    assert "addEventListener('install'" in res_sw.text
    print("✅ /sw.js endpoint and headers verified!")

    # 2. Test /manifest.json
    res_manifest = client.get("/manifest.json")
    assert res_manifest.status_code == 200, f"/manifest.json failed with status {res_manifest.status_code}"
    manifest_data = res_manifest.json()
    assert manifest_data.get("name") == "Kira AI - Public & Executive AI Assistant"
    assert manifest_data.get("short_name") == "Kira AI"
    assert manifest_data.get("display") == "standalone"
    assert len(manifest_data.get("icons", [])) >= 2
    print("✅ /manifest.json verified with standalone display & icons!")

    # 3. Test /api/system/version (New Update Detection Endpoint)
    res_ver = client.get("/api/system/version")
    assert res_ver.status_code == 200, f"/api/system/version failed with status {res_ver.status_code}"
    ver_data = res_ver.json()
    assert ver_data.get("status") == "success"
    assert "version" in ver_data
    assert "build_id" in ver_data
    assert "Cache-Control" in res_ver.headers
    print(f"✅ /api/system/version endpoint verified (version: {ver_data.get('version')}, build: {ver_data.get('build_id')})!")

    # 4. Test /api/generate-mindmap (New Living Mind Map Endpoint)
    res_mindmap = client.post("/api/generate-mindmap", json={"content": "ทดสอบการสร้างผังความคิด Mind Map ของ Kira AI"})
    assert res_mindmap.status_code == 200, f"/api/generate-mindmap failed with status {res_mindmap.status_code}"
    mindmap_data = res_mindmap.json()
    assert "status" in mindmap_data
    print(f"✅ /api/generate-mindmap endpoint verified (status: {mindmap_data.get('status')})!")

def test_pwa_html_elements():
    with open("templates/index.html", "r", encoding="utf-8") as f:
        html = f.read()

    assert 'id="btn-install-pwa-header"' in html, "Missing #btn-install-pwa-header in index.html"
    assert 'id="btn-install-app-menu"' in html, "Missing #btn-install-app-menu in index.html"
    assert 'id="pwa-install-banner"' in html, "Missing #pwa-install-banner in index.html"
    assert 'id="ios-pwa-modal"' in html, "Missing #ios-pwa-modal in index.html"
    assert 'rel="manifest"' in html, "Missing rel=manifest in index.html"
    assert 'name="apple-mobile-web-app-capable"' in html, "Missing apple-mobile-web-app-capable in index.html"
    
    # System Update Notification Modal & Chip
    assert 'id="kira-update-modal"' in html, "Missing #kira-update-modal in index.html"
    assert 'id="btn-kira-update-now"' in html, "Missing #btn-kira-update-now in index.html"
    assert 'id="btn-kira-update-later"' in html, "Missing #btn-kira-update-later in index.html"
    assert 'id="kira-update-chip"' in html, "Missing #kira-update-chip in index.html"
    assert 'name="kira-build-id"' in html, "Missing meta name=kira-build-id in index.html"

    # Living Mind Map Modal
    assert 'id="kira-mindmap-modal"' in html, "Missing #kira-mindmap-modal in index.html"
    assert 'id="mindmap-viewport"' in html, "Missing #mindmap-viewport in index.html"
    assert 'id="mindmap-canvas"' in html, "Missing #mindmap-canvas in index.html"
    assert 'id="btn-mindmap-export-png"' in html, "Missing #btn-mindmap-export-png in index.html"
    print("✅ index.html PWA elements, update modal & Mind Map modal verified!")

def test_pwa_and_pdf_scripts():
    with open("static/script.js", "r", encoding="utf-8") as f:
        js = f.read()

    assert "function initPWAController" in js, "Missing initPWAController in script.js"
    assert "function initKiraUpdateController" in js, "Missing initKiraUpdateController in script.js"
    assert "function initKiraMindMapController" in js, "Missing initKiraMindMapController in script.js"
    assert "function openKiraMindMap" in js, "Missing openKiraMindMap in script.js"
    assert "mindmap-btn" in js, "Missing mindmap-btn in script.js"
    assert "function exportDeliverableToPDF" in js, "Missing exportDeliverableToPDF in script.js"
    assert "function exportBoardroomToPDF" in js, "Missing exportBoardroomToPDF in script.js"
    assert "exportBoardroomToPDF(this)" in js, "Missing exportBoardroomToPDF call in script.js"
    assert "pdfReportBtn" in js, "Missing pdfReportBtn in script.js"
    assert "initPWAController();" in js, "Missing initPWAController() call in script.js"
    assert "initKiraMindMapController();" in js, "Missing initKiraMindMapController() call in script.js"
    print("✅ script.js PWA controller, update controller, Mind Map engine and PDF export verified!")

def test_pwa_and_print_styles():
    with open("static/style.css", "r", encoding="utf-8") as f:
        css = f.read()

    assert ".pwa-header-install-btn" in css, "Missing .pwa-header-install-btn in style.css"
    assert ".pwa-install-banner" in css, "Missing .pwa-install-banner in style.css"
    assert ".ios-pwa-card" in css, "Missing .ios-pwa-card in style.css"
    assert ".kira-update-card" in css, "Missing .kira-update-card in style.css"
    assert ".kira-update-chip" in css, "Missing .kira-update-chip in style.css"
    assert ".kira-mindmap-container" in css, "Missing .kira-mindmap-container in style.css"
    assert ".mindmap-node" in css, "Missing .mindmap-node in style.css"
    assert "@media print" in css, "Missing @media print in style.css"
    assert ".deliverable-pdf-btn" in css, "Missing .deliverable-pdf-btn in style.css"
    print("✅ style.css PWA components, update modal, Mind Map styles and print styles verified!")

def test_iron_citadel_security():
    client = TestClient(app)
    
    # 1. Test Security Headers on Clean Legitimate Request
    res_headers = client.get("/api/system/version", headers={"CF-Connecting-IP": "203.0.113.195"})
    assert res_headers.status_code == 200, f"Expected 200, got {res_headers.status_code}"
    assert res_headers.headers.get("x-content-type-options") == "nosniff"
    assert res_headers.headers.get("x-frame-options") == "SAMEORIGIN"
    assert "strict-transport-security" in res_headers.headers
    assert res_headers.headers.get("cross-origin-opener-policy") == "same-origin-allow-popups"
    assert "permissions-policy" in res_headers.headers
    print("✅ Iron Citadel: Enterprise Helmet Security Headers verified!")

    # 2. Test Scanner Vulnerability Probe Blocker (.env probe)
    res_probe = client.get("/.env", headers={"CF-Connecting-IP": "198.51.100.99"})
    assert res_probe.status_code == 403, f"Expected 403 on /.env probe, got {res_probe.status_code}"
    print("✅ Iron Citadel: Malicious vulnerability probe blocked with 403!")

    # 3. Test Malicious Scanner User-Agent Blocker (sqlmap)
    res_ua = client.get("/sw.js", headers={"User-Agent": "sqlmap/1.6#stable", "CF-Connecting-IP": "198.51.100.99"})
    assert res_ua.status_code == 403, f"Expected 403 on sqlmap UA, got {res_ua.status_code}"
    print("✅ Iron Citadel: Malicious scanner User-Agent blocked with 403!")

    # 4. Test CORS Protection on Render Domain
    res_cors = client.options("/api/system/version", headers={
        "Origin": "https://kira-public-engine.onrender.com",
        "Access-Control-Request-Method": "GET"
    })
    assert res_cors.headers.get("access-control-allow-origin") == "https://kira-public-engine.onrender.com"
    print("✅ Iron Citadel: Enterprise CORS policy verified!")

    # 5. Test Admin Endpoint Protection (Unauthenticated Access Blocked)
    res_admin = client.get("/api/admin/orders", headers={"CF-Connecting-IP": "198.51.100.55"})
    assert res_admin.status_code in (401, 403, 302, 404), f"Expected unauthorized, got {res_admin.status_code}"
    print("✅ Iron Citadel: Admin Fortress access control verified!")

if __name__ == "__main__":
    test_pwa_endpoints()
    test_pwa_html_elements()
    test_pwa_and_pdf_scripts()
    test_pwa_and_print_styles()
    test_iron_citadel_security()
    print("\n🎉 ALL TESTS (PWA, UPDATE MODAL, MIND MAP, PDF EXPORT, IRON CITADEL SHIELD) PASSED PERFECTLY! 🚀")
