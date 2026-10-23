import os
import subprocess
import time

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUTPUT_DIR = os.path.abspath("static/images")
SCRATCH_DIR = os.path.abspath("scratch")
os.makedirs(SCRATCH_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 1. 16:9 Banner (1920x1080)
HTML_16X9 = """<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700;800&family=Orbitron:wght@600;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            width: 1920px;
            height: 1080px;
            background: #060913;
            color: #f8fafc;
            font-family: 'Prompt', sans-serif;
            overflow: hidden;
            position: relative;
            display: flex;
        }

        /* Ambient Glows */
        .ambient-glow-cyan {
            position: absolute;
            top: -120px;
            left: -100px;
            width: 750px;
            height: 750px;
            background: radial-gradient(circle, rgba(6, 182, 212, 0.22) 0%, rgba(6, 182, 212, 0) 70%);
            filter: blur(80px);
            z-index: 1;
            pointer-events: none;
        }
        .ambient-glow-amber {
            position: absolute;
            bottom: -150px;
            left: 300px;
            width: 700px;
            height: 700px;
            background: radial-gradient(circle, rgba(245, 158, 11, 0.16) 0%, rgba(245, 158, 11, 0) 70%);
            filter: blur(90px);
            z-index: 1;
            pointer-events: none;
        }
        .ambient-glow-purple {
            position: absolute;
            top: 20%;
            right: 10%;
            width: 800px;
            height: 800px;
            background: radial-gradient(circle, rgba(147, 51, 234, 0.2) 0%, rgba(147, 51, 234, 0) 70%);
            filter: blur(100px);
            z-index: 1;
            pointer-events: none;
        }

        /* Grid lines background overlay */
        .grid-overlay {
            position: absolute;
            inset: 0;
            background-image: 
                linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
            background-size: 60px 60px;
            z-index: 2;
            pointer-events: none;
        }

        /* Content Layout: Left Information (56%), Right Visual Art (44%) */
        .left-col {
            width: 58%;
            height: 100%;
            padding: 70px 80px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            z-index: 10;
        }

        .brand-header {
            display: flex;
            align-items: center;
            gap: 20px;
        }
        .logo-box {
            width: 70px;
            height: 70px;
            border-radius: 20px;
            background: linear-gradient(135deg, #0284c7, #8b5cf6);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 35px rgba(6, 182, 212, 0.6);
            border: 1.5px solid rgba(255, 255, 255, 0.3);
        }
        .brand-info h2 {
            font-family: 'Orbitron', 'Prompt', sans-serif;
            font-size: 34px;
            font-weight: 800;
            letter-spacing: 2px;
            background: linear-gradient(135deg, #ffffff 40%, #38bdf8 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .brand-info p {
            font-size: 17px;
            color: #94a3b8;
            font-weight: 400;
            letter-spacing: 0.5px;
        }

        /* Badge */
        .badge-bar {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            padding: 10px 22px;
            background: rgba(245, 158, 11, 0.12);
            border: 1px solid rgba(245, 158, 11, 0.45);
            border-radius: 9999px;
            width: fit-content;
            box-shadow: 0 0 25px rgba(245, 158, 11, 0.2);
            margin-bottom: 24px;
        }
        .badge-dot {
            width: 12px;
            height: 12px;
            background: #f59e0b;
            border-radius: 50%;
            box-shadow: 0 0 12px #f59e0b;
            animation: pulse 2s infinite;
        }
        .badge-text {
            font-size: 18px;
            font-weight: 700;
            color: #fbbf24;
            letter-spacing: 1px;
            text-transform: uppercase;
        }

        /* Title */
        .main-title {
            font-size: 60px;
            font-weight: 800;
            line-height: 1.18;
            margin-bottom: 24px;
            background: linear-gradient(135deg, #ffffff 30%, #e0e7ff 70%, #93c5fd 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }

        /* Time Highlight Card */
        .time-card {
            background: linear-gradient(135deg, rgba(30, 41, 59, 0.75), rgba(15, 23, 42, 0.85));
            border: 1.5px solid rgba(56, 189, 248, 0.35);
            border-radius: 24px;
            padding: 30px 36px;
            margin-bottom: 30px;
            box-shadow: 0 20px 45px -15px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(20px);
        }
        .time-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .time-item {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .time-label {
            font-size: 16px;
            font-weight: 500;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .time-val {
            font-size: 34px;
            font-weight: 800;
            color: #38bdf8;
            font-family: 'Orbitron', 'Prompt', sans-serif;
            text-shadow: 0 0 20px rgba(56, 189, 248, 0.4);
        }
        .time-val.clock {
            color: #fbbf24;
            text-shadow: 0 0 20px rgba(251, 191, 36, 0.45);
        }
        .time-divider {
            width: 1.5px;
            height: 60px;
            background: rgba(255, 255, 255, 0.12);
        }

        /* Bullet Points */
        .details-list {
            display: flex;
            flex-direction: column;
            gap: 16px;
            margin-bottom: 35px;
        }
        .detail-item {
            display: flex;
            align-items: center;
            gap: 16px;
            font-size: 20px;
            color: #cbd5e1;
            font-weight: 400;
        }
        .detail-icon {
            width: 32px;
            height: 32px;
            border-radius: 10px;
            background: rgba(56, 189, 248, 0.15);
            border: 1px solid rgba(56, 189, 248, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #38bdf8;
            font-size: 16px;
            flex-shrink: 0;
        }

        /* Footer */
        .footer-note {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            color: #94a3b8;
            font-size: 17px;
        }
        .footer-note strong {
            color: #f1f5f9;
        }

        /* Right Visual Art Container */
        .right-col {
            width: 42%;
            height: 100%;
            position: relative;
            z-index: 5;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .image-frame {
            position: relative;
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
        .image-frame img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
        }
        /* Gradient mask feathering into left col */
        .image-mask {
            position: absolute;
            inset: 0;
            background: linear-gradient(90deg, #060913 0%, rgba(6, 9, 19, 0.7) 20%, rgba(6, 9, 19, 0) 50%),
                        linear-gradient(0deg, #060913 0%, rgba(6, 9, 19, 0) 25%),
                        linear-gradient(180deg, #060913 0%, rgba(6, 9, 19, 0) 20%);
            pointer-events: none;
        }
        .art-badge {
            position: absolute;
            bottom: 60px;
            right: 60px;
            padding: 14px 26px;
            background: rgba(15, 23, 42, 0.85);
            border: 1px solid rgba(139, 92, 246, 0.45);
            border-radius: 18px;
            backdrop-filter: blur(16px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .art-badge-text {
            font-size: 16px;
            font-weight: 600;
            color: #e2e8f0;
        }
        .art-badge-text span {
            color: #c084fc;
            display: block;
            font-size: 13px;
            font-weight: 400;
        }
    </style>
</head>
<body>
    <div class="ambient-glow-cyan"></div>
    <div class="ambient-glow-amber"></div>
    <div class="ambient-glow-purple"></div>
    <div class="grid-overlay"></div>

    <div class="left-col">
        <div class="brand-header">
            <div class="logo-box">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
            </div>
            <div class="brand-info">
                <h2>KIRA AI SYSTEM</h2>
                <p>Enterprise Symbiotic Intelligence Platform (v2.6)</p>
            </div>
        </div>

        <div>
            <div class="badge-bar">
                <div class="badge-dot"></div>
                <div class="badge-text">⚡ ประกาศปิดปรับปรุงระบบชั่วคราว (Maintenance Notice)</div>
            </div>

            <h1 class="main-title">
                ยกระดับประสิทธิภาพเซิร์ฟเวอร์<br>
                และเตรียมพร้อมอัปเดตระบบใหญ่
            </h1>

            <div class="time-card">
                <div class="time-row">
                    <div class="time-item">
                        <span class="time-label">📅 วันที่ดำเนินการ</span>
                        <span class="time-val">23 OCT 2026</span>
                    </div>
                    <div class="time-divider"></div>
                    <div class="time-item">
                        <span class="time-label">⏰ ช่วงเวลาปิดระบบ (2 ชม.)</span>
                        <span class="time-val clock">18:00 - 20:00 น.</span>
                    </div>
                    <div class="time-divider"></div>
                    <div class="time-item">
                        <span class="time-label">🚀 กลับมาออนไลน์</span>
                        <span class="time-val" style="color: #4ade80;">20:00 น. ตรง</span>
                    </div>
                </div>
            </div>

            <div class="details-list">
                <div class="detail-item">
                    <div class="detail-icon">✓</div>
                    <span><strong>เพิ่มขุมพลัง Core Processing:</strong> ปรับจูน Router & Consensus Engine ให้ตอบสนองเร็วขึ้น 30%</span>
                </div>
                <div class="detail-item">
                    <div class="detail-icon">✓</div>
                    <span><strong>เสริมเกราะความปลอดภัยระดับสูงสุด:</strong> อัปเดต Security Protocols & Iron Citadel v2.6</span>
                </div>
                <div class="detail-item">
                    <div class="detail-icon">✓</div>
                    <span><strong>ข้อมูลปลอดภัย 100%:</strong> ประวัติการสนทนา, Knowledge Vault และการตั้งค่าของท่านปลอดภัยสมบูรณ์</span>
                </div>
            </div>
        </div>

        <div class="footer-note">
            <span>ขออภัยในความไม่สะดวกเป็นอย่างยิ่งค่ะ • <strong>ทีมงานผู้พัฒนา Kira AI</strong></span>
            <span style="color: #64748b;">https://kira-public-engine.onrender.com</span>
        </div>
    </div>

    <div class="right-col">
        <div class="image-frame">
            <img src="{IMAGE_URL}" alt="Kira Maintenance Artwork">
            <div class="image-mask"></div>
            <div class="art-badge">
                <div style="width: 10px; height: 10px; background: #a855f7; border-radius: 50%; box-shadow: 0 0 10px #a855f7;"></div>
                <div class="art-badge-text">
                    KIRA RECHARGING & OPTIMIZING
                    <span>System Sync in Progress</span>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
"""

# 2. 1:1 Square Card (1080x1080) for Social Media Feeds (Facebook, IG, LINE OA)
HTML_1X1 = """<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700;800&family=Orbitron:wght@600;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            width: 1080px;
            height: 1080px;
            background: #060913;
            color: #f8fafc;
            font-family: 'Prompt', sans-serif;
            overflow: hidden;
            position: relative;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 50px 60px;
        }

        .ambient-glow-1 {
            position: absolute;
            top: -100px;
            right: -100px;
            width: 550px;
            height: 550px;
            background: radial-gradient(circle, rgba(139, 92, 246, 0.22) 0%, rgba(139, 92, 246, 0) 70%);
            filter: blur(80px);
            z-index: 1;
        }
        .ambient-glow-2 {
            position: absolute;
            bottom: -80px;
            left: -80px;
            width: 550px;
            height: 550px;
            background: radial-gradient(circle, rgba(6, 182, 212, 0.22) 0%, rgba(6, 182, 212, 0) 70%);
            filter: blur(80px);
            z-index: 1;
        }
        .grid-overlay {
            position: absolute;
            inset: 0;
            background-image: 
                linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
            background-size: 50px 50px;
            z-index: 2;
        }

        /* Header */
        .top-bar {
            position: relative;
            z-index: 10;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .brand-box {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .brand-icon {
            width: 56px;
            height: 56px;
            border-radius: 16px;
            background: linear-gradient(135deg, #0284c7, #8b5cf6);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 25px rgba(6, 182, 212, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
        .brand-name {
            font-family: 'Orbitron', 'Prompt', sans-serif;
            font-size: 26px;
            font-weight: 800;
            letter-spacing: 1.5px;
            background: linear-gradient(135deg, #ffffff 40%, #38bdf8 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .brand-sub {
            font-size: 14px;
            color: #94a3b8;
        }

        .badge-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 18px;
            background: rgba(245, 158, 11, 0.14);
            border: 1px solid rgba(245, 158, 11, 0.45);
            border-radius: 9999px;
            color: #fbbf24;
            font-size: 15px;
            font-weight: 700;
            letter-spacing: 0.5px;
            box-shadow: 0 0 15px rgba(245, 158, 11, 0.2);
        }
        .badge-pill span {
            width: 8px;
            height: 8px;
            background: #f59e0b;
            border-radius: 50%;
            box-shadow: 0 0 8px #f59e0b;
        }

        /* Middle Body */
        .mid-content {
            position: relative;
            z-index: 10;
        }
        .headline {
            font-size: 42px;
            font-weight: 800;
            line-height: 1.25;
            margin-bottom: 20px;
            background: linear-gradient(135deg, #ffffff 40%, #93c5fd 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        /* Visual Showcase */
        .art-banner-box {
            position: relative;
            width: 100%;
            height: 340px;
            border-radius: 24px;
            overflow: hidden;
            border: 1.5px solid rgba(56, 189, 248, 0.3);
            box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.7);
            margin-bottom: 25px;
        }
        .art-banner-box img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center 30%;
        }
        .art-overlay-gradient {
            position: absolute;
            inset: 0;
            background: linear-gradient(0deg, rgba(6, 9, 19, 0.95) 0%, rgba(6, 9, 19, 0.2) 60%, rgba(6, 9, 19, 0) 100%);
        }
        .art-overlay-text {
            position: absolute;
            bottom: 20px;
            left: 24px;
            right: 24px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }
        .art-status {
            font-size: 15px;
            color: #e2e8f0;
            font-weight: 600;
        }
        .art-status span {
            color: #38bdf8;
            font-weight: 700;
        }

        /* Time & Date Card */
        .schedule-box {
            background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9));
            border: 1.5px solid rgba(245, 158, 11, 0.4);
            border-radius: 20px;
            padding: 22px 28px;
            margin-bottom: 24px;
            box-shadow: 0 15px 35px -10px rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .schedule-col h4 {
            font-size: 14px;
            color: #94a3b8;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 4px;
        }
        .schedule-col .val {
            font-size: 26px;
            font-weight: 800;
            font-family: 'Orbitron', 'Prompt', sans-serif;
            color: #fbbf24;
            text-shadow: 0 0 15px rgba(251, 191, 36, 0.35);
        }
        .schedule-divider {
            width: 1px;
            height: 50px;
            background: rgba(255, 255, 255, 0.15);
        }

        /* Points */
        .bullet-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .bullet-row {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 17px;
            color: #cbd5e1;
        }
        .bullet-check {
            width: 24px;
            height: 24px;
            border-radius: 8px;
            background: rgba(34, 197, 94, 0.15);
            border: 1px solid rgba(34, 197, 94, 0.4);
            color: #4ade80;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 700;
            flex-shrink: 0;
        }

        /* Bottom */
        .bottom-bar {
            position: relative;
            z-index: 10;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: 18px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            font-size: 15px;
            color: #94a3b8;
        }
        .bottom-bar strong {
            color: #f8fafc;
        }
    </style>
</head>
<body>
    <div class="ambient-glow-1"></div>
    <div class="ambient-glow-2"></div>
    <div class="grid-overlay"></div>

    <div class="top-bar">
        <div class="brand-box">
            <div class="brand-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
            </div>
            <div>
                <div class="brand-name">KIRA AI SYSTEM</div>
                <div class="brand-sub">Symbiotic Intelligence v2.6</div>
            </div>
        </div>
        <div class="badge-pill">
            <span></span>
            MAINTENANCE NOTICE
        </div>
    </div>

    <div class="mid-content">
        <div class="headline">
            ประกาศปิดปรับปรุงระบบชั่วคราว<br>
            เพื่อยกระดับประสิทธิภาพเซิร์ฟเวอร์
        </div>

        <div class="art-banner-box">
            <img src="{IMAGE_URL}" alt="Kira Maintenance Artwork">
            <div class="art-overlay-gradient"></div>
            <div class="art-overlay-text">
                <div class="art-status">
                    สถานะ: <span>กำลังเตรียมปรับปรุงโครงสร้างพื้นฐาน</span>
                </div>
                <div style="font-size: 13px; color: #a855f7; font-weight: 600;">
                    SYSTEM RECHARGE MODE
                </div>
            </div>
        </div>

        <div class="schedule-box">
            <div class="schedule-col">
                <h4>📅 วันที่ดำเนินการ</h4>
                <div class="val" style="color: #38bdf8;">23 OCT 2026</div>
            </div>
            <div class="schedule-divider"></div>
            <div class="schedule-col">
                <h4>⏰ ช่วงเวลาปิดปรับปรุง</h4>
                <div class="val">18:00 - 20:00 น.</div>
            </div>
            <div class="schedule-divider"></div>
            <div class="schedule-col">
                <h4>⏱️ ระยะเวลา</h4>
                <div class="val" style="color: #4ade80;">~ 2 ชั่วโมง</div>
            </div>
        </div>

        <div class="bullet-list">
            <div class="bullet-row">
                <div class="bullet-check">✓</div>
                <span>ยกระดับ Core AI Router & ความเร็วในการประมวลผลขึ้น 30%</span>
            </div>
            <div class="bullet-row">
                <div class="bullet-check">✓</div>
                <span>เสริมความปลอดภัยเกราะ Iron Citadel v2.6 และฐานข้อมูล</span>
            </div>
            <div class="bullet-row">
                <div class="bullet-check">✓</div>
                <span>ข้อมูลและประวัติการสนทนาทั้งหมดของผู้ใช้ปลอดภัย 100%</span>
            </div>
        </div>
    </div>

    <div class="bottom-bar">
        <span>ขออภัยในความไม่สะดวกค่ะ • <strong>ทีมผู้พัฒนา Kira AI</strong></span>
        <span style="color: #38bdf8; font-weight: 600;">กลับมาพบกันเวลา 20:00 น.</span>
    </div>
</body>
</html>
"""

def render_poster():
    # Convert image to absolute file uri for local html rendering
    img_path = os.path.abspath("static/images/kira_maintenance_art.jpg").replace("\\", "/")
    img_uri = f"file:///{img_path}"

    html_16x9_path = os.path.join(SCRATCH_DIR, "maintenance_16x9.html")
    html_1x1_path = os.path.join(SCRATCH_DIR, "maintenance_1x1.html")

    out_16x9 = os.path.join(OUTPUT_DIR, "kira_maintenance_banner_16x9.png")
    out_1x1 = os.path.join(OUTPUT_DIR, "kira_maintenance_post_1x1.png")

    with open(html_16x9_path, "w", encoding="utf-8") as f:
        f.write(HTML_16X9.replace("{IMAGE_URL}", img_uri))

    with open(html_1x1_path, "w", encoding="utf-8") as f:
        f.write(HTML_1X1.replace("{IMAGE_URL}", img_uri))

    print("Rendering 16:9 Banner (1920x1080)...")
    cmd_16x9 = [
        CHROME_PATH,
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        "--window-size=1920,1080",
        f"--screenshot={out_16x9}",
        f"file:///{os.path.abspath(html_16x9_path)}"
    ]
    subprocess.run(cmd_16x9, check=True)
    print(f"Rendered: {out_16x9}")

    print("Rendering 1:1 Square Post (1080x1080)...")
    cmd_1x1 = [
        CHROME_PATH,
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        "--window-size=1080,1080",
        f"--screenshot={out_1x1}",
        f"file:///{os.path.abspath(html_1x1_path)}"
    ]
    subprocess.run(cmd_1x1, check=True)
    print(f"Rendered: {out_1x1}")

if __name__ == "__main__":
    render_poster()
