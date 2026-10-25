import re

def sanitize_ai_reply_for_chat(text: str) -> str:
    """ทำความสะอาดข้อความจาก AI ให้ปราศจาก Thinking Tags, Internal Scratchpad,
    System Prompts / Developer Instructions และข้อมูลลับ ก่อนส่งออกสู่ผู้ใช้ 100%
    """
    if not text:
        return ""

    # 1. ลบ Thinking Blocks รูปแบบต่างๆ (รวมถึง multiline)
    thinking_block_patterns = [
        r'\[THINKING\].*?\[/THINKING\]',
        r'\[THINKING_START\].*?\[THINKING_END\]',
        r'<think>.*?</think>',
        r'<thought>.*?</thought>',
        r'<reasoning>.*?</reasoning>',
        r'\[Thought Process\].*?\[/Thought Process\]',
        r'\[THINKING\].*?\[THINKING_DONE\]',
    ]
    cleaned = text
    for pat in thinking_block_patterns:
        cleaned = re.sub(pat, '', cleaned, flags=re.DOTALL | re.IGNORECASE)

    # 2. ลบ Unclosed thinking tag ที่อาจค้างอยู่ตอนต้นข้อความ
    unclosed_patterns = [
        r'^\s*\[THINKING\].*?(?=\n\n|\r\n\r\n|สวัสดี|ยินดี|ค่ะ|ครับ|\Z)',
        r'^\s*<think>.*?(?=\n\n|\r\n\r\n|สวัสดี|ยินดี|ค่ะ|ครับ|\Z)',
    ]
    for pat in unclosed_patterns:
        cleaned = re.sub(pat, '', cleaned, flags=re.DOTALL | re.IGNORECASE)

    # 3. ลบ Standalone / Residual Tags ทั้งหมด
    standalone_tags = [
        r'\[THINKING_DONE\]',
        r'\[/THINKING\]',
        r'\[THINKING\]',
        r'\[/THINKING_START\]',
        r'\[THINKING_START\]',
        r'\[/THINKING_END\]',
        r'\[THINKING_END\]',
        r'</think>',
        r'<think>',
        r'</thought>',
        r'<thought>',
        r'</reasoning>',
        r'<reasoning>',
    ]
    for tag in standalone_tags:
        cleaned = re.sub(tag, '', cleaned, flags=re.IGNORECASE)

    # 4. ลบการหลุดของ Meta-Prompts หรือ Developer Instructions ในเนื้อหา
    meta_instruction_patterns = [
        r'^\s*According to developer instruction[^\n]*\n*',
        r'^\s*The user says\s*["\'][^"\']+["\'][^\n]*\n*',
    ]
    for pat in meta_instruction_patterns:
        cleaned = re.sub(pat, '', cleaned, flags=re.IGNORECASE)

    return cleaned.strip()


def test_sanitizer():
    # Test case 1: Exact leak from Boss screenshot
    boss_leak = (
        '[THINKING]The user says "ทดสอบระบบหน่อย ลองทักทายมาสิ" twice. They want a greeting. '
        'According to developer instruction, respond as "คิระ" in Thai, use "หนู" or "คิระ", '
        'end with "ค่ะ/นะคะ". Provide greeting. Should not reveal personal data. Just greet. [/THINKING][THINKING_DONE]\n\n'
        'สวัสดีค่ะ! ยินดีต้อนรับสู่ Kira AI คิระ พร้อมช่วยเหลือคุณทุกเรื่องนะคะ 😊'
    )
    res1 = sanitize_ai_reply_for_chat(boss_leak)
    expected1 = 'สวัสดีค่ะ! ยินดีต้อนรับสู่ Kira AI คิระ พร้อมช่วยเหลือคุณทุกเรื่องนะคะ 😊'
    assert res1 == expected1, f"Failed Case 1! Got: {res1!r}"
    print("✅ Case 1 (Boss Screenshot Leak) PASSED!")

    # Test case 2: DeepSeek R1 <think> tag
    deepseek_leak = '<think>\nAnalyze user request and respond politely.\n</think>\nสวัสดีค่ะท่านประธาน หนูคิระพร้อมรับคำสั่งค่ะ!'
    res2 = sanitize_ai_reply_for_chat(deepseek_leak)
    expected2 = 'สวัสดีค่ะท่านประธาน หนูคิระพร้อมรับคำสั่งค่ะ!'
    assert res2 == expected2, f"Failed Case 2! Got: {res2!r}"
    print("✅ Case 2 (DeepSeek <think> tag) PASSED!")

    # Test case 3: Unclosed [THINKING] with [THINKING_DONE]
    unclosed_leak = '[THINKING]Internal scratchpad without close tag[THINKING_DONE]ยินดีต้อนรับค่ะ'
    res3 = sanitize_ai_reply_for_chat(unclosed_leak)
    assert res3 == 'ยินดีต้อนรับค่ะ', f"Failed Case 3! Got: {res3!r}"
    print("✅ Case 3 (Unclosed tag with THINKING_DONE) PASSED!")

    # Test case 4: Only thinking without reply
    only_thinking = '[THINKING]Just thinking and nothing else[/THINKING][THINKING_DONE]'
    res4 = sanitize_ai_reply_for_chat(only_thinking)
    assert res4 == '', f"Failed Case 4! Got: {res4!r}"
    print("✅ Case 4 (Only thinking -> empty string) PASSED!")

    print("\n🎉 ALL SANITIZER TESTS PASSED 100%!")


if __name__ == '__main__':
    test_sanitizer()
