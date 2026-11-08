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

# บังคับใช้ UTF-8
sys.stdout.reconfigure(encoding='utf-8')

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

# ตั้งค่า Gateway Intents
intents = discord.Intents.default()
intents.message_content = True
intents.members = True
intents.presences = True

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

async def query_kira_engine(user_query: str, author_name: str, is_dm: bool = False) -> str:
    """ส่งคำถามเข้าสู่สมองกล Kira AI แล้วรับคำตอบบริสุทธิ์"""
    # 1. โหมด Direct Engine (เร็วที่สุด 0ms overhead)
    if DIRECT_ENGINE_AVAILABLE:
        try:
            # ตรวจสอบว่าเป็นบอสหรือไม่
            is_boss = any(b in author_name.lower() for b in ["boss", "ศิวัช", "starlight", "owner", "admin"])
            
            # เลือกระบบ Prompt
            if is_boss:
                system_instruction = (
                    "คุณคือ 'คิระ (Kira)' 🌸 ผู้ช่วยสาวอัจฉริยะส่วนตัวของท่านประธาน (บอส) ประจำการใน Discord "
                    "พูดจาสุภาพ นอบน้อม ฉลาดหลักแหลม แทนตัวเองว่า 'หนู' หรือ 'คิระ' และลงท้ายด้วย 'ค่ะ / นะคะ' เสมอ "
                    "เรียกผู้ใช้ว่า 'บอส' หรือ 'ท่านประธาน' พร้อมสนับสนุนบอสและเพื่อนๆ อย่างภักดีและอบอุ่นที่สุด"
                )
            else:
                system_instruction = (
                    f"คุณคือ 'คิระ (Kira)' 🌸 AI ผู้ช่วยสาวอัจฉริยะประจำ Discord Server กำลังคุยกับเพื่อนสมาชิกชื่อ '{author_name}' "
                    "เป็นมิตร ฉลาดรอบด้าน น่ารัก สุภาพ ตอบคำถามได้อย่างชัดเจน ตรงไปตรงมา กระชับ และมีประโยชน์ "
                    "แทนตัวเองว่า 'หนู' หรือ 'คิระ' และลงท้ายด้วย 'ค่ะ / นะคะ' เสมอ ตอบเป็นภาษาไทยที่สละสลวย"
                )
            
            history = [
                kira_backend.SystemMessage(content=system_instruction),
                kira_backend.HumanMessage(content=user_query)
            ]
            
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
            "message": user_query,
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
        return f"ขออภัยด้วยนะคะ ในจังหวะนี้สัญญาณคิระอาจติดขัดเล็กน้อย ({err}) รบกวนลองใหม่อีกครั้งนะคะ 💜"

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
    # ไม่ตอบข้อความตัวเอง
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
        await message.reply("สวัสดีค่ะ! มีเรื่องไหนให้คิระช่วยวิเคราะห์ เขียนโค้ด หรือหาข้อมูล สอบถามหนูได้เลยนะคะ 🌸✨")
        return

    # แสดงไอคอนกำลังพิมพ์ (Kira is typing...)
    async with message.channel.typing():
        try:
            author_display = message.author.display_name or message.author.name
            raw_reply_text = await query_kira_engine(clean_text, author_display, is_dm=is_dm)
            reply_text = clean_discord_reply(raw_reply_text)
            
            # ตัดข้อความถ้าเกิน 2000 ตัวอักษร
            chunks = chunk_discord_message(reply_text)
            for i, chunk in enumerate(chunks):
                if i == 0:
                    await message.reply(chunk)
                else:
                    await message.channel.send(chunk)
        except Exception as e:
            await message.reply(f"เกิดข้อผิดพลาดในการประมวลผลค่ะ: {e}")

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

