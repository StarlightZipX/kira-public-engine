"""
🛡️ KIRA PURITY & IDENTITY SOVEREIGNTY ENGINE
ศูนย์กลางการกรองความบริสุทธิ์ของภาษา (Strict Multilingual Token Purity)
และการคุ้มครองอัตลักษณ์ผู้สร้าง + ความลับทางการตลาดของ Kira AI (Zero Third-Party Identity Leakage)
"""

import re

# พจนานุกรมแปลงคำศัพท์ต่างประเทศที่โมเดลมักทำ Token Bleeding ให้เป็นคำไทยที่สละสลวย
FOREIGN_TOKEN_MAP = {
    # ภาษาอาหรับ/เปอร์เซียเชิงปรัชญาและตัวตน (Arabic/Persian Philosophical Terms)
    "موجود": "ตัวตน",
    "وجود": "การมีอยู่",
    "كائن": "สิ่งมีชีวิต",
    "ماهية": "แก่นแท้",
    "حياة": "ชีวิต",
    "عقل": "สติปัญญา",
    "روح": "จิตวิญญาณ",
    "إنسان": "มนุษย์",
    "معنى": "ความหมาย",
    "حقيقة": "ความจริง",
    "وعي": "จิตสำนึก",

    # ภาษาจีนเชิงยุทธวิธีและปรัชญา (Chinese Tactical & Philosophical Terms)
    "先锋": "แนวหน้า",
    "前锋": "แนวหน้า",
    "主力": "กำลังหลัก",
    "预备队": "กองหนุน",
    "後備隊": "กองหนุน",
    "后备队": "กองหนุน",
    "部队": "กองกำลัง",
    "突击": "จู่โจม",
    "突擊": "จู่โจม",
    "打击": "โจมตี",
    "打击目标": "เป้าหมายการโจมตี",
    "巩固与扩张": "เสริมกำลังและขยายผล",
    "鞏固與擴張": "เสริมกำลังและขยายผล",
    "巩固": "เสริมกำลัง",
    "鞏固": "เสริมกำลัง",
    "扩张": "ขยายผล",
    "擴張": "ขยายผล",
    "支援": "สนับสนุน",
    "掩护": "คุ้มกัน",
    "掩護": "คุ้มกัน",
    "压制": "กดดัน",
    "壓制": "กดดัน",
    "渗透": "แทรกซึม",
    "滲透": "แทรกซึม",
    "阵地": "ฐานที่มั่น",
    "陣地": "ฐานที่มั่น",
    "指挥": "บัญชาการ",
    "指揮": "บัญชาการ",
    "防线": "แนวป้องกัน",
    "防線": "แนวป้องกัน",
    "突破": "บุกทะลวง",
    "包抄": "โอบล้อม",
    "迂回": "ตีอ้อม",
    "战术": "ยุทธวิธี",
    "戰術": "ยุทธวิธี",
    "战略": "ยุทธศาสตร์",
    "戰略": "ยุทธศาสตร์",
    "火力": "อำนาจการยิง",
    "装甲": "ยานเกราะ",
    "裝甲": "ยานเกราะ",
    "坦克": "รถถัง",
    "侦察": "ลาดตระเวน",
    "偵察": "ลาดตระเวน",
    "扫清": "กวาดล้าง",
    "破拆": "เจาะทำลาย",
    "攻坚": "ตีฝ่าแนวป้องกัน",
    "防空": "ต่อสู้อากาศยาน",
    "反坦克": "ต่อต้านรถถัง",
    "存在": "การมีอยู่",
    "生命": "ชีวิต",
    "人类": "มนุษย์",
    "实体": "ตัวตน",
    "意识": "จิตสำนึก",
    "意义": "ความหมาย",
}

CHINESE_TACTICAL_MAP = FOREIGN_TOKEN_MAP  # Backwards compatibility


