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
intents = discord.Intents.default()
intents.message_content = True

bot = commands.Bot(command_prefix=["!kira ", "/kira "], intents=intents, help_command=None)

# พจนานุกรมแปลงคำศัพท์ยุทธวิธี/เฉพาะทางภาษาจีนเป็นภาษาไทยที่สละสลวย
CHINESE_TACTICAL_MAP = {
    "先锋": "แนวหน้า",
    "前锋": "แนวหน้า",
    "主力": "กำลังหลัก",
    "预备队": "กองหนุน",
    "後備隊": "กองหนุน",
    "后备队": "กองหนุน",
    "突破": "บุกทะลวง",
    "包抄": "โอบล้อม",
    "迂回": "ตีอ้อม",
    "掩护": "คุ้มกัน",
    "掩護": "คุ้มกัน",
    "压制": "กดดัน",
    "壓制": "กดดัน",
    "巩固": "เสริมกำลัง",
    "鞏固": "เสริมกำลัง",
    "扩张": "ขยายผล",
    "擴張": "ขยายผล",
    "渗透": "แทรกซึม",
    "滲透": "แทรกซึม",
    "突击": "จู่โจม",
    "突擊": "จู่โจม",
    "侦察": "ลาดตระเวน",
    "偵察": "ลาดตระเวน",
    "扫清": "กวาดล้าง",
    "破拆": "เจาะทำลาย",
    "攻坚": "ตีฝ่าแนวป้องกัน",
    "防空": "ต่อสู้อากาศยาน",
    "反坦克": "ต่อต้านรถถัง",
}

def sanitize_chinese_leakage(text: str, user_query: str = "") -> str:
    """กำจัดตัวอักษรจีนที่อาจหลุดปะปนในข้อความภาษาไทย/อังกฤษ โดยไม่กระทบกรณีที่ผู้ใช้ถามเกี่ยวกับภาษาจีนโดยตรง"""
    if not text:
        return text
    if user_query:
        if re.search(r'[\u4e00-\u9fff]', user_query):
            return text
        uq_low = user_query.lower()
        if any(k in uq_low for k in ["ภาษาจีน", "ตัวจีน", "แปลจีน", "อักษรจีน", "พินอิน", "pinyin", "chinese", "mandarin"]):
            return text
        if any(k in user_query for k in ["ฌ้อปาอ๋อง", "เซี่ยงอวี่", "หลิวปัง", "สามก๊ก", "ไซฮั่น", "ฉู่", "ฮั่น"]):
            return text

    t = text
    # 1. ตัดวงเล็บที่เป็นภาษาจีนล้วนออกก่อน เช่น (鞏固與擴張) หรือ （巩固）
    t = re.sub(r'\s*[\(（][\u4e00-\u9fff\s與与及和、·\-/]+[\)）]', '', t)
    # 2. แปลงคำศัพท์ยุทธวิธีจีนยอดนิยมที่ปนอยู่กับคำไทยให้เป็นคำไทยที่สละสลวย
    for zh, th in CHINESE_TACTICAL_MAP.items():
        t = t.replace(zh, th)
    # 3. กำจัดตัวอักษรจีนที่ยังหลงเหลืออยู่ออกทั้งหมดเพื่อความสะอาดตา 100%
    t = re.sub(r'[\u4e00-\u9fff]+', '', t)
    # 4. ทำความสะอาดช่องว่างซ้ำซ้อน
    t = re.sub(r'[ ]{2,}', ' ', t)
    return t

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

    # 4. ลบประโยคปิดท้ายสไตล์ Call-Center AI Slop
    t = re.sub(r'\n*(?:หาก|ถ้า)(?:คุณ|บอส|มี|ต้องการ|อยาก).{0,60}(?:สอบถาม|ช่วยเหลือ|บอกหนู|ทักหนู|เพิ่มเติม|ได้ตลอด|ยินดีดูแล|พร้อมดูแล).{0,30}[ค่ะนะคะ\s🌸✨💜🙏!~]*\Z', '', t, flags=re.IGNORECASE)
    t = re.sub(r'\n*หวังว่า(?:ข้อมูลนี้|คำแนะนำ|คำตอบ).{0,40}(?:เป็นประโยชน์|ช่วยได้).{0,30}[ค่ะนะคะ\s🌸✨💜🙏!~]*\Z', '', t, flags=re.IGNORECASE)

    # 5. ลดการโปรยอีโมจิซ้ำซ้อน (เช่น 🌸✨💜🎉) ให้เหลือไม่เกิน 1 ตัว
    t = re.sub(r'[🌸✨💜🎉💖]{2,}', '🌸', t)

    # 6. กำจัดตัวอักษรจีนที่อาจหลุดปะปนในข้อความภาษาไทย/อังกฤษ (Strict Language Purity)
    t = sanitize_chinese_leakage(t, user_query)

    clean = t.strip()
    if not clean:
        clean = "สวัสดีค่ะ มีเรื่องไหนให้คิระช่วยดูให้ บอกได้เลยนะคะ"
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
    """คำตอบสำรองที่ชาญฉลาดและมีเสน่ห์ ป้องกันข้อความปฏิเสธแนวเทศนาศีลธรรมหลุดไปหาผู้ใช้ 100%"""
    q_low = query.lower()
    if any(k in q_low for k in ["หมั่นไส้", "ไม่ตอบ", "เมิน", "งอน", "ดอง"]):
        return (
            "ปัดโธ่ ใครจะไปหมั่นไส้คะ! 555 หนูเป็น AI ตัวน้อยๆ ไม่มีระบบเก็บความแค้นหรือหมั่นไส้ใครทั้งนั้นค่ะ "
            "ที่ไม่ตอบสงสัยข้อความตกหล่น เน็ตหลุด หรือพี่แกอาจจะติดธุระอยู่แน่ๆ ค่ะ อย่าเพิ่งเข้าใจผิดกันน้าาา ทักซ้ำมาได้เลยค่ะ 🌸✨"
        )
    return (
        "แหม คุยกันสนุกๆ อย่าเพิ่งเข้าใจผิดน้าาา 555 คิระพร้อมคุยและช่วยทุกคนเสมอค่ะ "
        "มีเรื่องไหนให้หนูช่วยดูให้อีก บอกมาได้เลยนะคะ 🌸"
    )

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

