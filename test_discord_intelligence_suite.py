# -*- coding: utf-8 -*-
"""
Test Suite: Discord Bot Social Awareness (Anti-Interruption), Anti-Chatter & 2-Stage Deep Reasoning
ทดสอบระบบ Discord Bot ฉบับปรับปรุง: ไม่แทรกคนคุยกัน, ไม่พูดพร่ำพรือ, คิดวิเคราะห์ลึก 2 ขั้นตอน พร้อมสังเกตบริบทห้องอัตโนมัติ
"""
import asyncio
import sys
import types
import unittest
from types import SimpleNamespace
from unittest.mock import patch

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

import app
import discord
import discord_bot


def _make_fake_channel(channel_id=5001, name="general", is_dm=False):
    if is_dm:
        # Simulate DMChannel check cleanly
        cls = type("FakeDM", (discord.DMChannel,), {})
        ch = object.__new__(cls)
        ch.id = channel_id
        ch.name = "dm"
        return ch
    return SimpleNamespace(id=channel_id, name=name)


def _make_fake_user(uid, name="User", is_bot=False):
    return SimpleNamespace(id=uid, name=name, display_name=name, bot=is_bot)


def _make_fake_message(
    mid,
    content,
    author,
    channel,
    mentions=None,
    role_mentions=None,
    reference=None,
):
    return SimpleNamespace(
        id=mid,
        content=content,
        clean_content=content,
        author=author,
        channel=channel,
        mentions=mentions or [],
        role_mentions=role_mentions or [],
        reference=reference,
        attachments=[],
    )


