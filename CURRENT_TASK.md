# 📝 สมุดส่งเวรสถานะงานสด (KIRA AI SYSTEM - LIVING TASK ANCHOR)

> **อัปเดตล่าสุด:** Kira Web v2.9.7 — Boss Flexible Co-Pilot, PostgreSQL Auth Sync & Async Chat Race Fix (**เพิ่มความยืดหยุ่นแบบเหมา 3 แกนหลักเฉพาะบัญชีบอส, แก้ Cross-DB PostgreSQL Boss Auth Token `403`, แก้ Async Chat History Race และอัปเดต Cache-Busting**)

---

### ✅ 1. งานระดับจุลภาคที่เพิ่งทำเสร็จ (Latest Completed Work - `v2.9.7` Boss Flexible Co-Pilot & Prod Fix)
* **1.1 ความยืดหยุ่นแบบเหมา 3 แกนหลักเฉพาะบัญชีบอส (`is_boss_user` หลังยืนยันตัวตน/โลคอลใน `app.py`):**
  * **IT / Sysadmin Practical Co-Pilot:** อัปเดต `system_prompt_boss` และ `init_db()` (`prompt_1.1` auto-upgrade สำหรับ Prompt ที่มีขนาดกะทัดรัด 4,078 ตัวอักษรสำหรับ Boss / 5,412 ตัวอักษรสำหรับ Guest) ให้วิเคราะห์ต้นตอปัญหา (Root Cause) คำสั่ง CLI/Config และแนวทาง Hardening ระบบที่บอสดูแลทันที โดย **ยังรักษาขอบเขตความปลอดภัย** (ปฏิเสธการข้ามล็อค/Paywall, การเจาะบัญชีผู้อื่น หรืออันตราย โดยข้ามการฉีด Co-Pilot directive เมื่อ `_is_security_or_harm_boundary_query` เป็นจริง)
  * **Adaptive Response Style:** ถอดข้อความบังคับปิดท้าย `"เชิญชวนบอสกด Like/Dislike"` ออกจาก Prompt บอส และเพิ่ม `_parse_boss_turn_mode()` + `_build_boss_adaptive_directive()` ให้ปรับความยาว/รูปแบบอัตโนมัติ (ถามสั้น/แก้ error → คำสั่งหรือโค้ดพร้อมรัน; ถามวางแผน → วิเคราะห์ Scenario & ความเสี่ยงครบ) พร้อม Prefix รายเทิร์น `/สั้น`, `/fast`, `/direct` และ `/ลึก`, `/deep`
  * **Persistent Stack/Style Shortcuts & Preference Safety:** เพิ่ม `_handle_boss_preference_command()` ใน `chat_endpoint` (`/stack`, `/จำสแต็ก`, `/style`, `/จำสไตล์`, `/reset-style`, `/รีเซ็ตสไตล์`, `/help-boss`, `/คำสั่งบอส`) พร้อมปรับ `save_user_settings()` / `_upsert_user_preferences_fields()` / `_refresh_active_user_prompts()` ให้เก็บรักษาฟิลด์ที่ไม่ได้ส่งมา (Partial Update Preservation — เปลี่ยนธีมหรือโหมดไม่ทับ `custom_instructions`/`custom_response_style`) และอนุญาต Sandbox `[PYTHON]` บนโมเดล `2.*`/`3.*` เฉพาะบัญชีบอส
  * **ความเท่าเทียมของ UI (`GEMINI.md` Rule 4):** จำกัด Logic ไว้ที่ Backend ภายใต้ `if is_boss_user:` เท่านั้น ไม่เพิ่มปุ่มลัดหรือ Badge อภิสิทธิ์ชนใน UI
* **1.2 แก้บั๊กร้ายแรงบน Production PostgreSQL & Async Chat Race (`app.py`, `static/script.js`, `templates/index.html`, `static/sw.js`):**
  * **PostgreSQL Boss Auth Sync Fix:** แทนที่คำสั่ง SQLite-only `INSERT OR IGNORE` / `INSERT OR REPLACE` ใน `init_db()`, `/api/register` และ `/api/login` ด้วย `_get_boss_seed_salt()` + `_upsert_boss_account()` (`ON CONFLICT(username) DO UPDATE SET ...` พร้อม fallback `SELECT/UPDATE/INSERT`) เพื่อให้ Render PostgreSQL ซิงก์ `password_hash` กับ Token Fingerprint (`pfp`) ของบอสตรงกันทุกครั้ง ไม่เกิด `403` หรือหลุดสิทธิ์จาก IP ภายนอก
  * **Frontend Async Session/Welcome Race Guard:** ปรับ `renderWelcomeHub()` และ `loadSession()` ใน `static/script.js` ให้ตรวจ `currentSessionId` / `currentUser` / `isGenerating` ก่อนเขียนทับ `#chat-box`, พร้อมอัปเดต Cache-Busting `?v=20261115_boss_copilot` และ `CACHE_NAME = 'kira-ai-cache-v2.9.7-boss-copilot'`
