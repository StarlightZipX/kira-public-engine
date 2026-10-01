import unittest
import sys
from fastapi.testclient import TestClient
from app import app, system_prompt, system_prompt_boss

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

class TestPillar1SmartGreeting(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_1_briefing_endpoint_returns_female_greeting(self):
        """Verify GET /api/user/briefing returns warm, polite female greeting (ค่ะ/นะคะ)"""
        res = self.client.get("/api/user/briefing/somchai")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("status"), "success")
        self.assertIn("greeting_title", data)
        self.assertIn("greeting_subtitle", data)
        
        title = data["greeting_title"]
        sub = data["greeting_subtitle"]
        self.assertTrue(title.startswith("สวัสดี") or "สวัสดิ์" in title)
        # Verify subtitle contains feminine polite particle
        self.assertTrue("ค่ะ" in sub or "นะคะ" in sub)
        # Verify Kira never says "ผม" or "ครับ" in her own greeting
        self.assertNotIn("ผม", title)
        self.assertNotIn("ผม", sub)
        self.assertNotIn("ครับ", title)
        self.assertNotIn("ครับ", sub)
        print(f"  ✅ General Greeting: '{title}' -> '{sub}' (100% Female Polite)")

    def test_2_briefing_proactive_suggestions_categories(self):
        """Verify proactive suggestions contain the 5 smart advisor categories"""
        res = self.client.get("/api/user/briefing/somchai")
        data = res.json()
        suggestions = data.get("proactive_suggestions", [])
        self.assertGreaterEqual(len(suggestions), 5)
        
        categories = {s.get("category") for s in suggestions}
        self.assertIn("advisor", categories)
        self.assertIn("draft", categories)
        self.assertIn("review", categories)
        self.assertIn("learning", categories)
        self.assertIn("tech", categories)
        
        for s in suggestions:
            prompt = s.get("prompt", "")
            # Ensure none of the suggested prompts use male pronouns
            self.assertNotIn("ผม", prompt)
            self.assertNotIn("ครับ", prompt)
            print(f"    - [{s.get('category').upper()}] {s.get('title')}: {prompt[:45]}...")
        print("  ✅ All 5 Smart Advisor Categories present with female/neutral polite phrasing")

    def test_3_boss_briefing_female_executive_tone(self):
        """Verify boss briefing has executive female tone"""
        res = self.client.get("/api/user/briefing/boss")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("is_boss"))
        self.assertIn("ท่านประธาน", data["greeting_title"])
        self.assertIn("ค่ะ", data["greeting_subtitle"])
        self.assertNotIn("ผม", data["greeting_subtitle"])
        self.assertNotIn("ครับ", data["greeting_subtitle"])
        print(f"  ✅ Boss Greeting: '{data['greeting_title']}' -> '{data['greeting_subtitle']}'")

    def test_4_system_prompts_strict_female_identity(self):
        """Verify system prompts strictly mandate 100% Female Identity"""
        self.assertIn("100% Female Identity", system_prompt)
        self.assertIn("ห้ามใช้สรรพนามเพศชาย", system_prompt)
        self.assertIn("100% Female Executive Identity", system_prompt_boss)
        self.assertIn("คิระคือผู้หญิง 100%", system_prompt_boss)
        print("  ✅ System Prompts strictly enforce 100% Female Identity")

if __name__ == "__main__":
    unittest.main()
