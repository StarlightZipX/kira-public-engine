import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

API_KEY = os.environ.get("GEMINI_API_KEY", "")
print("Testing models with API Key (masked):", API_KEY[:5] + "..." if API_KEY else "NONE")

models_to_test = [
    "gemini-pro",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro",
    "gemini-1.5-pro-latest"
]

for model_name in models_to_test:
    try:
        llm = ChatGoogleGenerativeAI(model=model_name, temperature=0.7)
        response = llm.invoke([HumanMessage(content="Hello")])
        print(f"[SUCCESS] {model_name} works! Response: {response.content}")
    except Exception as e:
        print(f"[FAILED] {model_name} failed. Error: {e}")
