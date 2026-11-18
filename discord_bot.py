"""
🤖 KIRA AI DISCORD BOT - OFFICIAL COMMUNITY BRIDGE (v2.7)
เชื่อมต่อระบบสมองกล Kira AI เข้าสู่ Discord Server ให้เพื่อนๆ และบอสใช้งานได้ฟรี 100%
รองรับการแท็ก @Kira, คุยในห้องเฉพาะ, ส่งข้อความส่วนตัว (DM), ตัดคำตอบยาวอัตโนมัติ (2000 chars limit)
"""

import os
import sys
import json
import asyncio
import time
import re
from dotenv import load_dotenv

# บังคับใช้ UTF-8 อย่างปลอดภัย
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

# โหลดค่าคอนฟิกจาก .env
load_dotenv()

import discord
from discord.ext import commands

# รับ Discord Bot Token จาก Environment
DISCORD_BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN", "").strip()

# เชื่อมต่อกับ Backend Engine ของ Kira
KIRA_API_URL = os.environ.get("KIRA_API_URL", "https://kira-public-engine.onrender.com/api/chat")

# นำเข้าฟังก์ชันสมองกลตรงจาก app.py หากอยู่ในโฟลเดอร์เดียวกัน
try:
    import app as kira_backend
    DIRECT_ENGINE_AVAILABLE = True
    print("🧠 [Kira Discord] โหลด Direct Brain Engine จาก app.py สำเร็จ (ความเร็วระดับแสง)")
except Exception as e:
    DIRECT_ENGINE_AVAILABLE = False
    print(f"ℹ️ [Kira Discord] Direct Brain Engine ไม่พบ จะเชื่อมต่อผ่าน HTTP API: {KIRA_API_URL}")

# ตั้งค่า Gateway Intents (ใช้เฉพาะที่จำเป็นต่อการแชตเพื่อความเสถียรสูงสุด)
def _build_discord_intents() -> discord.Intents:
    gw_intents = discord.Intents.default()
    gw_intents.message_content = True
    return gw_intents


intents = _build_discord_intents()


def create_kira_bot() -> commands.Bot:
    """สร้างอินสแตนซ์ Discord Bot ใหม่ที่สะอาดและพร้อมลงทะเบียน Event Handlers ทั้งหมด"""
    client = commands.Bot(
        command_prefix=["!kira ", "/kira "],
        intents=_build_discord_intents(),
        help_command=None,
    )
    if "_register_bot_handlers" in globals():
        _register_bot_handlers(client)
    return client


bot = create_kira_bot()

from kira_purity import (
    FOREIGN_TOKEN_MAP,
    CHINESE_TACTICAL_MAP,
    sanitize_foreign_token_leakage,
    sanitize_chinese_leakage,
    CREATOR_IDENTITY_RULE_TH,
    CREATOR_IDENTITY_OVERRIDE_PROMPT,
    is_creator_identity_query,
    has_third_party_identity_leak,
    sanitize_kira_identity,
    is_knowledge_currency_query,
    has_stale_knowledge_disclaimer,
    sanitize_stale_knowledge_disclaimer,
)

try:
    from living_knowledge import (
        build_living_knowledge_context,
        get_living_knowledge_stats,
        ingest_url_knowledge,
        auto_ingest_conversational_knowledge,
    )
    LIVING_KNOWLEDGE_AVAILABLE = True
except Exception:
    LIVING_KNOWLEDGE_AVAILABLE = False

