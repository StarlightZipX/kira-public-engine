# 🧠 KIRA AI SYSTEM - CURRENT TASK & LIVING STATE ANCHOR

## 🚀 สถานะล่าสุด (Active Build: Kira v2.9.8 Production)
- **Active Version:** `v2.9.8` (`KIRA_SYSTEM_VERSION = "2.9.8"`, SW Cache `kira-ai-cache-v2.9.8-polish`)
- **Production Endpoint:** `https://kira-public-engine.onrender.com` (Auto-Deploy ผ่าน `origin/main`)
- **กำหนดการ v3.0:** เตรียมปล่อย **Kira v3.0** ช่วง **ปีใหม่** ตามกำหนดการของบอส (คงสาย `v2.9.8` ไว้ในระหว่างนี้)

## ✅ งานระดับจุลภาคที่เพิ่งทำเสร็จสมบูรณ์ (Continuous Living Knowledge Engine in v2.9.8)
4. **ระบบฐานความรู้สดอัปเดตต่อเนื่อง & Credibility Firewall (`living_knowledge.py`, `kira_purity.py`, `discord_bot.py`, `rag_vault.py`, `app.py`, `templates/admin.html`):**
   - สร้าง `living_knowledge.py` (`living_knowledge_entries` รองรับทั้ง SQLite และ PostgreSQL พร้อมดัชนี 1024D Vector + Multilingual N-gram Hybrid Search)
   - อัปเดตข้อมูลเข้าฐานความรู้อัตโนมัติทันทีจาก 4 ช่องทาง: (1) ผลการค้นคว้าเว็บสด (`_perform_autonomous_deep_search` -> `ingest_web_research_findings`), (2) URL ที่ส่งให้อ่าน (`ingest_url_knowledge`), (3) Knowledge Pulse ซิงค์ข่าว/เทคโนโลยีอัตโนมัติทุก 30 นาทีบนเซิร์ฟเวอร์ (`sync_public_world_knowledge_pulse`), และ (4) การป้อนสอน/อัปเดตข้อเท็จจริงในแชตและหน้า Admin โดยแยก Trust Level (`boss`, `web_verified`, `world_pulse`, `user_note`) พร้อม Anti-Poisoning/Injection Guard
   - เชื่อม `rag_vault.py` เข้าคลัง `__kira_global__` เพื่อให้เอกสารกลางพร้อมอ้างอิงข้ามผู้ใช้และข้ามแชต รวมถึง Discord และ Web Chat
   - ปรับ `discord_bot.py` ให้ดึง Live Clock (Asia/Bangkok พ.ศ. 2569 / ค.ศ. 2026) + Living Knowledge + Global RAG + อ่าน URL + ใช้ `_decide_search` เต็มรูปแบบ พร้อม Retry Guard เมื่อโมเดลหลุดคำแก้ตัว
   - เพิ่ม Anti-Stale-Cutoff Firewall ใน `kira_purity.py` (`has_stale_knowledge_disclaimer` / `sanitize_stale_knowledge_disclaimer`) กำจัดข้อความหลุด *"จำกัดถึง มิ.ย. 2567 / ฐานข้อมูลไม่อัปเดต"* ในทุกช่องทาง (Web / Discord / LINE)
   - เพิ่ม API `/api/knowledge/*` (`status`, `entries`, `ingest`, `sync`, `delete`) และแท็บ **`🧠 Living Knowledge`** ใน `/admin_boss` (`templates/admin.html`)

## ✅ งานก่อนหน้าในสาย v2.9.8 (Item 1 & Item 2)
1. **Version Sync & PWA Shortcuts Cleanup (Item 1):**
   - อัปเดต `KIRA_SYSTEM_VERSION = "2.9.8"`, `KIRA_RELEASE_DATA` ครบ 5 ภาษา (`TH/EN/ZH/KO/JA`), `templates/index.html` fallback title/tag, UA `KiraSandboxInspector/2.9.8`, และ `static/sw.js` (`kira-ai-cache-v2.9.8-polish` + `?v=20261115_v298_polish`)
   - อัปเดต `static/manifest.json` ให้มี PWA Shortcuts ครบทั้ง `Offline Vault` และ `Virtual Boardroom`
   - อัปเดต `test_canvas_share_suite.py`, `test_zero_silence_protocol.py`, `test_subscription_suite.py` ให้ตรงสเปก `v2.9.8` ล่าสุดทั้งหมด