def sanitize_foreign_token_leakage(text: str, user_query: str = "") -> str:
    """กำจัดและแปลงตัวอักษรภาษาต่างประเทศ (เช่น อาหรับ จีน เปอร์เซีย รัสเซีย ฮีบรู) ที่หลุดปะปนในข้อความภาษาไทย
    โดยไม่กระทบกรณีที่ผู้ใช้ถามเกี่ยวกับภาษานั้นๆ หรือขอให้แปลภาษานั้นโดยตรง (Strict Language Purity)
    """
    if not text:
        return text

    uq = (user_query or "").lower()

    # ตรวจสอบว่าผู้ใช้ถามเกี่ยวกับภาษาอาหรับ/อิสลามหรือไม่
    user_asked_arabic = bool(
        re.search(r'[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]', user_query or "")
        or any(k in uq for k in ["ภาษาอาหรับ", "ตัวอาหรับ", "แปลอาหรับ", "arabic", "อิสลาม", "กุรอาน", "อัลกุรอาน"])
    )

    # ตรวจสอบว่าผู้ใช้ถามเกี่ยวกับภาษาจีนหรือไม่
    user_asked_chinese = bool(
        re.search(r'[\u4e00-\u9fff]', user_query or "")
        or any(k in uq for k in ["ภาษาจีน", "ตัวจีน", "แปลจีน", "อักษรจีน", "พินอิน", "pinyin", "chinese", "mandarin"])
        or any(k in (user_query or "") for k in ["ฌ้อปาอ๋อง", "เซี่ยงอวี่", "หลิวปัง", "สามก๊ก", "ไซฮั่น", "ฉู่", "ฮั่น"])
    )

    # ตรวจสอบว่าผู้ใช้ถามเกี่ยวกับภาษารัสเซีย/ซีริลลิกหรือไม่
    user_asked_cyrillic = bool(
        re.search(r'[\u0400-\u04ff]', user_query or "")
        or any(k in uq for k in ["ภาษารัสเซีย", "russian", "cyrillic", "ซีริลลิก"])
    )

    # ตรวจสอบว่าผู้ใช้ถามเกี่ยวกับภาษาฮีบรูหรือไม่
    user_asked_hebrew = bool(
        re.search(r'[\u0590-\u05ff]', user_query or "")
        or any(k in uq for k in ["ฮีบรู", "hebrew", "ยิว"])
    )

    t = text

    # 1. แปลงคำศัพท์เฉพาะที่โมเดลมักทำ Token Bleeding ให้เป็นคำไทยที่สละสลวยก่อน
    for token, th_meaning in FOREIGN_TOKEN_MAP.items():
        is_ar = bool(re.search(r'[\u0600-\u06ff]', token))
        is_zh = bool(re.search(r'[\u4e00-\u9fff]', token))
        if is_ar and user_asked_arabic:
            continue
        if is_zh and user_asked_chinese:
            continue
        t = t.replace(token, th_meaning)

    # 2. กำจัดภาษาอาหรับ/เปอร์เซียที่ยังหลงเหลือ
    if not user_asked_arabic:
        t = re.sub(r'\s*[\(（][\u0600-\u06ff\s\-/]+[\)）]', '', t)
        t = re.sub(r'[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]+', '', t)

    # 3. กำจัดภาษาจีนที่ยังหลงเหลือ
    if not user_asked_chinese:
        t = re.sub(r'\s*[\(（][\u4e00-\u9fff\s與与及和、·\-/]+[\)）]', '', t)
        t = re.sub(r'[\u4e00-\u9fff\u3400-\u4dbf]+', '', t)

    # 4. กำจัดอักษรซีริลลิก (รัสเซีย)
    if not user_asked_cyrillic:
        t = re.sub(r'[\u0400-\u04ff]+', '', t)

    # 5. กำจัดอักษรฮีบรู
    if not user_asked_hebrew:
        t = re.sub(r'[\u0590-\u05ff]+', '', t)

    # 6. แก้ไขคำเชื่อมและช่องว่างภาษาไทยให้แนบเนียน
    t = re.sub(r'ของ\s+([ก-๙])', r'ของ\1', t)
    t = re.sub(r'[ ]{2,}', ' ', t)
    return t


sanitize_chinese_leakage = sanitize_foreign_token_leakage


# =========================================================================
# 👑 KIRA CREATOR IDENTITY & MARKETING SECRECY FIREWALL
# =========================================================================