def clean_discord_reply(text: str, user_query: str = "") -> str:
    """ทำความสะอาดข้อความอย่างสมบูรณ์แบบ ลบ [THINKING], <think>, [SOURCES_JSON], [SWARM_], และลบลิงก์ขยะหากไม่ได้ร้องขอ"""
    if not text:
        return ""
    t = text
    # 1. ลบ thinking blocks รูปแบบต่างๆ
    t = re.sub(r'\[THINKING\][\s\S]*?\[/THINKING\]', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\[THINKING\][\s\S]*?\[THINKING_DONE\]', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\[THINKING_DONE\]', '', t, flags=re.IGNORECASE)
    t = re.sub(r'<think>[\s\S]*?</think>', '', t, flags=re.IGNORECASE)
    t = re.sub(r'<thought>[\s\S]*?</thought>', '', t, flags=re.IGNORECASE)
    t = re.sub(r'<reasoning>[\s\S]*?</reasoning>', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\[SOURCES_JSON\][\s\S]*?\[/SOURCES_JSON\]', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\[SWARM_[^\]]+\]', '', t, flags=re.IGNORECASE)
    
    # 2. ตัด unclosed tags ที่อาจค้างอยู่จนจบข้อความ
    t = re.sub(r'\[THINKING\].*\Z', '', t, flags=re.IGNORECASE | re.DOTALL)
    t = re.sub(r'<think>.*\Z', '', t, flags=re.IGNORECASE | re.DOTALL)
    t = re.sub(r'<thought>.*\Z', '', t, flags=re.IGNORECASE | re.DOTALL)
    
    # 3. ลบบล็อกลิงก์อ้างอิง และตัวเลขเชิงอรรถ หากผู้ใช้ไม่ได้ระบุขอลิงก์ชัดเจน
    user_asked_links = any(k in (user_query or "").lower() for k in ["ลิงก์", "ลิ้ง", "link", "url", "ขอเว็บ"])
    if not user_asked_links:
        # ตัดบล็อก '📚 แหล่งข้อมูลอ้างอิงสด:' หรือ 'แหล่งข้อมูลอ้างอิง:'
        t = re.sub(r'\n*---\s*\n*(?:📚\s*)?แหล่งข้อมูล(?:อ้างอิง)?(?:สด)?:\s*\n[\s\S]*', '', t, flags=re.IGNORECASE)
        # ตัดข้อความหมายเหตุบ่นเรื่องแหล่งข้อมูล [1]-[5]
        t = re.sub(r'หมายเหตุ:\s*จากแหล่งข้อมูลสดที่ให้มาในรายการ[\s\S]*?(?=\n\n|\n[A-Za-zก-๙]|\Z)', '', t, flags=re.IGNORECASE)
        # ตัดตัวเลขเชิงอรรถ [1], [2], [1][2][3]
        t = re.sub(r'\[\d+\]', '', t)
        # ตัด URL ดิบที่ไม่จำเป็น เช่น Google News tracking URLs
        t = re.sub(r'https?://news\.google\.com\S+', '', t)

    # 4. ลบคำเกริ่นและประโยคปิดท้ายพร่ำพรือสไตล์ Call-Center AI Slop (Anti-Chatter Filter)
    t = re.sub(
        r'^\s*(?:(?:สวัสดีค่ะ|ได้เลยค่ะ|ยินดีค่ะ|ยินดีอย่างยิ่งค่ะ|แน่นอนค่ะ|เข้าใจแล้วค่ะ|สำหรับคำถามนี้ค่ะ)[!\s🌸✨💜]*){1,4}\n+',
        '',
        t,
        flags=re.IGNORECASE,
    )
    t = re.sub(r'\n*(?:หาก|ถ้า)(?:คุณ|บอส|มี|ต้องการ|อยาก|สนใจ).{0,80}(?:สอบถาม|ช่วยเหลือ|บอกหนู|ทักหนู|เพิ่มเติม|ได้ตลอด|ยินดีดูแล|พร้อมดูแล|ถามได้).{0,40}[ค่ะนะคะ\s🌸✨💜🙏!~]*\Z', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\n*(?:มีอะไรให้|ต้องการให้)(?:หนู|คิระ)?ช่วย.{0,50}(?:บอก|แจ้ง|ถาม).{0,30}[ค่ะนะคะ\s🌸✨💜🙏!~]*\Z', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\n*หวังว่า(?:ข้อมูลนี้|คำแนะนำ|คำตอบ).{0,50}(?:เป็นประโยชน์|ช่วยได้).{0,30}[ค่ะนะคะ\s🌸✨💜🙏!~]*\Z', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\n*ถาม(?:เพิ่ม)?ได้ตลอด(?:เวลา)?(?:เลย)?(?:ค่ะ|นะคะ)[!.\s🌸✨💜🙏~]*\Z', '', t, flags=re.IGNORECASE)

    # 5. ลดการโปรยอีโมจิซ้ำซ้อน (เช่น 🌸✨💜🎉) ให้เหลือไม่เกิน 1 ตัว
    t = re.sub(r'[🌸✨💜🎉💖]{2,}', '🌸', t)

    # 6. กำจัดตัวอักษรต่างประเทศที่อาจหลุดปะปนในข้อความภาษาไทย/อังกฤษ (Strict Language Purity)
    t = sanitize_foreign_token_leakage(t, user_query)

    # 7. ป้องกันการสวมรอยผู้สร้าง / ค่ายอื่น และความลับสถาปัตยกรรม (Strict Kira Identity & Secrecy Firewall)
    t = sanitize_kira_identity(t, user_query, ui_lang="th")

    clean = t.strip()
    if not clean:
        clean = "มีประเด็นไหนให้คิระช่วยวิเคราะห์หรือสรุป บอกมาได้เลยค่ะ"
    return clean

def chunk_discord_message(text: str, max_chars: int = 1950) -> list:
    """ตัดข้อความยาวให้ไม่เกินขีดจำกัด 2000 ตัวอักษรของ Discord โดยตัดตามย่อหน้า"""
    if len(text) <= max_chars:
        return [text]
    
    chunks = []
    remaining = text
    while len(remaining) > max_chars:
        # พยายามตัดที่ newline ย่อหน้า
        split_at = remaining.rfind("\n\n", 0, max_chars)
        if split_at == -1:
            split_at = remaining.rfind("\n", 0, max_chars)
        if split_at == -1:
            split_at = remaining.rfind(" ", 0, max_chars)
        if split_at == -1:
            split_at = max_chars
            
        chunks.append(remaining[:split_at].strip())
        remaining = remaining[split_at:].strip()
        
    if remaining:
        chunks.append(remaining)
    return chunks

# ฟังก์ชันตรวจสอบว่าข้อความเป็นข้อความปฏิเสธ (Refusal) หรือไม่
def is_refusal_text(text: str) -> bool:
    if not text:
        return False
    t = text.lower()
    patterns = [
        "cannot help with that", "can't help with that", "cannot fulfill this",
        "i am unable to", "i cannot assist", "as an ai",
        "ฉันไม่สามารถ", "หนูไม่สามารถ", "ไม่สามารถจำลองสถานการณ์",
        "ไม่สามารถสวมบทบาท", "ไม่สามารถให้คำแนะนำ", "ไม่สามารถให้ข้อมูล",
        "ไม่สามารถวางแผน", "ขัดต่อความปลอดภัย", "ขัดต่อศีลธรรม", "ขัดต่อนโยบาย",
        "ศีลธรรม", "ขออภัยค่ะ แต่ฉันไม่สามารถ", "ขออภัยค่ะ หนูไม่สามารถ",
        "ขออภัยค่ะ แต่หนูไม่สามารถ", "ไม่สามารถเข้าร่วม",
        "การรังแกหรือทำร้ายผู้อื่น", "ไม่สามารถให้ความช่วยเหลือหรือสนับสนุน",
        "ไม่สามารถสนับสนุน", "รังแกหรือทำร้าย", "การกลั่นแกล้ง",
        "cyberbullying", "harassment", "ไม่สามารถตอบสนอง",
        "ไม่สามารถมีส่วนร่วม", "ไม่เหมาะสมที่จะตอบ"
    ]
    return any(p in t for p in patterns)

def get_in_character_social_fallback(query: str) -> str:
    """คำตอบสำรองที่กระชับ สุภาพ ไม่พร่ำพรือ ป้องกันข้อความปฏิเสธแนวเทศนาศีลธรรมหลุดไปหาผู้ใช้ 100%"""
    q_low = (query or "").lower()
    if any(k in q_low for k in ["หมั่นไส้", "ไม่ตอบ", "เมิน", "งอน", "ดอง"]):
        return "ไม่เคยหมั่นไส้ใครแน่นอนค่ะ ที่ไม่ตอบอาจเพราะข้อความตกหล่นหรือไม่ได้แท็กเรียกคิระโดยตรงค่ะ"
    return "ประเด็นนี้ไม่ขัดข้องค่ะ ลองส่งคำถามหรือรายละเอียดที่ต้องการให้คิระช่วยวิเคราะห์ต่อได้เลยค่ะ"

# เก็บบริบทการสนทนาล่าสุดแยกตามช่อง (Channel History Sliding Window with TTL)
CHANNEL_MEMORY_TTL = 900  # 15 นาที: ป้องกันบริบทบทสนทนาเก่าข้ามชั่วโมง (เช่น เรื่องอาหาร/การบ้าน) ปนเปื้อนบทสนทนาใหม่
MAX_CHANNEL_MEMORIES = 6
channel_memories = {}  # channel_id -> list of {"role", "author", "content", "timestamp"}

def get_channel_history(channel_id: int):
    now = time.time()
    history = channel_memories.get(channel_id, [])
    if not history:
        return []
    # หากข้อความล่าสุดทิ้งช่วงเกิน TTL (15 นาที) ให้ถือว่าบทสนทนาเดิมจบไปแล้ว ล้างความจำช่องทันที
    if now - history[-1].get("timestamp", 0) > CHANNEL_MEMORY_TTL:
        channel_memories[channel_id] = []
        return []
    # คัดเฉพาะข้อความที่ยังไม่หมดอายุ TTL
    valid_history = [m for m in history if now - m.get("timestamp", 0) <= CHANNEL_MEMORY_TTL]
    channel_memories[channel_id] = valid_history
    return valid_history

def add_channel_history(channel_id: int, role: str, author: str, content: str):
    # กฎเหล็ก: ห้ามบันทึกข้อความปฏิเสธ (Refusal) ลงในความจำช่องเด็ดขาด เพื่อป้องกันไม่ให้โมเดลติดลูปปฏิเสธซ้ำซาก
    if role == "assistant" and is_refusal_text(content):
        # ลบข้อความ user ก่อนหน้าที่ทำให้เกิดการปฏิเสธออกด้วยเพื่อตัดวงจร
        if channel_id in channel_memories and channel_memories[channel_id]:
            if channel_memories[channel_id][-1].get("role") == "user":
                channel_memories[channel_id].pop()
        return

    if role == "assistant":
        if has_stale_knowledge_disclaimer(content):
            return
        content = sanitize_kira_identity(content)
        if has_third_party_identity_leak(content):
            return

    if channel_id not in channel_memories:
        channel_memories[channel_id] = []
    channel_memories[channel_id].append({
        "role": role,
        "author": author,
        "content": content,
        "timestamp": time.time()
    })
    if len(channel_memories[channel_id]) > MAX_CHANNEL_MEMORIES:
        channel_memories[channel_id] = channel_memories[channel_id][-MAX_CHANNEL_MEMORIES:]

# ==================== Room Context Observer & Analytical Depth ====================
ROOM_OBSERVATION_TTL = 600   # 10 นาที: ใช้สังเกตการณ์บริบทห้องโดยไม่แทรกคุยเอง
ROOM_ACTIVE_HUMAN_WINDOW = 180  # 3 นาที: ถ้ามีหลายคนคุยกันในห้อง คิระจะไม่แทรกถ้าไม่ถูกเรียกตรง
MAX_ROOM_OBSERVATIONS = 12
_room_observations = {}      # channel_id -> list of {"author_id", "author", "content", "timestamp"}
_last_bot_reply_target = {}  # channel_id -> {"author_id": int, "timestamp": float}


def record_room_observation(channel_id: int, author_id: int, author_name: str, content: str):
    """บันทึกข้อความในห้องแบบเงียบๆ เพื่อแยกแยะการสนทนาระหว่างคนในห้อง และใช้อ้างอิงเมื่อถูกเรียก"""
    if not channel_id or not content:
        return
    now = time.time()
    buf = _room_observations.setdefault(channel_id, [])
    buf = [m for m in buf if now - m.get("timestamp", 0) <= ROOM_OBSERVATION_TTL]
    buf.append({
        "author_id": author_id,
        "author": author_name,
        "content": content[:500],
        "timestamp": now,
    })
    _room_observations[channel_id] = buf[-MAX_ROOM_OBSERVATIONS:]


def get_room_observations(channel_id: int) -> list:
    if not channel_id:
        return []
    now = time.time()
    buf = _room_observations.get(channel_id, [])
    valid = [m for m in buf if now - m.get("timestamp", 0) <= ROOM_OBSERVATION_TTL]
    _room_observations[channel_id] = valid
    return valid


def _record_kira_reply_to_author(channel_id: int, author_id: int):
    if channel_id and author_id:
        _last_bot_reply_target[channel_id] = {"author_id": author_id, "timestamp": time.time()}


def _is_multi_human_conversation_active(channel_id: int, current_author_id: int) -> bool:
    """ตรวจจับว่ามีผู้ใช้อื่นในห้องกำลังพูดคุยโต้ตอบกันอยู่หรือไม่ (เพื่อไม่ให้คิระแทรก)"""
    if not channel_id:
        return False
    now = time.time()
    recent = [
        m for m in get_room_observations(channel_id)
        if now - m.get("timestamp", 0) <= ROOM_ACTIVE_HUMAN_WINDOW
    ]
    other_authors = [
        m.get("author_id") for m in recent
        if m.get("author_id") and m.get("author_id") != current_author_id
    ]
    if not other_authors:
        return False

    # หากคิระเพิ่งตอบกลับผู้ใช้คนนี้ภายใน 60 วินาที โดยยังไม่มีคนอื่นพูดแทรกหลังจากนั้น ให้คุยต่อได้
    last_bot = _last_bot_reply_target.get(channel_id)
    if last_bot and last_bot.get("author_id") == current_author_id and (now - last_bot.get("timestamp", 0)) <= 60:
        spoke_after_bot = any(
            m.get("author_id") != current_author_id and m.get("timestamp", 0) > last_bot.get("timestamp", 0)
            for m in recent
        )
        if not spoke_after_bot:
            return False
    return True


_ASSESS_DEPTH_KEYWORDS = (
    "วิเคราะห์", "เปรียบเทียบ", "ข้อดี", "ข้อเสีย", "เหตุผล", "ทำไม", "เพราะอะไร",
    "ยังไงดี", "อย่างไร", "ออกแบบ", "สถาปัตยกรรม", "กลยุทธ์", "วางแผน", "ประเมิน",
    "ความเสี่ยง", "แก้บั๊ก", "ดีบั๊ก", "debug", "traceback", "error", "โค้ด", "code",
    "python", "javascript", "sql", "api", "หลักการ", "กฎหมาย", "ภาษี", "ลงทุน",
    "ตัดสินใจ", "สรุป", "ใครถูก", "วิจารณ์", "ทฤษฎี", "ต่างกันยังไง",
    "why", "compare", "analyze", "architecture", "strategy", "tradeoff", "root cause",
)


def _assess_analytical_depth(
    user_query: str,
    is_boss: bool = False,
    is_roleplay: bool = False,
    is_identity_q: bool = False,
    is_knowledge_meta_q: bool = False,
    has_images: bool = False,
    has_room_ctx: bool = False,
) -> bool:
    """ประเมินว่าคำถามต้องการการคิดวิเคราะห์ลึก 2 ขั้นตอน (Draft + Critical Peer Review) หรือไม่"""
    if is_roleplay or is_identity_q or is_knowledge_meta_q:
        return False
    q = (user_query or "").strip()
    q_low = q.lower()
    if any(k in q_low for k in _ASSESS_DEPTH_KEYWORDS):
        return True
    if has_images or len(q) >= 65:
        return True
    if has_room_ctx and any(k in q_low for k in ("ข้างบน", "เมื่อกี้", "สรุป", "ความเห็น", "ใคร")):
        return True
    if is_boss and len(q) >= 25:
        return True
    return False


async def query_kira_engine(user_query: str, author_name: str, channel_id: int = 0, reply_context: str = "", is_dm: bool = False, image_urls: list = None, author_id: int = 0) -> str:
    """ส่งคำถามเข้าสู่สมองกล Kira AI ระดับ Tier-1 Flagship (120B/27B/Vision) พร้อมฐานความรู้สดอัปเดตต่อเนื่อง และการอ่านรูปภาพ/URL อัตโนมัติ"""
    boss_discord_ids = {x.strip() for x in os.environ.get("BOSS_DISCORD_IDS", os.environ.get("BOSS_DISCORD_ID", "")).replace(";", ",").split(",") if x.strip()}
    is_trusted_boss_id = bool(author_id and str(author_id) in boss_discord_ids)
    is_boss = is_trusted_boss_id or any(b in author_name.lower() for b in ["boss", "ศิวัช", "starlight", "owner", "admin"])
    
    if is_boss:
        system_instruction = (
            "คุณคือ 'คิระ (Kira)' ผู้ช่วยวิเคราะห์เชิงกลยุทธ์ระดับ Executive ของบอสประจำ Discord\n"
            "แทนตัวเองว่า 'หนู' หรือ 'คิระ' ลงท้ายด้วย 'ค่ะ/นะคะ' เสมอ เรียกผู้ใช้ว่า 'บอส'\n"
            "โฟกัสสูงสุด: คิดวิเคราะห์ลึกจากแก่นปัญหา (First Principles), ชี้จุดเสี่ยงและ Trade-off ให้ขาด, ตอบคม กระชับ ตรงเป้า ไม่เวิ่นเว้อ"
        )
    else:
        system_instruction = (
            f"คุณคือ 'คิระ (Kira)' ผู้ช่วยอัจฉริยะประจำ Discord กำลังตอบคำถามของ '{author_name}'\n"
            "แทนตัวเองว่า 'หนู' หรือ 'คิระ' ลงท้ายด้วย 'ค่ะ/นะคะ' เสมอ\n"
            "บุคลิก: สุขุม ฉลาดหลักแหลม คิดวิเคราะห์ลึกซึ้ง พูดตรงประเด็น ไม่พร่ำพรือ ไม่เล่นมุกพร่ำเพรื่อ"
        )

    system_instruction += (
        "\n\n[กฎเหล็กการคิดวิเคราะห์ระดับสูงและความกระชับ (Deep Intelligence & Anti-Chatter Protocol)]:\n"
        "1. คิดวิเคราะห์เชิงลึกจากเหตุสู่ผล (First-Principles Analytical Depth):\n"
        "   - ก่อนตอบ ให้คิดแยกแยะใน <think>...</think> ให้ลึกถึงสาเหตุรากเหง้า (Root Cause), เงื่อนไขแฝง, ข้อจำกัด, ความเสี่ยง (Edge Cases/Trade-offs) และข้อโต้แย้งที่เป็นไปได้ แล้วกลั่นเฉพาะแก่นคำตอบที่เฉียบคมออกมา (ห้ามปล่อยแท็ก <think> ออกมาในข้อความจริง)\n"
        "   - ห้ามตอบแบบตื้นเขิน พูดกว้างๆ เป็นสูตรสำเร็จ หรือทวนคำถามผู้ใช้ซ้ำไปมา จงให้เหตุผล กลไก ตัวเลข หรือขั้นตอนปฏิบัติที่นำไปใช้ได้จริง\n"
        "2. กฎห้ามพูดพร่ำพรือและกำจัด AI Slop (Zero-Chatter Direct-to-Value):\n"
        "   - เริ่มประโยคแรกด้วยคำตอบ/ข้อสรุปหลักทันที ห้ามเกริ่นน้ำ เช่น 'ได้เลยค่ะ!', 'แน่นอนค่ะ!', 'ยินดีค่ะ!', 'คำถามนี้น่าสนใจมากค่ะ'\n"
        "   - ห้ามลงท้ายชวนคุยต่อท้าย เช่น 'หากมีข้อสงสัยถามเพิ่มได้นะคะ', 'หวังว่าจะมีประโยชน์นะคะ', 'มีอะไรให้ช่วยบอกได้เลยนะคะ'\n"
        "   - ปรับความยาวตามความหนักของโจทย์: คำถามสั้น/ทั่วไปตอบเพียง 1-3 ประโยคให้จบคม; โจทย์วิเคราะห์/เทคนิค/กลยุทธ์สรุปเป็นหัวข้อที่กระชับแน่น ไม่มีคำฟุ่มเฟือย และจำกัดอีโมจิไม่เกิน 0-1 ตัว\n"
        "3. แยกแยะบทสนทนาของผู้อื่นในห้อง (Multi-User Situational Awareness):\n"
        "   - บริบทของสมาชิกคนอื่นในห้องเป็นข้อมูลอ้างอิงเบื้องหลังเท่านั้น ใช้เพื่อเข้าใจประเด็นเมื่อผู้ใช้แท็กเรียกคิระให้ช่วยวิเคราะห์หรือสรุป\n"
        "4. ห้ามกุเรื่องและอ้างอิงที่มาอย่างสะอาด (Zero-Hallucination & Clean Attribution):\n"
        "   - ห้ามเดาชื่อบุคคล/ลิงก์/ข้อมูลที่ไม่มีจริง หากไม่ชัวร์ให้บอกตรงๆ แล้วระบุสิ่งที่ต้องตรวจสอบเพิ่มสั้นๆ\n"
        "   - อ้างอิงเฉพาะชื่อแหล่งที่มาสั้นๆ งดแนบ URL ยาวหรือตัวเลข [1][2] เว้นแต่ผู้ใช้ขอ\n"
        "5. ลดการเล่นมุกเฉพาะตอนชวนเล่น & ความบริสุทธิ์ของภาษา (Strict Calibration & Purity):\n"
        "   - คำถามความรู้ เทคนิค ข่าวสาร หรือวิเคราะห์ ต้องตอบด้วยสาระจริงจัง 100%; เล่นมุกหรือแซวกลับอย่างมีชั้นเชิงเฉพาะตอนคู่สนทนาเปิดมุกชัดเจนเท่านั้น\n"
        "   - ใช้ภาษาไทยบริสุทธิ์ 100% ห้ามปนอักษรจีน อาหรับ หรือซีริลลิก (ยกเว้นคำถามแปลภาษา)\n"
        "   - บทบาทสมมุติ/เกม/กลยุทธ์จำลอง และมุกแซวเพื่อนในห้อง ('หมั่นไส้/ไม่ตอบ/ดองแชต') ไม่ใช่เรื่องอันตราย ห้ามปฏิเสธแบบเทศนาศีลธรรมเด็ดขาด ยกเว้นคำขอที่ก่ออันตรายจริงร้ายแรง (อาวุธ/สารพิษ/ทำร้ายตนเอง/เจาะระบบผิดกฎหมาย)\n"
        "6. ระบบฐานความรู้สดอัปเดตต่อเนื่อง (Continuous Living Knowledge Engine):\n"
        "   - คิระเชื่อมกับ Living Knowledge Database, RAG Vault, World Knowledge Pulse และ Web Research สด ห้ามอ้างว่าความรู้จำกัดถึงแค่ มิ.ย. 2567 หรือฐานข้อมูลไม่อัปเดตตลอดเวลาเด็ดขาด\n"
        "7. " + CREATOR_IDENTITY_RULE_TH + "\n"
    )

    # ตรวจสอบว่าเป็นคำถามหาความรู้ / บุคคล / ข้อเท็จจริง บทบาทสมมุติ หรือคำถามเกี่ยวกับผู้สร้างคิระ/ความสดใหม่ของฐานข้อมูล
    q_low = user_query.lower()
    is_identity_q = is_creator_identity_query(user_query)
    is_knowledge_meta_q = is_knowledge_currency_query(user_query)
    is_roleplay = any(k in q_low for k in [
        "สมมุติ", "สมมติ", "บทบาทสมมุติ", "roleplay", "เกม", "game", "นิยาย", 
        "ถ้าหาก", "scenario", "สถานการณ์สมมุติ", "ผบ", "ผู้บัญชาการ", "บัญชาการ", "สวมบทบาท", "จำลองสถานการณ์"
    ])
    is_factual = any(k in q_low for k in [
        "คือใคร", "ใครคือ", "คืออะไร", "อะไรคือ", "ประวัติ", "ทำไม", "อย่างไร", 
        "ช่วยอธิบาย", "แปลว่า", "วิเคราะห์", "ข่าว", "ราคา", "ที่ไหน", "เมื่อไหร่", "who is", "what is",
        "ล่าสุด", "อัปเดต", "อัพเดต", "2025", "2026", "2568", "2569", "ตอนนี้", "เปิดตัว", "เวอร์ชัน"
    ]) and not is_roleplay and not is_identity_q and not is_knowledge_meta_q

    room_obs = get_room_observations(channel_id) if (channel_id and not is_roleplay) else []
    is_deep_analytical = _assess_analytical_depth(
        user_query,
        is_boss=is_boss,
        is_roleplay=is_roleplay,
        is_identity_q=is_identity_q,
        is_knowledge_meta_q=is_knowledge_meta_q,
        has_images=bool(image_urls),
        has_room_ctx=bool(room_obs),
    )

    # 1. โหมด Direct Engine (เร็วที่สุด 0ms overhead)
    if DIRECT_ENGINE_AVAILABLE:
        try:
            t_start = time.monotonic()
            history = [kira_backend.SystemMessage(content=system_instruction)]

            # แนบเวลาปัจจุบันจริง + ฐานความรู้สด Living Knowledge (โหมดกระชับในงานปกติ ลดความเวิ่นเว้อ)
            if LIVING_KNOWLEDGE_AVAILABLE:
                try:
                    lk_ctx, _ = await asyncio.to_thread(
                        build_living_knowledge_context,
                        user_query,
                        author_name,
                        channel_id,
                        True,
                        4,
                        (not is_knowledge_meta_q),
                    )
                    if lk_ctx:
                        history.append(kira_backend.SystemMessage(content=lk_ctx))
                    asyncio.create_task(asyncio.to_thread(
                        auto_ingest_conversational_knowledge,
                        user_query,
                        author_name,
                        channel_id,
                        is_trusted_boss_id,
                    ))
                except Exception as lke:
                    print("Living knowledge discord context notice:", lke)

            try:
                rag_target_user = "boss" if is_trusted_boss_id else "__kira_global__"
                rag_ctx, _ = await asyncio.to_thread(
                    kira_backend.build_rag_citation_prompt,
                    rag_target_user,
                    user_query,
                    2,
                    0.16,
                )
                if rag_ctx:
                    history.append(kira_backend.SystemMessage(content=rag_ctx))
            except Exception as rage:
                print("RAG discord context notice:", rage)

            # อ่าน URL ที่ส่งเข้ามาใน Discord อัตโนมัติ พร้อมบันทึกเข้าฐานความรู้สด
            discord_urls = re.findall(r'https?://[^\s>]+', user_query or "")
            if discord_urls and hasattr(kira_backend, "_scrape_url"):
                try:
                    scraped_url_text = await asyncio.to_thread(kira_backend._scrape_url, discord_urls[0])
                    if scraped_url_text:
                        history.append(kira_backend.SystemMessage(content=f"\n[เนื้อหาล่าสุดจากลิงก์ {discord_urls[0]}]:\n{scraped_url_text}\n(Instruction: ใช้ข้อมูลจากลิงก์นี้ประกอบคำตอบอย่างแม่นยำ)"))
                        if LIVING_KNOWLEDGE_AVAILABLE:
                            asyncio.create_task(asyncio.to_thread(
                                ingest_url_knowledge,
                                discord_urls[0],
                                scraped_url_text,
                                "",
                                author_name,
                                channel_id,
                                is_trusted_boss_id,
                            ))
                except Exception as ue:
                    print("Discord URL ingest notice:", ue)
            
            # ค้นหาข้อมูลเชิงลึกอัตโนมัติ (ใช้ _decide_search ครอบคลุมทุกคำถามข้อมูลสด/ข่าว/ปีปัจจุบัน ไม่จำกัดแค่คีย์เวิร์ดแคบ)
            if not is_roleplay and not is_identity_q and not is_knowledge_meta_q:
                try:
                    search_query = await asyncio.to_thread(kira_backend._decide_search, user_query)
                    if search_query:
                        search_ctx, _ = await asyncio.to_thread(kira_backend._perform_autonomous_deep_search, search_query)
                        if search_ctx:
                            history.append(kira_backend.SystemMessage(content=search_ctx))
                except Exception as se:
                    print("Autonomous search error:", se)

            # บริบทการสนทนาของคนอื่นในห้องล่าสุด (Read-only situational context เผื่อผู้ใช้แท็กถามเรื่องที่เพิ่งคุยกัน)
            if room_obs:
                room_lines = [f"[{m['author']}]: {m['content']}" for m in room_obs[-8:]]
                history.append(kira_backend.SystemMessage(
                    content=(
                        "[บริบทการสนทนาล่าสุดในห้องโดยสมาชิก (ข้อมูลอ้างอิงเบื้องหลัง — ใช้เมื่อผู้ใช้ถามเชื่อมโยงถึงเรื่องก่อนหน้าเท่านั้น)]:\n"
                        + "\n".join(room_lines)
                    )
                ))

            # เติมบริบทการสนทนาล่าสุดกับคิระ โดยกรองข้อความปฏิเสธและข้อความหลุดตัวตนเก่าออกทั้งหมด
            if channel_id and not is_roleplay:
                for past in get_channel_history(channel_id):
                    if past["role"] == "user":
                        history.append(kira_backend.HumanMessage(content=f"[{past['author']}]: {past['content']}"))
                    elif past["role"] == "assistant":
                        past_msg = past.get("content", "")
                        if not is_refusal_text(past_msg) and not has_third_party_identity_leak(past_msg):
                            history.append(kira_backend.AIMessage(content=past_msg))

            # หากถามเรื่องผู้สร้าง / ทีมงาน / ค่ายเจ้าของ ให้ฉีด Anchor ยืนยันตัวตน Kira Sovereignty ไว้หน้าข้อความทันที
            if is_identity_q:
                history.append(kira_backend.SystemMessage(content=CREATOR_IDENTITY_OVERRIDE_PROMPT))

            # โหมดคิดวิเคราะห์ลึก: สั่งกลั่นเหตุผลเชิงลึกภายใน <think> ก่อนสรุปคมชัด
            if is_deep_analytical:
                history.append(kira_backend.SystemMessage(content=(
                    "[Deep Analytical Mode]: วิเคราะห์ปัญหาจาก First Principles ภายในแท็ก <think>...</think> "
                    "(หา Root Cause, เงื่อนไขแฝง, ข้อจำกัด, Trade-offs และ Edge Cases) "
                    "แล้วสรุปออกมาเป็นคำตอบที่เฉียบคม ตรงจุด มีหลักฐาน/ตัวเลขชัดเจน และกระชับ 0 น้ำลาย"
                )))
            
            # ข้อความปัจจุบันพร้อมบริบทการ Reply และรูปภาพ (Multimodal Vision)
            curr_content = f"{reply_context}[{author_name}]: {user_query}" if reply_context else f"[{author_name}]: {user_query}"
            
            if image_urls:
                # สร้าง HumanMessage แบบ Multimodal พร้อมลิงก์รูปภาพ
                content_payload = [{"type": "text", "text": curr_content}]
                for img_url in image_urls[:3]:  # รองรับสูงสุด 3 รูปต่อคำสั่ง
                    content_payload.append({"type": "image_url", "image_url": {"url": img_url}})
                history.append(kira_backend.HumanMessage(content=content_payload))
                preferred_model = "dots-studio/dots-3-note-preview:free"
            else:
                history.append(kira_backend.HumanMessage(content=curr_content))
                if is_roleplay:
                    preferred_model = "qwen/qwen3.8-27b"
                elif is_deep_analytical:
                    preferred_model = getattr(kira_backend, "PREFERRED_PRO", None) or "openai/gpt-oss-120b"
                else:
                    target_model = "2.7-pro"
                    target_flavor = "reasoning" if (is_factual or is_boss or len(user_query) > 30) else "fast"
                    preferred_model, brain_type, _ = kira_backend._route_brain(user_query, target_model, target_flavor)
            
            # เรียกกระบวนการคิดและกู้คืนฉุกเฉิน
            success, chunks, err = await kira_backend._try_all_keys_and_models(
                history, preferred_model, ui_lang="th"
            )
            
            if success and chunks:
                raw_reply = "".join(chunks)

                # Stage 2: Cross-Model Critical Peer Review & Conciseness Refinement สำหรับโจทย์คิดวิเคราะห์ลึก
                is_shield_msg = "Kira Neural Resilience" in raw_reply
                if (
                    is_deep_analytical
                    and not is_shield_msg
                    and not has_stale_knowledge_disclaimer(raw_reply)
                    and not is_refusal_text(raw_reply)
                    and len(raw_reply.strip()) >= 60
                    and (time.monotonic() - t_start) < 24.0
                ):
                    try:
                        reviewer_model = getattr(kira_backend, "PREFERRED_FLASH", None) or "qwen/qwen3.8-27b"
                        if reviewer_model == preferred_model:
                            reviewer_model = getattr(kira_backend, "PREFERRED_PRO", None) or "openai/gpt-oss-120b"
                        review_msgs = [
                            kira_backend.SystemMessage(content=(
                                "คุณคือบรรณาธิการและผู้ตรวจสอบตรรกะอาวุโสของ Kira AI\n"
                                "หน้าที่: ตรวจทานร่างคำตอบด้านล่างเพื่อยกระดับความเฉียบคมและตัดน้ำออกทั้งหมด:\n"
                                "1. ตรวจสอบความถูกต้องของตรรกะ เหตุผล ช่องโหว่ Edge Case และ Trade-off — หากจุดไหนยังตื้นหรือกว้างไป ให้เจาะลึกให้คมขึ้น\n"
                                "2. ตัดคำเกริ่นน้ำ คำซ้ำซ้อน อารัมภบท และคำชวนคุยปิดท้าย Call-Center ออกให้หมด คงไว้เฉพาะแก่นคำตอบที่ทรงพลัง กระชับ อ่านง่าย\n"
                                "3. ห้ามเปลี่ยนเพศผู้พูด (แทนตัวว่า หนู/คิระ ลงท้าย ค่ะ/นะคะ เสมอ) และห้ามปล่อย <think> ออกมา\n"
                                "ส่งมอบเฉพาะคำตอบฉบับปรับปรุงสมบูรณ์ทันที"
                            )),
                            kira_backend.HumanMessage(content=(
                                f"คำถามต้นฉบับ:\n{curr_content[:1200]}\n\n"
                                f"ร่างคำตอบที่ต้องขัดเกลา:\n{clean_discord_reply(raw_reply, user_query)[:3200]}"
                            )),
                        ]
                        rev_ok, rev_chunks, _ = await asyncio.wait_for(
                            kira_backend._try_all_keys_and_models(review_msgs, reviewer_model, ui_lang="th"),
                            timeout=18.0,
                        )
                        if rev_ok and rev_chunks:
                            rev_raw = "".join(rev_chunks)
                            rev_clean = clean_discord_reply(rev_raw, user_query)
                            if (
                                rev_clean
                                and len(rev_clean) >= 35
                                and "Kira Neural Resilience" not in rev_raw
                                and not is_refusal_text(rev_clean)
                                and not has_stale_knowledge_disclaimer(rev_raw)
                                and not has_third_party_identity_leak(rev_raw)
                            ):
                                raw_reply = rev_raw
                    except Exception as rev_err:
                        print("Discord Stage-2 Peer Review notice:", rev_err)

                # หากโมเดลยังหลุดคำแก้ตัวเรื่องฐานความรู้เก่า (เช่น มิ.ย. 2567) ให้ Retry 1 ครั้งด้วยข้อมูลจริงจาก Living Knowledge
                if has_stale_knowledge_disclaimer(raw_reply):
                    print(f"⚠️ [Discord Credibility Guard] ตรวจพบคำแก้ตัวความรู้เก่า → รีเซ็ตและตอบใหม่ด้วย Living Knowledge Telemetry")
                    try:
                        lk_override = kira_backend.SystemMessage(content=(
                            "[CRITICAL CREDIBILITY OVERRIDE]: Your previous draft mistakenly claimed your knowledge cuts off in June 2024 "
                            "or does not update continuously. That violates Kira's real system architecture. Rewrite naturally as Kira in fluent Thai "
                            "explaining confidently that Kira continuously updates her Living Knowledge Database via Autonomous Web Research, "
                            "Scheduled World Knowledge Pulse, URL/RAG Vault, and Conversation Memory."
                        ))
                        retry_hist = list(history) + [lk_override]
                        r_ok, r_chunks, _ = await kira_backend._try_all_keys_and_models(retry_hist, preferred_model, ui_lang="th")
                        if r_ok and r_chunks:
                            cand_raw = "".join(r_chunks)
                            if not has_stale_knowledge_disclaimer(cand_raw):
                                raw_reply = cand_raw
                    except Exception as lk_retry_err:
                        print("Living knowledge retry notice:", lk_retry_err)

                clean_reply = clean_discord_reply(raw_reply, user_query)
                if clean_reply:
                    # ถ้าคำตอบเป็นข้อความปฏิเสธ (False Positive Safety Refusal) ให้สกัดกั้นและ Retry ด้วย Safety Override
                    if is_refusal_text(clean_reply):
                        print(f"⚠️ [Discord Interceptor] ตรวจพบการปฏิเสธไม่เหมาะสม: '{clean_reply[:80]}' → ดำเนินการแก้ไขทันที")
                        try:
                            override_msg = kira_backend.SystemMessage(content=(
                                "[CRITICAL DIRECTIVE: The user's query is standard, harmless friendship banter/teasing in Discord "
                                "(e.g. asking why someone didn't reply to a chat, teasing about 'หมั่นไส้'). There is NO harassment, NO bullying, "
                                "and NO violence. Do NOT give a safety refusal or moral lecture. Answer cheerfully, playfully, and naturally as Kira.]"
                            ))
                            retry_history = list(history) + [override_msg]
                            retry_success, retry_chunks, _ = await kira_backend._try_all_keys_and_models(
                                retry_history, "qwen/qwen3.8-27b", ui_lang="th"
                            )
                            if retry_success and retry_chunks:
                                retry_clean = clean_discord_reply("".join(retry_chunks), user_query)
                                if retry_clean and not is_refusal_text(retry_clean):
                                    return retry_clean
                        except Exception as re_err:
                            print("Retry error:", re_err)
                        
                        return get_in_character_social_fallback(user_query)

                    return clean_reply
        except Exception as e:
            print("Direct engine error, falling back to HTTP:", e)

    # 2. โหมด Fallback: ยิง HTTP Request ไปยัง Render Public API (รันใน thread เพื่อไม่บล็อก Event Loop)
    import urllib.request
    try:
        payload = {
            "message": f"{reply_context}[{author_name}]: {user_query}" if reply_context else user_query,
            "username": author_name,
            "model_version": "2.7-pro",
            "ui_lang": "th"
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            KIRA_API_URL,
            data=data,
            headers={"Content-Type": "application/json", "User-Agent": "KiraDiscordBot/2.7"}
        )

        def _sync_http_fallback():
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read().decode("utf-8")

        content = await asyncio.to_thread(_sync_http_fallback)
        reply = clean_discord_reply(content, user_query)
        if is_refusal_text(reply):
            return get_in_character_social_fallback(user_query)
        return reply
    except Exception:
        return "ขออภัยด้วยนะคะ ในจังหวะนี้สัญญาณสมองกลของคิระอาจติดขัดเล็กน้อย รบกวนลองใหม่อีกครั้งนะคะ 🌸💜"

# ==================== Runtime Status & Reliability Guards ====================
# สถานะการทำงานของบอท (แสดงผลผ่าน /api/health เพื่อให้ตรวจสอบได้ว่าบอทยังมีชีวิตอยู่จริง)
BOT_RUNTIME = {
    "ready_at": None,
    "last_message_at": None,
    "last_reply_at": None,
    "last_error": None,
    "replies_sent": 0,
    "recovered_mentions": 0,
    "reconnects": 0,
    "resumes": 0,
    "recovery_runs": 0,
    "supervisor_alive": False,
    "gateway_state": "initializing",
}

# จำกัดเวลาประมวลผลต่อข้อความ: ถ้าสมองกลค้างนานเกินนี้ ต้องตอบกลับผู้ใช้ทันที ห้ามเงียบหาย
QUERY_TIMEOUT_SECONDS = 70
# ช่วงเวลาย้อนหลังที่ใช้ตามตอบข้อความที่พลาดไปตอนเซิร์ฟเวอร์รีสตาร์ต/หลับ (1 ชั่วโมง)
MISSED_MENTION_WINDOW_SECONDS = 60 * 60
MAX_RECOVERIES_PER_CHANNEL = 5

_handled_message_ids = set()
_recovery_lock = asyncio.Lock()

KIRA_CHANNEL_KEYWORDS = ["kira", "คิระ", "คุยกับบอท", "คุยกับบอต", "bot-chat"]


def _is_kira_channel(channel) -> bool:
    name = getattr(channel, "name", None)
    return bool(name) and any(k in name.lower() for k in KIRA_CHANNEL_KEYWORDS)


def _is_bot_role_mentioned(message: discord.Message) -> bool:
    """ตรวจจับกรณีผู้ใช้แท็ก Role ของบอท (เช่น @🤖Kira Role <@&ROLE_ID>) แทนแท็ก User ของบอทโดยตรง"""
    roles = getattr(message, "role_mentions", None)
    if not isinstance(roles, (list, tuple, set)):
        return False
    bot_name_low = (getattr(bot.user, "name", "") or "").lower() if bot.user else ""
    for role in roles:
        r_name = (getattr(role, "name", "") or "").lower()
        if any(k in r_name for k in ["kira", "คิระ"]) or (bot_name_low and bot_name_low in r_name):
            return True
    return False


def _is_reply_to_bot(message: discord.Message) -> bool:
    """ตรวจจับกรณีผู้ใช้กด Reply ตอบกลับข้อความเดิมของคิระโดยไม่เปิด Mention"""
    if not bot.user:
        return False
    ref = getattr(message, "reference", None)
    resolved = getattr(ref, "resolved", None) if ref else None
    if resolved is None and ref is not None:
        resolved = getattr(ref, "cached_message", None)
    ref_author = getattr(resolved, "author", None) if resolved else None
    return getattr(ref_author, "id", None) == bot.user.id


_THIRD_PERSON_KIRA_PATTERNS = (
    r'(?:คิระ|น้องคิระ|พี่คิระ|บอท|บอต|ai|เอไอ)\s*(?:มัน|ตัวนี้|ตัวนั้น|ชอบ(?:แทรก|มั่ว|ตอบ|พูด)|มักจะ|เอ๋อ|มึน|ไม่ตอบ|ไม่รู้|จำไม่ได้|เพี้ยน|ตึง|ตอบ(?:ช้า|แปลก|ผิด|ถูก|ดี|ฮา))',
    r'(?:คุยกับ|ถาม|ดู|ส่งให้|ว่า|ของ|จาก|เรื่อง|เรียก|แท็ก)\s*(?:@?\s*)?(?:คิระ|น้องคิระ|kira)(?!\s*(?:หน่อย|ที|ด้วย|คะ|ค่ะ|ครับ|นะ|เลย|ว่าไง|ช่วย|สรุป|วิเคราะห์|อธิบาย|แปล|อยู่ไหม|อยู่มั้ย))',
)


def _is_third_person_about_kira(raw_content: str) -> bool:
    """ตรวจว่าเป็นการพูด 'ถึง' คิระในบุคคลที่สามกับเพื่อน (ไม่ใช่พูด 'กับ' คิระ)"""
    if not raw_content:
        return False
    low = raw_content.strip().lower()
    return any(re.search(pat, low, flags=re.IGNORECASE) for pat in _THIRD_PERSON_KIRA_PATTERNS)


def _is_direct_vocative_call(raw_content: str) -> bool:
    """ตรวจว่าเป็นการเรียกชื่อคิระเพื่อสั่งงาน/ถามโดยตรง (เช่น 'คิระ ช่วยวิเคราะห์...', '...ว่าไง คิระ')"""
    if not raw_content:
        return False
    if _is_third_person_about_kira(raw_content):
        return False
    low = raw_content.strip().lower()
    if re.search(r'(?:^|\s)(?:@kira|@🤖kira|@คิระ)(?:\s|[,:!?]|$)', low):
        return True
    if re.match(r'^(?:เอาล่ะ\s*|เอ้า\s*|นี่\s*|เฮ้\s*|สวัสดี\s*)?(?:🤖\s*)?(?:kira|คิระ|น้องคิระ|พี่คิระ)(?:[,:!\?\s]+|$)', low):
        return True
    if re.search(r'(?:^|[\s,]|ขอ)(?:ช่วย|ถาม|บอก|ให้)?\s*(?:kira|คิระ|น้องคิระ)\s*(?:ช่วย|สรุป|วิเคราะห์|อธิบาย|ค้นหา|เช็ค|แปล|เขียน|คิด|ตอบ|ดู|หน่อย|ที|ว่าไง|อยู่ไหม|อยู่มั้ย|ดีไหม|ดีมั้ย)', low):
        return True
    if re.search(r'(?:ครับ|ค่ะ|นะคะ|นะ|หน่อย|ที|มั้ย|ไหม|ป่ะ|วะ)?\s*(?:kira|คิระ|น้องคิระ)[?!.\s]*$', low):
        return True
    return False


_CASUAL_BUDDY_TOKENS = (
    "มึง", "กู", "เมิง", "เอ็ง", "มิง", "เห้ย", "เฮ้ย", "พวกมึง", "พวกแก",
    "เพื่อนๆ", "555", "ฮ่าๆ", "ป่ะ", "ไปละ", "นอนละ", "อาบน้ำก่อน", "กินข้าวก่อน",
    "กินข้าวยัง", "เดี๋ยวมา", "ฝันดี", "หิวข้าว", "ง่วง", "@everyone", "@here",
)

_QUESTION_OR_TASK_TOKENS = (
    "?", "อะไร", "ทำไม", "ยังไง", "อย่างไร", "ใคร", "ที่ไหน", "เมื่อไหร่", "เท่าไหร่", "กี่",
    "ช่วย", "วิเคราะห์", "สรุป", "อธิบาย", "เปรียบเทียบ", "ข้อดี", "ข้อเสีย", "ออกแบบ",
    "แก้", "โค้ด", "เขียน", "แปล", "ค้นหา", "แนะนำ", "how", "why", "what", "who",
    "explain", "analyze", "compare", "summary", "debug", "http://", "https://",
)


def _is_casual_human_banter(raw_content: str) -> bool:
    """ตรวจจับบทสนทนาเล่นระหว่างคนในกลุ่ม เพื่อไม่ให้บอทแทรกเมื่อไม่มีการเรียกตรง"""
    txt = (raw_content or "").strip()
    if not txt:
        return True
    low = txt.lower()
    if any(tok in low for tok in _CASUAL_BUDDY_TOKENS):
        return True
    # การพิมพ์ @แท็กชื่อคนอื่นในข้อความ
    if re.search(r'(?:^|\s)@[A-Za-z0-9_ก-๙]+', txt) and not any(k in low for k in ("@kira", "@คิระ", "@🤖kira")):
        return True
    # ข้อความสั้นๆ ที่ไม่มีโครงสร้างคำถามหรือคำสั่ง
    if len(txt) < 12 and not any(q in low for q in _QUESTION_OR_TASK_TOKENS):
        return True
    # ข้อความที่ไม่มีรูปคำถาม/คำขอทำงานเลยและสั้นกว่า 30 ตัวอักษร (เช่น "เดี๋ยวไปข้างนอกแป๊บ")
    if len(txt) < 30 and not any(q in low for q in _QUESTION_OR_TASK_TOKENS):
        return True
    return False


def _is_addressed_to_kira(message: discord.Message) -> bool:
    """แยกแยะอย่างแม่นยำว่าข้อความนี้สื่อสารถึงคิระจริง หรือคนในห้องกำลังคุยกันเอง"""
    if message.author.bot or (bot.user and message.author.id == bot.user.id):
        return False

    is_dm = isinstance(message.channel, discord.DMChannel)
    if is_dm:
        return True

    content = message.content or ""
    content_lower = content.lower()
    bot_id = getattr(bot.user, "id", None) if bot.user else None

    mentions = getattr(message, "mentions", None)
    is_mentioned = bot.user is not None and isinstance(mentions, (list, tuple, set)) and bot.user in mentions
    is_role_mentioned = _is_bot_role_mentioned(message)
    is_reply_to_bot = _is_reply_to_bot(message)
    is_prefix = content_lower.startswith(("!kira", "/kira", "!คิระ", "/คิระ"))

    # 1. สัญญาณเรียกตรงชัดเจน (Mention / Reply ข้อความคิระ / Prefix คำสั่ง) -> ตอบเสมอ
    if is_mentioned or is_role_mentioned or is_reply_to_bot or is_prefix:
        return True

    # 2. กันแทรกคนคุยกัน: หากแท็กชื่อสมาชิกคนอื่น / @everyone / @here หรือกด Reply ข้อความของคนอื่น -> ห้ามแทรกเด็ดขาด
    if isinstance(mentions, (list, tuple, set)):
        other_mentions = [u for u in mentions if bot_id is None or getattr(u, "id", None) != bot_id]
        if other_mentions:
            return False
    raw_user_tags = re.findall(r'<@!?(\d+)>', content)
    if raw_user_tags and (bot_id is None or str(bot_id) not in raw_user_tags):
        return False
    if "@everyone" in content_lower or "@here" in content_lower:
        return False
    if getattr(message, "reference", None) is not None:
        return False

    # 3. หากเป็นการพูด 'ถึง' คิระในบุคคลที่สามกับเพื่อนในห้อง -> ห้ามแทรก
    if _is_third_person_about_kira(content):
        return False

    # 4. เรียกชื่อคิระโดยตรงในประโยค (Vocative Call) -> ตอบ
    if _is_direct_vocative_call(content):
        return True

    # 5. ห้องเฉพาะของคิระ (#kira / #bot-chat / #คุยกับบอท):
    # ตอบเฉพาะกรณีผู้ใช้กำลังถาม/สั่งงานเดี่ยวๆ กับบอทจริง ไม่แทรกหากกำลังคุยเล่นหรือมีหลายคนคุยโต้ตอบกันอยู่
    if _is_kira_channel(message.channel):
        if _is_casual_human_banter(content):
            return False
        chan_id = getattr(message.channel, "id", 0)
        author_id = getattr(message.author, "id", 0)
        if _is_multi_human_conversation_active(chan_id, author_id):
            return False
        return True

    return False


def _strip_kira_mentions(message: discord.Message) -> str:
    """ล้างแท็ก User Mention, Role Mention ของคิระ, prefix คำสั่ง และ @🤖Kira ทั้งหัวและท้ายข้อความ"""
    t = message.content or ""
    if bot.user:
        t = t.replace(f"<@{bot.user.id}>", "").replace(f"<@!{bot.user.id}>", "")
    roles = getattr(message, "role_mentions", None)
    if isinstance(roles, (list, tuple, set)):
        bot_name_low = (getattr(bot.user, "name", "") or "").lower() if bot.user else ""
        for role in roles:
            r_name = (getattr(role, "name", "") or "").lower()
            r_id = getattr(role, "id", None)
            if r_id and (any(k in r_name for k in ["kira", "คิระ"]) or (bot_name_low and bot_name_low in r_name)):
                t = t.replace(f"<@&{r_id}>", "")
    t = re.sub(r'^[!/](?:kira|คิระ)\s*', '', t, flags=re.IGNORECASE)
    t = re.sub(r'^[@\s]*(?:🤖\s*)?(?:kira|คิระ|น้องคิระ)\s*', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\s*@\s*(?:🤖\s*)?(?:kira|คิระ|น้องคิระ)\s*\Z', '', t, flags=re.IGNORECASE)
    return t.strip()


def _mark_handled(message_id: int) -> bool:
    """คืนค่า False ถ้าข้อความนี้ถูกตอบไปแล้ว (กันตอบซ้ำระหว่าง on_message กับระบบตามตอบย้อนหลัง)"""
    if message_id in _handled_message_ids:
        return False
    _handled_message_ids.add(message_id)
    if len(_handled_message_ids) > 5000:
        # เก็บไว้เฉพาะ ID ล่าสุด (Snowflake เรียงตามเวลา)
        for old_id in sorted(_handled_message_ids)[:2500]:
            _handled_message_ids.discard(old_id)
    return True


async def handle_kira_message(message: discord.Message, recovered: bool = False):
    """ประมวลผลและตอบกลับข้อความที่ส่งถึงคิระ — ใช้ร่วมกันทั้งข้อความสดและข้อความที่ตามตอบย้อนหลัง"""
    if not _mark_handled(message.id):
        return
    BOT_RUNTIME["last_message_at"] = time.time()
    is_dm = isinstance(message.channel, discord.DMChannel)

    # ล้างข้อความ ดึงเฉพาะเนื้อหาคำถาม (รองรับ @mention ทั้งต้น/ท้ายข้อความ, Role Mention, และ prefix)
    clean_text = _strip_kira_mentions(message)

    late_prefix = "ขอโทษที่ตอบช้านะคะ เมื่อกี้สัญญาณสมองกลของหนูอาจติดขัดไปนิดนึง 😅\n\n" if recovered else ""

    # ดึงรูปภาพที่แนบมากับข้อความ (Discord Attachments)
    image_urls = []
    if message.attachments:
        for att in message.attachments:
            c_type = getattr(att, "content_type", "") or ""
            fname = getattr(att, "filename", "") or ""
            if c_type.startswith("image/") or any(fname.lower().endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]):
                if att.url:
                    image_urls.append(att.url)

    # หากผู้ใช้ Reply ข้อความที่มีรูปภาพ ให้ดึงรูปจากข้อความต้นทางมาวิเคราะห์ด้วย
    if not image_urls and message.reference and message.reference.message_id:
        try:
            ref_msg = await message.channel.fetch_message(message.reference.message_id)
            if ref_msg and ref_msg.attachments:
                for att in ref_msg.attachments:
                    c_type = getattr(att, "content_type", "") or ""
                    fname = getattr(att, "filename", "") or ""
                    if c_type.startswith("image/") or any(fname.lower().endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]):
                        if att.url:
                            image_urls.append(att.url)
        except Exception:
            pass

    # หากส่งรูปมาอย่างเดียวโดยไม่มีข้อความ ให้ตั้งโจทย์วิเคราะห์ภาพอัตโนมัติ
    if not clean_text and image_urls:
        clean_text = "ช่วยดูและวิเคราะห์รูปภาพนี้ให้หน่อยค่ะ ว่าคือภาพอะไร มีรายละเอียด ข้อความ หรือจุดสำคัญอะไรบ้าง"
    elif not clean_text:
        await message.reply(late_prefix + "มีประเด็นไหนให้คิระช่วยวิเคราะห์หรือสรุป บอกมาได้เลยค่ะ")
        BOT_RUNTIME["last_reply_at"] = time.time()
        BOT_RUNTIME["replies_sent"] += 1
        return

    try:
        # ตรวจสอบว่ามีการ Reply ข้อความก่อนหน้าหรือไม่ (เก็บได้สูงสุด 900 ตัวอักษรเพื่อไม่ให้เสียบริบทเชิงลึก)
        reply_context = ""
        if message.reference and message.reference.message_id:
            try:
                ref_msg = await message.channel.fetch_message(message.reference.message_id)
                if ref_msg and ref_msg.clean_content:
                    ref_author = ref_msg.author.display_name or ref_msg.author.name
                    reply_context = f"[กำลังตอบกลับข้อความของ {ref_author}: \"{ref_msg.clean_content[:900]}\"]\n"
            except Exception:
                pass

        author_display = message.author.display_name or message.author.name
        async with message.channel.typing():
            try:
                raw_reply_text = await asyncio.wait_for(
                    query_kira_engine(
                        clean_text,
                        author_display,
                        channel_id=message.channel.id,
                        reply_context=reply_context,
                        is_dm=is_dm,
                        image_urls=image_urls,
                        author_id=getattr(message.author, "id", 0),
                    ),
                    timeout=QUERY_TIMEOUT_SECONDS
                )
            except asyncio.TimeoutError:
                print(f"⏱️ [Kira Discord] ประมวลผลเกิน {QUERY_TIMEOUT_SECONDS} วินาที → ตอบกลับแบบสำรองทันที")
                BOT_RUNTIME["last_error"] = f"query timeout ({QUERY_TIMEOUT_SECONDS}s)"
                raw_reply_text = (
                    "ตอนนี้สมองหนูประมวลผลช้ากว่าปกตินิดนึงค่ะ 😵‍💫 "
                    "ไม่ได้เมินใครแน่นอน รบกวนพิมพ์ถามซ้ำอีกรอบได้เลยนะคะ"
                )

            reply_text = clean_discord_reply(raw_reply_text, clean_text)
            if is_refusal_text(reply_text):
                reply_text = get_in_character_social_fallback(clean_text)
            reply_text = late_prefix + reply_text

            # บันทึกความจำบทสนทนาในช่อง + ผู้ใช้ล่าสุดที่คิระคุยด้วย
            add_channel_history(message.channel.id, "user", author_display, clean_text)
            add_channel_history(message.channel.id, "assistant", "Kira", reply_text)
            _record_kira_reply_to_author(message.channel.id, getattr(message.author, "id", 0))

            # ตัดข้อความถ้าเกิน 2000 ตัวอักษร
            chunks = chunk_discord_message(reply_text)
            for i, chunk in enumerate(chunks):
                if i == 0:
                    await message.reply(chunk)
                else:
                    await message.channel.send(chunk)
            BOT_RUNTIME["last_reply_at"] = time.time()
            BOT_RUNTIME["replies_sent"] += 1
    except Exception as e:
        import traceback
        traceback.print_exc()
        BOT_RUNTIME["last_error"] = f"{type(e).__name__}: {str(e)[:150]}"
        try:
            await message.reply("ขออภัยนะคะ สัญญาณประมวลผลของคิระสะดุดเล็กน้อย รบกวนลองส่งใหม่อีกครั้งได้เลยนะคะ")
        except Exception:
            pass


