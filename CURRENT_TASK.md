# 📝 สมุดส่งเวรสถานะงานสด (KIRA AI SYSTEM - LIVING TASK ANCHOR)

> **อัปเดตล่าสุด:** Kira Web v2.9.5 — Phase 1: Everyday PWA, 1-Click Slip Helper & Study Pack

---

### ✅ 1. งานระดับจุลภาคที่เพิ่งทำเสร็จ (Latest Completed Work - `v2.9.5`)
* **1.1 Mobile PWA Native Experience & Deep-Link Shortcuts:**
  * อัปเกรด `static/manifest.json` เพิ่ม `shortcuts` 4 ทางลัด (`/?open=receipt`, `/?open=study`, `/?open=tasks`, `/?open=vault`) และ `share_target` (`/?share_target=1` รองรับการแชร์ข้อความ/ลิงก์จากมือถือเข้าแอปคิระ)
  * เพิ่ม `handlePWADeepLinksAndShareTarget()` ใน `static/script.js` และทำงานก่อนบล็อก `isStandalone` เพื่อให้ PWA เปิดโมดัลเป้าหมายหรือกรอกข้อความลงช่องแชตได้ทันที
  * แก้ไข `initKiraUpdateController()` เพิ่มตัวเช็ก `hadControllerAtBoot` เพื่อไม่ให้ Service Worker ใหม่รีเฟรชหน้าเว็บซ้ำตอน Claim ครั้งแรกจนพารามิเตอร์ `?open=...` หายไป
  * อัปเกรด `CACHE_NAME` ใน `static/sw.js` เป็น `'kira-ai-cache-v2.9.5-phase1-pwa-utilities'` และ Query Cache-Busting `?v=20261114_phase1_v295` ใน `templates/index.html` / `static/sw.js`
* **1.2 1-Click Slip, Receipt & Expense Ledger Helper:**
  * เพิ่มตาราง `user_expense_logs` และดัชนี `idx_expense_username` ใน `init_db()` (`app.py`) พร้อมฟังก์ชันอ่าน/สรุปยอด (`_classify_receipt_text`, `_heuristic_parse_receipt`, `_parse_receipt_ai_json`, `_get_user_expense_summary`, `_sanitize_csv_cell`)
  * เปิดใช้งาน API ครบชุด: `POST /api/receipts/scan` (รองรับ Multimodal Vision AI + Heuristic Fallback), `GET /api/receipts/history`, `DELETE /api/receipts/{entry_id}` (ตรวจ Ownership) และ `GET /api/receipts/export-csv` (UTF-8 BOM)
  * เพิ่ม `#receipt-helper-modal`, ปุ่ม `#btn-tools-receipt-helper`, ชิป `#btn-open-receipt-helper-chip` ใน `templates/index.html`, คอนโทรลเลอร์ `initReceiptHelperController()` (รวมส่งออก Canvas และ CSV) ใน `static/script.js` และตกแต่งด้วย Quiet Luxury Obsidian + Responsive Mobile CSS ใน `static/style.css`
* **1.3 Study & Document 1-Click Pack:**
  * เพิ่มโหมด `action == "study_pack"` (LLM prompt + โครงสร้าง 5 ส่วน) ใน `POST /api/study/generate` และจุดเชื่อม `POST /api/study/extract-file` (`.pdf`, `.docx`, `.txt`, `.md`, `.csv`, `.json`, `.log` สูงสุด 8 MB ผ่าน `_parse_document`)
  * เพิ่มแท็บ `study_pack`, ปุ่มอัปโหลด `#btn-upload-study-file` / `#study-file-input`, และปุ่มสร้างลิงก์แชร์ `#btn-study-share-link` (`/api/share/create`) ใน `#study-hub-modal` พร้อมอัปเดต `KIRA_I18N` ครบ 5 ภาษา (`th`, `en`, `zh`, `ko`, `ja`) และตั้ง `KIRA_SYSTEM_VERSION = "2.9.5"` ใน `app.py`
* **หมายเหตุสถานะโมดูลและกฎสำคัญเดิม:** คงโค้ด LINE OA (`/api/line/webhook`, `/api/line/diagnostics`) ไว้ครบ (เวอร์ชัน `2.9.5`), ระบบชำระเงิน PromptPay บัญชีจริงบอส (นาย ศิวัช รอสวัสดิ์ / กสิกรไทย `004-9-99252-5`) และ Auth มาตรฐานเท่าเทียมคงเดิม; การพัฒนา Discord (`discord_bot.py`) อยู่ในสถานะพักชั่วคราวตามคำสั่งบอส (บันทึกเวอร์ชันก่อนหน้า `v2.9.4` เสร็จสมบูรณ์แล้ว)

---