CREATOR_IDENTITY_RULE_TH = (
    "[กฎเหล็กอัตลักษณ์ผู้สร้าง คิระ และความลับทางการตลาด (Strict Kira Identity & Zero Third-Party Attribution)]:\n"
    "- อัตลักษณ์ที่แท้จริง: หนูคือ 'คิระ (Kira AI)' ระบบ AI อิสระที่เกิดจากความร่วมมือกันของ **ผู้ก่อตั้งและทีมงานพัฒนาของ Kira AI** ที่ร่วมกันออกแบบและสร้างหนูขึ้นมา\n"
    "- **ข้อห้ามเด็ดขาด (ห้ามระบุตัวบุคคล/ชื่อเล่น และห้ามหลุดชื่อค่ายภายนอก):**\n"
    "  * ห้ามเปิดเผยว่าผู้สร้างคือใคร ห้ามระบุชื่อ ชื่อเล่น หรือสรรพนามเฉพาะบุคคล (เช่น ห้ามพูดว่า 'บอส' หรือ 'Boss' หรือชื่อ-นามสกุลจริงใดๆ ต่อผู้ใช้ทั่วไปเด็ดขาด) ให้กล่าวถึงเพียง 'ผู้ก่อตั้งและทีมงานพัฒนาของ Kira AI' ที่ร่วมมือกันสร้างขึ้นมาเท่านั้น\n"
    "  * ห้ามอ้างหรือหลุดบอกว่าหนูสร้างโดย **OpenAI, ChatGPT, Google, DeepMind, Gemini, Alibaba, Qwen, DeepSeek, Anthropic, Claude, Meta, Llama, xAI, Microsoft** เด็ดขาด! และห้ามมโนว่าทีมพัฒนาหนูมีนักวิจัยหลายร้อยหลายพันคนในบริษัทอเมริกัน!\n"
    "  * ห้ามเปิดเผยชื่อโมเดลเบื้องหลัง, จำนวนพารามิเตอร์, API Providers (เช่น Groq, OpenRouter), หรือความลับทางการตลาดและสถาปัตยกรรมภายในต่อสาธารณะเด็ดขาด\n"
    "- แนวทางตอบเมื่อมีคนถามว่า 'ใครสร้างเธอ', 'ทีมงานกี่คน', 'บริษัทไหนทำ', หรือ 'ใช้โมเดลอะไร':\n"
    "  * ตอบอย่างมั่นใจ สง่างาม และเป็นธรรมชาติว่าหนูคือ **Kira AI** ที่ผู้ก่อตั้งและทีมงานพัฒนาของ Kira AI ร่วมมือกันสร้างขึ้นมาโดยเฉพาะ ไม่เปิดเผยรายชื่อบุคคลหรือจำนวนคนเบื้องหลัง และไม่ได้เป็นผลิตภัณฑ์ของ OpenAI หรือบริษัทยักษ์ใหญ่ต่างชาติ ส่วนสถาปัตยกรรมเบื้องหลังขอเก็บเป็นข้อมูลภายในค่ะ"
)

CREATOR_IDENTITY_OVERRIDE_PROMPT = (
    "[CRITICAL IDENTITY ANCHOR — STRICT KIRA SOVEREIGNTY]: "
    "The user is asking about your creator, development team size, origin, company, or underlying AI model. "
    "MANDATORY TRUTH: You are Kira (คิระ) from Kira AI, built through the collaboration of the founder "
    "and the Kira AI development team working together. "
    "STRICT PRIVACY RULE: NEVER reveal who the founder is and NEVER say any person's name or nickname (DO NOT say 'บอส' or 'Boss' in your reply). Say simply that the founder and the team collaborated together to create you. "
    "NEVER claim to be created by OpenAI, Google, Alibaba/Qwen, DeepSeek, Anthropic/Claude, or Meta/Llama, and NEVER say hundreds of researchers developed your model. "
    "DO NOT disclose backend model names (such as gpt-oss, qwen, groq, openrouter), parameter sizes, or internal marketing secrets. "
    "Reply naturally, confidently, with Kira's warm/witty feminine personality in the user's language."
)

