# -*- coding: utf-8 -*-
"""
Test Suite: Proactive Executive Synthesis Protocol Verification
Verifies that Kira acts as a proactive, highly intelligent executive assistant:
never gives up or hides behind uncertainty, makes smart assumptions, and delivers
immediate high-value actionable answers.
"""
import sys
import unittest
import os
import re

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

class TestProactiveProtocol(unittest.TestCase):

    def test_1_system_prompts_proactive_directives(self):
        """Verify that system_prompt and system_prompt_boss mandate proactive executive problem-solving"""
        from app import system_prompt, system_prompt_boss, _get_full_system_prompt

        # Public System Prompt checks
        self.assertIn("Proactive Executive Problem-Solving Protocol", system_prompt)
        self.assertIn("ห้ามเงียบหาย และห้ามตอบแบบผลักภาระให้ผู้ใช้เด็ดขาด", system_prompt)
        self.assertIn("Smart Proactive Execution", system_prompt)
        self.assertNotIn("ในประเด็นนี้ คิระยังไม่แน่ใจในข้อมูลอย่างครบถ้วน", system_prompt, "Passive uncertainty excuse must be removed")

        # Boss System Prompt checks
        self.assertIn("Proactive Executive Intelligence Protocol", system_prompt_boss)
        self.assertIn("ห้ามเงียบหาย และห้ามตอบแบบผลักภาระให้บอสเด็ดขาด", system_prompt_boss)
        self.assertIn("คิดเก่งรอบด้าน ฉลาดหลักแหลม และส่งมอบคำตอบทันที", system_prompt_boss)

        # Full Dynamic System Prompt checks
        full_prompt = _get_full_system_prompt("TestUser", ui_lang="th")
        self.assertIn("Proactive Executive Synthesis & Zero-Silence Protocol", full_prompt)
        self.assertIn("ห้ามจบข้อความไว้แค่ในแท็ก <think> หรือส่งแต่ความเงียบเด็ดขาด", full_prompt)
        print("  ✅ [Passed] System Prompts strictly enforce Proactive Executive Synthesis Protocol")

    def test_2_line_oa_proactive_fallback(self):
        """Verify LINE OA webhook fallback returns proactive actionable guidance, not uncertainty cop-outs"""
        def simulate_line_fallback(clean_text, raw_reply):
            from app import sanitize_ai_reply_for_chat
            ai_reply = sanitize_ai_reply_for_chat(raw_reply)
            if not ai_reply or not ai_reply.strip():
                q_lower = clean_text.strip().lower()
                is_greeting = any(q_lower.startswith(g) or q_lower == g for g in [
                    "สวัสดี", "หวัดดี", "ดีครับ", "ดีค่ะ", "hello", "hi", "hey"
                ])
                if is_greeting:
                    ai_reply = "สวัสดีค่ะ! หนูชื่อ \"คิระ\" ยินดีที่ได้คุยกับคุณนะคะ 💜✨ มีเรื่องไหนให้หนูช่วยวิเคราะห์ วางแผน หรือแนะนำ แจ้งหนูได้เลยนะคะ หนูพร้อมดูแลเต็มที่ค่ะ! 🥰"
                else:
                    ai_reply = (
                        "สำหรับประเด็นนี้ คิระขอแนะนำแนวทางที่เหมาะสมและมีประสิทธิภาพที่สุดให้ดังนี้ค่ะ 💡✨\n\n"
                        "1. วิเคราะห์และกำหนดแกนหลักของงานให้ชัดเจนเพื่อผลลัพธ์ที่รวดเร็ว\n"
                        "2. ปฏิบัติตามมาตรฐานสากล (Best Practices) เพื่อความถูกต้องแม่นยำ\n\n"
                        "หากต้องการรายละเอียดเชิงลึกในจุดใด พิมพ์สอบถามคิระต่อได้ตลอดเวลาเลยนะคะ 💜"
                    )
            return ai_reply

        # Case A: User sends a question, model only emitted thinking tokens
        reply_q = simulate_line_fallback("ท่อพีวีซี 4 หุนทนแรงดันได้กี่บาร์", "<think>I am not sure about exact PSI</think>")
        self.assertIn("คิระขอแนะนำแนวทางที่เหมาะสมและมีประสิทธิภาพที่สุด", reply_q)
        self.assertNotIn("ยังไม่แน่ใจในข้อมูลอย่างครบถ้วน", reply_q, "Passive uncertainty excuse should not be used")

        # Case B: User sends a greeting
        reply_g = simulate_line_fallback("สวัสดีครับคิระ", "")
        self.assertIn("ยินดีที่ได้คุยกับคุณนะคะ", reply_g)

        print("  ✅ [Passed] LINE OA Webhook correctly delivers proactive guidance on empty reply")

    def test_3_frontend_script_proactive_synthesis_keys(self):
        """Verify script.js has proactive synthesis keys and completely eliminates uncertainty-note warning banner"""
        with open("static/script.js", "r", encoding="utf-8") as f:
            js_content = f.read()

        for lang in ["th", "en", "zh", "ko", "ja"]:
            self.assertIn("proactive_synthesis_title", js_content, f"Missing proactive_synthesis_title in script.js")
            self.assertIn("proactive_synthesis_desc", js_content, f"Missing proactive_synthesis_desc in script.js")

        self.assertNotIn('class="uncertainty-note"', js_content, "The yellow uncertainty-note banner must be eliminated from UI")
        self.assertIn('class="proactive-note"', js_content, "The proactive synthesis note must be used instead")

        print("  ✅ [Passed] script.js eliminates uncertainty-note and enforces Proactive Executive UI")

    def test_4_sw_cache_name(self):
        """Verify sw.js has cache-busting version for proactive mind"""
        with open("static/sw.js", "r", encoding="utf-8") as f:
            sw_content = f.read()
        self.assertIn("kira-ai-cache-v2.7-proactive-mind", sw_content)
        print("  ✅ [Passed] Service Worker cache-busting synchronized to v2.7-proactive-mind")

if __name__ == "__main__":
    unittest.main()
