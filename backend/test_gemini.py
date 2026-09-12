from dotenv import load_dotenv
import os
import google.generativeai as genai

load_dotenv()

key = os.getenv("GEMINI_API_KEY")

print("KEY FOUND:", key is not None)

genai.configure(api_key=key)

model = genai.GenerativeModel("gemini-2.5-flash")

print("Sending request...")

response = model.generate_content("Say hello")

print(response.text)