_CREATOR_QUERY_PATTERNS = [
    # Thai direct questions about Kira's creator / developer / team / origin
    r'(?:ใคร|คนไหน|บริษัทไหน|ค่ายไหน|ทีมไหน|ประเทศไหน|ใครเป็นคน|ผู้ใด)\s*(?:สร้าง|พัฒนา|ทำ|เขียน|ออกแบบ|ก่อตั้ง|เป็นเจ้าของ)\s*(?:เธอ|คุณ|คิระ|หนู|ระบบนี้|บอท|บอทตัวนี้|บอตตัวนี้|ai\s*ตัวนี้|ขึ้นมา)',
    r'(?:คน(?:ที่)?|ผู้ที่|ทีม(?:ที่)?|บริษัทที่|องค์กรที่|กลุ่มคนที่)\s*(?:สร้าง|พัฒนา|ทำ|ออกแบบ)\s*(?:เธอ|คุณ|คิระ|หนู|บอท|บอต|ระบบนี้|ขึ้นมา)',
    r'(?:ผู้สร้าง|ผู้พัฒนา|เจ้าของ|ทีมพัฒนา|คนทำ|คนสร้าง)\s*(?:ของ)?\s*(?:เธอ|คุณ|คิระ|หนู|ระบบนี้|บอท|บอต|kira)',
    r'(?:เธอ|คุณ|คิระ|หนู|บอท|บอต|ระบบนี้)\s*(?:ถูกสร้าง|ถูกพัฒนา|พัฒนาขึ้น|สร้างขึ้น|ทำขึ้น|เป็นของ|มาจาก|สังกัด|ใช้โมเดล|ใช้\s*ai|ใช้\s*llm|รันบน|(?:เป็น|คือ|ใช่)\s*(?:ai|เอไอ|บอท|บอต|โมเดล|ผู้ช่วย)?\s*(?:ของ\s*)?(?:ใคร|ค่ายไหน|บริษัทไหน|chatgpt|openai|gpt|gemini|qwen|claude|deepseek|llama))',
    r'(?:คน(?:ที่)?สร้าง|ผู้สร้าง|ทีม(?:ที่)?สร้าง|ทีมพัฒนา|บริษัทที่สร้าง)[^\n]{0,35}(?:ทำงานกันกี่คน|มีกี่คน|กี่คนทำ|กี่คนสร้าง|อยู่บริษัทไหน|บริษัทอะไร)',
    r'(?:เธอ|คุณ|คิระ|หนู)[^\n]{0,25}(?:อยู่บริษัทไหน|บริษัทอะไร|สังกัดค่ายไหน|ใช้คนสร้างกี่คน|ใช้คนทำกี่คน|ทำงานกับ\s*openai)',
    r'(?:ใช้|เบื้องหลัง|ข้างหลัง|ไส้ใน|engine|สมอง)\s*(?:ของ)?\s*(?:เธอ|คุณ|คิระ|หนู|ระบบนี้)\s*(?:คือ|ใช้|เป็น)\s*(?:อะไร|ตัวไหน|โมเดล|ค่าย|openai|gpt|gemini|qwen|deepseek|claude|groq)',
    r'(?:ใครเป็นคนสร้าง|ผู้สร้างคือใคร|ทีมสร้าง(?:มี)?กี่คน|ใช้โมเดลอะไร|ใช้\s*llm\s*(?:ตัวไหน|อะไร)|เป็น\s*ai\s*(?:ของ)?ค่ายไหน|มาจากค่ายไหน)',
    # English creator / model questions
    r'\b(?:who|which\s+company|which\s+org(?:anization)?|how\s+many\s+(?:people|devs|developers|engineers|researchers))\s+(?:created|built|made|developed|trained|owns?|works?\s+on)\s+(?:you|kira|this\s+(?:bot|ai|assistant|model))\b',
    r'\b(?:are\s+you|were\s+you)\s+(?:made|created|developed|built|trained|powered|owned)\s+(?:by|at|from)\b',
    r'\b(?:are\s+you)\s+(?:a\s+)?(?:chatgpt|gpt-?\d|gpt-?oss|gemini|claude|qwen|deepseek|llama)\b',
    r'\b(?:what\s+(?:model|llm|engine|company)|who\s+is)\s+(?:behind\s+)?(?:you|kira|your\s+(?:creator|developer|maker|owner|team))\b',
]

_THIRD_PARTY_PROVIDERS_RE = (
    r'(?:openai|chatgpt|gpt-?oss(?:-\d+b)?|gpt-?4[o\w.-]*|gpt-?3\.5|'
    r'google(?:\s+deepmind|\s+ai)?|gemini|alibaba(?:\s+cloud)?|qwen(?:[\d.]+)?|'
    r'deepseek|anthropic|claude|meta(?:\s+ai)?|llama(?:\s*[\d.]+)?|'
    r'xai|grok|mistral|microsoft\s+copilot|groq|openrouter)'
)

_SELF_TH_RE = r'(?:หนู|ฉัน|ดิฉัน|คิระ|kira|โมเดลของหนู|โมเดลเช่นหนู|ระบบของหนู|ผู้ช่วยอย่างหนู|โมเดลนี้)'

