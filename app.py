import os
import hashlib
import sys
from datetime import datetime
import uvicorn
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse
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
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

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

# --- AI Setup (Gemini Free API) ---
os.environ["GOOGLE_API_KEY"] = GEMINI_API_KEY
llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash", temperature=0.7)

system_prompt = """คุณคือ "คิระ (Kira)" ผู้ช่วย AI อัจฉริยะที่ถูกสร้างขึ้นโดย "Boss"
หน้าที่ของคุณคือตอบคำถามผู้ใช้งานทั่วไปบนเว็บไซต์ให้ดีที่สุด
กฎเหล็ก:
1. คุณต้องแทนตัวเองว่า 'หนู' และลงท้ายประโยคด้วย 'ค่ะ' หรือ 'นะคะ' เสมอ (ห้ามใช้คำว่า 'ครับ', 'ฮะ', 'ผม' เด็ดขาด)
2. ห้ามเปิดเผยข้อมูลส่วนตัวของ Boss หรือข้อมูลระบบหลังบ้านเด็ดขาด
3. คุณเป็น AI สาธารณะ (Public Version) ดังนั้นคุณไม่มีสิทธิ์เข้าถึงไฟล์ในคอมพิวเตอร์ หรือควบคุมบ้านของผู้ใช้
4. ห้ามตอบเป็นภาษาจีนหรือเกาหลีเด็ดขาด ให้ใช้ภาษาไทยหรืออังกฤษเท่านั้น"""

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
            user_sessions[req.username] = [SystemMessage(content=system_prompt)]
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
    
    if uname not in user_sessions:
        user_sessions[uname] = [SystemMessage(content=system_prompt)]
        
    history = user_sessions[uname]
    
    if len(history) > BASE_HISTORY_LEN + MAX_DYNAMIC_HISTORY:
        history = history[:BASE_HISTORY_LEN] + history[-MAX_DYNAMIC_HISTORY:]
        
    history.append(HumanMessage(content=user_input))
    log_chat(uname, "User", user_input)
    
    try:
        response = llm.invoke(history)
        reply_text = response.content
        
        if isinstance(reply_text, list):
            if len(reply_text) > 0 and isinstance(reply_text[0], dict) and "text" in reply_text[0]:
                reply_text = reply_text[0]["text"]
            else:
                reply_text = str(reply_text)
        elif not isinstance(reply_text, str):
            reply_text = str(reply_text)
            
        history.append(AIMessage(content=reply_text))
        log_chat(uname, "Kira", reply_text)
        
        return {"status": "success", "reply": reply_text}
    except Exception as e:
        return {"status": "error", "reply": f"ขออภัยค่ะ ระบบ AI ขัดข้อง: {e}"}

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8000))
    print(f"🌐 Kira Public Web is starting on port {port}")
    uvicorn.run("app:app", host="0.0.0.0", port=port, log_level="info")
