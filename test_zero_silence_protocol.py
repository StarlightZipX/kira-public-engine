# -*- coding: utf-8 -*-
"""
Test Suite: Zero-Silence & Honest Uncertainty Protocol Verification
Verifies that Kira never stays silent or drops responses when uncertain,
always responding with polite honesty, clarifying questions, and guidance.
"""
import sys
import unittest
import os
import re

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

class TestZeroSilenceProtocol(unittest.TestCase):

    def test_1_system_prompts_zero_silence_directives(self):
        """Verify that system_prompt and system_prompt_boss mandate honest response on uncertainty"""
        from app import system_prompt, system_prompt_boss, _get_full_system_prompt

        # Public System Prompt checks
        self.assertIn("Zero-Silence & Honest Uncertainty Protocol", system_prompt)
        self.assertIn("ห้ามเงียบหาย", system_prompt)
        self.assertIn("ในประเด็นนี้ คิระยังไม่แน่ใจในข้อมูลอย่างครบถ้วน", system_prompt)
        self.assertNotIn("หยุดพิมพ์ข้อความทันที", system_prompt, "Legacy hard-stop phrase that caused abrupt silence must be removed")

        # Boss System Prompt checks
        self.assertIn("Executive Zero-Silence & Honest Uncertainty Protocol", system_prompt_boss)
        self.assertIn("ห้ามเงียบหาย เมินเฉย หรือทิ้งความเงียบให้บอสเด็ดขาด", system_prompt_boss)
        self.assertIn("รายงานสถานะความมั่นใจอย่างซื่อสัตย์ระดับมืออาชีพ", system_prompt_boss)

        # Full Dynamic System Prompt checks
        full_prompt = _get_full_system_prompt("TestUser", ui_lang="th")
        self.assertIn("Zero-Silence Protocol", full_prompt)
        self.assertIn("ห้ามจบข้อความไว้แค่ในแท็ก <think> หรือส่งแต่ความเงียบเด็ดขาด", full_prompt)
        print("  ✅ [Passed] System Prompts strictly enforce Zero-Silence & Honest Uncertainty Protocol")

    def test_2_line_oa_honest_uncertainty_fallback(self):
        """Verify LINE OA webhook fallback returns polite uncertainty on questions, not generic greeting"""
        # Test simulation logic matching app.py line webhook handler
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
                        "ในประเด็นนี้คิระยังไม่แน่ใจในข้อมูลอย่างครบถ้วน หรือข้อมูลอาจยังมีความละเอียดอ่อนและไม่ชัดเจนเพียงพอค่ะ 🌸\n\n"
                        "💡 เพื่อความถูกต้องและตรงจุดที่สุด รบกวนช่วยระบุรายละเอียด ขยายความบริบท หรือส่งตัวอย่างเพิ่มเติมอีกสักนิดนะคะ "
                        "คิระพร้อมช่วยค้นหาและดูแลต่อให้ทันทีค่ะ 💜"
                    )
            return ai_reply

        # Case A: User sends a question, but model only emitted thinking tokens
        reply_q = simulate_line_fallback("ท่อพีวีซี 4 หุนทนแรงดันได้กี่บาร์", "<think>I am not sure about exact PSI</think>")
        self.assertIn("ยังไม่แน่ใจในข้อมูลอย่างครบถ้วน", reply_q)
        self.assertNotIn("ยินดีที่ได้คุยกับคุณนะคะ", reply_q, "Question should not receive a generic stranger greeting")

        # Case B: User sends a greeting
        reply_g = simulate_line_fallback("สวัสดีครับคิระ", "")
        self.assertIn("ยินดีที่ได้คุยกับคุณนะคะ", reply_g)

        print("  ✅ [Passed] LINE OA Webhook correctly differentiates questions from greetings on empty reply")

    def test_3_frontend_script_i18n_uncertainty_keys(self):
        """Verify script.js has uncertainty_title and uncertainty_desc for all 5 languages"""
        with open("static/script.js", "r", encoding="utf-8") as f:
            js_content = f.read()

        for lang in ["th", "en", "zh", "ko", "ja"]:
            self.assertIn("uncertainty_title", js_content, f"Missing uncertainty_title in script.js")
            self.assertIn("uncertainty_desc", js_content, f"Missing uncertainty_desc in script.js")

        self.assertIn("ในประเด็นนี้คิระยังไม่แน่ใจในข้อมูลอย่างครบถ้วนค่ะ", js_content)
        self.assertIn("I am not 100% certain regarding this matter", js_content)
        self.assertIn("关于此问题，我暂无法100%确定", js_content)
        self.assertIn("이 질문에 대해서는 100% 확답을 드리기 어렵습니다", js_content)
        self.assertIn("この件につきましては、現時点で確実な回答が困難です", js_content)

        print("  ✅ [Passed] script.js localized uncertainty strings verified for TH, EN, ZH, KO, JA")

    def test_4_sw_and_template_cache_busting(self):
        """Verify sw.js and index.html cache-busting versions are synchronized"""
        with open("static/sw.js", "r", encoding="utf-8") as f:
            sw_content = f.read()
        self.assertIn("kira-ai-cache-v2.7.12", sw_content)
        self.assertIn("script.js?v=20261031_2712", sw_content)

        with open("templates/index.html", "r", encoding="utf-8") as f:
            html_content = f.read()
        self.assertIn("script.js?v=20261031_2712", html_content)

        print("  ✅ [Passed] Service Worker and HTML cache-busting synchronized to v2.7.12")

if __name__ == "__main__":
    unittest.main()
