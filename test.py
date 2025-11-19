import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

# --- AYARLAR ---
PROJECT_ID = 1  # Proje ID (1 veya 15, hangisi çalışıyorsa)
FOLDER_ID = 14863  # Klasör (Group) ID
# ----------------

BASE_URL = (os.getenv('TESTMO_BASE_URL') or '').rstrip('/')
if not BASE_URL.endswith('/api/v1'): BASE_URL += '/api/v1'
API_KEY = os.getenv('TESTMO_API_KEY')

headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json',
    'Accept': 'application/json'
}

url = f"{BASE_URL}/projects/{PROJECT_ID}/cases"

print(f"🚀 İSTEK: {url}")

# SENİN GÖNDERDİĞİN FORMAT
payload = {
    "cases": [
        {
            "name": "Python Script Test Case",
            "folder_id": int(FOLDER_ID),
            "template_id": 2,  # 2 Genelde 'Steps' şablonudur
            "state_id": 2,  # Taslak veya Ready olabilir
            "priority_id": 2,  # Normal
            "estimate": 0,

            # Jira Açıklaması Buraya
            "custom_description": "<p>Bu case Python script ile oluşturuldu.</p>",

            # Adımlar Buraya
            "custom_steps": [
                {
                    "text1": "<p>Login sayfasına git</p>",  # Step
                    "text3": "<p>Sayfa açılmalı</p>"  # Expected
                },
                {
                    "text1": "<p>Kullanıcı adı gir</p>",
                    "text3": "<p>Giriş yapılmalı</p>"
                }
            ]
        }
    ]
}

print(f"📦 Payload Hazırlandı...")

try:
    r = requests.post(url, headers=headers, json=payload)

    print(f"📡 Status Code: {r.status_code}")
    if r.status_code in [200, 201]:
        print("✅ BAŞARILI! Case oluşturuldu.")
        print(json.dumps(r.json(), indent=2))
    else:
        print("❌ HATA:")
        print(r.text)

except Exception as e:
    print(f"Hata: {e}")