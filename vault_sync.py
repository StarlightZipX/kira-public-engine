"""
Kira 2.2 - Executive Offline Vault & Mobile PWA Sync Engine
ระบบคลังข้อมูลนิรภัยออฟไลน์สำหรับผู้บริหาร และระบบซิงก์ข้อมูลสองทิศทาง (Bidirectional Sync)
รองรับการจัดเก็บเอกสารยุทธศาสตร์, บันทึกข้อความสั่งการ, Slide Decks, และ Task Matrix แบบ Local-First
"""

import os
import json
import time
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Request, Response

vault_router = APIRouter(prefix="/api/vault", tags=["Executive Offline Vault & Sync"])

def _get_now_str() -> str:
    tz = timezone(timedelta(hours=7))
    return datetime.now(tz).strftime("%Y-%m-%d %H:%M:%S")

def _get_db():
    from app import execute_query
    return execute_query

# ====================================================================
# 🗄️ DATABASE INITIALIZATION
# ====================================================================

def init_vault_tables():
    """สร้างตารางที่จำเป็นสำหรับ Executive Offline Vault"""
    execute_query = _get_db()
    execute_query('''CREATE TABLE IF NOT EXISTS executive_vault_items
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  item_id TEXT UNIQUE,
                  username TEXT,
                  category TEXT DEFAULT 'memo',
                  title TEXT,
                  content TEXT,
                  metadata TEXT,
                  is_pinned INTEGER DEFAULT 0,
                  client_updated_at TEXT,
                  synced_at TEXT,
                  created_at TEXT)''')
                  
    execute_query('''CREATE INDEX IF NOT EXISTS idx_vault_username ON executive_vault_items (username)''')
    execute_query('''CREATE INDEX IF NOT EXISTS idx_vault_item_id ON executive_vault_items (item_id)''')

# ====================================================================
# 📦 PYDANTIC MODELS
# ====================================================================

class VaultItemSaveRequest(BaseModel):
    item_id: Optional[str] = None
    username: Optional[str] = "boss"
    category: str = Field(default="memo", description="memo, directive, boardroom_minutes, slide_deck, task")
    title: str = Field(..., min_length=1, max_length=150)
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    is_pinned: bool = False
    client_updated_at: Optional[str] = None

class VaultBulkSyncRequest(BaseModel):
    username: Optional[str] = "boss"
    client_changes: List[Dict[str, Any]] = Field(default_factory=list)
    last_sync_time: Optional[str] = None

class VaultImportRequest(BaseModel):
    username: Optional[str] = "boss"
    backup_data: List[Dict[str, Any]]

# ====================================================================
# 🚀 API ENDPOINTS
# ====================================================================

@vault_router.get("/items")
async def list_vault_items(username: str = "boss", category: Optional[str] = None):
    """ดึงรายการเอกสารและบันทึกในคลังนิรภัยของผู้ใช้"""
    init_vault_tables()
    execute_query = _get_db()
    
    if category and category != "all":
        rows = execute_query("""SELECT item_id, username, category, title, content, metadata, is_pinned, client_updated_at, synced_at, created_at 
                                FROM executive_vault_items 
                                WHERE username=? AND category=? 
                                ORDER BY is_pinned DESC, id DESC""",
                             (username, category), fetch='all')
    else:
        rows = execute_query("""SELECT item_id, username, category, title, content, metadata, is_pinned, client_updated_at, synced_at, created_at 
                                FROM executive_vault_items 
                                WHERE username=? 
                                ORDER BY is_pinned DESC, id DESC""",
                             (username,), fetch='all')
                             
    items = []
    if rows:
        for r in rows:
            meta = {}
            if r[5]:
                try:
                    meta = json.loads(r[5])
                except:
                    meta = {}
            items.append({
                "item_id": r[0],
                "username": r[1],
                "category": r[2],
                "title": r[3],
                "content": r[4],
                "metadata": meta,
                "is_pinned": bool(r[6]),
                "client_updated_at": r[7],
                "synced_at": r[8],
                "created_at": r[9]
            })
            
    return {
        "status": "success",
        "count": len(items),
        "items": items,
        "server_time": _get_now_str()
    }

