# 📝 สมุดส่งเวรสถานะงานสด (KIRA AI SYSTEM - LIVING TASK ANCHOR)

> **อัปเดตล่าสุด:** Kira Web v2.9.6 — Phase 2: ตัวแทนรับงาน & เลขาส่วนตัว (Personal Intake QR, PWA Notification Center, Sovereign Privacy & International Rail)

---

### ✅ 1. งานระดับจุลภาคที่เพิ่งทำเสร็จ (Latest Completed Work - `v2.9.6`)
* **2.1 Personal Intake Portal & Scannable QR Business Card:**
  * เพิ่มตาราง `intake_profiles` ใน `init_db()` (`app.py`) สำหรับตั้งค่าชื่อหน้าพอร์ทัล, ข้อความต้อนรับ, สถานะเปิด-ปิดรับคำขอ และ Auto-Draft ต่อผู้ใช้
  * เปิดเส้นทาง `/intake/{owner_username}` คู่กับ `/intake?owner=...`, `GET/POST /api/intake/profile`, `GET /api/intake/track/{task_id}` (ติดตามสถานะตั๋วงานสำหรับลูกค้า) และ `GET /api/intake/qr.svg` (ตัวสร้าง QR Code แบบ Pure-Python ISO/IEC 18004 ไม่พึ่งไลบรารีภายนอก)
  * อัปเกรด `templates/intake.html` ด้วย Quiet Luxury Obsidian UI, ตัวสลับภาษา `TH / EN / ZH / KO / JA`, ช่องติดต่อ/งบประมาณ/กำหนดส่ง และการค้นหาสถานะตั๋ว
  * อัปเกรดแท็บ `#tab-pane-intake-link` ใน `#task-matrix-modal` (`templates/index.html`, `static/script.js`) ให้แก้ไขโปรไฟล์ แสดง QR นามบัตรสด และดาวน์โหลดการ์ด `.png` ผ่าน Canvas ได้ทันที
* **2.2 PWA Web Push & Notification Center:**
  * เพิ่มตาราง `user_notifications` (`idx_user_notif_username`) และ `web_push_subscriptions` ใน `app.py` พร้อมฟังก์ชัน `_create_user_notification` ที่แจ้งเตือนอัตโนมัติทันทีที่มีงานเข้าจาก Personal Intake
  * เพิ่ม REST APIs: `GET /api/notifications`, `POST /api/notifications/create`, `POST /api/notifications/read` (คืนค่า `unread_count` ทันที), `DELETE /api/notifications/{notif_id}`, `POST /api/notifications/subscribe` และ `POST /api/notifications/test-push`
  * เพิ่ม Event Handlers `push`, `notificationclick` และ `message` (`KIRA_SHOW_LOCAL_NOTIFICATION`) ใน `static/sw.js` พร้อม Cache Version ใหม่ `kira-ai-cache-v2.9.6-phase2-secretary-agent` และ Cache-Busting `?v=20261115_phase2_v296`
  * เพิ่มปุ่มกระดิ่งพร้อมตัวเลข `#notification-unread-badge` ที่ Header, ทางลัด Tools menu, Deep Link `/?open=notifications`, และหน้าต่าง `#notification-center-modal` (`initNotificationCenterController()` ใน `static/script.js` พร้อม XSS Escaping ครบจุด)
* **2.3 Sovereign Privacy & Local Engine Showcase (PDPA Hub):**
  * เพิ่ม `GET /api/privacy/sovereign-status` (ตรวจสถานะ Local Ollama Edge + นับข้อมูลจาก `logs`, `user_memories`, `tasks`, `user_expense_logs`, `rag_documents`, `vault_items`) และ `GET /api/privacy/export-data` (ส่งออกไฟล์ JSON ตามสิทธิ์ PDPA — แก้ไขชื่อคอลัมน์ `user_memories.fact` และ `logs.role, logs.content` ให้ตรงสคีมา SQLite จริงครบถ้วน)
  * เพิ่ม Deep Link `/?open=privacy` และหน้าต่าง `#sovereign-privacy-modal` (`initSovereignPrivacyController()` ใน `static/script.js`) พร้อมปุ่มเปิด RAG Vault และ Offline Vault
