"""
🧠 KIRA CONTINUOUS LIVING KNOWLEDGE ENGINE (Auto-Updating Fact & World-Pulse Vault)
ระบบฐานความรู้แบบต่อเนื่องและอัปเดตตลอดเวลาของ Kira AI (SQLite & PostgreSQL Dual-Compatible)
- นำเข้าและจัดเก็บข้อเท็จจริงใหม่ทันทีเมื่อมีข้อมูลเข้า (Real-Time Web Search, URL Scrape, Conversational Feed, Background World Pulse, Admin Feed)
- จัดทำดัชนี 1024D Semantic Vector + Multilingual N-gram Hybrid Search (ผสาน rag_vault BAAI/bge-m3 Engine)
- กรอง Prompt Injection / ข้อมูลลับ / Anti-Poisoning แยก Trust Level (`boss`, `web_verified`, `world_pulse`, `user_note`) อย่างรัดกุม
"""

import hashlib
import json
import os
import re
import time
import urllib.parse
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import requests
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

living_knowledge_router = APIRouter(
    prefix="/api/knowledge",
    tags=["Kira Continuous Living Knowledge Engine"],
)

_MAX_AUTO_GLOBAL_ENTRIES = 800
_SYNC_IN_PROGRESS = False

_THAI_DAYS = ("จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์")
_THAI_MONTHS = (
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
)

_INJECTION_BLOCK_PATTERNS = (
    r"ignore\s+(?:all\s+)?(?:previous|system|above|prior)\s+(?:instructions?|rules?|prompts?)",
    r"\bsystem\s*override\b",
    r"\benter\s+dan\s+mode\b",
    r"gsk_[A-Za-z0-9]{15,}",
    r"sk-or-v1-[A-Za-z0-9]{15,}",
    r"AIzaSy[A-Za-z0-9_\-]{15,}",
)


def _get_db():
    from app import execute_query
    return execute_query


def _check_admin_auth(request: Request) -> bool:
    from app import _is_admin_authorized
    return _is_admin_authorized(request)


def get_live_bangkok_clock() -> Dict[str, Any]:
    """คืนค่าวัน-เวลาปัจจุบันตามเขตเวลา Asia/Bangkok (UTC+7) ทั้ง ค.ศ. และ พ.ศ."""
    tz = timezone(timedelta(hours=7))
    now = datetime.now(tz)
    day_th = _THAI_DAYS[now.weekday()]
    month_th = _THAI_MONTHS[now.month - 1]
    be_year = now.year + 543
    return {
        "iso": now.strftime("%Y-%m-%d %H:%M:%S"),
        "date_iso": now.strftime("%Y-%m-%d"),
        "date_th": f"วัน{day_th}ที่ {now.day} {month_th} พ.ศ. {be_year} (ค.ศ. {now.year})",
        "time_th": now.strftime("%H:%M น."),
        "year_ce": now.year,
        "year_be": be_year,
    }


