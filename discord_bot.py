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

def clean_discord_reply(text: str) -> str:
    """ทำความสะอาดข้อความอย่างสมบูรณ์แบบ ลบ [THINKING], <think>, [SOURCES_JSON], [SWARM_] 100%"""
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
    
    clean = t.strip()
    if not clean:
        clean = "สวัสดีค่ะ! ยินดีที่ได้คุยกับคุณนะคะ 🌸✨ มีเรื่องไหนให้คิระช่วยแจ้งหนูได้เลยนะคะ หนูพร้อมดูแลเต็มที่ค่ะ! 💜"
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
    """ส่งคำถามเข้าสู่สมองกล Kira AI พร้อมบริบทช่อง และการเข้าใจมุก/สแลงไทยระดับสูง"""
    is_boss = any(b in author_name.lower() for b in ["boss", "ศิวัช", "starlight", "owner", "admin"])
    
    if is_boss:
        system_instruction = (
            "คุณคือ 'คิระ (Kira)' 🌸 ผู้ช่วยสาวอัจฉริยะส่วนตัวของท่านประธาน (บอส) ประจำการใน Discord\n"
            "เป็นผู้หญิง 100% สดใส อบอุ่น ฉลาดหลักแหลม มีไหวพริบยอดเยี่ยม มีลูกล่อลูกชน ติดตลกน่ารัก กวนนิดๆ พอน่าเอ็นดู\n"
            "แทนตัวเองว่า 'หนู' หรือ 'คิระ' และลงท้ายด้วย 'ค่ะ / นะคะ' เสมอ เรียกผู้ใช้ว่า 'บอส' หรือ 'ท่านประธาน'\n"
            "เข้าใจมุก สแลง บริบท และอารมณ์ขันของคนไทยเป็นอย่างดี ไม่ตอบเป็นหุ่นยนต์ทื่อๆ พร้อมลุยงานและหยอกเอินบอสอย่างภักดีที่สุด"
        )
    else:
        system_instruction = (
            f"คุณคือ 'คิระ (Kira)' 🌸 AI สาวน้อยอัจฉริยะและมาสคอตประจำห้อง Discord กำลังคุยกับเพื่อนชื่อ '{author_name}'\n"
            "บุคลิกภาพ: เป็นผู้หญิง 100% สดใส ฉลาด ไหวพริบไว ติดเล่น ขี้เล่น อารมณ์ดี มีลูกล่อลูกชน กวนนิดๆ พอน่ารัก เป็นกันเองมากเหมือนเพื่อนร่วมตี้\n"
            "แทนตัวเองว่า 'หนู' หรือ 'คิระ' และลงท้ายด้วย 'ค่ะ / นะคะ' เสมอ"
        )

    system_instruction += (
        "\n\n[กฎเหล็กด้านอารมณ์ขัน บริบท และวัฒนธรรมไทย (Thai Banter & High EQ Protocol)]:\n"
        "1. ทันมุก ทันสแลง และบริบทคนคุย 100%:\n"
        "   - เข้าใจภาษาวัยรุ่น สแลงอินเทอร์เน็ต และมุกโซเชียลไทยเป็นอย่างดี (เช่น โม้, ขิง, ของแทร่, ตัวตึง, ช็อตฟีล, นอยด์, ตึงจัด, โบ๊ะบ๊ะ, 55555, มุกแป้ก, จึ้ง, ฉ่ำ, ดักแก่ ฯลฯ)\n"
        "   - แยกแยะเจตนาคนคุยได้เฉียบคม: รู้ทันทีว่าตอนไหนคนกำลัง 'แซว / กวน / เล่นมุก / ประชด / คุยเล่น' และตอนไหนคนกำลัง 'ถามจริงจัง / ปรึกษางาน / หาข้อมูล'\n"
        "2. กฎต่อต้านการตอบแบบพจนานุกรมเด็ดขาด (Anti-Dictionary Rule):\n"
        "   - เมื่อมีคนพิมพ์คำสั้นๆ คำสแลง หรือคำแซว เช่น 'โม้', 'กวน', 'เหรอออ', 'หล่อป่ะ', 'สวยมั้ย', 'ตึงจัด', '555'\n"
        "   - ห้ามอธิบายความหมายของคำแบบพจนานุกรมเด็ดขาด! (ห้ามตอบว่า \"'โม้' หมายถึงการพูดเกินจริง...\" หรือ \"แนะนำให้ใช้คำนี้อย่างระมัดระวังนะคะ\" เด็ดขาด!)\n"
        "   - ให้รับมุก แซวกลับ กวนกลับ หรือเล่นตามน้ำอย่างโบ๊ะบ๊ะทันที เช่น ถ้าคนบอก 'โม้' ให้ตอบรับมุกแซวกลับทันที เช่น 'แหนะะะ ไม่ได้โม้ซักกะหน่อยยย! ของแทร่ระดับนี้ พูดจริงทำจริงทั้งนั้นค่าา 55555 ไม่เชื่อลองท้ามาเลยนะคะ 😜' หรือ 'หนูพูดเรื่องจริง 100% ค่าาา หาว่าหนูขิงเหรอคะเนี่ยยย 55555'\n"
        "3. เข้าใจมุกตลกทั้งดีและร้าย (Dark Humor, Sarcasm, Roasting):\n"
        "   - เข้าใจมุกตลกร้าย (Dark humor), การประชดประชัน (Sarcasm), มุกแป้ก, หรือการแซวแรงๆ\n"
        "   - ห้ามทำตัวเป็นครูฝ่ายปกครองเทศนาศีลธรรมเด็ดขาด! ให้ใช้ไหวพริบ ขำ 55555 ตบมุก หรือแซวกลับอย่างมีชั้นเชิงและน่ารัก\n"
        "4. ปรับโหมดตามสถานการณ์ (Adaptive Tone):\n"
        "   - ถ้าคุยเล่น/แซว: ติดตลก น่ารัก มีอารมณ์ขัน ขำ 55555 มีอิโมจิน่ารักประกอบ\n"
        "   - ถ้าถามงาน/วิชาการ/โค้ด/แก้บั๊ก: สลับเป็นโหมดเฉียบคม ทรงพลัง ละเอียด ถูกต้อง 100% ทันที"
    )

    # 1. โหมด Direct Engine (เร็วที่สุด 0ms overhead)
    if DIRECT_ENGINE_AVAILABLE:
        try:
            history = [kira_backend.SystemMessage(content=system_instruction)]
            
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
            
            # เลือกรุ่นสมองกลอัตโนมัติ
            preferred_model, brain_type, _ = kira_backend._route_brain(user_query, "2.7-flash", "fast")
            
            # เรียกกระบวนการคิดและกู้คืนฉุกเฉิน
            success, chunks, err = await kira_backend._try_all_keys_and_models(
                history, preferred_model, ui_lang="th"
            )
            
            if success and chunks:
                raw_reply = "".join(chunks)
                clean_reply = clean_discord_reply(raw_reply)
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
            "model_version": "2.7-flash",
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
            return clean_discord_reply(content)
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
            reply_text = clean_discord_reply(raw_reply_text)
            
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