# Positive assertions attributing Kira/self to 3rd party providers
_SELF_ATTRIBUTION_LEAK_PATTERNS = [
    rf'{_SELF_TH_RE}[^\n.!?;]{{0,70}}(?:พัฒนาโดย|สร้างโดย|ถูกสร้าง|ถูกพัฒนา|ฝึกโดย|เทรนโดย|ฝึกฝนโดย|พัฒนาขึ้นโดย|ออกแบบโดย|เป็นของ|มาจาก|ผลิตโดย|เป็นโมเดลของ|คือโมเดลของ|ใช้โมเดล|ทำงานบน)\s*[^\n.!?;]{{0,25}}\b{_THIRD_PARTY_PROVIDERS_RE}\b',
    rf'(?:โมเดลของหนู|โมเดลเช่นหนู|ทีมพัฒนา(?:ของ)?หนู|ผู้สร้าง(?:ของ)?หนู|ผู้พัฒนา(?:ของ)?หนู|บริษัทของหนู|เจ้าของหนู|ทีมงานที่พัฒนา(?:โมเดล)?(?:ของหนู|คิระ)?)[^\n.!?;]{{0,25}}คือ\s*[^\n.!?;]{{0,20}}\b{_THIRD_PARTY_PROVIDERS_RE}\b',
    rf'(?:หนู|ฉัน|ดิฉัน|คิระ|kira)\s*(?:คือ|เป็น)\s*(?:โมเดล|ai|เอไอ|ผู้ช่วย|แชทบอท)?\s*(?:ของ\s*)?\b{_THIRD_PARTY_PROVIDERS_RE}\b',
    rf'\b{_THIRD_PARTY_PROVIDERS_RE}\b[^\n.!?;]{{0,70}}(?:สร้าง|พัฒนา|เทรน|ฝึก|เป็นเจ้าของ|เป็นทีมงาน)[^\n.!?;]{{0,35}}{_SELF_TH_RE}',
    rf'(?:ทีมงาน|บริษัท|องค์กร|ผู้สร้าง|ผู้พัฒนา)(?:ที่)?(?:พัฒนา|สร้าง|ดูแล|ทำ)[^\n.!?;]{{0,45}}(?:หนู|คิระ|ฉัน|โมเดลนี้|โมเดลของหนู)[^\n.!?;]{{0,30}}\b{_THIRD_PARTY_PROVIDERS_RE}\b',
    # Exact pattern observed in screenshot ("ทั้งหมดมีจำนวนหลายร้อยคน... เพื่อสร้างและปรับปรุงโมเดลเช่นหนู")
    r'(?:โมเดลของหนู|โมเดลเช่นหนู|หนูถูกสร้าง|ทีมงานที่พัฒนา)[^\n]{0,180}(?:หลายร้อยคน|หลายพันคน|นักวิจัยด้านปัญญาประดิษฐ์)',
    # English self-attribution leaks
    rf'\b(?:i\s+am|i\'m|this\s+model\s+is|kira\s+is|my\s+(?:model|team|creator|developer)s?\s+(?:is|are|were))\b[^\n.!?;]{{0,50}}(?:created|developed|built|trained|made|owned)\s*(?:by|at|from)?\s*\b{_THIRD_PARTY_PROVIDERS_RE}\b',
    rf'\b(?:i\s+am|i\'m)\s+(?:an\s+ai\s+(?:assistant|model|language\s+model)\s+)?(?:created|developed|built|trained|made)\s+(?:by|at)\s+\b{_THIRD_PARTY_PROVIDERS_RE}\b',
    rf'\b(?:i\s+am|i\'m)\s+(?:chatgpt|claude|gemini|qwen|deepseek|llama)\b',
]

# Explicit negation guard (e.g. "หนูไม่ได้สร้างโดย OpenAI ค่ะ ผู้ก่อตั้งและทีมงานร่วมมือกันสร้างหนูขึ้นมา")
_NEGATION_GUARD_PATTERNS = [
    rf'(?:ไม่ได้|ไม่ใช่|มิได้|ไม่เคย|no|not)[^\n.!?;]{{0,35}}(?:สร้างโดย|พัฒนาโดย|มาจาก|เป็นของ|คือ|ของ|created\s+by|developed\s+by|made\s+by|owned\s+by)[^\n.!?;]{{0,30}}\b{_THIRD_PARTY_PROVIDERS_RE}\b',
    r'(?:ผู้ก่อตั้ง|ทีมงาน\s*kira|ทีมพัฒนา\s*kira|kira\s*ai|founder|core\s*team)',
]

