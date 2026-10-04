import sys
import os
import unittest
import asyncio
import time
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# Import components from app
import app
from app import (
    provider_monitor,
    UnifiedLLM,
    _try_all_keys_and_models,
    _synthesize_autonomous_emergency_response,
    scrub_sensitive_output,
    GEMINI_API_KEYS,
    OPENROUTER_API_KEYS,
    API_KEYS
)
from langchain_core.messages import HumanMessage, SystemMessage

class TestFallbackResilienceSuite(unittest.TestCase):

    def test_1_provider_monitor_circuit_breaker(self):
        """1. ตรวจสอบการทำงานของ Circuit Breaker และการจำกัด Key Cooldown"""
        print("\n[1/5] Testing Circuit Breaker & Key Cooldown Logic...")
        
        test_key = "gsk_test_fake_exhausted_key_12345"
        provider = "groq"
        
        # Initially available
        self.assertTrue(provider_monitor.is_available(provider, test_key))
        
        # Simulate 429 Rate Limit error
        provider_monitor.mark_failure(provider, test_key, "429 Rate Limit Exceeded", cooldown_seconds=60)
        
        # Key should now be in cooldown
        self.assertFalse(provider_monitor.is_available(provider, test_key))
        
        # Summary should report active cooldown
        summary = provider_monitor.get_summary()
        self.assertTrue(summary["circuit_breaker_active"])
        print("  ✅ Circuit Breaker accurately detected failure and quarantined exhausted key for 60s")
        
        # Mark success (recovery)
        provider_monitor.mark_success(provider, test_key)
        self.assertTrue(provider_monitor.is_available(provider, test_key))
        print("  ✅ Key successfully recovered and reinstated after recovery")

    def test_2_unified_llm_multi_provider_routing(self):
        """2. ตรวจสอบ UnifiedLLM Gateway Routing รองรับ Groq, OpenRouter, Gemini และ Ollama"""
        print("\n[2/5] Testing UnifiedLLM Provider Auto-Detection & Endpoint Binding...")
        
        # Test Groq routing
        llm_groq = UnifiedLLM("llama-3.3-70b-versatile")
        self.assertEqual(llm_groq.provider, "groq")
        self.assertIn("api.groq.com", llm_groq.base_url)
        print("  ✅ Groq routed to api.groq.com")
        
        # Test OpenRouter routing
        llm_or = UnifiedLLM("qwen/qwen-2.5-72b-instruct")
        self.assertEqual(llm_or.provider, "openrouter")
        self.assertIn("openrouter.ai", llm_or.base_url)
        print("  ✅ OpenRouter routed to openrouter.ai")
        
        # Test Gemini routing
        llm_gemini = UnifiedLLM("gemini-1.5-flash", provider="gemini")
        self.assertEqual(llm_gemini.provider, "gemini")
        self.assertIn("generativelanguage.googleapis.com", llm_gemini.base_url)
        print("  ✅ Google Gemini routed to generativelanguage.googleapis.com REST v1beta")
        
        # Test Local Ollama routing
        llm_ollama = UnifiedLLM("llama3.2", provider="ollama")
        self.assertEqual(llm_ollama.provider, "ollama")
        self.assertIn("11434", llm_ollama.base_url)
        print("  ✅ Local Ollama routed to local GPU port 11434")

    def test_3_autonomous_emergency_response_synthesizer(self):
        """3. ตรวจสอบ Autonomous Emergency Response Synthesizer เมื่อคลาวด์ภายนอกตัดการเชื่อมต่อ"""
        print("\n[3/5] Testing Autonomous Emergency Response Synthesizer...")
        
        history = [
            SystemMessage(content="You are Kira AI."),
            HumanMessage(content="สวัสดีตอนเช้าครับคิระ")
        ]
        
        chunks = _synthesize_autonomous_emergency_response(history, "Simulated Multi-Cloud Outage 503")
        self.assertTrue(len(chunks) > 0)
        full_text = "".join(chunks)
        
        # Check Thai politeness and resilience tags
        self.assertIn("คิระ", full_text)
        self.assertIn("ค่ะ", full_text)
        self.assertIn("Kira Neural Resilience", full_text)
        print("  ✅ Autonomous Emergency Synthesizer produced resilient, polite response with zero crash")

    def test_4_scrub_sensitive_output_gemini_keys(self):
        """4. ตรวจสอบ Output Scrubber ครอบคลุม Google/Gemini API Key Format (AIza...)"""
        print("\n[4/5] Testing Sensitive Key Sanitization for Google AI Studio Keys...")
        
        fake_gemini_key = "AIzaSyD-738927498237498237498237498237"
        raw_text = f"Warning: Connection error with key {fake_gemini_key} on Google cluster"
        scrubbed = scrub_sensitive_output(raw_text)
        
        self.assertNotIn(fake_gemini_key, scrubbed)
        self.assertIn("[REDACTED_GEMINI_KEY]", scrubbed)
        print("  ✅ Google Gemini Key (AIza...) successfully redacted by Output Scrubber")

    def test_5_system_providers_endpoint(self):
        """5. ตรวจสอบ Endpoint /api/system/providers ผ่าน FastAPI TestClient"""
        print("\n[5/5] Testing GET /api/system/providers endpoint...")
        from fastapi.testclient import TestClient
        client = TestClient(app.app)
        
        resp = client.get("/api/system/providers")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        
        self.assertEqual(data.get("status"), "online")
        self.assertEqual(data.get("resilience_mesh"), "active")
        providers = data.get("providers", {})
        self.assertIn("groq", providers)
        self.assertIn("openrouter", providers)
        self.assertIn("gemini", providers)
        self.assertIn("ollama", providers)
        self.assertIn("autonomous_offline", providers)
        self.assertIn("circuit_breaker", data)
        print("  ✅ GET /api/system/providers returned full resilience matrix and provider telemetry")

if __name__ == "__main__":
    unittest.main()