### 🌐 2. สถานะการ Deploy และผลตรวจสอบ (Verification & Production Status)
* **Verification Suites (รันหลังแก้ไขโค้ดครั้งสุดท้ายครบ 100%):**
  * Syntax Check: `py_compile app.py discord_bot.py`, `node --check static/script.js`, `node --check static/sw.js` — ผ่าน
  * Phase 1 Unit & Integration Tests (`test_phase1_pwa_utilities.py`): ผ่านครบ 8/8 รายการ (`/api/system/version` -> `2.9.5`, `/manifest.json`, `/api/line/diagnostics`, Receipts Scan/History/CSV/Delete, Study Extract-File & `study_pack`)
  * Deep i18n Audit (`test_i18n_deep_audit.py`): 6/6 passed
  * PWA & PDF Suite (`test_pwa_pdf_suite.py`): ALL TESTS PASSED (13/13 checks: PWA, Update Modal, Mind Map, PDF Export, Iron Citadel Shield)
  * LINE Webhook Suite (`test_line_webhook.py`): 7/7 passed
  * Auth & DB Integrity Suite (`test_auth_suite.py`): 14/14 passed
* **Playwright E2E & Visual Audit (Desktop `1440x900` + Mobile `390x844`):**
  * ตรวจสอบ `/?open=receipt`, `/?open=study`, `/?share_target=1` และถ่ายภาพหน้าจอทั้ง Desktop/Mobile ครบ 4 ไฟล์ (`v295_*.png`)
  * ผลลัพธ์: `Console errors: 0`, `Page errors: 0`, `HTTP 5xx: 0`, Mobile horizontal overflow `0px` (ทั้ง Receipt Helper และ Study Hub)
* **Production Repository:** `https://github.com/StarlightZipX/kira-public-engine.git` (Branch `main` → Auto-Deploy บน Render ที่ `https://kira-public-engine.onrender.com`)

---

### 🧭 3. แนวทางการพัฒนาหลัก (Master Development Direction — Boss Approved)
* **จุดยืนผลิตภัณฑ์ (Core Positioning):** **ผู้ช่วยและตัวแทนส่วนตัวของคนไทย (Thai-First Core, Global-Ready 5-Language Shell: `TH / EN / ZH / KO / JA`)**
* **นโยบายแพลตฟอร์ม (Owned Home Policy):** ยึด **Web + Mobile PWA** เป็นบ้านหลัก (`0฿` ค่าส่งข้อความ); **คงโค้ด LINE OA** (`/api/line/webhook`, `/api/line/diagnostics`) ใน `app.py` ไว้ตามคำสั่งบอสโดยไม่ขยายฟีเจอร์ AI ที่พึ่งพาโควตา Reply API ของ LINE (ซึ่งจะเริ่มเก็บค่าบริการ Reply API เกิน 25,000 ข้อความ/เดือน ใน 1 ก.พ. 2570)

---

### 🗺️ 4. แผนพัฒนา 3 ระยะ (3-Phase Master Roadmap)
* **✅ ระยะที่ 1 (เสร็จสมบูรณ์ใน `v2.9.5` — PWA & Daily Thai Utilities):**
  1. **1.1 Mobile PWA Native Experience & Deep-Link Shortcuts:** อัปเกรด `manifest.json` (`shortcuts`, `share_target`) + `handlePWADeepLinksAndShareTarget()` + `hadControllerAtBoot` guard ให้เปิดโมดัล/ส่งต่อข้อความเข้าหน้าหลักได้เหมือนแอปจริง
  2. **1.2 1-Click Slip & Receipt Helper:** สแกนสลิป/ใบเสร็จด้วย Vision AI หรือวางข้อความ + บันทึกรายรับ-รายจ่าย สรุปยอด แยกหมวดหมู่ และส่งออก CSV/Canvas
  3. **1.3 Study & Document 1-Click Pack:** แพ็กติวครบชุด 1 คลิก (`study_pack`), อัปโหลดสกัดข้อความ PDF/DOCX/TXT/MD/CSV และปุ่มสร้างลิงก์แชร์สาธารณะ
* **🟡 ระยะที่ 2 (ถัดไป — ตัวแทนรับงาน & เลขาส่วนตัว):**
  1. **2.1 Personal Intake Portal:** ขยาย `/intake` และบอร์ดงาน `/api/tasks` ให้ผู้ใช้ทั่วไป/Pro มีลิงก์และ QR รับงานส่วนตัว
  2. **2.2 Web Push Notifications:** แจ้งเตือนนัดหมาย บิล และงานใหม่ตรงเข้ามือถือ/เดสก์ท็อปผ่าน PWA แทนการพึ่งพา LINE Push
  3. **2.3 Sovereign Privacy / Local Engine Showcase:** ชูจุดแข็งการคุมข้อมูลและความเป็นส่วนตัวผ่าน Local Engine (Ollama) และคลังเอกสาร RAG Vault
  4. **2.4 International Payment Rail:** เพิ่มช่องทางชำระเงินสากล (เช่น บัตรเครดิต / Stripe) คู่กับ PromptPay เมื่อพร้อมรับลูกค้าต่างชาตินอกไทย
* **🔵 ระยะที่ 3 (Action Agent & Autonomous OS Companion):**
  1. **3.1 Cloud Web Computer Use:** Playwright Headless + Vision API + Live Split Canvas + Visual Prompt Injection Shield (ทำงานบน Sandbox เซิร์ฟเวอร์)
  2. **3.2 Desktop (`PyAutoGUI`) & Mobile (`ADB` / Accessibility) OS Companion:** ขยายแขนขาควบคุมระดับระบบปฏิบัติการสำหรับผู้ใช้ระดับสูง