class TestDiscordIntelligenceSuite(unittest.TestCase):

    def setUp(self):
        discord_bot._room_observations.clear()
        discord_bot._last_bot_reply_target.clear()
        discord_bot.channel_memories.clear()
        self.bot_user = _make_fake_user(999999, "Kira", is_bot=True)
        self.orig_bot_user = getattr(discord_bot.bot, "user", None)
        # Safely set fake bot connection user on internal connection state if needed
        self._conn = getattr(discord_bot.bot, "_connection", None)
        if self._conn is not None:
            self._orig_conn_user = self._conn.user
            self._conn.user = self.bot_user

    def tearDown(self):
        if self._conn is not None:
            self._conn.user = self._orig_conn_user

    def test_1_anti_interruption_social_addressing_gate(self):
        """ต้องไม่แทรกบทสนทนาระหว่างคนอื่น ไม่ว่าใน #general หรือ #kira-chat และตอบเฉพาะเมื่อเรียก/ถามคิระจริง"""
        friend_a = _make_fake_user(101, "Alice")
        friend_b = _make_fake_user(102, "Bob")
        gen_ch = _make_fake_channel(5001, name="ทั่วไป")
        kira_ch = _make_fake_channel(5002, name="คุยกับคิระ")

        # 1) Human A mentions Human B while talking ABOUT Kira -> must IGNORE
        msg_mention_other = _make_fake_message(
            1, "@Bob ดูคิระดิ ชอบแทรกเวลาคุยกัน", friend_a, kira_ch, mentions=[friend_b]
        )
        self.assertFalse(discord_bot._is_addressed_to_kira(msg_mention_other))

        # 2) Raw Discord ID tag mentioning another user in text -> must IGNORE
        msg_raw_other = _make_fake_message(
            2, "<@102> เดี๋ยวเจอกันในเกม", friend_a, kira_ch
        )
        self.assertFalse(discord_bot._is_addressed_to_kira(msg_raw_other))

        # 3) Replying to another human's message -> must IGNORE even if mentions word "คิระ"
        ref_human = SimpleNamespace(
            message_id=10,
            resolved=_make_fake_message(10, "เมื่อกี้ว่าไงนะ", friend_b, gen_ch),
        )
        msg_reply_human = _make_fake_message(
            3, "เมื่อกี้ถามคิระแล้วไม่รู้เรื่องเลย", friend_a, kira_ch, reference=ref_human
        )
        self.assertFalse(discord_bot._is_addressed_to_kira(msg_reply_human))

        # 4) Third-person gossip about Kira without tagging Kira -> must IGNORE
        for gossip in [
            "คิระมันชอบแทรกเวลาเราคุยกันว่ะ",
            "เมื่อกี้คุยกับคิระอยู่เลย ตอบแปลกๆ",
            "ดูคิระดิ 555",
            "ของคิระยังไม่ค่อยแม่นนะ",
        ]:
            m_gossip = _make_fake_message(4, gossip, friend_a, gen_ch)
            self.assertFalse(discord_bot._is_addressed_to_kira(m_gossip), f"Should ignore gossip: {gossip}")

        # 5) Casual buddy banter inside #คุยกับคิระ -> must IGNORE
        for banter in ["เห้ย กินข้าวยัง", "555 จริงดิ", "มึงดูนี่ก่อน", "ไปนอนละ ฝันดี"]:
            m_banter = _make_fake_message(5, banter, friend_a, kira_ch)
            self.assertFalse(discord_bot._is_addressed_to_kira(m_banter), f"Should ignore casual banter: {banter}")

        # 6) Multi-human conversation active in #คุยกับคิระ -> must NOT butt in on un-tagged lines
        discord_bot.record_room_observation(kira_ch.id, friend_a.id, "Alice", "วันนี้อากาศร้อนมากเลยนะเพื่อน")
        msg_b_untagged = _make_fake_message(
            6, "จริงด้วย อากาศแบบนี้ทำเอาคิดงานไม่ออกเลยว่าทำไมร้อนขนาดนี้", friend_b, kira_ch
        )
        self.assertFalse(discord_bot._is_addressed_to_kira(msg_b_untagged))

        # 7) Explicit triggers MUST always respond
        self.assertTrue(discord_bot._is_addressed_to_kira(
            _make_fake_message(7, "ช่วยวิเคราะห์หน่อย", friend_a, gen_ch, mentions=[self.bot_user])
        ))
        self.assertTrue(discord_bot._is_addressed_to_kira(
            _make_fake_message(8, "!kira วิเคราะห์ Redis vs PostgreSQL", friend_a, gen_ch)
        ))
        ref_bot = SimpleNamespace(
            message_id=20,
            resolved=_make_fake_message(20, "คำตอบก่อนหน้า", self.bot_user, gen_ch),
        )
        self.assertTrue(discord_bot._is_addressed_to_kira(
            _make_fake_message(9, "ขยายความข้อ 2 หน่อย", friend_a, gen_ch, reference=ref_bot)
        ))
        self.assertTrue(discord_bot._is_addressed_to_kira(
            _make_fake_message(11, "คิระ ช่วยเปรียบเทียบ FastAPI กับ Django หน่อย", friend_a, gen_ch)
        ))
        self.assertTrue(discord_bot._is_addressed_to_kira(
            _make_fake_message(12, "ขอถามคิระหน่อยว่าทำไม SSD ถึงเสื่อมเร็ว", friend_a, gen_ch)
        ))
        dm_ch = _make_fake_channel(9001, is_dm=True)
        self.assertTrue(discord_bot._is_addressed_to_kira(
            _make_fake_message(13, "สรุปข่าวนี้ที", friend_a, dm_ch)
        ))

    def test_2_anti_chatter_slop_cleanup_and_conciseness(self):
        """ตัดคำเกริ่นน้ำและประโยคปิดท้ายพร่ำพรือออก เหลือเฉพาะสาระตรงประเด็น"""
        noisy_reply = (
            "สวัสดีค่ะ!\n"
            "ได้เลยค่ะ! ยินดีอย่างยิ่งค่ะ\n\n"
            "สาเหตุหลักที่ระบบช้าเกิดจาก N+1 Query บน Database แนะนำให้ใช้ `selectinload()` ค่ะ\n\n"
            "หากมีข้อสงสัยเพิ่มเติมหรือต้องการให้หนูช่วยส่วนไหนสอบถามได้ตลอดเวลาเลยนะคะ 🌸✨💜🙏"
        )
        cleaned = discord_bot.clean_discord_reply(noisy_reply, "ทำไม API ช้า")
        self.assertIn("N+1 Query", cleaned)
        self.assertNotIn("ยินดีอย่างยิ่ง", cleaned)
        self.assertNotIn("หากมีข้อสงสัยเพิ่มเติม", cleaned)
        self.assertNotIn("ตลอดเวลา", cleaned)

        fallback = discord_bot.get_in_character_social_fallback("หมั่นไส้ป่ะ")
        self.assertNotIn("555", fallback)
        self.assertNotIn("ตัวน้อยๆ", fallback)

    def test_3_deep_analytical_2stage_peer_review_and_room_context(self):
        """ตรวจโหมดคิดวิเคราะห์ 2 ขั้นตอน (Draft 120B + Critical Review) และการดึงบริบทห้องเมื่อถูกแท็กถาม"""
        # Simple greeting -> fast single pass
        self.assertFalse(discord_bot._assess_analytical_depth("สวัสดี", is_boss=False))
        # Analytical comparison -> deep 2-stage pass
        self.assertTrue(discord_bot._assess_analytical_depth("วิเคราะห์ข้อดีข้อเสีย Redis กับ Memcached หน่อย", is_boss=False))

        # Populate room observations from silent friend chatter
        discord_bot.record_room_observation(6601, 101, "Alice", "โปรเจกต์เราควรใช้ PostgreSQL หรือ MongoDB ดี")
        discord_bot.record_room_observation(6601, 102, "Bob", "ระบบเรามี Transaction การเงินซับซ้อนด้วยนะ")

        seen_histories = []
        seen_models = []

        async def mock_llm(history, preferred_model, ui_lang="th"):
            seen_histories.append(history)
            seen_models.append(preferred_model)
            if len(seen_models) == 1:
                return True, [
                    "แนะนำให้ใช้ PostgreSQL เนื่องจากรองรับ ACID Transaction สำหรับข้อมูลการเงินโดยตรง "
                    "ส่วน MongoDB เหมาะกับเอกสารที่โครงสร้างเปลี่ยนบ่อย แต่จัดการ Relation การเงินยากกว่า"
                ], ""
            return True, [
                "ฟันธงใช้ **PostgreSQL** ค่ะ เพราะระบบมี Transaction การเงินซับซ้อนซึ่งต้องการ ACID Compliance 100% "
                "ลดความเสี่ยงยอดเงินไม่ตรง (Race Condition) ได้ดีกว่า MongoDB และรองรับ JSONB สำหรับข้อมูลกึ่งโครงสร้างได้ในตัวค่ะ"
            ], ""

        with patch.object(app, "_decide_search", return_value=""), \
             patch.object(app, "_perform_autonomous_deep_search", return_value=("", [])), \
             patch.object(app, "_try_all_keys_and_models", side_effect=mock_llm):
            reply = asyncio.run(
                discord_bot.query_kira_engine(
                    "ช่วยวิเคราะห์ที่คุยกันข้างบนหน่อย ควรเลือกตัวไหนดี",
                    author_name="Alice",
                    channel_id=6601,
                    author_id=101,
                )
            )

        # Must run 2 passes (Draft + Critical Review)
        self.assertEqual(len(seen_models), 2)
        self.assertIn("ACID Compliance", reply)
        # Stage 1 prompt must include silent room observations so Kira knows about PostgreSQL vs MongoDB!
        first_prompt_text = "\n".join(str(getattr(m, "content", "")) for m in seen_histories[0])
        self.assertIn("MongoDB", first_prompt_text)
        self.assertIn("Transaction การเงิน", first_prompt_text)

    def test_4_stage2_graceful_fallback_on_reviewer_failure(self):
        """หาก Stage 2 Critical Reviewer ล้มเหลวหรือโดน timeout ต้องคืนผลจาก Stage 1 อย่างปลอดภัย"""
        calls = {"n": 0}

        async def mock_llm_fail_stage2(history, preferred_model, ui_lang="th"):
            calls["n"] += 1
            if calls["n"] == 1:
                return True, [
                    "สาเหตุของ Latency สูงมาจากการเปิด Connection ใหม่ทุก Request ควรใช้ Connection Pool เพื่อลด TCP/TLS Handshake ค่ะ"
                ], ""
            raise RuntimeError("Simulated reviewer timeout")

        with patch.object(app, "_decide_search", return_value=""), \
             patch.object(app, "_perform_autonomous_deep_search", return_value=("", [])), \
             patch.object(app, "_try_all_keys_and_models", side_effect=mock_llm_fail_stage2):
            reply = asyncio.run(
                discord_bot.query_kira_engine(
                    "ช่วยวิเคราะห์สาเหตุ Latency สูงและวิธีแก้หน่อย",
                    author_name="Tester",
                    channel_id=6602,
                    author_id=202,
                )
            )

        self.assertEqual(calls["n"], 2)
        self.assertIn("Connection Pool", reply)


if __name__ == "__main__":
    unittest.main(verbosity=2)