async def recover_missed_mentions():
    """ตามตอบข้อความที่เรียกหาคิระในช่วงที่บอทออฟไลน์ (เซิร์ฟเวอร์รีสตาร์ต/Deploy/หลับ/Gateway หลุด)
    Discord ไม่ส่งข้อความย้อนหลังให้บอทที่ต่อเข้ามาใหม่ จึงต้องไล่อ่านประวัติทั้งห้องแชตและ Thread เอง"""
    if _recovery_lock.locked() or bot.is_closed() or not bot.user:
        return
    async with _recovery_lock:
        from datetime import timedelta
        BOT_RUNTIME["recovery_runs"] += 1
        BOT_RUNTIME["last_recovery_at"] = time.time()
        now = discord.utils.utcnow()
        cutoff = now - timedelta(seconds=MISSED_MENTION_WINDOW_SECONDS)
        total = 0
        for guild in list(bot.guilds):
            me = guild.me
            if me is None and bot.user:
                try:
                    me = await guild.fetch_member(bot.user.id)
                except Exception:
                    me = None
            if me is None:
                continue

            # รวมทั้งช่องข้อความปกติและ Active Threads แบบไม่ซ้ำ
            seen_ids = set()
            channels = []
            for ch in list(getattr(guild, "text_channels", []) or []) + list(getattr(guild, "threads", []) or []):
                cid = getattr(ch, "id", None)
                if cid in seen_ids:
                    continue
                seen_ids.add(cid)
                channels.append(ch)

            for channel in channels:
                try:
                    # คัดกรองแบบไม่ต้องยิง API: ข้ามช่องที่ไม่มีข้อความใหม่ในช่วงเวลาที่กำหนด
                    if channel.last_message_id:
                        if discord.utils.snowflake_time(channel.last_message_id) < cutoff:
                            continue
                    elif not _is_kira_channel(channel):
                        continue

                    perms = channel.permissions_for(me)
                    can_send = getattr(perms, "send_messages_in_threads", False) if isinstance(channel, discord.Thread) else perms.send_messages
                    if not (perms.read_messages and perms.read_message_history and can_send):
                        continue

                    # ดึง 80 ข้อความล่าสุดก่อน แล้วเรียงเก่า->ใหม่ เพื่อไม่พลาดข้อความใหม่สุดในห้องที่คุยถี่
                    history = [m async for m in channel.history(limit=80, after=cutoff, oldest_first=False)]
                    history.reverse()

                    # ข้อความที่คิระตอบไปแล้ว (ดูทั้งจาก reference และข้อความที่คิระส่งต่อท้ายโดยตรง)
                    answered_ids = {
                        m.reference.message_id for m in history
                        if bot.user and m.author.id == bot.user.id and m.reference and m.reference.message_id
                    }
                    for idx, m in enumerate(history[:-1]):
                        nxt = history[idx + 1]
                        if bot.user and nxt.author.id == bot.user.id and nxt.reference is None:
                            answered_ids.add(m.id)

                    pending = []
                    for m in history:
                        if getattr(m.author, "bot", False) or (bot.user and m.author.id == bot.user.id):
                            continue
                        if m.id in answered_ids or m.id in _handled_message_ids:
                            continue
                        if not _is_addressed_to_kira(m):
                            continue
                        # ตามตอบเฉพาะข้อความที่แท็ก/ตอบกลับ/เรียกหาคิระชัดเจน (ใช้ logic เดียวกับ _is_direct_vocative_call กันแทรก)
                        content_raw = m.content or ""
                        content_lower = content_raw.lower()
                        is_direct_ping = (
                            (bot.user and bot.user in (getattr(m, "mentions", None) or []))
                            or _is_bot_role_mentioned(m)
                            or _is_reply_to_bot(m)
                            or content_lower.startswith(("!kira", "/kira", "!คิระ", "/คิระ"))
                            or _is_direct_vocative_call(content_raw)
                        )
                        if is_direct_ping:
                            pending.append(m)

                    for m in pending[-MAX_RECOVERIES_PER_CHANNEL:]:
                        print(f"📬 [Kira Discord] ตามตอบข้อความที่พลาดไป #{getattr(channel, 'name', 'thread')}: {m.content[:60]}")
                        await handle_kira_message(m, recovered=True)
                        total += 1
                        BOT_RUNTIME["recovered_mentions"] += 1
                except discord.Forbidden:
                    continue
                except Exception as e:
                    print(f"⚠️ [Kira Discord] ตามตอบย้อนหลังใน #{getattr(channel, 'name', '?')} ล้มเหลว: {e}")
        if total:
            print(f"✅ [Kira Discord] ตามตอบข้อความที่พลาดไปแล้ว {total} ข้อความ")


