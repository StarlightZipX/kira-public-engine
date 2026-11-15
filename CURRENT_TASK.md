# 📝 สมุดส่งเวรสถานะงานสด (KIRA AI SYSTEM - LIVING TASK ANCHOR)

> **อัปเดตล่าสุด:** Kira Web v2.9.7 — Post-Phase 3 Resilience & Header Tools Dropdown Hotfix (**แก้ปัญหาค้างหน้าจอ Resilience Shield, Key Poisoning จาก Refusal Cascade, Groq 413 TPM Prompt Bloat และแถบเครื่องมือค้างเปิดซ้ำไม่ได้**)

---

### ✅ 1. งานระดับจุลภาคที่เพิ่งทำเสร็จ (Latest Completed Work - `v2.9.7` Hotfix)
* **1.1 แก้ต้นตอหน้าจอ `Resilience Shield` (`Rate Limit Cooling Down`) วนลูปข้ามทุกคำถามและทุกโมเดล (`app.py`):**
  * ลดขนาด System Prompt (`_get_full_system_prompt`, `system_prompt`, `system_prompt_boss`) และปรับ `init_db()` ให้ auto-upgrade prompt เก่าที่เกิน 4,000 ตัวอักษร เพื่อให้ผ่าน Groq `openai/gpt-oss-120b` (`8,000 TPM`) โดยไม่ติด `HTTP 413 Request too large` (Boss `3,673` chars / Guest `5,412` chars)
  * เพิ่ม `_compact_history_for_tpm()` ย่อประวัติแชตเมื่อเจอ `413`, แยก Per-Model Cooldown (`_MODEL_COOLDOWNS` / `_is_model_available` / `_mark_model_cooldown`) ใน `_try_all_keys_and_models`, และปรับ `UnifiedLLM.astream` ให้ไม่ทำ Key Failure/Poisoning กับ `400`/`404`/`413`/`429`/`FalseSafetyRefusalError`
  * เพิ่ม `_is_security_or_harm_boundary_query()` และ `FalseSafetyRefusalError`: ให้ตรวจเฉพาะคำตอบสุดท้ายหลัง `[THINKING]`, ไม่จับคำตอบปฏิเสธเรื่องความปลอดภัย (เช่น ขอวิธีผ่านล็อค/bypass/แฮก) มาลองซ้ำข้ามคีย์/ข้ามโมเดล, จำกัด False-Refusal fallback เฉพาะคำถามปกติไว้ไม่เกิน `1` โมเดลสำรอง, กรองข้อความ `Resilience Shield` เก่าออกจาก `clean_history`, และไม่บันทึกแบนเนอร์ `Resilience Shield` หรือหักโควตาผู้ใช้
* **1.2 แก้แถบเครื่องมือด้านบน (`#tools-dropdown-menu`) และเมนูปุ่ม `เครื่องมือ v` ล็อกเปิดซ้ำไม่ได้ (`static/script.js`, `templates/index.html`, `static/sw.js`):**
  * เพิ่ม `window.closeHeaderToolsMenu = closeHeaderToolsMenu` ใน `initToolsDropdownController()` เพื่อถอดคลาส `.open`/`.show` และเรียก `style.removeProperty('display')` แทนการเขียน `style.display = 'none'` แบบ Inline ที่เคยบังทับ CSS `.tools-dropdown-wrapper.open .tools-dropdown-menu` ใน Handler ของ Language Switcher, Study Hub, Receipt Helper, Memory Hub และ Action Agent
  * ลบ Inline `onclick` ซ้ำบน `#btn-tools-action-agent` ใน `templates/index.html`, ปรับ Toggle `.msg-tools-dropdown-menu` ให้ตรวจ `getComputedStyle(...).display`, และอัปเดต `CACHE_NAME = 'kira-ai-cache-v2.9.7-resilience-tools-fix'` พร้อม Cache-Busting `?v=20261115_fix_resilience_tools`
* **งานหลักก่อนหน้า (`v2.9.7` Phase 3):** Web Computer Use Sandbox + SSRF Guard, Visual & DOM Prompt Injection Shield, Autonomous OS Companion Bridge (`PyAutoGUI`/`ADB`), และคงโค้ด LINE OA, บัญชี KBANK/PromptPay จริงของบอส, และ Auth มาตรฐานเท่าเทียมครบถ้วน

---

### 🌐 2. สถานะการ Deploy และผลตรวจสอบ (Verification & Production Status)
* **Syntax Checks (ผ่านหลังแก้ไขโค้ดครั้งสุดท้าย):**
  * `python -m py_compile app.py` — ผ่าน
  * `node --check static/script.js` และ `node --check static/sw.js` — ผ่าน
* **Combined Sequential Pytest Runs (หลังแก้ไขโค้ดล่าสุด):**
  * Resilience & Tools Hotfix + Failover + Greeting + Stabilization (`26 passed in 17.70s`): `test_resilience_and_tools_fix.py` (7), `test_fallback_resilience_suite.py` (5), `test_local_failover.py` (4), `test_pillar_1_smart_greeting.py` (4), `test_audit_stabilization_suite.py` (6)
  * Regression & i18n/PWA/LINE Suites (`31 passed in 24.16s`): `test_phase3_action_agent_suite.py` (6), `test_phase2_secretary_suite.py` (7), `test_i18n_deep_audit.py` (6), `test_pwa_pdf_suite.py` (5), `test_line_webhook.py` (7)
  * Thinking Sanitizer & User Modes (`4 passed in 38.76s`): `test_thinking_sanitizer.py` (1), `test_user_modes_suite.py` (3)
* **Zero-Trust Auth Security Audit (`python test_auth_suite.py`):** 14/14 passed
* **Local Playwright E2E & Visual Audit (Desktop `1440x900` + Mobile `390x844`):**
  * ทดสอบเปิด-ปิดเครื่องมือบนแถบ `#tools-dropdown-menu` 5 ตัวต่อเนื่อง (`Study Hub`, `Receipt Helper`, `Memory Hub`, `Action Agent`, `Notification Center`) แล้วเปิดแถบซ้ำบน Desktop & Mobile, ทดสอบปุ่ม `เครื่องมือ v` ท้ายข้อความ, และทดสอบแชตคำถามเรื่องผ่านล็อค + คำถามปกติ + สลับโมเดล `2.9-reasoning` → `2.9-pro` โดยไม่เกิดหน้าจอ `Resilience Shield` (`fix_local_*.png`)
  * ผลลัพธ์: `Console errors: 0`, `Page errors: 0`, `HTTP 5xx: 0`, Mobile horizontal overflow `<= 0px`
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
