import os
import sys
import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

WORKSPACE = r"c:\Users\ASUS\Desktop\Kira_AI_System\2_Kira_Public_Web"
sys.path.insert(0, WORKSPACE)
os.chdir(WORKSPACE)

from app import (
    app,
    get_ollama_endpoints,
    get_active_ollama_models,
    _try_all_keys_and_models,
    OllamaConfigRequest,
)


class TestAntiFragileLocalFailover(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_1_get_ollama_endpoints_normalization(self):
        """Test URL normalization handles root, /v1, and trailing slashes correctly"""
        ep1 = get_ollama_endpoints("http://localhost:11434")
        self.assertEqual(ep1["root"], "http://localhost:11434")
        self.assertEqual(ep1["tags"], "http://localhost:11434/api/tags")
        self.assertEqual(ep1["chat"], "http://localhost:11434/v1/chat/completions")

        ep2 = get_ollama_endpoints("http://127.0.0.1:11434/v1/")
        self.assertEqual(ep2["root"], "http://127.0.0.1:11434")
        self.assertEqual(ep2["tags"], "http://127.0.0.1:11434/api/tags")
        self.assertEqual(ep2["chat"], "http://127.0.0.1:11434/v1/chat/completions")

        print("  ✅ [Passed] get_ollama_endpoints URL normalization verified")

    def test_2_api_ollama_status_and_config(self):
        """Test GET /api/ollama/status and POST /api/ollama/config endpoints"""
        # Test GET status (offline scenario)
        res = self.client.get("/api/ollama/status?url=http://127.0.0.1:65530")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("status", data)
        self.assertEqual(data["status"], "offline")

        # Test POST config
        cfg_res = self.client.post("/api/ollama/config", json={"url": "http://localhost:11434"})
        self.assertEqual(cfg_res.status_code, 200)
        self.assertEqual(cfg_res.json()["status"], "success")

        print("  ✅ [Passed] /api/ollama/status & /api/ollama/config endpoints verified")

    @patch("app.requests.get")
    def test_3_get_active_ollama_models_online(self, mock_get):
        """Test get_active_ollama_models parses installed models when Ollama is online"""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "models": [
                {"name": "llama3.2:latest"},
                {"name": "qwen2.5:7b"},
                {"name": "deepseek-r1:8b"}
            ]
        }
        mock_get.return_value = mock_resp

        models = get_active_ollama_models(custom_url="http://mock-ollama:11434")
        self.assertIn("llama3.2:latest", models)
        self.assertIn("qwen2.5:7b", models)
        self.assertIn("deepseek-r1:8b", models)
        print("  ✅ [Passed] get_active_ollama_models dynamically discovers installed local models")

    @patch("app.get_active_ollama_models")
    @patch("app._execute_single_attempt")
    async def _async_failover_test(self, mock_exec, mock_active):
        mock_active.return_value = ["llama3.2"]

        # Simulate cloud providers failing (e.g. connection cut / rate limit)
        # and ollama succeeding on failover
        async def mock_exec_impl(provider, model_name, key, history):
            if provider in ("groq", "openrouter", "gemini"):
                raise ConnectionError(f"Cloud provider {provider} connection dropped (cable cut simulation)")
            elif provider == "ollama":
                return ["สวัสดีค่ะ ฉันประมวลผลคำตอบจาก Local GPU ในเครื่องให้บอสเรียบร้อยค่ะ"]
            raise Exception("Unknown provider")

        mock_exec.side_effect = mock_exec_impl

        from app import HumanMessage
        history = [HumanMessage(content="ทดสอบการสลับลง Local GPU")]
        success, chunks, err = await _try_all_keys_and_models(history, preferred_model="qwen/qwen3.8-27b", ui_lang="th")

        self.assertTrue(success)
        full_text = "".join(chunks)
        self.assertIn("Local GPU/Ollama สำเร็จ", full_text)
        self.assertIn("ประมวลผลคำตอบจาก Local GPU", full_text)
        print("  ✅ [Passed] Seamless auto-failover to Local GPU on cloud network disruption verified")

    def test_4_auto_failover_simulation(self):
        """Run async failover test verifying Anti-Fragile banner injection"""
        import asyncio
        asyncio.run(self._async_failover_test())


if __name__ == "__main__":
    unittest.main()