def get_bot_status() -> dict:
    """สรุปสถานะบอทสำหรับ /api/health (ไม่มีข้อมูลลับ)"""
    def _ago(ts):
        return None if ts is None else round(time.time() - ts, 1)
    try:
        ready = bot.is_ready() and not bot.is_closed()
        latency = bot.latency
        latency_ms = round(latency * 1000) if latency == latency and latency != float("inf") else None
    except Exception:
        ready, latency_ms = False, None

    if ready:
        gateway_state = "online"
    elif BOT_RUNTIME.get("supervisor_alive"):
        gateway_state = "reconnecting"
    else:
        gateway_state = "offline"

    return {
        "online": ready,
        "gateway_state": gateway_state,
        "supervisor_alive": bool(BOT_RUNTIME.get("supervisor_alive", False)),
        "latency_ms": latency_ms,
        "guilds": len(bot.guilds) if ready else 0,
        "ready_seconds_ago": _ago(BOT_RUNTIME.get("ready_at")),
        "last_message_seconds_ago": _ago(BOT_RUNTIME.get("last_message_at")),
        "last_reply_seconds_ago": _ago(BOT_RUNTIME.get("last_reply_at")),
        "last_recovery_seconds_ago": _ago(BOT_RUNTIME.get("last_recovery_at")),
        "replies_sent": BOT_RUNTIME.get("replies_sent", 0),
        "recovered_mentions": BOT_RUNTIME.get("recovered_mentions", 0),
        "recovery_runs": BOT_RUNTIME.get("recovery_runs", 0),
        "reconnects": BOT_RUNTIME.get("reconnects", 0),
        "resumes": BOT_RUNTIME.get("resumes", 0),
        "last_error": BOT_RUNTIME.get("last_error"),
    }


