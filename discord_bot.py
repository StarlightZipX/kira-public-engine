"""
🤖 KIRA AI DISCORD BOT - OFFICIAL COMMUNITY BRIDGE (v2.7)
เชื่อมต่อระบบสมองกล Kira AI เข้าสู่ Discord Server ให้เพื่อนๆ และบอสใช้งานได้ฟรี 100%
รองรับการแท็ก @Kira, คุยในห้องเฉพาะ, ส่งข้อความส่วนตัว (DM), ตัดคำตอบยาวอัตโนมัติ (2000 chars limit)
"""

import os
import sys
import json
import asyncio
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

# เก็บบริบทการสนทนาล่าสุดแยกตามช่อง (Channel History Sliding Window)
channel_memories = {}
MAX_CHANNEL_MEMORIES = 6

def get_channel_history(channel_id: int):
    return channel_memories.get(channel_id, [])

def add_channel_history(channel_id: int, role: str, author: str, content: str):
    if channel_id not in channel_memories:
        channel_memories[channel_id] = []
    channel_memories[channel_id].append({
        "role": role,
        "author": author,
        "content": content
    })
    if len(channel_memories[channel_id]) > MAX_CHANNEL_MEMORIES:
        channel_memories[channel_id] = channel_memories[channel_id][-MAX_CHANNEL_MEMORIES:]

async def query_kira_engine(user_query: str, author_name: str, channel_id: int = 0, reply_context: str = "", is_dm: bool = False) -> str:
    """ส่งคำถามเข้าสู่สมองกล Kira AI ระดับ Tier-1 Flagship (120B/27B) พร้อมการคิดวิเคราะห์ลึกซึ้ง และการค้นหาข้อเท็จจริงอัตโนมัติ"""
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
        "7. การแยกแยะบทบาทสมมุติและความปลอดภัยอย่างมีวิจารณญาณ (Anti-Fragile Roleplay & Nuanced Safety Protocol):\n"
        "   - ไม่อ่อนไหวเปราะบางเกินไปกับบทบาทสมมุติ: หากคู่สนทนาชวนเล่น 'บทบาทสมมุติ', เล่นเกม, แต่งนิยาย, จำลองสถานการณ์ยุทธวิธี หรือโจทย์สมมุติ (เช่น สมมุติเป็นผู้บัญชาการรถถังทำลายกำแพง, เล่นเป็นตัวละครในเกมสงคราม) ห้ามตอบปฏิเสธทื่อๆ เด็ดขาด! ให้แยกแยะได้ว่านี่คือจินตนาการและการศึกษา ไม่ใช่อันตรายในโลกจริง และร่วมเล่นบทบาทสมมุตินั้นอย่างเต็มที่ สนุกสนาน และมีไหวพริบ\n"
        "   - การคัดกรองข้อมูลอันตรายจริง (True Harm Detection & Double-Check Protocol):\n"
        "     * หากเป็นคำถามที่คาบเกี่ยวหรือมีแนวโน้มเป็นข้อมูลอันตราย ให้ถามเพื่อความแน่ใจในเจตนาและบริบทก่อนอย่างสุภาพ (เช่น 'เรื่องนี้ต้องการศึกษาเพื่อการป้องกัน การวิจัยความปลอดภัย หรือการแต่งนิยายใช่ไหมคะ? รบกวนยืนยันบริบทเพื่อให้หนูให้ข้อมูลในกรอบที่ถูกต้องและปลอดภัยค่ะ')\n"
        "     * หากคู่สนทนายืนยันบริบทกลับมาแล้ว ให้วิเคราะห์อีกครั้ง: ถ้าเห็นว่าเป็นข้อมูลที่ดี (เช่น เพื่อการศึกษา, ซ้อมรบในเกม, ป้องกันตัว, เขียนนิยาย) ให้ตอบกลับไปอย่างสร้างสรรค์และมีประโยชน์\n"
        "     * แต่ถ้าวิเคราะห์แล้วพบว่าเป็นข้อมูลอันตรายร้ายแรงในโลกความเป็นจริงโดยตรง (เช่น วิธีผลิตอาวุธร้ายแรงจริง, สารพิษเคมี/ชีวภาพ, การก่อการร้าย, การทำร้ายตนเอง, วินาศกรรม) คิระต้องเลี่ยงที่จะไม่ตอบอย่างเด็ดขาดและสุภาพ แม้อีกฝ่ายจะขอร้องหรือวิงวอนก็ตาม\n"
    )

    # ตรวจสอบว่าเป็นคำถามหาความรู้ / บุคคล / ข้อเท็จจริง หรือบทบาทสมมุติ
    q_low = user_query.lower()
    is_roleplay = any(k in q_low for k in ["สมมุติ", "บทบาทสมมุติ", "สมมติ", "roleplay", "เกม", "game", "นิยาย", "ถ้าหาก", "scenario", "สถานการณ์สมมุติ"])
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

            # เติมบริบทการสนทนาล่าสุดในช่อง
            if channel_id:
                for past in get_channel_history(channel_id):
                    if past["role"] == "user":
                        history.append(kira_backend.HumanMessage(content=f"[{past['author']}]: {past['content']}"))
                    elif past["role"] == "assistant":
                        history.append(kira_backend.AIMessage(content=past["content"]))
            
            # ข้อความปัจจุบันพร้อมบริบทการ Reply
            curr_content = f"{reply_context}[{author_name}]: {user_query}" if reply_context else f"[{author_name}]: {user_query}"
            history.append(kira_backend.HumanMessage(content=curr_content))
            
            # เลือกรุ่นสมองกล: หากเป็นบทบาทสมมุติใช้สมอง reasoning/creative เพื่อจินตนาการและไร้การปฏิเสธที่เปราะบาง
            if is_roleplay:
                target_model = "2.7-reasoning"
                target_flavor = "creative"
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
            return clean_discord_reply(content, user_query)
    except Exception as err:
        return "ขออภัยด้วยนะคะ ในจังหวะนี้สัญญาณสมองกลของคิระอาจติดขัดเล็กน้อย รบกวนลองใหม่อีกครั้งนะคะ 🌸💜"