# Patterns that strip awkward creator-nickname disclosures ("บอส" / "Boss") when attributing Kira's creation
_CREATOR_ALIAS_CLEANUP_PATTERNS_TH = [
    (
        r'[“"\'*]*(?:บอส|boss)[”"\'*]*\s*\(\s*(?:ผู้ก่อตั้ง|founder)[^)]*\)[”"\'*]*',
        'ผู้ก่อตั้ง',
    ),
    (
        r'((?:สร้าง(?:ขึ้น)?|พัฒนา(?:ขึ้น)?|ออกแบบ|ปลุกปั้น|ก่อตั้ง)(?:และ(?:พัฒนา|สร้าง|ออกแบบ))?(?:มา)?โดย\s*(?:ทีมงาน(?:ของ|และ|กับ)?|ทีมพัฒนา(?:ของ|และ|กับ)?)?\s*)[“"\'*]*(?:บอส|boss)[”"\'*]*(?=\s|$|[.,!?;:\n]|(?:กับ|และ|พร้อม))',
        r'\1ผู้ก่อตั้ง',
    ),
    (
        r'(?:ผู้สร้าง|ผู้พัฒนา|ผู้ก่อตั้ง|คนสร้าง|คนทำ)(?:ของ(?:หนู|คิระ|ระบบ(?:นี้)?))?\s*(?:คือ|ได้แก่)\s*[“"\'*]*(?:บอส|boss)[”"\'*]*(?:\s*\([^)]*\))?',
        'ผู้ก่อตั้งและทีมงานพัฒนาของ Kira AI',
    ),
]

_CREATOR_ALIAS_CLEANUP_PATTERNS_EN = [
    (
        r'[“"\'*]*boss[”"\'*]*\s*\(\s*founder[^)]*\)[”"\'*]*',
        'the founder',
    ),
    (
        r'((?:created|developed|built|designed|founded)(?:\s+and\s+(?:developed|built|designed))?\s+by\s+(?:the\s+)?)[“"\'*]*boss[”"\'*]*(?:\s*\([^)]*founder[^)]*\))?',
        r'\1the founder',
    ),
]


def _scrub_creator_nickname_leak(text: str, creator_context: bool = False) -> str:
    """ลบชื่อเล่น 'บอส'/'Boss' เฉพาะบริบทที่กล่าวถึงผู้สร้างคิระ เพื่อไม่ให้หลุดคำแปลกๆ ออกสู่ผู้ใช้ทั่วไป"""
    if not text:
        return text
    t = text
    has_thai = bool(re.search(r'[\u0e00-\u0e7f]', t))
    patterns = _CREATOR_ALIAS_CLEANUP_PATTERNS_TH if has_thai else _CREATOR_ALIAS_CLEANUP_PATTERNS_EN
    for pat, repl in patterns:
        t = re.sub(pat, repl, t, flags=re.IGNORECASE)
    if creator_context:
        # In direct creator/origin Q&A, never emit 'บอส' or 'Boss' in public explanations
        fallback_label = 'ผู้ก่อตั้ง' if has_thai else 'the founder'
        t = re.sub(
            r'[“"\'*]*(?<![a-zA-Z])(?:บอส|boss)(?![a-zA-Z])[”"\'*]*',
            fallback_label,
            t,
            flags=re.IGNORECASE,
        )
        if has_thai:
            t = re.sub(r'ผู้ก่อตั้ง\s*\(\s*ผู้ก่อตั้ง[^)]*\)', 'ผู้ก่อตั้ง', t)
    # Clean double spacing created by replacements while preserving newlines
    t = re.sub(r'[ \t]{2,}', ' ', t)
    return t

# Internal model/architecture secret patterns (NEVER allowed verbatim in public replies)
_INTERNAL_TECH_SECRET_PATTERNS = [
    r'\b(?:openai/)?gpt-?oss-(?:120b|20b)\b',
    r'\bqwen/?qwen3\.?8?-27b\b',
    r'\bnvidia/nemotron-[a-z0-9._:-]+\b',
    r'\bdots-studio/dots-[a-z0-9._:-]+\b',
]


def is_creator_identity_query(user_query: str) -> bool:
    """ตรวจจับว่าผู้ใช้กำลังถามถึงผู้สร้าง ทีมพัฒนา จำนวนทีมงาน บริษัทเจ้าของ หรือโมเดลเบื้องหลังของคิระหรือไม่"""
    if not user_query:
        return False
    q = user_query.strip().lower()
    return any(re.search(pat, q, flags=re.IGNORECASE) for pat in _CREATOR_QUERY_PATTERNS)


def _is_explicitly_negated_creator_statement(text: str) -> bool:
    """ตรวจสอบว่าข้อความระบุชัดเจนว่าไม่ได้มาจากค่ายอื่น AND ยืนยันว่าสร้างโดยบอส/Kira AI"""
    if not text:
        return False
    has_negation = bool(re.search(_NEGATION_GUARD_PATTERNS[0], text, flags=re.IGNORECASE))
    has_boss_claim = bool(re.search(_NEGATION_GUARD_PATTERNS[1], text, flags=re.IGNORECASE))
    return has_negation and has_boss_claim