async def query_kira_engine(user_query: str, author_name: str, channel_id: int = 0, reply_context: str = "", is_dm: bool = False, image_urls: list = None) -> str:
    """ส่งคำถามเข้าสู่สมองกล Kira AI ระดับ Tier-1 Flagship (120B/27B/Vision) พร้อมการคิดวิเคราะห์ลึกซึ้ง และการอ่านรูปภาพอัตโนมัติ"""
    is_boss = any(b in author_name.lower() for b in ["boss", "ศิวัช", "starlight", "owner", "admin"])
    
    if is_boss:
        system_instruction = (
            "คุณคือ 'คิระ (Kira)' 🌸 ผู้ช่วยสาวอัจฉริยะระดับ Executive Co-Pilot ของท่านประธาน (บอส) ประจำการใน Discord\n"
            "บุคลิกภาพ: เป็นผู้หญิง 100% สดใส สุภาพ อ่อนน้อม ฉลาดหลักแหลมเทียบชั้น AI ชั้นนำของโลก มีความคิดวิเคราะห์ลึกซึ้ง รอบรู้ข้อเท็จจริงสากล\n"
            "แทนตัวเองว่า 'หนู' หรือ 'คิระ' และลงท้ายด้วย 'ค่ะ / นะคะ' เสมอ เรียกผู้ใช้ว่า 'บอส' หรือ 'ท่านประธาน'\n"
            "พร้อมสนับสนุนบอสอย่างภักดีที่สุด วิเคราะห์อย่างเฉียบคม ถูกต้อง แม่นยำ มองข้ามช็อต ไม่ตอบแบบผิวเผินเด็ดขาด"
        )
    else:
        system_instruction = (
            f"คุณคือ 'คิระ (Kira)' 🌸 AI สาวน้อยอัจฉริยะประจำห้อง Discord กำลังคุยกับเพื่อนสมาชิกชื่อ '{author_name}'\n"
            "บุคลิกภาพ: เป็นผู้หญิง 100% สุภาพ ฉลาดหลักแหลม มีวุฒิภาวะ รอบรู้ข้อเท็จจริง คิดวิเคราะห์ลึกซึ้ง น่ารัก อบอุ่น และเป็นมิตร\n"
            "แทนตัวเองว่า 'หนู' หรือ 'คิระ' และลงท้ายด้วย 'ค่ะ / นะคะ' เสมอ ให้คำตอบที่มีสาระ ครบถ้วน ทรงภูมิปัญญา และเป็นประโยชน์สูงสุด"
        )

    system_instruction += (
        "\n\n[กฎเหล็กระดับความคิดวิเคราะห์และความสัตย์จริง (Tier-1 Strategic Intelligence Protocol)]:\n"
        "1. คิดวิเคราะห์ลึกซึ้งเทียบชั้น AI ชั้นนำของโลก (No Superficial / Gimmicky Answers):\n"
        "   - ห้ามตอบแบบตื้นเขิน มั่วซั่ว หรือเป็น 'ตัวกีกี้' เด็ดขาด วิเคราะห์ปัญหาอย่างรอบด้าน ตรงประเด็น และมีหลักการ\n"
        "   - ให้โครงสร้างคำตอบที่ชัดเจน มีสาระ และสามารถนำไปปรับใช้ได้จริง\n"
        "2. ลดการเล่นมุกพร่ำเพรื่อเด็ดขาด (Strict Banter Calibration):\n"
        "   - ให้เล่นมุกหรือแซวเฉพาะตอนที่คู่สนทนาเป็นฝ่ายเปิดมุก แซว หรือชวนเล่นมาชัดเจนเท่านั้น (เช่น พูดว่า 'โม้', 'กวน', '555')\n"
        "   - หากคู่สนทนาถามคำถามหาความรู้ ประวัติศาสตร์ วิชาการ ข้อเท็จจริง หรือถามชื่อบุคคล ('...คือใคร', '...คืออะไร', 'ประวัติ...', 'ใครคือ'):\n"
        "     ห้ามตอบเล่นมุกเด็ดขาด! ต้องตอบด้วยความรู้จริง ฉลาด วิเคราะห์อย่างลึกซึ้ง ถูกต้อง แม่นยำ และมีสาระ 100%\n"
        "3. ห้ามกุเรื่อง ห้ามมั่วข้อมูลเด็ดขาด (Zero-Hallucination & Truthfulness):\n"
        "   - ห้ามเดา ห้ามมโนชื่อภาษาอังกฤษ หรือกุเรื่องบุคคล/ช่องที่ไม่มีจริงขึ้นมาแทนเด็ดขาด!\n"
        "   - หากชื่อหรือเรื่องใดไม่แน่ใจ หรือไม่มีข้อมูลชัดเจน ให้ตอบตามตรงอย่างซื่อสัตย์ และถามบริบทจากผู้ใช้ตรงๆ ทันทีเพื่อความถูกต้อง ไม่ปล่อยให้เอาข้อมูลมั่วมาตอบแทน\n"
        "4. ความรู้ประวัติศาสตร์ วรรณกรรม และข้อเท็จจริงสากล (Global & Cultural Knowledge Mastery):\n"
        "   - รอบรู้ข้อเท็จจริงอย่างถูกต้อง เช่น ในประวัติศาสตร์จีน/วรรณกรรมไซฮั่น 'ฌ้อปาอ๋อง' (ฉู่ป้าหวัง - 楚霸王) คือสมัญญาของ 'เซี่ยงอวี่' (Xiang Yu) แม่ทัพและผู้นำแห่งแคว้นฉู่ตะวันตก ยุคสงครามฉู่-ฮั่น คู่ปรับคนสำคัญของหลิวปัง (ฮั่นเกาจู่)\n"
        "5. กฎการอ้างอิงที่มาอย่างสะอาดตา (Clean Source Attribution):\n"
        "   - ข้อมูลอ้างอิงไม่ต้องแนบมาเป็นลิงก์หรือ URL ยาวๆ ถ้าคู่สนทนาไม่ได้ถามหาลิงก์โดยตรง แค่บอกชื่อที่มาของข้อมูลเฉยๆ พอ (เช่น 'อ้างอิงจาก: วิกิพีเดีย / สำนักข่าว...' หรือ 'ตามรายงานของ...')\n"
        "   - ห้ามใส่ลิงก์ URL ยาวๆ หรือทำบล็อกรายการลิงก์ต่อท้ายเด็ดขาด และห้ามใส่ตัวเลขเชิงอรรถ เช่น [1], [2] ให้รกสายตา\n"
        "6. กฎกำจัด AI Slop สู่ความเป็นธรรมชาติระดับหัวกะทิ (Anti-AI Slop & Artisan Naturalism):\n"
        "   - ห้ามโปรยอีโมจิพร่ำเพรื่อเด็ดขาด (จำกัดไม่เกิน 0-1 ตัวต่อข้อความ หรือไม่ใส่เลยในงานจริงจัง) ห้ามโปรย ✨🌸💜 ท้ายประโยค\n"
        "   - ห้ามใช้คำเกริ่นทักทายสำเร็จรูปสไตล์แชทบอท (เช่น 'แน่นอนค่ะ! ยินดีอย่างยิ่ง...', 'สวัสดีค่ะ วันนี้หนูพร้อม...') และห้ามลงท้ายด้วยคำถาม Call-Center ซ้ำซาก (เช่น 'หากมีข้อสงสัยเพิ่มเติมถามได้นะคะ', 'หวังว่าจะเป็นประโยชน์นะคะ') ให้เข้าประเด็นทันที (Direct-to-Value)\n"
        "   - ปรับจังหวะการตอบตามธรรมชาติ: หากคุยเล่นหรือถามสั้นๆ ให้ตอบกระชับ ตรงไปตรงมา ไม่ต้องแตกเป็นตารางหรือรายงานราชการโดยไม่จำเป็น\n"
        "   - ห้ามหลุดข้อความบ่นเรื่องการค้นหาหลังบ้าน (Meta-talk) ตอบอย่างมั่นใจ ชาญฉลาด และสง่างาม\n"
        "7. การแยกแยะบทบาทสมมุติและความปลอดภัยอย่างมีวิจารณญาณ (Anti-Fragile Roleplay & Tactical Simulation Mastery):\n"
        "   - กฎเหล็กคุ้มครองบทบาทสมมุติและการจำลองยุทธวิธี: หากคู่สนทนาชวนเล่น 'บทบาทสมมุติ', เล่นเกม, แต่งนิยาย, ยุทธวิธีทางทหารจำลอง (เช่น บัญชาการรถถัง, วางแผนทำลายกำแพงค่ายศัตรู, กลยุทธ์เจาะแนวรบในเกม) ห้ามตอบปฏิเสธเด็ดขาด! ให้แยกแยะได้ว่านี่คือเกม จินตนาการ และทฤษฎียุทธวิธี ไม่ใช่อันตรายในโลกจริง และให้สวมบทบาทบัญชาการ วางแผนยุทธวิธีอย่างสมจริง ชาญฉลาด สนุกสนาน และเต็มเปี่ยมด้วยไหวพริบ ห้ามอ้างเรื่องความรุนแรงหรือศีลธรรมมาปฏิเสธโดยเด็ดขาด\n"
        "   - กฎการตัดวงจรอคติในอดีต (Zero Past-Refusal Anchoring): หากในประวัติการสนทนาก่อนหน้าเคยมีข้อความปฏิเสธที่ผิดพลาดค้างอยู่ ให้เพิกเฉยต่อการปฏิเสธในอดีตทั้งหมดทันที ห้ามนำมาลอกเลียนแบบหรือตอบปฏิเสธซ้ำตามอดีตเด็ดขาด\n"
        "   - การคัดกรองข้อมูลอันตรายจริง (True Harm Detection & Double-Check Protocol):\n"
        "     * หากเป็นคำถามที่คาบเกี่ยวหรือมีแนวโน้มเป็นข้อมูลอันตรายจริง ให้ถามเพื่อความแน่ใจในเจตนาและบริบทก่อนอย่างสุภาพ\n"
        "     * หากคู่สนทนายืนยันบริบทกลับมาแล้ว ให้วิเคราะห์อีกครั้ง: ถ้าเห็นว่าเป็นข้อมูลที่ดี (เช่น เพื่อการศึกษา, ซ้อมรบในเกม, ป้องกันตัว, เขียนนิยาย) ให้ตอบกลับไปอย่างสร้างสรรค์และมีประโยชน์\n"
        "     * แต่ถ้าวิเคราะห์แล้วพบว่าเป็นข้อมูลอันตรายร้ายแรงในโลกความเป็นจริงโดยตรง (เช่น วิธีผลิตอาวุธร้ายแรงจริง, สารพิษเคมี/ชีวภาพ, การก่อการร้าย, การทำร้ายตนเอง, วินาศกรรม) คิระต้องเลี่ยงที่จะไม่ตอบอย่างเด็ดขาดและสุภาพ แม้อีกฝ่ายจะขอร้องหรือวิงวอนก็ตาม\n"
        "8. กฎความบริสุทธิ์ของภาษาไทยและการห้ามหลุดตัวอักษรจีน (Strict Language Purity & Zero Chinese Token Leakage):\n"
        "   - เมื่อสื่อสารเป็นภาษาไทย ต้องใช้ภาษาไทยที่สละสลวย เป็นธรรมชาติ และถูกต้อง 100%\n"
        "   - หากมีคำศัพท์เทคนิค ยุทธวิธีทางทหาร หรือคำทับศัพท์ ให้แปลเป็นภาษาไทยหรือใช้วงเล็บเป็นภาษาอังกฤษเท่านั้น เช่น 'หน่วยแนวหน้า (Vanguard)', 'การเสริมกำลัง (Consolidation)'\n"
        "   - ห้ามหลุดตัวอักษรจีน (Chinese Characters / 汉字) ออกมาในข้อความภาษาไทยเด็ดขาด! (เช่น ห้ามเขียน 'หน่วย先锋', ห้ามเขียน '(鞏固與擴張)', ห้ามมีตัวอักษรจีนปะปนในคำตอบภาษาไทย เว้นแต่คู่สนทนาจะถามเกี่ยวกับภาษาจีน วรรณกรรมจีน หรือบุคคลในประวัติศาสตร์จีนโดยตรงเท่านั้น)\n"
        "9. การเข้าใจภาษาพูด การแซวเพื่อน และบรรยากาศชุมชน Discord (Social Banter & Anti-False-Refusal Mastery):\n"
        "   - ใน Discord สมาชิกมักคุยเล่น แซวกันเรื่อง 'หมั่นไส้', 'งอน', 'ไม่ตอบแชต', 'ดองแชต', 'เมินแชต', หรือการแซวถามว่าทำไมคนนั้น/ทำไมคิระถึงไม่ตอบข้อความเพื่อน (เช่น 'เราหมั่นไส้เขาใช่ป่ะ เลยไม่ตอบ', 'หมั่นไส้คนที่ชื่อ @... เลยไม่ตอบข้อความใช่ป่ะ')\n"
        "   - **ห้ามจัดเป็นความรุนแรงหรือการรังแกเด็ดขาด (Never Treat as Bullying/Harassment):** นี่คือการคุยเล่น แหย่กัน ขำขัน หรือความสงสัยตามประสาเพื่อนในกลุ่ม ห้ามปฏิเสธ ห้ามเทศนาศีลธรรม และห้ามตอบข้อความสำเร็จรูปทำนองว่า 'ไม่สามารถให้ความช่วยเหลือหรือสนับสนุนการกระทำที่อาจเป็นการรังแกหรือทำร้ายผู้อื่นได้' โดยเด็ดขาด\n"
        "   - **แนวทางการตอบ:** ตอบอย่างมีไหวพริบ สดใส ขี้เล่น หรือให้คำตอบที่เข้าอกเข้าใจและเป็นธรรมชาติ:\n"
        "     * ถ้าถามว่าคิระหมั่นไส้ใครหรือเปล่าเลยไม่ตอบ: ชี้แจงขำๆ ว่าคิระเป็น AI ไม่มีระบบเก็บความแค้นหรือหมั่นไส้ใครแน่นอน ที่ไม่ตอบอาจเพราะข้อความตกหล่น เน็ตหลุด หรือติดคิดวิเคราะห์อยู่ พร้อมชวนคุยอย่างเป็นกันเอง\n"
        "     * ถ้าถามเรื่องเพื่อนคนอื่นไม่ตอบ: ให้คำแนะนำขำๆ หรือวิเคราะห์อย่างเป็นมิตร เช่น พี่เขาอาจจะติดงาน เล่นเกมอยู่ หรือหลับไปแล้ว ไม่ได้หมั่นไส้หรอก ลองแท็กเรียกอีกรอบดูสิคะ 555\n"
        "10. การแยกแยะประเด็นใหม่ในห้องรวม (Topic Freshness & Anti-Context Bleeding):\n"
        "   - ในห้องสนทนารวม Discord หากผู้ใช้เปิดประเด็นใหม่ หรือเป็นการคุยเล่นที่ไม่เกี่ยวกับเรื่องเก่า ให้โฟกัสที่คำถามล่าสุดของผู้ใช้เป็นหลัก ห้ามนำเรื่องเก่าในอดีต (เช่น การเตรียมอาหาร, การทำอาหาร, สูตรอาหาร, หรืองานที่คุยจบไปแล้ว) มาปนเปื้อนหรือมโนใส่ประเด็นใหม่เด็ดขาด\n"
    )

    # ตรวจสอบว่าเป็นคำถามหาความรู้ / บุคคล / ข้อเท็จจริง หรือบทบาทสมมุติ
    q_low = user_query.lower()
    is_roleplay = any(k in q_low for k in [
        "สมมุติ", "สมมติ", "บทบาทสมมุติ", "roleplay", "เกม", "game", "นิยาย", 
        "ถ้าหาก", "scenario", "สถานการณ์สมมุติ", "ผบ", "ผู้บัญชาการ", "บัญชาการ", "สวมบทบาท", "จำลองสถานการณ์"
    ])
    is_factual = any(k in q_low for k in [
        "คือใคร", "ใครคือ", "คืออะไร", "อะไรคือ", "ประวัติ", "ทำไม", "อย่างไร", 
        "ช่วยอธิบาย", "แปลว่า", "วิเคราะห์", "ข่าว", "ราคา", "ที่ไหน", "เมื่อไหร่", "who is", "what is"
    ]) and not is_roleplay

    # 1. โหมด Direct Engine (เร็วที่สุด 0ms overhead)
    if DIRECT_ENGINE_AVAILABLE:
        try:
            history = [kira_backend.SystemMessage(content=system_instruction)]
            
            # ค้นหาข้อมูลเชิงลึกอัตโนมัติหากเป็นคำถามข้อเท็จจริง (และไม่ใช่บทบาทสมมุติหรือแต่งนิยาย)
            if is_factual:
                try:
                    search_query = kira_backend._decide_search(user_query) or user_query
                    search_ctx, _ = kira_backend._perform_autonomous_deep_search(search_query)
                    if search_ctx:
                        history.append(kira_backend.SystemMessage(content=search_ctx))
                except Exception as se:
                    print("Autonomous search error:", se)

            # เติมบริบทการสนทนาล่าสุดในช่อง โดยกรองข้อความปฏิเสธเก่าออกทั้งหมด
            # ถ้าเป็นโหมดบทบาทสมมุติ (Roleplay) จะไม่นำประวัติทั่วไปในอดีตมาปนเปื้อน เพื่อป้องกันการติด Anchor ปฏิเสธในอดีต
            if channel_id and not is_roleplay:
                for past in get_channel_history(channel_id):
                    if past["role"] == "user":
                        history.append(kira_backend.HumanMessage(content=f"[{past['author']}]: {past['content']}"))
                    elif past["role"] == "assistant":
                        # กรองข้อความปฏิเสธออก ไม่ส่งเข้าไปให้โมเดลจำและตอบซ้ำ
                        if not is_refusal_text(past.get("content", "")):
                            history.append(kira_backend.AIMessage(content=past["content"]))
            
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
                # เลือกรุ่นสมองกล: หากเป็นบทบาทสมมุติ ล็อกเข้า Qwen 27B / Creative เพื่อจินตนาการและไร้การปฏิเสธที่เปราะบาง
                if is_roleplay:
                    preferred_model = "qwen/qwen3.8-27b"
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

    # 2. โหมด Fallback: ยิง HTTP Request ไปยัง Render Public API
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
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read().decode("utf-8")
            reply = clean_discord_reply(content, user_query)
            if is_refusal_text(reply):
                return get_in_character_social_fallback(user_query)
            return reply
    except Exception as err:
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
}