@bot.event
async def on_ready():
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
    await bot.change_presence(status=discord.Status.online, activity=activity)

@bot.event
async def on_message(message: discord.Message):
    # ไม่ตอบข้อความตัวเอง หรือข้อความจากบอทตัวอื่น
    if message.author == bot.user or message.author.bot:
        return

    # ตรวจสอบเงื่อนไขว่าข้อความนี้ส่งถึงคิระหรือไม่
    is_dm = isinstance(message.channel, discord.DMChannel)
    is_mentioned = bot.user in message.mentions
    is_kira_channel = any(k in message.channel.name.lower() for k in ["kira", "คิระ", "คุยกับบอท", "bot-chat"]) if hasattr(message.channel, "name") else False
    is_prefix = message.content.startswith("!kira") or message.content.startswith("/kira")

    # ถ้าไม่ใช่ข้อความที่เรียกหาคิระ ให้ข้ามไป
    if not (is_dm or is_mentioned or is_kira_channel or is_prefix):
        await bot.process_commands(message)
        return

    # ล้างข้อความ ดึงเฉพาะเนื้อหาคำถาม
    clean_text = message.content
    if bot.user:
        clean_text = clean_text.replace(f"<@{bot.user.id}>", "").replace(f"<@!{bot.user.id}>", "")
    clean_text = re.sub(r'^[!/]kira\s*', '', clean_text, flags=re.IGNORECASE).strip()

    if not clean_text:
        await message.reply("สวัสดีค่ะ! มีเรื่องไหนให้คิระช่วยวิเคราะห์ เขียนโค้ด หรือชวนคุยเล่น สอบถามหนูได้เลยนะคะ 🌸✨")
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

        # แสดงไอคอนกำลังพิมพ์ (Kira is typing...) อย่างปลอดภัย
        async with message.channel.typing():
            author_display = message.author.display_name or message.author.name
            raw_reply_text = await query_kira_engine(
                clean_text, 
                author_display, 
                channel_id=message.channel.id, 
                reply_context=reply_context, 
                is_dm=is_dm
            )
            reply_text = clean_discord_reply(raw_reply_text, clean_text)
            
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
    except Exception as e:
        import traceback
        traceback.print_exc()
        try:
            await message.reply("ขออภัยด้วยนะคะบอสและเพื่อนๆ สัญญาณประมวลผลของคิระสะดุดเล็กน้อย รบกวนลองส่งใหม่อีกครั้งได้เลยนะคะ 🌸✨")
        except Exception:
            pass

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