* **งานหลักก่อนหน้า:** `v2.9.7` Hotfix (`2aa5345` — Resilience Shield & `#tools-dropdown-menu`) และ Phase 3 (Cloud Web Computer Use + SSRF Guard, Visual/DOM Prompt Injection Shield, OS Companion Bridge, คงโค้ด LINE OA, บัญชี KBANK/PromptPay จริงของบอส และ Auth มาตรฐานเท่าเทียม)

---

### 🌐 2. สถานะการ Deploy และผลตรวจสอบ (Verification & Production Status)
* **Syntax & Asset Checks (หลังแก้ไขครั้งสุดท้าย):**
  * `python -m py_compile app.py` — ผ่าน
  * `node --check static/script.js` และ `node --check static/sw.js` — ผ่าน
  * ขนาด System Prompt: `Boss: 4078` chars, `Guest: 5412` chars
* **Sequential Automated Test Suites (หลังแก้ไขครั้งสุดท้าย):**
  * 12-Suite Combined Pytest (`67 passed in 148.53s`): `test_resilience_and_tools_fix.py` (10), `test_fallback_resilience_suite.py` (5), `test_local_failover.py` (4), `test_pillar_1_smart_greeting.py` (4), `test_audit_stabilization_suite.py` (6), `test_approved_fixes.py` (10), `test_user_modes_suite.py` (3), `test_thinking_sanitizer.py` (1), `test_line_webhook.py` (7), `test_pwa_pdf_suite.py` (5), `test_i18n_deep_audit.py` (6), `test_mcp_hub_suite.py` (6)
  * `python test_auth_suite.py` — **14/14 passed**
  * `python test_settings_suite.py` — **6/6 passed**
* **Local Playwright E2E Verification (`Desktop 1440x900`):**
  * ล็อกอินเข้าบัญชี `👑 Boss (Owner)` บนเซิร์ฟเวอร์โลคอล (`127.0.0.1:8783`), ทดสอบ `/help-boss`, `/stack Windows 11 + Docker + Nginx + FastAPI`, `/จำสไตล์ ตอบสั้น คม พร้อมคำสั่งรันทันที`, `/สั้น Nginx ขึ้น 502 Bad Gateway บน Docker เช็ก 3 คำสั่งแรกอะไรบ้าง`, และ `/reset-style` (`boss_copilot_local_desktop.png`)
  * ผลลัพธ์: `Console errors: 0`, `Page errors: 0`, `HTTP 5xx: 0`
* **Production Repository:** `https://github.com/StarlightZipX/kira-public-engine.git` (Branch `main` → Auto-Deploy บน Render ที่ `https://kira-public-engine.onrender.com`)

---

### 🧭 3. แนวทางการพัฒนาหลัก (Master Development Direction — Boss Approved)
* **จุดยืนผลิตภัณฑ์ (Core Positioning):** **ผู้ช่วยและตัวแทนส่วนตัวของคนไทย (Thai-First Core, Global-Ready 5-Language Shell: `TH / EN / ZH / KO / JA`)**
* **นโยบายแพลตฟอร์ม (Owned Home Policy):** ยึด **Web + Mobile PWA** เป็นบ้านหลัก (`0฿` ค่าส่งข้อความ); **คงโค้ด LINE OA** (`/api/line/webhook`, `/api/line/diagnostics`) ใน `app.py` ไว้ตามคำสั่งบอสโดยไม่ขยายฟีเจอร์ AI ที่พึ่งพาโควตา Reply API ของ LINE

---

### 🗺️ 4. แผนพัฒนา 3 ระยะ (3-Phase Master Roadmap — COMPLETE)
* **✅ ระยะที่ 1 (`v2.9.5` — PWA & Daily Thai Utilities):** Mobile PWA Shortcuts/Share Target, 1-Click Slip & Expense Ledger, Study & Document 1-Click Pack
* **✅ ระยะที่ 2 (`v2.9.6` — ตัวแทนรับงาน & เลขาส่วนตัว):** Personal Intake Portal + QR Card, PWA Notification Center, Sovereign Privacy / Local Engine Showcase & PDPA Export, International Payment Rail Switcher
* **✅ ระยะที่ 3 (`v2.9.7` — Action Agent & Autonomous OS Companion):** Cloud Web Computer Use Sandbox + SSRF Guard, Live DOM Wireframe & Split Canvas, Visual & DOM Prompt Injection Shield, Desktop (`PyAutoGUI`) & Mobile (`ADB`) OS Companion Bridge