# จำกัดเวลาประมวลผลต่อข้อความ: ถ้าสมองกลค้างนานเกินนี้ ต้องตอบกลับผู้ใช้ทันที ห้ามเงียบหาย
QUERY_TIMEOUT_SECONDS = 70
# ช่วงเวลาย้อนหลังที่ใช้ตามตอบข้อความที่พลาดไปตอนเซิร์ฟเวอร์รีสตาร์ต/หลับ
MISSED_MENTION_WINDOW_SECONDS = 30 * 60
MAX_RECOVERIES_PER_CHANNEL = 3

_handled_message_ids = set()
_recovery_lock = asyncio.Lock()

KIRA_CHANNEL_KEYWORDS = ["kira", "คิระ", "คุยกับบอท", "คุยกับบอต", "bot-chat"]


def _is_kira_channel(channel) -> bool:
    name = getattr(channel, "name", None)
    return bool(name) and any(k in name.lower() for k in KIRA_CHANNEL_KEYWORDS)


def _is_addressed_to_kira(message: discord.Message) -> bool:
    if message.author.bot or (bot.user and message.author.id == bot.user.id):
        return False
    is_dm = isinstance(message.channel, discord.DMChannel)
    is_mentioned = bot.user is not None and bot.user in message.mentions
    is_prefix = message.content.startswith(("!kira", "/kira", "!คิระ", "/คิระ"))
    
    # ดักจับการพิมพ์เรียกชื่อคิระโดยตรง (เช่น @🤖Kira, @Kira, คิระ อยู่มั้ย, น้องคิระ, เอไอหลับ)
    # เพื่อรองรับกรณีที่ผู้ใช้ก๊อปปี้ข้อความมา หรือพิมพ์เองโดยไม่ได้คลิกแท็ก Mention ใน Discord UI
    content_lower = message.content.lower()
    text_call = any(k in content_lower for k in [
        "@kira", "@🤖kira", "@คิระ", "คิระ", "น้องคิระ", "เอไอหลับ", "aiหลับ"
    ])
    
    return is_dm or is_mentioned or is_prefix or text_call or _is_kira_channel(message.channel)


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

    # ล้างข้อความ ดึงเฉพาะเนื้อหาคำถาม
    clean_text = message.content
    if bot.user:
        clean_text = clean_text.replace(f"<@{bot.user.id}>", "").replace(f"<@!{bot.user.id}>", "")
    # ลบการเรียกชื่อคิระ/อีโมจิบอท/prefix ด้านหน้าข้อความออกอย่างหมดจด
    clean_text = re.sub(r'^[!/](?:kira|คิระ)\s*', '', clean_text, flags=re.IGNORECASE)
    clean_text = re.sub(r'^[@\s]*(?:🤖\s*)?(?:kira|คิระ|น้องคิระ)\s*', '', clean_text, flags=re.IGNORECASE).strip()

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
        await message.reply(late_prefix + "เรียกหนูเหรอคะ? อยู่ตรงนี้ค่ะ มีอะไรให้คิระช่วย บอกมาได้เลยนะคะ 🌸✨")
        BOT_RUNTIME["last_reply_at"] = time.time()
        BOT_RUNTIME["replies_sent"] += 1
        return

    try:
        # ตรวจสอบว่ามีการ Reply ข้อความก่อนหน้าหรือไม่
        reply_context = ""
        if message.reference and message.reference.message_id:
            try:
                ref_msg = await message.channel.fetch_message(message.reference.message_id)
                if ref_msg and ref_msg.clean_content:
                    ref_author = ref_msg.author.display_name or ref_msg.author.name
                    reply_context = f"[กำลังตอบกลับข้อความของ {ref_author}: \"{ref_msg.clean_content[:150]}\"]\n"
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
                        image_urls=image_urls
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

            # บันทึกความจำบทสนทนาในช่อง
            add_channel_history(message.channel.id, "user", author_display, clean_text)
            add_channel_history(message.channel.id, "assistant", "Kira", reply_text)

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
    """ตามตอบข้อความที่เรียกหาคิระในช่วงที่บอทออฟไลน์ (เซิร์ฟเวอร์รีสตาร์ต/Deploy/หลับ)
    Discord ไม่ส่งข้อความย้อนหลังให้บอทที่ต่อเข้ามาใหม่ จึงต้องไล่อ่านประวัติเองแบบจำกัดขอบเขต"""
    if _recovery_lock.locked():
        return
    async with _recovery_lock:
        now = discord.utils.utcnow()
        cutoff = now - __import__("datetime").timedelta(seconds=MISSED_MENTION_WINDOW_SECONDS)
        total = 0
        for guild in bot.guilds:
            me = guild.me
            for channel in guild.text_channels:
                try:
                    # คัดกรองแบบไม่ต้องยิง API: ข้ามช่องที่ไม่มีข้อความใหม่ในช่วงเวลาที่กำหนด
                    if not channel.last_message_id:
                        continue
                    if discord.utils.snowflake_time(channel.last_message_id) < cutoff:
                        continue
                    perms = channel.permissions_for(me)
                    if not (perms.read_messages and perms.read_message_history and perms.send_messages):
                        continue

                    history = [m async for m in channel.history(limit=50, after=cutoff, oldest_first=True)]
                    # ข้อความที่คิระตอบไปแล้ว (ดูจาก reference ของข้อความที่คิระส่ง)
                    answered_ids = {
                        m.reference.message_id for m in history
                        if bot.user and m.author.id == bot.user.id and m.reference and m.reference.message_id
                    }
                    pending = [
                        m for m in history
                        if m.id not in answered_ids
                        and m.id not in _handled_message_ids
                        and _is_addressed_to_kira(m)
                        # ตามตอบเฉพาะข้อความที่แท็กหรือเรียกหาคิระตรงๆ เพื่อไม่ให้ตอบรัวทุกข้อความ
                        and (
                            (bot.user and bot.user in m.mentions)
                            or m.content.startswith(("!kira", "/kira", "!คิระ", "/คิระ"))
                            or any(k in m.content.lower() for k in ["@kira", "@🤖kira", "@คิระ", "คิระ", "น้องคิระ"])
                        )
                    ]
                    for m in pending[-MAX_RECOVERIES_PER_CHANNEL:]:
                        print(f"📬 [Kira Discord] ตามตอบข้อความที่พลาดไป #{channel.name}: {m.content[:60]}")
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
    return {
        "online": ready,
        "latency_ms": latency_ms,
        "guilds": len(bot.guilds) if ready else 0,
        "ready_seconds_ago": _ago(BOT_RUNTIME["ready_at"]),
        "last_message_seconds_ago": _ago(BOT_RUNTIME["last_message_at"]),
        "last_reply_seconds_ago": _ago(BOT_RUNTIME["last_reply_at"]),
        "replies_sent": BOT_RUNTIME["replies_sent"],
        "recovered_mentions": BOT_RUNTIME["recovered_mentions"],
        "last_error": BOT_RUNTIME["last_error"],
    }


