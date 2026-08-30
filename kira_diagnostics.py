import os
import sys
import time
import requests
from dotenv import load_dotenv

# Fix Windows console encoding for UTF-8 and Thai emojis
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

load_dotenv()

print("====================================================================")
print("🤖 KIRA AI 2.1 - SYSTEM DIAGNOSTICS & HARDWARE/CLOUD SCAN")
print("====================================================================\n")

# 1. Environment & API Keys Scan
print("🔑 [1/5] สแกน API Keys & Providers ในระบบ...")
def _clean_key(k: str) -> str:
    return k.strip().strip('"`\'[] \t\r\n') if k else ""

raw_groq = os.environ.get("GROQ_API_KEYS", os.environ.get("GROQ_API_KEY", ""))
groq_keys = [_clean_key(k) for k in raw_groq.replace(";", ",").replace("\n", ",").split(",") if _clean_key(k) and _clean_key(k) != "YOUR_GROQ_API_KEY_HERE"]

raw_or = os.environ.get("OPENROUTER_API_KEYS", os.environ.get("OPENROUTER_API_KEY", ""))
or_keys = [_clean_key(k) for k in raw_or.replace(";", ",").replace("\n", ",").split(",") if _clean_key(k)]

ollama_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1")
enable_ollama = os.environ.get("ENABLE_OLLAMA", "false").lower() in ("true", "1", "yes")

print(f"  • Groq API Keys: {len(groq_keys)} ดอก ({'พร้อมใช้งาน ✅' if groq_keys else 'ไม่มี ⚠️'})")
print(f"  • OpenRouter Deep-Brain Keys: {len(or_keys)} ดอก ({'พร้อมใช้งาน ✅' if or_keys else 'Standby ℹ️'})")
print(f"  • Local Ollama GPU: {'เปิดใช้งาน ✅ (' + ollama_url + ')' if enable_ollama else 'ปิดการใช้งาน (Cloud Mode) ☁️'}")

# 2. Test Groq Multi-Keys Cluster
print("\n⚡ [2/5] ทดสอบการเชื่อมต่อ Groq Supercluster...")
if groq_keys:
    for idx, key in enumerate(groq_keys, 1):
        masked_key = key[:6] + "..." + key[-4:] if len(key) > 10 else "***"
        try:
            headers = {"Authorization": f"Bearer {key}"}
            res = requests.get("https://api.groq.com/openai/v1/models", headers=headers, timeout=6)
            if res.status_code == 200:
                models = [m.get("id") for m in res.json().get("data", [])]
                print(f"  ✅ Key #{idx} [{masked_key}]: เชื่อมต่อสำเร็จ! (พบ {len(models)} โมเดล)")
            else:
                print(f"  ⚠️ Key #{idx} [{masked_key}]: HTTP {res.status_code} - {res.text[:80]}")
        except Exception as e:
            print(f"  ❌ Key #{idx} [{masked_key}]: Connection Error - {str(e)}")
else:
    print("  ⚠️ ข้ามการทดสอบ Groq เนื่องจากไม่มี API Key")

# 3. Test Database Integrity
print("\n💾 [3/5] ทดสอบฐานข้อมูล & โครงข่ายความจำ (Database & Memory)...")
db_url = os.environ.get("DATABASE_URL")
if db_url:
    print("  🐘 Mode: PostgreSQL Cloud Database")
    try:
        import psycopg2
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM users")
        user_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM user_knowledge_graph")
        kg_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM logs")
        log_count = cur.fetchone()[0]
        print(f"  ✅ เชื่อมต่อ PostgreSQL สำเร็จ! (ผู้ใช้: {user_count} คน, ความจำ Graph: {kg_count} รายการ, ประวัติแชต: {log_count} ข้อความ)")
        conn.close()
    except Exception as e:
        print(f"  ❌ PostgreSQL Error: {e}")
else:
    print("  🗄️ Mode: Local SQLite Database")
    try:
        import sqlite3
        base_dir = os.path.dirname(os.path.abspath(__file__))
        db_file = os.path.join(base_dir, "chat_logs.db")
        if os.path.exists(db_file):
            conn = sqlite3.connect(db_file)
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM users")
            user_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM user_knowledge_graph")
            kg_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM logs")
            log_count = cur.fetchone()[0]
            print(f"  ✅ อ่าน SQLite สำเร็จ! (ผู้ใช้: {user_count} คน, ความจำ Graph: {kg_count} รายการ, ประวัติแชต: {log_count} ข้อความ)")
            conn.close()
        else:
            print(f"  ℹ️ ไม่พบไฟล์ {db_file} (จะถูกสร้างอัตโนมัติเมื่อรันแอป)")
    except Exception as e:
        print(f"  ❌ SQLite Error: {e}")

# 4. Test Neural Voice (Edge-TTS)
print("\n🎙️ [4/5] ตรวจสอบระบบเสียงสังเคราะห์ประสาทเทียม (Edge-TTS)...")
try:
    import edge_tts
    print("  ✅ edge-tts Library ติดตั้งสมบูรณ์ (พร้อมสร้างเสียงภาษาไทย th-TH-PremwadeeNeural)")
except ImportError:
    print("  ❌ ไม่พบ edge-tts กรุณารัน pip install edge-tts")

# 5. Live Production URL Reachability
print("\n🌐 [5/5] ตรวจสอบสถานะ Production Web Endpoint...")
prod_url = "https://kira-public-engine.onrender.com"
try:
    t0 = time.time()
    res = requests.get(f"{prod_url}/api/health", timeout=12)
    elapsed = time.time() - t0
    if res.status_code == 200:
        data = res.json()
        print(f"  ✅ Live Production Ready! ({prod_url})")
        print(f"     Status: {data.get('status')}, Engine: {data.get('engine')}, Response Time: {elapsed:.2f}s")
    else:
        print(f"  ⚠️ Live Production Status: HTTP {res.status_code} ({elapsed:.2f}s)")
except Exception as e:
    print(f"  ℹ️ Live Production Notice (อาจกำลังตื่นจาก sleep): {e}")

print("\n====================================================================")
print("✨ การวินิจฉัยและสแกนระบบเสร็จสมบูรณ์ 100%")
print("====================================================================")