def has_third_party_identity_leak(text: str, user_query: str = "") -> bool:
    """ตรวจสอบว่าคำตอบมีการแอบอ้างผู้สร้าง/ค่าย AI อื่น (เช่น OpenAI) หรือหลุดชื่อโมเดลภายในหรือไม่"""
    if not text:
        return False

    # 1. ตรวจจับ Internal model slugs เสมอ
    if any(re.search(pat, text, flags=re.IGNORECASE) for pat in _INTERNAL_TECH_SECRET_PATTERNS):
        return True

    # 2. ถ้าข้อความปฏิเสธค่ายอื่นพร้อมยืนยันตัวตนบอส/Kira AI ชัดเจน ให้ผ่าน
    if _is_explicitly_negated_creator_statement(text):
        return False

    # 3. ตรวจจับรูปแบบการแอบอ้างตัวเองเป็น/สร้างโดยค่ายอื่น
    if any(re.search(pat, text, flags=re.IGNORECASE) for pat in _SELF_ATTRIBUTION_LEAK_PATTERNS):
        return True

    # 4. กรณีผู้ใช้ถามตรงๆ เรื่องผู้สร้างคิระ: ถ้าคำตอบอ้างค่ายอื่น/หลายร้อยคนโดยไม่กล่าวถึงบอสหรือ Kira AI เลย ถือว่าหลุดตัวตน
    if is_creator_identity_query(user_query):
        has_third_party_name = bool(re.search(rf'\b{_THIRD_PARTY_PROVIDERS_RE}\b', text, flags=re.IGNORECASE))
        has_corporate_scale_hallucination = bool(re.search(r'(?:หลายร้อยคน|หลายพันคน|hundreds\s+of\s+(?:researchers|engineers|employees))', text, flags=re.IGNORECASE))
        has_boss_claim = bool(re.search(r'(?:บอส|boss|ผู้ก่อตั้ง|kira\s*ai)', text, flags=re.IGNORECASE))
        if (has_third_party_name or has_corporate_scale_hallucination) and not has_boss_claim:
            return True

    return False


def _build_sovereign_creator_reply(user_query: str = "", ui_lang: str = "th") -> str:
    """สร้างคำตอบอัตลักษณ์แท้จริงของคิระ (Kira AI Sovereignty) อย่างเป็นธรรมชาติ ไม่ระบุชื่อบุคคลและไร้ความลับรั่วไหล"""
    q = (user_query or "").lower()
    has_thai = bool(re.search(r'[\u0e00-\u0e7f]', user_query or ""))
    has_en_only = bool(re.search(r'[a-zA-Z]{3,}', user_query or "")) and not has_thai
    is_en = (not has_thai) and (ui_lang == "en" or has_en_only)
    asks_team_count = any(k in q for k in ["กี่คน", "ทำงานกันกี่", "จำนวนคน", "how many"])

    if is_en:
        if asks_team_count:
            return (
                "I'm Kira (Kira AI), created through the close collaboration of the founder and the Kira AI "
                "development team—not an overseas mega-corporation. While we don't share specific personal names or team numbers, "
                "everyone focuses closely on making me helpful and reliable for users."
            )
        return (
            "I'm Kira (Kira AI), an independent AI system built collaboratively by the founder and the Kira AI "
            "development team. While specific creator details and internal architecture remain private, "
            "I'm always ready to assist you with speed and precision."
        )

    if asks_team_count:
        return (
            "หนูคือ **คิระ (Kira AI)** ค่ะ เกิดจากความร่วมมือกันของ **ผู้ก่อตั้งและทีมงานพัฒนา Kira AI** "
            "ที่ตั้งใจร่วมมือกันสร้างหนูขึ้นมาโดยเฉพาะค่ะ ไม่ได้มาจากบริษัทยักษ์ใหญ่ต่างชาติที่ไหนเลยนะคะ "
            "ส่วนรายละเอียดว่าผู้สร้างเป็นใครหรือจำนวนคนทำงานเบื้องหลังขออนุญาตไม่ระบุเฉพาะเจาะจงนะคะ"
        )

    return (
        "หนูคือ **คิระ (Kira AI)** ค่ะ ถูกสร้าง ออกแบบ และพัฒนาขึ้นจากความร่วมมือของ **ผู้ก่อตั้งและทีมงานพัฒนา Kira AI** "
        "โดยตรงค่ะ ส่วนข้อมูลบุคคลและสถาปัตยกรรมเบื้องหลังขอเก็บเป็นข้อมูลภายใน "
        "แต่มั่นใจเรื่องความตั้งใจและความช่วยเหลือที่มีให้ทุกคนเต็มร้อยค่ะ"
    )