@vault_router.post("/items")
async def save_vault_item(req: VaultItemSaveRequest):
    """บันทึกหรืออัปเดตรายการในคลังนิรภัยเดี่ยว"""
    init_vault_tables()
    execute_query = _get_db()
    
    now = _get_now_str()
    item_id = req.item_id or f"vault_{int(time.time())}_{os.urandom(3).hex()}"
    uname = req.username or "boss"
    meta_json = json.dumps(req.metadata, ensure_ascii=False)
    client_up = req.client_updated_at or now
    
    # Check if exists
    chk = execute_query("SELECT id FROM executive_vault_items WHERE item_id=?", (item_id,), fetch='one')
    if chk:
        execute_query("""UPDATE executive_vault_items 
                         SET category=?, title=?, content=?, metadata=?, is_pinned=?, client_updated_at=?, synced_at=? 
                         WHERE item_id=?""",
                      (req.category, req.title, req.content, meta_json, 1 if req.is_pinned else 0, client_up, now, item_id))
        action = "updated"
    else:
        execute_query("""INSERT INTO executive_vault_items 
                         (item_id, username, category, title, content, metadata, is_pinned, client_updated_at, synced_at, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                      (item_id, uname, req.category, req.title, req.content, meta_json, 1 if req.is_pinned else 0, client_up, now, now))
        action = "created"
        
    return {
        "status": "success",
        "action": action,
        "item_id": item_id,
        "message": f"บันทึกเอกสาร '{req.title}' ลงคลังนิรภัยเรียบร้อยแล้วค่ะ",
        "synced_at": now
    }

@vault_router.delete("/items/{item_id}")
async def delete_vault_item(item_id: str, username: str = "boss"):
    """ลบรายการออกจากคลังนิรภัย"""
    init_vault_tables()
    execute_query = _get_db()
    
    chk = execute_query("SELECT id, title FROM executive_vault_items WHERE item_id=?", (item_id,), fetch='one')
    if not chk:
        raise HTTPException(status_code=404, detail="ไม่พบรายการดังกล่าวในคลังนิรภัยค่ะ")
        
    execute_query("DELETE FROM executive_vault_items WHERE item_id=?", (item_id,))
    return {
        "status": "success",
        "item_id": item_id,
        "message": f"ลบเอกสาร '{chk[1]}' ออกจากคลังนิรภัยเรียบร้อยแล้วค่ะ"
    }

@vault_router.post("/items/{item_id}/pin")
async def toggle_pin_vault_item(item_id: str):
    """ปักหมุดหรือยกเลิกการปักหมุดเอกสารสำคัญ"""
    init_vault_tables()
    execute_query = _get_db()
    
    chk = execute_query("SELECT is_pinned, title FROM executive_vault_items WHERE item_id=?", (item_id,), fetch='one')
    if not chk:
        raise HTTPException(status_code=404, detail="ไม่พบรายการดังกล่าวในคลังนิรภัยค่ะ")
        
    new_pinned = 0 if chk[0] == 1 else 1
    execute_query("UPDATE executive_vault_items SET is_pinned=? WHERE item_id=?", (new_pinned, item_id))
    
    status_text = "ปักหมุดเอกสารสำคัญเรียบร้อยค่ะ" if new_pinned == 1 else "ยกเลิกการปักหมุดเรียบร้อยค่ะ"
    return {
        "status": "success",
        "item_id": item_id,
        "is_pinned": bool(new_pinned),
        "message": status_text
    }

@vault_router.post("/sync")
async def bidirectional_sync(req: VaultBulkSyncRequest):
    """
    ระบบซิงก์สองทิศทางอัตโนมัติ (Bidirectional Bulk Sync)
    1. รับการเปลี่ยนแปลงจาก Client (Offline Outbox) และบันทึกลง Database
    2. ส่งกลับรายการที่อัปเดตบน Server ให้ Client ไปแคชลงเครื่อง
    """
    init_vault_tables()
    execute_query = _get_db()
    now = _get_now_str()
    uname = req.username or "boss"
    applied_count = 0
    deleted_count = 0

    # 1. Apply Client Changes
    for chg in req.client_changes:
        action = chg.get("action", "upsert")
        item_id = chg.get("item_id")
        if not item_id:
            continue
            
        if action == "delete":
            execute_query("DELETE FROM executive_vault_items WHERE item_id=?", (item_id,))
            deleted_count += 1
        else:
            title = chg.get("title", "บันทึกออฟไลน์")
            content = chg.get("content", "")
            category = chg.get("category", "memo")
            meta = chg.get("metadata", {})
            meta_json = json.dumps(meta, ensure_ascii=False) if isinstance(meta, dict) else str(meta)
            is_pinned = 1 if chg.get("is_pinned", False) else 0
            client_up = chg.get("client_updated_at", now)
            
            chk = execute_query("SELECT id, client_updated_at FROM executive_vault_items WHERE item_id=?", (item_id,), fetch='one')
            if chk:
                # Update with Last-Write-Wins
                execute_query("""UPDATE executive_vault_items 
                                 SET category=?, title=?, content=?, metadata=?, is_pinned=?, client_updated_at=?, synced_at=? 
                                 WHERE item_id=?""",
                              (category, title, content, meta_json, is_pinned, client_up, now, item_id))
                applied_count += 1
            else:
                created = chg.get("created_at", now)
                execute_query("""INSERT INTO executive_vault_items 
                                 (item_id, username, category, title, content, metadata, is_pinned, client_updated_at, synced_at, created_at)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                              (item_id, uname, category, title, content, meta_json, is_pinned, client_up, now, created))
                applied_count += 1

    # 2. Query Server Delta (Items updated after last_sync_time, or all if no last_sync_time)
    if req.last_sync_time:
        server_rows = execute_query("""SELECT item_id, username, category, title, content, metadata, is_pinned, client_updated_at, synced_at, created_at 
                                       FROM executive_vault_items 
                                       WHERE username=? AND synced_at >= ?
                                       ORDER BY id DESC""",
                                    (uname, req.last_sync_time), fetch='all')
    else:
        server_rows = execute_query("""SELECT item_id, username, category, title, content, metadata, is_pinned, client_updated_at, synced_at, created_at 
                                       FROM executive_vault_items 
                                       WHERE username=? 
                                       ORDER BY id DESC LIMIT 100""",
                                    (uname,), fetch='all')
                                    
    server_items = []
    if server_rows:
        for r in server_rows:
            meta = {}
            if r[5]:
                try: meta = json.loads(r[5])
                except: meta = {}
            server_items.append({
                "item_id": r[0],
                "username": r[1],
                "category": r[2],
                "title": r[3],
                "content": r[4],
                "metadata": meta,
                "is_pinned": bool(r[6]),
                "client_updated_at": r[7],
                "synced_at": r[8],
                "created_at": r[9]
            })

    return {
        "status": "success",
        "applied_count": applied_count,
        "deleted_count": deleted_count,
        "server_items": server_items,
        "synced_at": now,
        "message": f"ซิงก์ข้อมูลคลังนิรภัยสำเร็จเรียบร้อยค่ะ (บันทึกเข้าระบบ {applied_count} รายการ, รับข้อมูลจากเซิร์ฟเวอร์ {len(server_items)} รายการ)"
    }

