import sys
import requests
import json

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"

def test_debate_arena():
    print("==================================================")
    print("🏛️ KIRA 2.2 - LIVE ROUNDTABLE DEBATE ARENA TEST")
    print("==================================================\n")

    # 1. Health check
    print("[1/3] Checking server health...")
    r = requests.get(f"{BASE_URL}/api/health", timeout=5)
    assert r.status_code == 200, f"Health failed: {r.status_code}"
    print("  ✅ Server responsive")

    # 2. Test Debate Stream Endpoint
    print("\n[2/3] Testing POST /api/boardroom/debate with Boss Intervention...")
    payload = {
        "topic": "เราควรสร้าง AI Executive Autonomous Boardroom สำหรับองค์กรขนาดใหญ่หรือไม่?",
        "angle": "aggressive_growth",
        "boss_intervention": "ตัดงบประมาณลง 50% ทันที และต้องส่งมอบ MVP ให้ได้ใน 30 วัน!",
        "username": "boss",
        "session_id": "test_arena_live"
    }

    r = requests.post(f"{BASE_URL}/api/boardroom/debate", json=payload, stream=True, timeout=90)
    assert r.status_code == 200, f"Debate stream failed: {r.status_code}"

    events_received = []
    has_session_start = False
    has_boss_intervention = False
    has_voting_matrix = False
    has_consensus_blueprint = False
    has_session_done = False
    rounds_seen = set()
    speakers_seen = set()

    for line in r.iter_lines(decode_unicode=True):
        if not line:
            continue
        if line.startswith("data:"):
            json_str = line[5:].strip()
            try:
                data = json.loads(json_str)
                event_type = data.get("type")
                events_received.append(event_type)

                if event_type == "session_start":
                    has_session_start = True
                    print(f"  ✅ [session_start] Topic: {data.get('topic')[:40]}... (4 Executives loaded)")
                elif event_type == "round_start":
                    round_num = data.get("round")
                    rounds_seen.add(round_num)
                    print(f"  ✅ [round_start] Round {round_num}: {data.get('title')}")
                elif event_type == "speaker_start":
                    sp = data.get("speaker")
                    speakers_seen.add(sp)
                elif event_type == "boss_intervention":
                    has_boss_intervention = True
                    print(f"  🔨 [boss_intervention] Gavel Struck: '{data.get('instruction')}'")
                elif event_type == "voting_matrix":
                    has_voting_matrix = True
                    matrix = data.get("matrix", [])
                    avg = data.get("average_score")
                    print(f"  ⚖️ [voting_matrix] 4D Matrix received: Average Score {avg}/10 ({len(matrix)} dimensions)")
                elif event_type == "consensus_blueprint":
                    has_consensus_blueprint = True
                    content = data.get("content", "")
                    print(f"  📜 [consensus_blueprint] Blueprint synthesized: {len(content)} characters (Slide Deck Ready: {data.get('can_convert_to_slides')})")
                elif event_type == "session_done":
                    has_session_done = True
                    print(f"  🏁 [session_done] Session concluded: {data.get('summary')[:50]}...")
            except Exception as e:
                pass

    print(f"\n  Total events received: {len(events_received)}")
    assert has_session_start, "Missing session_start event"
    assert len(rounds_seen) == 3, f"Expected 3 rounds, got {rounds_seen}"
    assert set(speakers_seen).issuperset({"CEO", "CFO", "CPO", "CTO"}), f"Missing speakers: {speakers_seen}"
    assert has_boss_intervention, "Missing boss_intervention event"
    assert has_voting_matrix, "Missing voting_matrix event"
    assert has_consensus_blueprint, "Missing consensus_blueprint event"
    assert has_session_done, "Missing session_done event"

    # 3. Check Database Logs
    print("\n[3/3] Checking logs persistence...")
    r = requests.get(f"{BASE_URL}/api/history/boss/test_arena_live", timeout=5)
    assert r.status_code == 200
    history = r.json().get("history", [])
    has_arena_log = any("Boardroom (Live Arena)" in h.get("role", "") for h in history)
    assert has_arena_log, f"Debate Arena session not found in database logs. Got roles: {[h.get('role') for h in history]}"
    print("  ✅ Live Roundtable Arena successfully persisted in SQLite logs!")

    print("\n==================================================")
    print("🎉 ALL ROUNDTABLE DEBATE ARENA TESTS PASSED (100% SUCCESS)!")
    print("==================================================")

if __name__ == "__main__":
    test_debate_arena()
