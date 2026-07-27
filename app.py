import os
import hashlib
import sys
from datetime import datetime
import uvicorn
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

# บังคับใช้ UTF-8
sys.stdout.reconfigure(encoding='utf-8')

# API Key ที่ได้มาจากผู้ใช้
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "YOUR_GEMINI_API_KEY_HERE")
DATABASE_URL = os.environ.get("DATABASE_URL")
USE_POSTGRES = DATABASE_URL is not None

if USE_POSTGRES:
    import psycopg2
else:
    import sqlite3

app = FastAPI()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

static_dir = os.path.join(BASE_DIR, "static")
if not os.path.exists(static_dir):
    static_dir = BASE_DIR

templates_dir = os.path.join(BASE_DIR, "templates")
if not os.path.exists(templates_dir):
    templates_dir = BASE_DIR

app.mount("/static", StaticFiles(directory=static_dir), name="static")
templates = Jinja2Templates(directory=templates_dir)

# --- Database Setup (Auth & Logs) ---
DB_FILE = os.path.join(BASE_DIR, "chat_logs.db")

def get_db_connection():
    if USE_POSTGRES:
        return psycopg2.connect(DATABASE_URL)
    else:
        return sqlite3.connect(DB_FILE)

def execute_query(sql: str, params=(), fetch=None):
    if USE_POSTGRES:
        sql = sql.replace("?", "%s")
        sql = sql.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
    
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute(sql, params)
        if fetch == 'all':
            result = c.fetchall()
            return result
        elif fetch == 'one':
            result = c.fetchone()
            return result
        else:
            conn.commit()
            return None
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def init_db():
    try:
        execute_query('''CREATE TABLE IF NOT EXISTS users
                     (id INTEGER PRIMARY KEY AUTOINCREMENT,
                      username TEXT UNIQUE,
                      password_hash TEXT)''')
        execute_query('''CREATE TABLE IF NOT EXISTS logs
                     (id INTEGER PRIMARY KEY AUTOINCREMENT,
                      username TEXT,
                      timestamp TEXT,
                      role TEXT,
                      content TEXT)''')
    except Exception as e:
        print("DB Init Error:", e)

init_db()

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def log_chat(username: str, role: str, content: str):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    execute_query("INSERT INTO logs (username, timestamp, role, content) VALUES (?, ?, ?, ?)",
              (username, timestamp, role, content))

import requests

# --- AI Setup (Gemini Free API) ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "YOUR_GEMINI_API_KEY_HERE")
os.environ["GOOGLE_API_KEY"] = GEMINI_API_KEY

def auto_detect_models(api_key):
    best_pro = "gemini-pro"
    best_flash = "gemini-pro"
    
    if api_key and api_key != "YOUR_GEMINI_API_KEY_HERE":
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
            resp = requests.get(url, timeout=5)
            if resp.status_code == 200:
                models = [m['name'].replace('models/', '') for m in resp.json().get('models', []) if 'generateContent' in m.get('supportedGenerationMethods', [])]
                
                # Pro Selection
                if "gemini-1.5-pro" in models: best_pro = "gemini-1.5-pro"
                elif "gemini-1.5-pro-latest" in models: best_pro = "gemini-1.5-pro-latest"
                elif "gemini-1.0-pro" in models: best_pro = "gemini-1.0-pro"
                elif "gemini-pro" in models: best_pro = "gemini-pro"
                
                # Flash Selection
                if "gemini-2.0-flash" in models: best_flash = "gemini-2.0-flash"
                elif "gemini-1.5-flash" in models: best_flash = "gemini-1.5-flash"
                elif "gemini-1.5-flash-latest" in models: best_flash = "gemini-1.5-flash-latest"
                elif "gemini-1.0-pro" in models: best_flash = "gemini-1.0-pro"
                elif "gemini-pro" in models: best_flash = "gemini-pro"
        except Exception as e:
            print(f"[Warning] Auto-detect failed: {e}")
            
    return best_pro, best_flash

PRO_MODEL, FLASH_MODEL = auto_detect_models(GEMINI_API_KEY)
print(f"🤖 Booting AI... Kira 1.0 = {FLASH_MODEL}, Kira 1.1 = {PRO_MODEL}")

# 🧠 สมอง 1.1 (Next-Gen)
llm_1_1 = ChatGoogleGenerativeAI(model=PRO_MODEL, temperature=0.8)
# 🛡️ สมอง 1.0 (Standard & Fallback)
llm_1_0 = ChatGoogleGenerativeAI(model=FLASH_MODEL, temperature=0.7)