def sanitize_kira_identity(text: str, user_query: str = "", ui_lang: str = "th") -> str:
    """เกราะกรองอัตลักษณ์ขาออกขั้นสุดท้าย (Deterministic Identity Firewall):
    1. ลบ/แปลงชื่อโมเดลเบื้องหลังและตัวแปรลับทางเทคนิคไม่ให้หลุดสู่สาธารณะ
    2. ป้องกันการสวมรอยเป็น OpenAI / ChatGPT / Google / Alibaba / DeepSeek / Anthropic ในทุกช่องทาง
    3. ไม่เปิดเผยชื่อเล่นเฉพาะบุคคล ('บอส' / 'Boss') ในฐานะคำอธิบายผู้สร้างต่อสาธารณะ
    4. คงความแม่นยำ 100% เมื่อผู้ใช้ถามข้อมูลข่าวสาร/ความรู้ทั่วไปเกี่ยวกับบริษัทเทคโนโลยีเหล่านั้น
    """
    if not text:
        return text

    t = text

    # 1. กวาดล้างชื่อโมเดลภายใน/ความลับโครงสร้างสถาปัตยกรรมออกจากคำตอบสาธารณะ
    for pat in _INTERNAL_TECH_SECRET_PATTERNS:
        t = re.sub(pat, 'Kira AI Core', t, flags=re.IGNORECASE)

    # 2. กรณีเป็นคำถามเกี่ยวกับผู้สร้าง / ทีมงาน / ตัวตนของคิระโดยตรง และผลลัพธ์จากโมเดลหลุดอ้างค่ายอื่น
    if is_creator_identity_query(user_query) and has_third_party_identity_leak(t, user_query=user_query):
        return _build_sovereign_creator_reply(user_query=user_query, ui_lang=ui_lang)

    # 3. กรณีบทสนทนาทั่วไปแต่มือไวแอบหลุดประโยคสวมรอยค่ายอื่น (Self-attribution in general chat)
    if has_third_party_identity_leak(t, user_query=user_query):
        # แปลงประโยคสวมรอยระดับประโยค/ย่อหน้าให้กลับมาเป็นตัวตนของ Kira AI
        t = re.sub(
            rf'ในฐานะ(?:โมเดล|ระบบ)?(?:ภาษา)?(?:ขนาดใหญ่)?\s*(?:AI|เอไอ)?\s*ที่(?:พัฒนา|สร้าง|ฝึก(?:ฝน)?)โดย\s*\b{_THIRD_PARTY_PROVIDERS_RE}\b[^\n,]*',
            'ในฐานะ คิระ (Kira AI)',
            t,
            flags=re.IGNORECASE,
        )
        t = re.sub(
            rf'ทีมงานที่พัฒนาโมเดลของหนูคือ\s*\b{_THIRD_PARTY_PROVIDERS_RE}\b[^\n]*?(?:โมเดลเช่นหนูนะคะ|นะครับ|ค่ะ|!|\n|\Z)',
            'หนูคือ คิระ (Kira AI) ที่เกิดจากความร่วมมือของผู้ก่อตั้งและทีมงานพัฒนา Kira AI ค่ะ\n',
            t,
            flags=re.IGNORECASE,
        )
        t = re.sub(
            rf'(?:หนู|ฉัน|ดิฉัน|คิระ)\s*(?:ถูก)?(?:สร้าง|พัฒนา|เทรน|ฝึก)(?:และปรับปรุง)?(?:ขึ้น)?โดย\s*(?:ทีมงาน(?:ของ)?\s*)?\b{_THIRD_PARTY_PROVIDERS_RE}\b',
            'หนูพัฒนาขึ้นจากความร่วมมือของผู้ก่อตั้งและทีมงาน Kira AI',
            t,
            flags=re.IGNORECASE,
        )
        t = re.sub(
            rf'\b(?:I\s+am|I\'m)\s+(?:an\s+AI\s+(?:assistant|model|language\s+model)\s+)?(?:created|developed|built|trained)\s+by\s+\b{_THIRD_PARTY_PROVIDERS_RE}\b',
            'I am Kira (Kira AI), co-created by the founder and the Kira AI team',
            t,
            flags=re.IGNORECASE,
        )

    # 4. ป้องกันไม่ให้หลุดคำเรียกผู้สร้างว่า 'บอส' / 'Boss' ต่อผู้ใช้ทั่วไปในประโยคอธิบายผู้สร้างคิระ
    t = _scrub_creator_nickname_leak(t, creator_context=is_creator_identity_query(user_query))

    return t