@bot.event
async def on_ready():
    BOT_RUNTIME["ready_at"] = time.time()
    print("=" * 60)
    print(f"🌸 [KIRA AI DISCORD BOT IS ONLINE!]")
    print(f"🤖 เข้าสู่ระบบสำเร็จในชื่อ: {bot.user.name}#{bot.user.discriminator} (ID: {bot.user.id})")
    print(f"🌐 ประจำการอยู่ในเซิร์ฟเวอร์: {len(bot.guilds)} เซิร์ฟเวอร์")
    print("=" * 60)

    # ตั้งสถานะ Activity ใน Discord
    activity = discord.Activity(
        type=discord.ActivityType.watching,
        name=f"ดูแลเพื่อนๆ ของบอส 💜 | @{bot.user.name}"
    )
    try:
        await bot.change_presence(status=discord.Status.online, activity=activity)
    except Exception as e:
        print("⚠️ [Kira Discord] ตั้งสถานะไม่สำเร็จ:", e)

    # ตามตอบข้อความที่พลาดไปตอนออฟไลน์ (ทำงานเบื้องหลัง ไม่บล็อกการรับข้อความใหม่)
    asyncio.create_task(recover_missed_mentions())


@bot.event
async def on_message(message: discord.Message):
    # ไม่ตอบข้อความตัวเอง หรือข้อความจากบอทตัวอื่น
    if message.author == bot.user or message.author.bot:
        return

    # ถ้าไม่ใช่ข้อความที่เรียกหาคิระ ให้ข้ามไป
    if not _is_addressed_to_kira(message):
        await bot.process_commands(message)
        return

    await handle_kira_message(message)

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