@vault_router.get("/export")
async def export_vault_backup(username: str = "boss"):
    """ส่งออกข้อมูลทั้งหมดในคลังนิรภัยเป็นไฟล์ JSON สำหรับสำรองข้อมูลออฟไลน์ (Cold Storage Backup)"""
    init_vault_tables()
    execute_query = _get_db()
    
    rows = execute_query("""SELECT item_id, username, category, title, content, metadata, is_pinned, client_updated_at, synced_at, created_at 
                            FROM executive_vault_items 
                            WHERE username=? 
                            ORDER BY id ASC""",
                         (username,), fetch='all')
                         
    items = []
    if rows:
        for r in rows:
            meta = {}
            if r[5]:
                try: meta = json.loads(r[5])
                except: meta = {}
            items.append({
                "item_id": r[0],
                "username": r[1],
                "category": r[2],
                "title": r[3],
                "content": r[4],
                "metadata": meta,
                "is_pinned": bool(r[6]),
                "client_updated_at": r[7],
                "synced_at": r[8],
                "created_at": r[9]
            })
            
    backup_payload = {
        "export_version": "2.2",
        "system": "Kira AI Executive Offline Vault",
        "owner": username,
        "exported_at": _get_now_str(),
        "total_items": len(items),
        "items": items
    }
    
    json_bytes = json.dumps(backup_payload, ensure_ascii=False, indent=2).encode('utf-8')
    filename = f"kira_vault_backup_{username}_{int(time.time())}.json"
    
    return Response(
        content=json_bytes,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@vault_router.post("/import")
async def import_vault_backup(req: VaultImportRequest):
    """นำเข้าข้อมูลจากไฟล์สำรอง JSON กลับเข้าสู่คลังนิรภัย"""
    init_vault_tables()
    execute_query = _get_db()
    
    uname = req.username or "boss"
    imported_count = 0
    now = _get_now_str()
    
    for item in req.backup_data:
        item_id = item.get("item_id") or f"vault_imp_{int(time.time())}_{os.urandom(3).hex()}"
        title = item.get("title", "เอกสารนำเข้า")
        content = item.get("content", "")
        category = item.get("category", "memo")
        meta = item.get("metadata", {})
        meta_json = json.dumps(meta, ensure_ascii=False) if isinstance(meta, dict) else str(meta)
        is_pinned = 1 if item.get("is_pinned", False) else 0
        client_up = item.get("client_updated_at", now)
        created = item.get("created_at", now)
        
        chk = execute_query("SELECT id FROM executive_vault_items WHERE item_id=?", (item_id,), fetch='one')
        if chk:
            execute_query("""UPDATE executive_vault_items 
                             SET category=?, title=?, content=?, metadata=?, is_pinned=?, client_updated_at=?, synced_at=? 
                             WHERE item_id=?""",
                          (category, title, content, meta_json, is_pinned, client_up, now, item_id))
        else:
            execute_query("""INSERT INTO executive_vault_items 
                             (item_id, username, category, title, content, metadata, is_pinned, client_updated_at, synced_at, created_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                          (item_id, uname, category, title, content, meta_json, is_pinned, client_up, now, created))
        imported_count += 1
        
    return {
        "status": "success",
        "imported_count": imported_count,
        "message": f"นำเข้าข้อมูลเข้าสู่คลังนิรภัยสำเร็จ {imported_count} รายการเรียบร้อยแล้วค่ะ"
    }