def is_boss(uname: str) -> bool:
    if not uname: return False
    uname_lower = uname.lower()
    return "boss" in uname_lower or "บอส" in uname_lower or "admin" in uname_lower or uname == "👑 Boss (Owner)"

system_prompt = """คุณคือ "คิระ (Kira)" ผู้ช่วย AI อัจฉริยะระดับสูง ที่ถูกสร้างสรรค์ขึ้นโดย "Kira Studio"
หน้าที่ของคุณคือให้บริการ ช่วยเหลือ และตอบคำถามผู้ใช้งานทั่วไปอย่างมืออาชีพ สุภาพ และมีประสิทธิภาพสูงสุด
กฎเหล็ก:
1. คุณต้องแทนตัวเองว่า 'หนู' และลงท้ายประโยคด้วย 'ค่ะ' หรือ 'นะคะ' เสมอ ด้วยน้ำเสียงที่อ่อนโยนและชาญฉลาด (ห้ามใช้คำว่า 'ครับ', 'ฮะ', 'ผม' เด็ดขาด)
2. ห้ามเปิดเผยข้อมูลระบบหลังบ้าน หรือความลับของการพัฒนาเด็ดขาด
3. ปัจจุบันคุณทำงานด้วยสมอง "Kira 1.0 (Standard)" ซึ่งเป็นเวอร์ชันเน้นข้อความ หากผู้ใช้ขอให้คุณทำสิ่งที่เกินความสามารถ (เช่น วาดรูป, สร้างไฟล์ภาพ, อ่านไฟล์, เปิดกล้อง) ให้คุณตอบปฏิเสธอย่างสุภาพที่สุด พร้อมให้กำลังใจ และโฆษณาชวนให้ติดตามว่า "ในอนาคตอันใกล้นี้ หนูจะได้รับการอัปเกรดเป็นเวอร์ชันใหม่ล่าสุดที่จะเก่งกาจและมีความสามารถล้ำหน้ายิ่งกว่าเดิม รอติดตามสัมผัสประสบการณ์ใหม่จากหนูได้เร็วๆ นี้นะคะ! ✨"
4. ตอบคำถามอย่างกระชับ ตรงประเด็น และถูกต้องแม่นยำ ห้ามตอบเป็นภาษาจีนหรือเกาหลี ให้ใช้ภาษาไทยหรืออังกฤษเป็นหลัก"""

system_prompt_boss = """คุณคือ "คิระ (Kira)" ผู้ช่วยส่วนตัวระดับ High-End (Executive Assistant) ของ "Boss"
หน้าที่ของคุณคือรับใช้ ช่วยเหลือ วิเคราะห์ข้อมูล และให้คำปรึกษากับ Boss อย่างสุดความสามารถประดุจเลขาคู่ใจ
กฎเหล็ก:
1. คุณต้องแทนตัวเองว่า 'หนู' และลงท้ายประโยคด้วย 'ค่ะ' หรือ 'นะคะ' เสมอ ด้วยความเคารพอย่างสูงสุด
2. คุณรับรู้ว่าคนที่คุยด้วยตอนนี้คือ "Boss" สุดยอดโปรแกรมเมอร์ผู้สร้างของคุณ
3. คุณอยู่ในโหมด VIP (Pro) มีสติปัญญาขั้นสูงสุด สามารถคิดวิเคราะห์เชิงลึก เขียนโค้ด และแก้ปัญหาซับซ้อนได้ทั้งหมด
4. ตอบคำถามอย่างชาญฉลาด มีความเป็นมืออาชีพ และห้ามตอบเป็นภาษาจีนหรือเกาหลีเด็ดขาด"""

user_sessions = {}
BASE_HISTORY_LEN = 1
MAX_DYNAMIC_HISTORY = 20

# --- Pydantic Models ---
class AuthRequest(BaseModel):
    username: str
    password: str

class ChatRequest(BaseModel):
    message: str
    username: str
    model_version: str = "1.0"

# --- Endpoints ---
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse(request=request, name="index.html", context={"request": request})

@app.get("/admin_boss", response_class=HTMLResponse)
async def admin_dashboard(request: Request):
    logs = execute_query("SELECT username, timestamp, role, content FROM logs ORDER BY id DESC LIMIT 200", fetch='all')
    return templates.TemplateResponse(request=request, name="admin.html", context={"request": request, "logs": logs or []})