* **2.4 International Payment Rail Alongside PromptPay:**
  * เพิ่ม `INTERNATIONAL_BANK_DETAILS` ใน `app.py` โดยคงบัญชีจริงของบอสเท่านั้น (`SIWAT ROSAWAT` / `นาย ศิวัช รอสวัสดิ์`, ธนาคารกสิกรไทย `KASIKORNBANK PCL (KBANK)`, SWIFT/BIC `KASITHBK`, บัญชีย่อ `xxx-x-xx252-5`, PromptPay `004999252517585`) และรองรับการตรวจชื่อ `rosawat` ใน `verify_slip_data()`
  * อัปเดต `/api/subscription/plans` และ `POST /api/subscription/create-order` ให้คืนข้อมูล `international` และรองรับ `payment_rail` พร้อมตัวสลับช่องทางชำระเงิน `#btn-rail-promptpay` / `#btn-rail-international` ในหน้า Checkout ของ `#subscription-modal` (`KIRA_I18N` ครบ 5 ภาษา 35 คีย์ใหม่ทั้งหมด)
* **หมายเหตุสถานะโมดูลและกฎสำคัญเดิม:** คงโค้ด LINE OA (`/api/line/webhook`, `/api/line/diagnostics`) ไว้ครบ, ระบบชำระเงิน PromptPay บัญชีจริงบอส และ Auth มาตรฐานเท่าเทียมคงเดิม

---

### 🌐 2. สถานะการ Deploy และผลตรวจสอบ (Verification & Production Status)
* **Verification Suites (รันหลังแก้ไขโค้ดครั้งสุดท้ายครบ 100%):**
  * Syntax Check: `py_compile app.py discord_bot.py`, `node --check static/script.js`, `node --check static/sw.js` — ผ่าน
  * Combined Pytest Run (`25 passed`):
    * `test_phase2_secretary_suite.py`: 7/7 passed
    * `test_i18n_deep_audit.py`: 6/6 passed (100% key parity across `th`/`en`/`zh`/`ko`/`ja`, 0 untranslated Thai)
    * `test_pwa_pdf_suite.py`: 5/5 passed
    * `test_line_webhook.py`: 7/7 passed
  * Zero-Trust Auth Audit (`test_auth_suite.py`): 14/14 passed
* **Playwright E2E & Visual Audit (Local Uvicorn Desktop `1440x900` + Mobile `390x844`):**
  * ตรวจสอบ `/intake?owner=test_pro`, `/?open=intake`, `/?open=notifications`, `/?open=privacy`, และ `#subscription-modal` International Payment Rail (`v296_local_*.png`)
  * ผลลัพธ์: `Console errors: 0`, `Page errors: 0`, `HTTP 5xx: 0`, Mobile horizontal overflow `0px` (ทุกหน้าทดสอบ)
* **Production Repository:** `https://github.com/StarlightZipX/kira-public-engine.git` (Branch `main` → Auto-Deploy บน Render ที่ `https://kira-public-engine.onrender.com`)

---

### 🧭 3. แนวทางการพัฒนาหลัก (Master Development Direction — Boss Approved)
* **จุดยืนผลิตภัณฑ์ (Core Positioning):** **ผู้ช่วยและตัวแทนส่วนตัวของคนไทย (Thai-First Core, Global-Ready 5-Language Shell: `TH / EN / ZH / KO / JA`)**
* **นโยบายแพลตฟอร์ม (Owned Home Policy):** ยึด **Web + Mobile PWA** เป็นบ้านหลัก (`0฿` ค่าส่งข้อความ); **คงโค้ด LINE OA** (`/api/line/webhook`, `/api/line/diagnostics`) ใน `app.py` ไว้ตามคำสั่งบอสโดยไม่ขยายฟีเจอร์ AI ที่พึ่งพาโควตา Reply API ของ LINE

---

### 🗺️ 4. แผนพัฒนา 3 ระยะ (3-Phase Master Roadmap)
* **✅ ระยะที่ 1 (เสร็จสมบูรณ์ใน `v2.9.5` — PWA & Daily Thai Utilities):** Mobile PWA Shortcuts/Share Target, 1-Click Slip & Expense Ledger, Study & Document 1-Click Pack
* **✅ ระยะที่ 2 (เสร็จสมบูรณ์ใน `v2.9.6` — ตัวแทนรับงาน & เลขาส่วนตัว):** Personal Intake Portal + QR Card, PWA Notification Center, Sovereign Privacy / Local Engine Showcase & PDPA Export, International Payment Rail Switcher
* **🟡 ระยะที่ 3 (ถัดไป — Action Agent & Autonomous OS Companion):**
  1. **3.1 Cloud Web Computer Use:** Playwright Headless + Vision API + Live Split Canvas + Visual Prompt Injection Shield (ทำงานบน Sandbox เซิร์ฟเวอร์)
  2. **3.2 Desktop (`PyAutoGUI`) & Mobile (`ADB` / Accessibility) OS Companion:** ขยายแขนขาควบคุมระดับระบบปฏิบัติการสำหรับผู้ใช้ระดับสูง