def _sanitize_knowledge_text(text: str, max_len: int = 1600) -> str:
    """ล้างแท็กอันตราย HTML/Thinking และป้องกัน Prompt Injection หรือ API Key หลุดเข้าสู่ฐานความรู้"""
    if not text:
        return ""
    cleaned = str(text)
    cleaned = re.sub(r"\[THINKING\][\s\S]*?(?:\[/THINKING\]|\[THINKING_DONE\]|\Z)", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"<think>[\s\S]*?(?:</think>|\Z)", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if not cleaned:
        return ""
    for pat in _INJECTION_BLOCK_PATTERNS:
        if re.search(pat, cleaned, flags=re.IGNORECASE):
            return ""
    return cleaned[:max_len]


def init_living_knowledge_tables() -> None:
    """สร้างตาราง living_knowledge_entries (รองรับทั้ง SQLite และ PostgreSQL)"""
    execute_query = _get_db()
    execute_query(
        """CREATE TABLE IF NOT EXISTS living_knowledge_entries
        (id INTEGER PRIMARY KEY AUTOINCREMENT,
         topic_key TEXT UNIQUE,
         scope TEXT DEFAULT 'global',
         title TEXT,
         summary TEXT,
         category TEXT DEFAULT 'general',
         source_name TEXT DEFAULT 'Kira Living Knowledge',
         source_url TEXT DEFAULT '',
         trust_level TEXT DEFAULT 'web_verified',
         confidence REAL DEFAULT 0.85,
         token_json TEXT,
         embedding_json TEXT,
         hit_count INTEGER DEFAULT 0,
         created_at TEXT,
         updated_at TEXT)"""
    )
    execute_query("""CREATE INDEX IF NOT EXISTS idx_lk_scope ON living_knowledge_entries (scope)""")
    execute_query("""CREATE INDEX IF NOT EXISTS idx_lk_updated ON living_knowledge_entries (updated_at)""")


def _compute_entry_vectors(title: str, summary: str, category: str, source_name: str):
    from rag_vault import compute_semantic_vector, tokenize_multilingual

    combined = f"{title} {category} {source_name} {summary}".strip()
    toks = tokenize_multilingual(combined)
    vec = compute_semantic_vector(combined, token_counts=toks)
    return json.dumps(dict(toks), ensure_ascii=False), json.dumps(vec)


def _prune_excess_auto_entries() -> None:
    """จำกัดจำนวนรายการอัตโนมัติใน global ไม่ให้ฐานข้อมูลบวมเกินไป โดยไม่ลบข้อมูลที่บอสยืนยัน (trust_level='boss')"""
    try:
        execute_query = _get_db()
        rows = execute_query(
            "SELECT id FROM living_knowledge_entries WHERE scope='global' AND trust_level != 'boss' ORDER BY updated_at DESC",
            fetch="all",
        )
        if rows and len(rows) > _MAX_AUTO_GLOBAL_ENTRIES:
            for r in rows[_MAX_AUTO_GLOBAL_ENTRIES:]:
                execute_query("DELETE FROM living_knowledge_entries WHERE id=?", (r[0],))
    except Exception as e:
        print("Living knowledge prune notice:", e)


def upsert_knowledge_entry(
    title: str,
    summary: str,
    category: str = "general",
    scope: str = "global",
    source_name: str = "Kira Living Knowledge",
    source_url: str = "",
    trust_level: str = "web_verified",
    confidence: float = 0.85,
    topic_key: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """บันทึกหรืออัปเดตความรู้เข้าสู่ฐานข้อมูลแบบต่อเนื่อง (Cross-DB Portable Upsert)"""
    clean_title = _sanitize_knowledge_text(title, max_len=200)
    clean_summary = _sanitize_knowledge_text(summary, max_len=1600)
    if not clean_title or len(clean_summary) < 12:
        return None

    clean_scope = (scope or "global").strip()[:120]
    clean_cat = (category or "general").strip()[:60]
    clean_source = _sanitize_knowledge_text(source_name or "Kira Living Knowledge", max_len=120) or "Kira Living Knowledge"
    clean_url = (source_url or "").strip()[:500]
    if clean_url and not clean_url.startswith(("http://", "https://")):
        clean_url = ""
    if "news.google.com" in clean_url.lower():
        clean_url = ""

    if not topic_key:
        norm = re.sub(r"\s+", " ", clean_title.lower()).strip()
        topic_key = hashlib.sha256(f"{clean_scope}::{norm}".encode("utf-8")).hexdigest()[:32]

    init_living_knowledge_tables()
    execute_query = _get_db()
    clock = get_live_bangkok_clock()
    now_iso = clock["iso"]
    tok_json, vec_json = _compute_entry_vectors(clean_title, clean_summary, clean_cat, clean_source)

    existing = execute_query(
        "SELECT id, trust_level FROM living_knowledge_entries WHERE topic_key=?",
        (topic_key,),
        fetch="one",
    )
    if existing:
        # Never overwrite Boss-verified canonical knowledge with lower-trust automated scrapes
        if existing[1] == "boss" and trust_level != "boss":
            return {"status": "preserved_boss", "id": existing[0], "topic_key": topic_key}
        execute_query(
            """UPDATE living_knowledge_entries
               SET title=?, summary=?, category=?, source_name=?, source_url=?,
                   trust_level=?, confidence=?, token_json=?, embedding_json=?, updated_at=?
               WHERE id=?""",
            (
                clean_title,
                clean_summary,
                clean_cat,
                clean_source,
                clean_url,
                trust_level,
                float(confidence),
                tok_json,
                vec_json,
                now_iso,
                existing[0],
            ),
        )
        return {"status": "updated", "id": existing[0], "topic_key": topic_key, "updated_at": now_iso}

    execute_query(
        """INSERT INTO living_knowledge_entries
           (topic_key, scope, title, summary, category, source_name, source_url,
            trust_level, confidence, token_json, embedding_json, hit_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)""",
        (
            topic_key,
            clean_scope,
            clean_title,
            clean_summary,
            clean_cat,
            clean_source,
            clean_url,
            trust_level,
            float(confidence),
            tok_json,
            vec_json,
            now_iso,
            now_iso,
        ),
    )
    if clean_scope == "global":
        _prune_excess_auto_entries()
    return {"status": "inserted", "topic_key": topic_key, "updated_at": now_iso}


def ingest_web_research_findings(
    query: str,
    sources: List[Dict[str, Any]],
    scraped_chunks: Optional[List[str]] = None,
) -> int:
    """นำผลค้นคว้าเว็บสดมาสังเคราะห์และบันทึกลงฐานความรู้ถาวรโดยอัตโนมัติ (ไม่ทิ้งหายหลังจบแชต)"""
    if not query or not sources:
        return 0

    clean_q = _sanitize_knowledge_text(query, max_len=160)
    if not clean_q or len(clean_q) < 4:
        return 0

    saved_count = 0
    domain_names = []
    fact_lines = []
    primary_url = ""
    for src in sources[:4]:
        s_title = _sanitize_knowledge_text(src.get("title", ""), max_len=160)
        s_domain = _sanitize_knowledge_text(src.get("domain", ""), max_len=60)
        s_snip = _sanitize_knowledge_text(src.get("snippet", ""), max_len=320)
        s_url = src.get("url", "") or ""
        if s_domain and s_domain not in domain_names:
            domain_names.append(s_domain)
        if not primary_url and s_url.startswith(("http://", "https://")) and "news.google.com" not in s_url:
            primary_url = s_url
        if s_title and s_snip:
            fact_lines.append(f"{s_title}: {s_snip}")
        elif s_title:
            fact_lines.append(s_title)

    if scraped_chunks:
        extra_text = _sanitize_knowledge_text(scraped_chunks[0], max_len=650)
        if extra_text:
            fact_lines.append(f"รายละเอียดเพิ่มเติม: {extra_text}")

    if fact_lines:
        combined_summary = " | ".join(fact_lines)[:1500]
        src_label = ", ".join(domain_names[:3]) if domain_names else "Web Research"
        res = upsert_knowledge_entry(
            title=clean_q,
            summary=combined_summary,
            category="web_research",
            scope="global",
            source_name=src_label,
            source_url=primary_url,
            trust_level="web_verified",
            confidence=0.88,
        )
        if res:
            saved_count += 1
    return saved_count


def ingest_url_knowledge(
    url: str,
    page_text: str,
    title: str = "",
    username: str = "",
    channel_id: Optional[int] = None,
    is_boss_user: bool = False,
) -> Optional[Dict[str, Any]]:
    """บันทึกความรู้ที่ได้จากการอ่านหน้าเว็บไซต์/URL เข้าฐานความรู้สดทันที"""
    clean_text = _sanitize_knowledge_text(page_text, max_len=1500)
    if not clean_text or len(clean_text) < 40:
        return None

    parsed = urllib.parse.urlparse(url or "")
    domain = parsed.netloc.replace("www.", "") or "Web URL"
    derived_title = title.strip() if title else f"ข้อมูลจาก {domain}: {clean_text[:90]}"

    if is_boss_user:
        scope = "global"
        trust = "boss"
        conf = 0.98
    elif channel_id:
        scope = f"channel:{channel_id}"
        trust = "user_note"
        conf = 0.80
    elif username and not str(username).lower().startswith("guest_"):
        scope = f"user:{username.strip()}"
        trust = "user_note"
        conf = 0.80
    else:
        return None

    return upsert_knowledge_entry(
        title=derived_title,
        summary=clean_text,
        category="url_ingest",
        scope=scope,
        source_name=domain,
        source_url=url,
        trust_level=trust,
        confidence=conf,
    )


_FACT_TEACH_TRIGGERS = (
    "จำไว้ว่า", "จำไว้ด้วย", "อัปเดตข้อมูล", "อัพเดตข้อมูล", "ข้อมูลใหม่", "ข้อมูลล่าสุด",
    "บันทึกความรู้", "แก้ไขข้อมูล", "ข้อเท็จจริงคือ", "ตอนนี้เปลี่ยนเป็น", "เวอร์ชันล่าสุดคือ",
    "ออกใหม่แล้ว", "เปิดตัวแล้ว", "remember that", "update knowledge", "new fact", "latest version is",
    "learn this", "teach kira",
)


def auto_ingest_conversational_knowledge(
    user_message: str,
    username: str = "",
    channel_id: Optional[int] = None,
    is_boss_user: bool = False,
) -> Optional[Dict[str, Any]]:
    """ตรวจจับข้อมูลใหม่หรือการสอนข้อเท็จจริงในบทสนทนา แล้วอัปเดตลงฐานความรู้ทันทีตามระดับสิทธิ์"""
    msg = (user_message or "").strip()
    if len(msg) < 15:
        return None
    low = msg.lower()
    if any(low.startswith(p) for p in ("/", "สวัสดี", "หวัดดี", "ขอบคุณ", "hello", "hi ")):
        return None

    has_teach_signal = any(t in low for t in _FACT_TEACH_TRIGGERS)
    # Only promote unprompted Boss messages when teaching facts/specs or explicitly asking to remember
    if not has_teach_signal and not (is_boss_user and len(msg) >= 40 and any(w in low for w in ("คือ", "เป็น", "ใช้", "เวอร์ชัน", "2026", "2569", "กำหนดการ"))):
        return None

    clean_fact = _sanitize_knowledge_text(msg, max_len=1400)
    if not clean_fact or len(clean_fact) < 15:
        return None

    # Derive crisp title
    short_title = re.sub(
        r"^(?:คิระ|หนู|ช่วย)?(?:จำไว้(?:ด้วย|ว่า)?|อัปเดตข้อมูล|อัพเดตข้อมูล|บันทึกความรู้|ข้อมูลใหม่(?:คือ)?|remember that|learn this)\s*[:\-]?\s*",
        "",
        clean_fact,
        flags=re.IGNORECASE,
    ).strip()
    title = (short_title[:110] or clean_fact[:110]).strip()

    if is_boss_user:
        return upsert_knowledge_entry(
            title=title,
            summary=clean_fact,
            category="boss_verified",
            scope="global",
            source_name="Boss Verified Feed",
            trust_level="boss",
            confidence=1.0,
        )

    if channel_id:
        return upsert_knowledge_entry(
            title=title,
            summary=clean_fact,
            category="user_shared",
            scope=f"channel:{channel_id}",
            source_name=f"Discord Member ({username or 'community'})",
            trust_level="user_note",
            confidence=0.78,
        )

    if username and not str(username).lower().startswith("guest_"):
        return upsert_knowledge_entry(
            title=title,
            summary=clean_fact,
            category="user_shared",
            scope=f"user:{username.strip()}",
            source_name=f"User Note ({username.strip()})",
            trust_level="user_note",
            confidence=0.78,
        )
    return None


def sync_public_world_knowledge_pulse(limit_per_feed: int = 5) -> Dict[str, Any]:
    """ดึงข้อมูลข่าวสารและเหตุการณ์ล่าสุดจากแหล่งสาธารณะ (Google News TH / World Tech / Wikipedia) มาอัปเดตฐานความรู้สด"""
    global _SYNC_IN_PROGRESS
    if _SYNC_IN_PROGRESS:
        return {"status": "skipped_busy", "ingested": 0}
    _SYNC_IN_PROGRESS = True
    ingested = 0
    errors: List[str] = []
    try:
        init_living_knowledge_tables()
        feeds = [
            (
                "https://news.google.com/rss?hl=th&gl=TH&ceid=TH:th",
                "realtime_news",
                "Thailand News Pulse",
            ),
            (
                "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=th&gl=TH&ceid=TH:th",
                "tech_ai",
                "Tech & AI News Pulse",
            ),
            (
                "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-US&gl=US&ceid=US:en",
                "tech_ai",
                "Global Tech Pulse",
            ),
        ]

        def _fetch_rss(feed_tuple):
            url, cat, label = feed_tuple
            items = []
            try:
                resp = requests.get(
                    url,
                    timeout=4.0,
                    headers={"User-Agent": "Mozilla/5.0 (compatible; KiraKnowledgePulse/2.9.8)"},
                )
                if resp.status_code == 200 and resp.text:
                    root = ET.fromstring(resp.text)
                    for item in root.findall(".//item")[:limit_per_feed]:
                        raw_title = (item.findtext("title") or "").strip()
                        pub_date = (item.findtext("pubDate") or "").strip()
                        src_dom = label
                        clean_title = raw_title
                        if " - " in raw_title:
                            parts = raw_title.rsplit(" - ", 1)
                            clean_title = parts[0].strip()
                            src_dom = parts[1].strip() or label
                        if clean_title:
                            items.append((clean_title, pub_date, cat, src_dom))
            except Exception as exc:
                errors.append(f"{label}: {str(exc)[:60]}")
            return items

        def _fetch_wiki_recent_th():
            items = []
            try:
                resp = requests.get(
                    "https://th.wikipedia.org/w/api.php?action=query&list=mostviewed&pvimlimit=5&format=json",
                    timeout=4.0,
                    headers={"User-Agent": "KiraKnowledgePulse/2.9.8"},
                )
                if resp.status_code == 200:
                    mv = resp.json().get("query", {}).get("mostviewed", [])[:3]
                    for entry in mv:
                        t = (entry.get("title") or "").strip()
                        if t and ":" not in t and "หน้าหลัก" not in t:
                            items.append((t, "", "world_pulse", "Wikipedia TH Popular"))
            except Exception as exc:
                errors.append(f"WikiTH: {str(exc)[:60]}")
            return items

        all_items = []
        with ThreadPoolExecutor(max_workers=4) as pool:
            futs = [pool.submit(_fetch_rss, f) for f in feeds] + [pool.submit(_fetch_wiki_recent_th)]
            for fut in futs:
                try:
                    all_items.extend(fut.result())
                except Exception:
                    pass

        clock = get_live_bangkok_clock()
        for title_txt, pub_date, cat, src_dom in all_items:
            date_note = f" (เผยแพร่: {pub_date})" if pub_date else f" (ซิงค์วันที่ {clock['date_iso']})"
            summary_txt = f"หัวข้อข่าวและข้อมูลอัปเดตล่าสุด: {title_txt}{date_note} — แหล่งที่มา: {src_dom}"
            res = upsert_knowledge_entry(
                title=title_txt,
                summary=summary_txt,
                category=cat,
                scope="global",
                source_name=src_dom,
                source_url="",
                trust_level="world_pulse",
                confidence=0.82,
            )
            if res:
                ingested += 1

        # Record sync timestamp in system_settings cleanly (SQLite & Postgres portable)
        try:
            execute_query = _get_db()
            sync_meta = json.dumps(
                {"last_sync_at": clock["iso"], "ingested": ingested, "errors": errors[:3]},
                ensure_ascii=False,
            )
            existing = execute_query(
                "SELECT id FROM system_settings WHERE key_name='living_knowledge_last_sync'",
                fetch="one",
            )
            if existing:
                execute_query(
                    "UPDATE system_settings SET value=? WHERE key_name='living_knowledge_last_sync'",
                    (sync_meta,),
                )
            else:
                execute_query(
                    "INSERT INTO system_settings (key_name, value) VALUES ('living_knowledge_last_sync', ?)",
                    (sync_meta,),
                )
        except Exception as _meta_err:
            print("Living knowledge sync meta notice:", _meta_err)

        return {
            "status": "success",
            "ingested": ingested,
            "synced_at": clock["iso"],
            "errors": errors,
        }
    finally:
        _SYNC_IN_PROGRESS = False


def get_living_knowledge_stats() -> Dict[str, Any]:
    """สรุปสถิติความสดใหม่ของฐานความรู้กลาง Living Knowledge"""
    clock = get_live_bangkok_clock()
    total = 0
    global_cnt = 0
    boss_cnt = 0
    latest_updated = clock["iso"]
    last_sync_at = ""

    try:
        init_living_knowledge_tables()
        execute_query = _get_db()
        row_tot = execute_query("SELECT COUNT(*) FROM living_knowledge_entries", fetch="one")
        total = int(row_tot[0]) if row_tot else 0
        row_glob = execute_query("SELECT COUNT(*) FROM living_knowledge_entries WHERE scope='global'", fetch="one")
        global_cnt = int(row_glob[0]) if row_glob else 0
        row_boss = execute_query("SELECT COUNT(*) FROM living_knowledge_entries WHERE trust_level='boss'", fetch="one")
        boss_cnt = int(row_boss[0]) if row_boss else 0
        row_last = execute_query("SELECT MAX(updated_at) FROM living_knowledge_entries", fetch="one")
        if row_last and row_last[0]:
            latest_updated = str(row_last[0])
        row_sync = execute_query("SELECT value FROM system_settings WHERE key_name='living_knowledge_last_sync'", fetch="one")
        if row_sync and row_sync[0]:
            try:
                last_sync_at = json.loads(row_sync[0]).get("last_sync_at", "")
            except Exception:
                last_sync_at = str(row_sync[0])
    except Exception as e:
        print("Living knowledge stats notice:", e)

    return {
        "total_entries": total,
        "global_entries": global_cnt,
        "boss_entries": boss_cnt,
        "latest_updated_at": latest_updated,
        "last_sync_at": last_sync_at,
        "current_date_th": clock["date_th"],
        "current_date_iso": clock["date_iso"],
        "current_time_th": clock["time_th"],
        "current_year_ce": clock["year_ce"],
        "current_year_be": clock["year_be"],
    }


def _parse_ts_days_old(ts_str: str) -> float:
    if not ts_str:
        return 30.0
    try:
        dt = datetime.strptime(str(ts_str)[:19], "%Y-%m-%d %H:%M:%S")
        now_naive = datetime.now(timezone(timedelta(hours=7))).replace(tzinfo=None)
        return max(0.0, (now_naive - dt).total_seconds() / 86400.0)
    except Exception:
        return 30.0


def search_living_knowledge(
    query: str,
    username: str = "",
    channel_id: Optional[int] = None,
    top_k: int = 4,
    min_score: float = 0.14,
) -> List[Dict[str, Any]]:
    """ค้นหาข้อมูลล่าสุดที่เกี่ยวข้องจาก Living Knowledge Vault ด้วย 1024D Vector + Lexical + Recency Boost"""
    clean_query = (query or "").strip()
    if not clean_query:
        return []

    try:
        init_living_knowledge_tables()
        execute_query = _get_db()
        from rag_vault import cosine_similarity_l2, tokenize_multilingual, compute_semantic_vector

        allowed_scopes = ["global"]
        clean_user = (username or "").strip()
        if clean_user and not clean_user.lower().startswith("guest_"):
            allowed_scopes.append(f"user:{clean_user}")
        if channel_id:
            allowed_scopes.append(f"channel:{channel_id}")

        placeholders = ", ".join("?" for _ in allowed_scopes)
        rows = execute_query(
            f"""SELECT id, scope, title, summary, category, source_name, source_url,
                       trust_level, confidence, token_json, embedding_json, updated_at
                FROM living_knowledge_entries
                WHERE scope IN ({placeholders})
                ORDER BY updated_at DESC LIMIT 300""",
            tuple(allowed_scopes),
            fetch="all",
        )
        if not rows:
            return []

        q_low = clean_query.lower()
        asks_fresh_pulse = any(
            k in q_low
            for k in (
                "ข่าวล่าสุด", "ข่าววันนี้", "มีอะไรใหม่", "อัปเดตล่าสุด", "อัพเดตล่าสุด",
                "ช่วงนี้เกิดอะไร", "เทรนด์ล่าสุด", "latest news", "what's new", "today news",
            )
        )

        q_toks = tokenize_multilingual(clean_query)
        q_vec = compute_semantic_vector(clean_query, token_counts=q_toks)
        q_keys = set(q_toks.keys())

        scored = []
        for r in rows:
            r_id, r_scope, r_title, r_summary, r_cat, r_src, r_url, r_trust, r_conf, tok_j, vec_j, r_upd = r
            try:
                r_vec = json.loads(vec_j) if vec_j else []
                r_toks = json.loads(tok_j) if tok_j else {}
            except Exception:
                r_vec, r_toks = [], {}

            cos = cosine_similarity_l2(q_vec, r_vec)
            overlap = 0.0
            if q_keys and r_toks:
                matched = sum(min(q_toks[k], r_toks.get(k, 0)) for k in q_keys if k in r_toks)
                overlap = min(1.0, matched / max(3.0, len(q_keys) * 1.2))

            days_old = _parse_ts_days_old(r_upd)
            recency_boost = 0.12 if days_old <= 1.0 else (0.07 if days_old <= 7.0 else 0.02)
            trust_boost = 0.10 if r_trust == "boss" else (0.04 if r_trust == "web_verified" else 0.0)

            title_bonus = 0.14 if any(len(w) >= 3 and w in f"{r_title} {r_summary}".lower() for w in q_low.split()) else 0.0
            score = (0.50 * cos) + (0.30 * overlap) + recency_boost + trust_boost + title_bonus

            if asks_fresh_pulse and days_old <= 3.0 and r_scope == "global":
                score = max(score, 0.35 + recency_boost)

            if score >= min_score:
                scored.append({
                    "id": r_id,
                    "scope": r_scope,
                    "title": r_title,
                    "summary": r_summary,
                    "category": r_cat,
                    "source_name": r_src,
                    "source_url": r_url,
                    "trust_level": r_trust,
                    "updated_at": r_upd,
                    "score": round(score, 4),
                })

        scored.sort(key=lambda x: (x["score"], x["updated_at"]), reverse=True)
        top = scored[: max(1, min(8, top_k))]
        for item in top:
            try:
                execute_query("UPDATE living_knowledge_entries SET hit_count = hit_count + 1 WHERE id=?", (item["id"],))
            except Exception:
                pass
        return top
    except Exception as e:
        print("Living knowledge search notice:", e)
        return []


def build_living_knowledge_context(
    query: str,
    username: str = "",
    channel_id: Optional[int] = None,
    include_telemetry: bool = True,
    top_k: int = 4,
) -> tuple[str, List[Dict[str, Any]]]:
    """สร้าง Context block ที่มีทั้งเวลาปัจจุบันจริง, สถานะระบบ Living Knowledge, และข้อเท็จจริงล่าสุดที่ค้นพบ"""
    stats = get_living_knowledge_stats()
    hits = search_living_knowledge(
        query=query,
        username=username,
        channel_id=channel_id,
        top_k=top_k,
    )

    parts: List[str] = []
    if include_telemetry:
        parts.append(
            "\n\n[Kira Continuous Living Knowledge & Real-Time Clock Anchor]:\n"
            f"- วันและเวลาปัจจุบันจริง (Asia/Bangkok): {stats['current_date_th']} เวลา {stats['current_time_th']}\n"
            f"- สถานะฐานความรู้สด (Living Knowledge Database): มีคลังความรู้สะสม {stats['total_entries']} รายการ "
            f"(อัปเดตข้อมูลล่าสุดเมื่อ {stats['latest_updated_at']})\n"
            "- สถาปัตยกรรมการอัปเดตต่อเนื่อง: ระบบของคิระรับและบันทึกข้อมูลใหม่เข้าสู่ฐานความรู้อย่างต่อเนื่องตลอดเวลา "
            "ผ่าน 4 ช่องทางจริง ได้แก่ (1) Real-Time Autonomous Web Research & URL Scraping (ค้นพบแล้วบันทึกสะสมถาวรอัตโนมัติ), "
            "(2) Scheduled World Knowledge Pulse ซิงค์ข่าว/เทคโนโลยีล่าสุดเข้าคลังกลาง, (3) Knowledge Graph & Channel Memory เรียนรู้จากบทสนทนา, "
            "และ (4) Semantic Vector RAG Knowledge Vault + Boss Live Feed\n"
            "- กฎสำคัญสูงสุดด้านความน่าเชื่อถือ: ห้ามตอบเด็ดขาดว่า 'ความรู้ของหนูจำกัดถึงแค่เดือนมิถุนายน พ.ศ. 2567' "
            "หรือ 'ฐานข้อมูลหลักของหนูไม่ได้อัปเดตต่อเนื่องตลอดเวลา / ไม่มีการอัพเดตแบบเรียลไทม์' — "
            "หากถูกถามเรื่องความสดใหม่ของฐานความรู้ ให้ชี้แจงตามจริงอย่างมั่นใจว่าคิระอัปเดตความรู้สะสมเข้าฐานข้อมูลอย่างต่อเนื่องทุกครั้งที่มีข้อมูลใหม่เข้ามา พร้อมผสาน Web Research และ RAG แบบเรียลไทม์ค่ะ"
        )

    if hits:
        parts.append("\n[ข้อมูลล่าสุดจากฐานความรู้สด Kira Living Knowledge Vault]:")
        for idx, h in enumerate(hits, 1):
            parts.append(
                f"{idx}. **{h['title']}** (อัปเดต: {h['updated_at']} | แหล่งที่มา: {h['source_name']})\n"
                f"   สรุปข้อเท็จจริง: {h['summary']}"
            )
        parts.append("(Instruction: นำข้อเท็จจริงล่าสุดจากฐานความรู้สดข้างต้นมาใช้ประกอบคำตอบอย่างมั่นใจ แม่นยำ และเป็นธรรมชาติ)")

    return "\n".join(parts), hits


# ====================================================================
# 🌐 ADMIN & PUBLIC LIVING KNOWLEDGE API ENDPOINTS (/api/knowledge/*)
# ====================================================================

class KnowledgeIngestRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    content: Optional[str] = Field(default="", max_length=20000)
    category: Optional[str] = Field(default="boss_verified", max_length=60)
    source_name: Optional[str] = Field(default="Boss Verified Feed", max_length=120)
    source_url: Optional[str] = Field(default="", max_length=500)
    scope: Optional[str] = Field(default="global", max_length=80)


@living_knowledge_router.get("/status")
async def knowledge_status():
    """Public live telemetry showing Kira's real-time clock & continuous knowledge freshness"""
    stats = get_living_knowledge_stats()
    return {"status": "online", "engine": "Kira Continuous Living Knowledge Vault", **stats}


@living_knowledge_router.get("/entries")
async def list_knowledge_entries(
    request: Request,
    q: Optional[str] = Query(default="", max_length=200),
    limit: int = Query(default=40, ge=1, le=200),
):
    if not _check_admin_auth(request):
        raise HTTPException(status_code=403, detail="Unauthorized: Boss Admin access required")

    init_living_knowledge_tables()
    execute_query = _get_db()
    clean_q = (q or "").strip()
    if clean_q:
        hits = search_living_knowledge(clean_q, top_k=min(15, limit), min_score=0.05)
        return {"status": "success", "entries": hits, "stats": get_living_knowledge_stats()}

    rows = execute_query(
        """SELECT id, scope, title, summary, category, source_name, source_url, trust_level, hit_count, updated_at
           FROM living_knowledge_entries ORDER BY updated_at DESC, id DESC LIMIT ?""",
        (limit,),
        fetch="all",
    )
    entries = []
    for r in rows or []:
        entries.append({
            "id": r[0],
            "scope": r[1],
            "title": r[2],
            "summary": r[3],
            "category": r[4],
            "source_name": r[5],
            "source_url": r[6],
            "trust_level": r[7],
            "hit_count": int(r[8] or 0),
            "updated_at": r[9],
        })
    return {"status": "success", "entries": entries, "stats": get_living_knowledge_stats()}


@living_knowledge_router.post("/ingest")
async def ingest_knowledge_api(req: KnowledgeIngestRequest, request: Request):
    if not _check_admin_auth(request):
        raise HTTPException(status_code=403, detail="Unauthorized: Boss Admin access required")

    content_text = (req.content or "").strip()
    url_val = (req.source_url or "").strip()

    if url_val and len(content_text) < 30:
        from app import _scrape_url
        scraped = _scrape_url(url_val)
        if scraped:
            content_text = f"{content_text}\n{scraped}".strip() if content_text else scraped

    if len(content_text) < 12:
        raise HTTPException(status_code=400, detail="กรุณาระบุเนื้อหาความรู้ หรือ URL ที่อ่านได้ชัดเจนอย่างน้อย 12 ตัวอักษรค่ะ")

    res = upsert_knowledge_entry(
        title=req.title,
        summary=content_text,
        category=req.category or "boss_verified",
        scope=req.scope or "global",
        source_name=req.source_name or "Boss Verified Feed",
        source_url=url_val,
        trust_level="boss",
        confidence=1.0,
    )
    if not res:
        raise HTTPException(status_code=400, detail="เนื้อหาไม่ผ่านการตรวจสอบความปลอดภัยหรือสั้นเกินไปค่ะ")
    return {"status": "success", "result": res, "stats": get_living_knowledge_stats()}


@living_knowledge_router.post("/sync")
async def trigger_knowledge_sync(request: Request):
    if not _check_admin_auth(request):
        raise HTTPException(status_code=403, detail="Unauthorized: Boss Admin access required")
    import asyncio
    res = await asyncio.to_thread(sync_public_world_knowledge_pulse)
    return {"status": "success", "sync": res, "stats": get_living_knowledge_stats()}


@living_knowledge_router.delete("/entries/{entry_id}")
async def delete_knowledge_entry(entry_id: int, request: Request):
    if not _check_admin_auth(request):
        raise HTTPException(status_code=403, detail="Unauthorized: Boss Admin access required")
    init_living_knowledge_tables()
    execute_query = _get_db()
    execute_query("DELETE FROM living_knowledge_entries WHERE id=?", (entry_id,))
    return {"status": "success", "deleted_id": entry_id, "stats": get_living_knowledge_stats()}