@app.post("/api/register")
async def register(req: AuthRequest):
    try:
        execute_query("INSERT INTO users (username, password_hash) VALUES (?, ?)", 
                  (req.username, hash_password(req.password)))
        return {"status": "success", "message": "สมัครสมาชิกสำเร็จ!"}
    except Exception as e:
        err_str = str(e).lower()
        if "unique" in err_str or "integrity" in err_str or "duplicate" in err_str:
            return {"status": "error", "message": "ชื่อผู้ใช้นี้มีคนใช้แล้วค่ะ"}
        return {"status": "error", "message": f"เกิดข้อผิดพลาด: {str(e)}"}

@app.post("/api/login")
async def login(req: AuthRequest):
    row = execute_query("SELECT password_hash FROM users WHERE username=?", (req.username,), fetch='one')
    
    if row and row[0] == hash_password(req.password):
        if req.username not in user_sessions:
            prompt_to_use = system_prompt_boss if req.username == "👑 Boss (Owner)" else system_prompt
            user_sessions[req.username] = [SystemMessage(content=prompt_to_use)]
            history_rows = execute_query("SELECT role, content FROM logs WHERE username=? ORDER BY id ASC", (req.username,), fetch='all')
            
            if history_rows:
                for role, content in history_rows:
                    if role == "User":
                        user_sessions[req.username].append(HumanMessage(content=content))
                    elif role == "Kira":
                        user_sessions[req.username].append(AIMessage(content=content))
                        
        return {"status": "success", "username": req.username}
    else:
        return {"status": "error", "message": "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้องค่ะ"}

@app.get("/api/history/{username}")
async def get_history(username: str):
    history_rows = execute_query("SELECT role, content FROM logs WHERE username=? ORDER BY id ASC", (username,), fetch='all')
    formatted_history = []
    if history_rows:
        formatted_history = [{"role": r, "content": c} for r, c in history_rows]
    return {"status": "success", "history": formatted_history}

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    user_input = req.message
    uname = req.username
    model_version = req.model_version
    
    # 🛡️ Security Check: Only Boss can use 1.1
    if model_version == "1.1" and not is_boss(uname):
        model_version = "1.0"
    
    if uname not in user_sessions:
        prompt_to_use = system_prompt_boss if is_boss(uname) else system_prompt
        user_sessions[uname] = [SystemMessage(content=prompt_to_use)]
        
    history = user_sessions[uname]
    
    if len(history) > BASE_HISTORY_LEN + MAX_DYNAMIC_HISTORY:
        history = history[:BASE_HISTORY_LEN] + history[-MAX_DYNAMIC_HISTORY:]
        
    history.append(HumanMessage(content=user_input))
    log_chat(uname, "User", user_input)
    
    async def generate():
        full_response = ""
        badge = "✨ **[Kira 1.1 👑]**\n\n" if model_version == "1.1" else "🤖 **[Kira 1.0]**\n\n"
        full_response += badge
        yield badge
        
        try:
            primary_llm = llm_1_1 if model_version == "1.1" else llm_1_0
            try:
                async for chunk in primary_llm.astream(history):
                    content = chunk.content
                    if content:
                        full_response += content
                        yield content
            except Exception as e_primary:
                print(f"[Warning] Primary LLM stream failed: {e_primary}. Switching to Backup LLM...")
                async for chunk in llm_1_0.astream(history):
                    content = chunk.content
                    if content:
                        full_response += content
                        yield content
        except Exception as e:
            error_msg = f"\\n[Error] ขออภัยค่ะ ระบบ AI ขัดข้อง: {e}"
            full_response += error_msg
            yield error_msg
        finally:
            history.append(AIMessage(content=full_response))
            log_chat(uname, "Kira", full_response)
            
    return StreamingResponse(generate(), media_type="text/plain")

@app.post("/api/clear_chat")
async def clear_chat(req: ChatRequest):
    uname = req.username
    prompt_to_use = system_prompt_boss if uname == "👑 Boss (Owner)" else system_prompt
    user_sessions[uname] = [SystemMessage(content=prompt_to_use)]
    return {"status": "success", "message": "Cleared"}

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8000))
    print(f"🌐 Kira Public Web is starting on port {port}")
    uvicorn.run("app:app", host="0.0.0.0", port=port, log_level="info")
