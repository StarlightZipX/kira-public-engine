import os
import time
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    print("❌ ERROR: Please set GEMINI_API_KEY environment variable before running this test.")
    exit(1)

print(f"🔑 Testing with API Key (masked): {API_KEY[:5]}...{API_KEY[-5:] if len(API_KEY)>10 else ''}")

# Stable models
llm_1_0 = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.7)
llm_1_1 = ChatGoogleGenerativeAI(model="gemini-1.5-pro", temperature=0.8)

test_questions = [
    # ง่ายๆ ทั่วไป
    "สวัสดี แนะนำตัวหน่อย",
    "1+1 เท่ากับเท่าไร?",
    "แมวร้องยังไง?",
    "วันนี้อากาศดีไหม?",
    "พูดคำว่า 'คิระเก่งมาก' ให้หน่อย",
    # ระดับกลาง
    "ช่วยสรุปประวัติศาสตร์สงครามโลกครั้งที่ 2 ภายใน 3 บรรทัด",
    "เขียนโค้ด Python สำหรับคำนวณ Fibonacci แบบ Recursive หน่อย",
    # ยากสุดๆ
    "จงอธิบายทฤษฎีควอนตัมเอนแทงเกิลเมนต์ (Quantum Entanglement) แบบเข้าใจง่ายๆ สำหรับเด็ก 5 ขวบ",
    "สมมติว่าโลกหยุดหมุนกะทันหัน จะเกิดผลกระทบทางฟิสิกส์อะไรบ้างกับมนุษย์?",
    "เขียนบทกวีไฮกุ (Haiku) ภาษาไทย เกี่ยวกับ AI ที่มีความรู้สึก"
]

def run_test(llm, model_name, questions):
    print(f"\n{'='*50}\n🚀 เริ่มต้นการทดสอบ: {model_name}\n{'='*50}")
    success_count = 0
    for i, q in enumerate(questions):
        print(f"\n[คำถาม {i+1}/10]: {q}")
        try:
            start_time = time.time()
            response = llm.invoke([HumanMessage(content=q)])
            elapsed = time.time() - start_time
            print(f"✅ [ผ่าน] (ใช้เวลา {elapsed:.2f} วินาที)\nตอบ: {response.content[:100]}...\n")
            success_count += 1
        except Exception as e:
            print(f"❌ [ล้มเหลว]: {e}")
        time.sleep(1) # กัน rate limit เล็กน้อย
    
    print(f"\n🎯 สรุปผล {model_name}: ผ่าน {success_count}/{len(questions)}")
    return success_count

print("เริ่มการทดสอบ 10 ข้อ (Deep Test)...")
score_1_0 = run_test(llm_1_0, "🤖 Kira 1.0 (gemini-1.5-flash)", test_questions)
score_1_1 = run_test(llm_1_1, "✨ Kira 1.1 (gemini-1.5-pro)", test_questions)

print("\n" + "="*50)
if score_1_0 == 10 and score_1_1 == 10:
    print("🏆 SUCCESS: การทดสอบผ่านฉลุย 100% ไม่มี Error 404 แล้ว!")
else:
    print("⚠️ WARNING: พบข้อผิดพลาดระหว่างทดสอบ")
print("="*50)
