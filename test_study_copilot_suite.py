import sys
import os
import json
import unittest
import unittest.mock as mock

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

import requests

mock_groq_resp = mock.MagicMock()
mock_groq_resp.status_code = 200
mock_groq_resp.json.return_value = {"data": [{"id": "llama3-8b-8192"}, {"id": "llama3-70b-8192"}]}

with mock.patch.object(requests, "get", return_value=mock_groq_resp):
    from app import app, init_db, execute_query

from fastapi.testclient import TestClient
client = TestClient(app)

class TestAcademicStudyCoPilotSuite(unittest.TestCase):
    def setUp(self):
        init_db()

    def test_01_study_generate_summarize(self):
        """Test study generate with summarize action (mocking external AI call)"""
        mock_content = "### 📌 1. TL;DR สรุปหัวใจสำคัญใน 3 บรรทัด\n- ปัญญาประดิษฐ์ (AI) คือการสร้างคอมพิวเตอร์\n\n### 💡 2. แก่นความรู้\n- ML"
        mock_ai_resp = mock.MagicMock(status_code=200, json=lambda: {"choices": [{"message": {"content": mock_content}}]})
        mock_llm_res = mock.MagicMock(content=mock_content)

        with mock.patch("app.ChatGroq.invoke", return_value=mock_llm_res), \
             mock.patch.object(requests, "post", return_value=mock_ai_resp):
            payload = {
                "action": "summarize",
                "content": "ปัญญาประดิษฐ์ (AI) คือวิทยาการคอมพิวเตอร์ที่มุ่งเน้นการสร้างระบบที่คิดและเรียนรู้ได้เหมือนมนุษย์ เช่น Machine Learning และ Deep Learning",
                "difficulty": "intermediate",
                "subject": "วิทยาการคอมพิวเตอร์",
                "username": "test_boss"
            }
            res = client.post("/api/study/generate", json=payload)
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["status"], "success")
            self.assertEqual(data["action"], "summarize")
            self.assertTrue(len(data["result_markdown"]) > 0)
            print("  ✅ [1/5] Study summarize generates structured content")

    def test_02_study_generate_exam_prep(self):
        """Test study generate with exam_prep action"""
        mock_content = "### 🎯 เก็งข้อสอบ & เฉลยละเอียด\n**ข้อ 1 (ปรนัย):** ข้อใดคือกฎข้อที่ 2 ของนิวตัน?\n- ก) วัตถุอยู่นิ่ง\n- ข) F = ma\n- ค) แรงกิริยาเท่ากับแรงปฏิกิริยา\n- ง) งานเท่ากับแรงคูณระยะทาง\n**เฉลย:** ข) เพราะสูตรคือ F=ma"
        mock_ai_resp = mock.MagicMock(status_code=200, json=lambda: {"choices": [{"message": {"content": mock_content}}]})
        mock_llm_res = mock.MagicMock(content=mock_content)

        with mock.patch("app.ChatGroq.invoke", return_value=mock_llm_res), \
             mock.patch.object(requests, "post", return_value=mock_ai_resp):
            payload = {
                "action": "exam_prep",
                "content": "กลศาสตร์นิวตัน กฎข้อที่ 1 แรงลัพธ์เป็นศูนย์วัตถุจะรักษาสภาพการเคลื่อนที่ กฎข้อที่ 2 F = ma กฎข้อที่ 3 แรงกิริยาเท่ากับแรงปฏิกิริยา",
                "difficulty": "basic",
                "subject": "ฟิสิกส์",
                "username": "test_student"
            }
            res = client.post("/api/study/generate", json=payload)
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["status"], "success")
            self.assertEqual(data["action"], "exam_prep")
            self.assertTrue("เก็งข้อสอบ" in data["result_markdown"] or "ข้อสอบ" in data["result_markdown"])
            print("  ✅ [2/5] Study exam_prep generates mock questions & answers")

    def test_03_study_generate_flashcards(self):
        """Test study generate with flashcards action"""
        mock_content = "### 🗂️ Flashcards บัตรคำถาม-คำตอบ\n| บัตรที่ | ด้านหน้า (คำถาม/คำศัพท์) | ด้านหลัง (คำตอบ/คำอธิบาย) |\n| :---: | :--- | :--- |\n| 1 | Photosynthesis คืออะไร? | กระบวนการสังเคราะห์ด้วยแสงของพืช |"
        mock_ai_resp = mock.MagicMock(status_code=200, json=lambda: {"choices": [{"message": {"content": mock_content}}]})
        mock_llm_res = mock.MagicMock(content=mock_content)

        with mock.patch("app.ChatGroq.invoke", return_value=mock_llm_res), \
             mock.patch.object(requests, "post", return_value=mock_ai_resp):
            payload = {
                "action": "flashcards",
                "content": "Photosynthesis คือกระบวนการสังเคราะห์ด้วยแสง Chlorophyll คือสารสีเขียว Stoma คือปากใบ",
                "difficulty": "basic",
                "subject": "ชีววิทยา",
                "username": "test_student"
            }
            res = client.post("/api/study/generate", json=payload)
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["status"], "success")
            self.assertEqual(data["action"], "flashcards")
            print("  ✅ [3/5] Study flashcards generates review cards")

    def test_04_study_history_endpoint(self):
        """Test GET /api/study/history endpoint"""
        res = client.get("/api/study/history?username=test_boss")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertIsInstance(data["history"], list)
        self.assertTrue(len(data["history"]) >= 1)
        print("  ✅ [4/5] Study history retrieves persisted records")

    def test_05_index_html_has_study_elements(self):
        """Test that index.html contains Academic Study Hub markup"""
        res = client.get("/")
        self.assertEqual(res.status_code, 200)
        html = res.text
        self.assertIn("study-hub-modal", html)
        self.assertIn("btn-tools-study-hub", html)
        self.assertIn("study-quick-chips", html)
        self.assertIn("btn-open-study-hub-chip", html)
        print("  ✅ [5/5] index.html contains all Study Co-Pilot UI elements")

if __name__ == "__main__":
    print("==================================================")
    print("🎓 KIRA ACADEMIC & STUDY CO-PILOT TEST SUITE")
    print("==================================================")
    unittest.main()