2. **Multi-Device Modal & Checkout Responsive Polish (Item 1):**
   - แก้ไข Responsive `@media (max-width: 640px)` ใน `static/style.css` ครบทุก Modals ทั้ง 19 ตัว (ยืนยัน `cardOverflowX = false` และ `docOverflowX = false` บน `360px / 768px / 1280px`)
   - จัดระเบียบ `#boardroom-debate-modal` บนมือถือให้วาง `Roundtable Arena` เป็นกริด 2 คอลัมน์ไม่ซ้อนทับกัน และแถบ Setup Stack แนวตั้งครบช่อง
   - แก้ไข `#settings-modal` footer ให้อยู่บรรทัดเดียวสวยงาม, `#subscription-modal` checkout ให้อยู่ครบในกรอบพร้อม `129.00 ฿` ไม่ตกบรรทัด, `#rmbg-modal` tab bar, และ `#transcribe-modal` select width
3. **Production Ops, Payment Flow & `/admin_boss` Fixes (Item 2):**
   - แก้ไข `upload_subscription_slip` ใน `app.py` ให้คืน `"status": "pending_review"` & `"order_status": "pending_review"` อย่างถูกต้องเมื่อ AI ส่งต่อให้แอดมินตรวจ (ไม่อ้างสิทธิ์เปิดทันทีและไม่ส่ง welcome ก่อนตรวจ)
   - แก้ไข `static/script.js` และ `templates/admin.html` ให้นับ/แสดงผลและมีปุ่ม อนุมัติ/ปฏิเสธ สำหรับรายการ `pending_review` ครบถ้วน พร้อมเพิ่ม `startOrderStatusPolling` บนหน้าเว็บ
   - แก้ไข Date Filter ใน `/admin_boss` (`app.py`) ให้ใช้ parameterized `SUBSTR(CAST(timestamp AS TEXT), 1, 10)` รองรับทั้ง SQLite และ PostgreSQL
   - เพิ่ม in-page `#admin-slip-lightbox` ใน `templates/admin.html` แทน `window.open("")` เพื่อให้เปิดดูสลิปบนมือถือได้ลื่นไหล พร้อมจัด layout ฟอร์ม Dictionary บนมือถือ (`flex-col sm:flex-row`)

## 🛡️ กฎหลักและบริบทระบบที่คงอยู่เสมอ
- **บัญชีรับโอนของบอส (ห้ามเปลี่ยนแปลง):** นาย ศิวัช รอสวัสดิ์ • ธนาคารกสิกรไทย (KBANK) `004-9-99252-5` • PromptPay `004999252517585`
- **LINE OA Code:** คงโค้ด `/api/line/webhook` และ `/api/line/diagnostics` ไว้ครบถ้วน
- **Absolute Equality Auth:** ทุกคนล็อกอินผ่านฟอร์มมาตรฐานเดียวกัน ไม่มีปุ่ม Fast-Pass ส่วนตัว (`hasBossFastPassShortcut = false`)
- **Admin Dashboard:** `/admin_boss` (รหัสผ่าน Master Key `kira1234`) พร้อมปุ่ม Logout

## 📌 สิ่งที่ทำต่อในสเต็ปถัดไป
- เฝ้าติดตามการใช้งานจริงบน `https://kira-public-engine.onrender.com` (ยอดคำสั่งซื้อ KBANK/PromptPay, `/admin_boss`, และการโต้ตอบของ AI)
- วางแผนใหญ่สำหรับ **`Kira v3.0`** รับปีใหม่ตามกำหนดการของบอส
