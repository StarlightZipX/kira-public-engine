import os
import google.generativeai as genai

# นำเข้า API Key จากไฟล์ที่เกี่ยวข้อง หรือให้ผู้ใช้กรอกตรงนี้
API_KEY = os.environ.get("GEMINI_API_KEY", "ใส่_API_KEY_ของบอสตรงนี้")

print("=======================================")
print("🤖 KIRA AI DIAGNOSTICS & SYSTEM SCAN")
print("=======================================")

if API_KEY == "ใส่_API_KEY_ของบอสตรงนี้" or not API_KEY:
    print("[Error] ไม่พบ API Key กรุณาเปิดไฟล์นี้ด้วย Text Editor แล้วนำ API Key ไปใส่ในบรรทัดที่ 5")
    exit()

print("[1] กำลังเชื่อมต่อกับ Google AI Server...")
genai.configure(api_key=API_KEY)

print("[2] กำลังสแกน 'สมอง' (Models) ทั้งหมดที่ API Key ของบอสมีสิทธิ์ใช้งาน...\n")

try:
    models = genai.list_models()
    supported_models = []
    
    for m in models:
        if 'generateContent' in m.supported_generation_methods:
            supported_models.append(m.name)
            
    if not supported_models:
        print("❌ ไม่พบโมเดลที่รองรับการแชทเลย")
    else:
        print("✅ สมองที่สามารถใช้งานได้ 100% มีดังนี้:")
        for name in supported_models:
            print(f"  - {name}")
            
    print("\n[สรุปผล]")
    if "models/gemini-1.5-pro-latest" in supported_models:
        print("🟢 ยอดเยี่ยม! บอสมีสิทธิ์ใช้งาน 1.5 Pro Latest")
    elif "models/gemini-1.5-pro" in supported_models:
        print("🟢 บอสมีสิทธิ์ใช้งาน 1.5 Pro (Standard)")
    else:
        print("🔴 คำเตือน: API Key ของบอส **ไม่มีสิทธิ์** เข้าถึงตระกูล 1.5 Pro")
        
    if "models/gemini-pro" in supported_models:
        print("🟢 บอสมีสิทธิ์ใช้งาน gemini-pro (ระบบ Fallback สำรองพร้อมทำงาน!)")
        
except Exception as e:
    print(f"❌ เกิดข้อผิดพลาดในการดึงข้อมูลจาก Google: {e}")

print("\n=======================================")
print("✅ สแกนเสร็จสมบูรณ์")
print("=======================================")