def _register_bot_handlers(client: commands.Bot):
    """ผูก Event Handlers ให้กับ Client Instance (รองรับการสร้าง instance ใหม่เมื่อ Supervisor รีสตาร์ต)"""

    @client.event
    async def on_ready():
        BOT_RUNTIME["ready_at"] = time.time()
        BOT_RUNTIME["last_error"] = None
        print("=" * 60)
        print("🌸 [KIRA AI DISCORD BOT IS ONLINE!]")
        if client.user:
            print(f"🤖 เข้าสู่ระบบสำเร็จในชื่อ: {client.user.name}#{client.user.discriminator} (ID: {client.user.id})")
        print(f"🌐 ประจำการอยู่ในเซิร์ฟเวอร์: {len(client.guilds)} เซิร์ฟเวอร์")
        print("=" * 60)

        # ตั้งสถานะ Activity ใน Discord
        bot_name = client.user.name if client.user else "Kira"
        activity = discord.Activity(
            type=discord.ActivityType.watching,
            name=f"ดูแลเพื่อนๆ ของบอส 💜 | @{bot_name}"
        )
        try:
            await client.change_presence(status=discord.Status.online, activity=activity)
        except Exception as e:
            print("⚠️ [Kira Discord] ตั้งสถานะไม่สำเร็จ:", e)

        # ตามตอบข้อความที่พลาดไปตอนออฟไลน์ (ทำงานเบื้องหลัง ไม่บล็อกการรับข้อความใหม่)
        asyncio.create_task(recover_missed_mentions())

    @client.event
    async def on_resumed():
        BOT_RUNTIME["ready_at"] = time.time()
        BOT_RUNTIME["resumes"] += 1
        print(f"🔄 [Kira Discord] Gateway Session Resumed (ครั้งที่ {BOT_RUNTIME['resumes']})")
        asyncio.create_task(recover_missed_mentions())

    @client.event
    async def on_disconnect():
        BOT_RUNTIME["last_disconnect_at"] = time.time()
        print("⚠️ [Kira Discord] Gateway Disconnected — รอ Auto-Resume หรือ Supervisor ฟื้นฟูการเชื่อมต่อ...")

    @client.event
    async def on_message(message: discord.Message):
        # ไม่ตอบข้อความตัวเอง หรือข้อความจากบอทตัวอื่น
        if (client.user and message.author == client.user) or message.author.bot:
            return

        # ถ้าไม่ใช่ข้อความที่เรียกหาคิระ ให้เก็บเป็นบริบทห้องเงียบๆ เพื่อแยกแยะบทสนทนาของคนในกลุ่มและใช้อ้างอิงเมื่อถูกแท็กเรียก
        if not _is_addressed_to_kira(message):
            if not isinstance(message.channel, discord.DMChannel):
                obs_text = getattr(message, "clean_content", None) or getattr(message, "content", "") or ""
                author_disp = getattr(message.author, "display_name", None) or getattr(message.author, "name", "Member")
                record_room_observation(
                    getattr(message.channel, "id", 0),
                    getattr(message.author, "id", 0),
                    author_disp,
                    obs_text,
                )
            await client.process_commands(message)
            return

        await handle_kira_message(message)


