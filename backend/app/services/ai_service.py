import os
import json
import logging
import google.generativeai as genai
from flask import current_app
from app.services.encryption_service import EncryptionService

logger = logging.getLogger(__name__)

class AIService:
    def __init__(self, user_id):
        self.user_id = user_id

    def _get_setting(self, key, decrypt=False):
        """Setting değerini al - Flask app context içinde çalışır"""
        from app.models.setting import Setting
        try:
            setting = Setting.query.filter_by(user_id=self.user_id, key=key).first()
            if setting and setting.value:
                if decrypt:
                    return EncryptionService.decrypt(setting.value)
                return setting.value
        except Exception as e:
            logger.error(f"Setting okuma hatası ({key}): {e}")
        return None

    def _get_api_key(self):
        return self._get_setting('AI_API_KEY', decrypt=True)

    def generate_test_cases(self, summary, description, comments, user_instruction=None, images=None):
        api_key = self._get_api_key()
        if not api_key:
            logger.error("AI_API_KEY not found for user")
            return {'test_cases': [], 'automation_candidates': []}

        def get_bool_setting(key):
            val = self._get_setting(key)
            return val and val.lower() == 'true'

        vision_enabled = get_bool_setting('AI_VISION_ENABLED')
        auto_enabled = get_bool_setting('AI_AUTOMATION_ENABLED')
        neg_enabled = get_bool_setting('AI_NEGATIVE_ENABLED')
        mock_enabled = get_bool_setting('AI_MOCKDATA_ENABLED')


        genai.configure(api_key=api_key)
        # models/gemini-2.0-flash - list_models() ile doğrulanmış mevcut model
        model = genai.GenerativeModel('models/gemini-2.0-flash')







        # Robot Framework örnek kod (f-string'de \\n kullanılamaz)
        rf_example = """*** Test Cases ***
Test Case Name
    Open Browser    ${URL}    chrome
    Input Text    id=username    ${USERNAME}
    Click Button    id=submit
    Page Should Contain    Success"""

        auto_instruction = f"Her test case için Robot Framework otomasyon kodu ('automation_script' alanı) üret. SeleniumLibrary keyword'lerini kullan. Örnek format: {rf_example}" if auto_enabled else ""
        neg_instruction = "Negatif test senaryoları ve edge-case'leri de dahil et. 'edge_cases' alanına liste olarak ekle." if neg_enabled else "SADECE işlevsel senaryolara odaklan."
        mock_instruction = "Adımlarda kullanılabilecek gerçekçi mock veriler ('mock_data' alanı) JSON formatında hazırla." if mock_enabled else ""
        vision_instruction = "Jira ekindeki görselleri (Vision) analiz et ve adımları görsellere göre zenginleştir." if vision_enabled else ""

        rf_instruction = f"Her test case için Robot Framework otomasyon kodu üret. SeleniumLibrary kullan. Örnek:\n{rf_example}" if auto_enabled else ""
        
        # 1. Sabit Sistem Talimatı (Gelişmiş Seviye)
        base_system_prompt = f"""
        Sektör standartlarında, profesyonel bir QA ve Otomasyon Mühendisi olarak Jira verilerini analiz et.
        
        GÖREVİN:
        1. Jira açıklamasını (description) "Ana Senaryo (TC01)" olarak değerlendir.
        2. Yorumlarda (comments) elle yazılmış veya belirtilmiş TÜM test caselerini ayıkla (TC02, TC03... şeklinde devam ettir).
        3. Bu mevcut caselere ek olarak, sistemin kararlılığını artıracak kendi özgün AI test senaryolarını da ekle.
        4. OLUŞTURDUĞUN BU TÜM BİRLEŞİK LİSTE (Açıklama + Yorumlar + AI Önerileri) içinden otomasyona (Robot Framework/Selenium) en uygun ve kritik olanları seçerek "automation_candidates" listesine ekle.
        
        ÇIKTI FORMATI:
        Yanıtın SADECE aşağıdaki yapıda bir JSON objesi olmalıdır:
        {{
            "test_cases": [
                {{
                    "name": "TC01: Başlık",
                    "scenario": "Adım adım test adımları (Türkçe ve düz metin)",
                    "expected_result": "Beklenen sonuç",
                    "status": "NO RUN",
                    "mock_data": { "JSON objesi veya null" if mock_enabled else "null" },
                    "edge_cases": [ { "Negatif senaryo listesi" if neg_enabled else "" } ]
                }}
            ],
            "automation_candidates": [
                "Seçtiğin otomasyon adaylarının isimleri (Örn: ['TC01: ...', 'TC03: ...'])"
            ]
        }}
        
        TEMEL KURALLAR:
        1. KESİNLİKLE Robot Framework kodu (automation_script) üretme.
        2. "name" alanındaki "TC" ifadesi her zaman büyük harf olmalıdır.
        3. Yanıt içerisinde JSON haricinde hiçbir açıklama veya markdown karakteri bulunmamalıdır.
        4. "automation_candidates" listesini hazırlarken hem kullanıcıdan gelen (açıklama/yorum) hem de senin eklediğin senaryoları kapsadığından emin ol.
        5. {"Görselleri (Vision) analiz et ve adımları görsellere göre zenginleştir." if vision_enabled else ""}
        """

        # 2. Kullanıcı Talimatı
        instruction = user_instruction if user_instruction and user_instruction.strip() else "Jira yorumlarındaki caseleri en başa al, üzerine kendi analizini ekle."
        
        # 3. Final Prompt
        final_prompt = f"{base_system_prompt}\n\nEKSTRA TALİMATLAR:\n{instruction}"
        
        input_data = f"""
        Jira Verileri:
        Özet: {summary}
        Açıklama: {description}
        Yorumlar: {comments}
        """

        # Gemini'ye gönderilecek içerik listesi
        contents = [final_prompt, input_data]

        # Vision aktifse ve görsel varsa ekle
        if vision_enabled and images:
            for img_b64 in images:
                if "," in img_b64:
                    img_data = img_b64.split(",")[1]
                else:
                    img_data = img_b64
                contents.append({'mime_type': 'image/jpeg', 'data': img_data})

        try:
            # Basitleştirilmiş generation config
            response = model.generate_content(
                contents,
                generation_config={"temperature": 0.2}
            )

            response_text = response.text.strip()
            # Markdown temizliği
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()

            logger.info(f"--- AI RAW RESPONSE ---\n{response_text}\n--- END AI RESPONSE ---")
            
            ai_data = json.loads(response_text)
            
            # Yanıt bir obje olmalı: {"test_cases": [], "automation_candidates": []}
            raw_cases = ai_data.get('test_cases', [])
            candidates = ai_data.get('automation_candidates', [])
            
            if isinstance(raw_cases, list):
                sanitized_cases = []
                for case in raw_cases:
                    # Temel alanlar
                    item = {
                        'name': case.get('name', 'Unnamed Test Case'),
                        'scenario': case.get('scenario', 'No scenario provided'),
                        'expected_result': case.get('expected_result', 'No expected result provided'),
                        'status': case.get('status', 'NO RUN'),
                        'mock_data': case.get('mock_data'),
                        'edge_cases': case.get('edge_cases', []),
                        'is_automation_candidate': any(case.get('name', '') in c for c in candidates)
                    }
                    
                    # Testmo için scenario alanına yediriyoruz (Sync sırasında kullanılacak)
                    # Artık kod gönderilmiyor (Kullanıcı isteği)
                    extra_info = ""
                    if mock_enabled and item['mock_data']:
                        m_data = item['mock_data']
                        if isinstance(m_data, (dict, list)):
                            m_data = json.dumps(m_data, indent=2, ensure_ascii=False)
                        extra_info += f"\n\n**[TEST DATA]**\n{m_data}"
                    
                    if extra_info:
                        item['scenario'] += extra_info
                        
                    sanitized_cases.append(item)
                
                # Frontend için automation_candidates bilgisini ilk case'e veya ayrı bir meta olarak ekleyebiliriz
                # Şimdilik listeyi döndürelim, sync.py bunu işleyecek
                return {
                    'test_cases': sanitized_cases,
                    'automation_candidates': candidates
                }
            return {'test_cases': [], 'automation_candidates': []}
        except Exception as e:
            logger.error(f"AI Generation Error: {e}")
            return {'test_cases': [], 'automation_candidates': []}