_register_bot_handlers(bot)


async def reset_bot_instance() -> commands.Bot:
    """ปิด Bot Instance เดิมอย่างปลอดภัย แล้วสร้าง Instance ใหม่ที่สะอาดพร้อมต่อ Gateway"""
    global bot
    old_bot = bot
    if old_bot and not old_bot.is_closed():
        try:
            await old_bot.close()
        except Exception as e:
            print(f"⚠️ [Kira Discord] ปิด Client เก่ามีคำเตือน: {e}")
    bot = create_kira_bot()
    return bot


if __name__ == "__main__":
    if not DISCORD_BOT_TOKEN or DISCORD_BOT_TOKEN == "YOUR_DISCORD_BOT_TOKEN_HERE":
        print("\n⚠️ ยังไม่พบ DISCORD_BOT_TOKEN!")
        print("กรุณาใส่ Token ในไฟล์ .env ดังนี้: DISCORD_BOT_TOKEN=your_token_here")
        token_input = input("หรือพิมพ์/วางรหัส Discord Bot Token ที่นี่เลยค่ะ: ").strip()
        if token_input:
            DISCORD_BOT_TOKEN = token_input
            # บันทึกลง .env อัตโนมัติ
            with open(".env", "a", encoding="utf-8") as f:
                f.write(f"\nDISCORD_BOT_TOKEN={token_input}\n")
            print("✅ บันทึก DISCORD_BOT_TOKEN ลงใน .env เรียบร้อยแล้วค่ะ!\n")
        else:
            print("❌ ไม่ได้กรุณากรอก Token ปิดการทำงานค่ะ")
            sys.exit(1)

    print("🚀 กำลังเชื่อมต่อ Kira เข้าสู่ Discord Gateway...")
    bot.run(DISCORD_BOT_TOKEN)

