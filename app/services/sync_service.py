import requests
import re
import html
import base64
import io
from PIL import Image
from concurrent.futures import ThreadPoolExecutor, as_completed
from app.models.setting import Setting
from app.services.encryption_service import EncryptionService


class QuickCaseSyncService:
    def __init__(self, user_id):
        self.user_id = user_id
        self.session = requests.Session()
        self._setup_config()

    def _get_setting(self, key):
        s = Setting.query.filter_by(user_id=self.user_id, key=key).first()
        if s and s.value:
            return EncryptionService.decrypt(s.value)
        return ""

    def _setup_config(self):
        # Ayarları çek
        testmo_key = self._get_setting("TESTMO_API_KEY")
        jira_email = self._get_setting("JIRA_EMAIL")
        jira_token = self._get_setting("JIRA_API_TOKEN")

        # URL Düzeltmeleri
        self.jira_url = self._get_setting("JIRA_BASE_URL").rstrip('/')
        if self.jira_url and not self.jira_url.startswith('http'):
            self.jira_url = f"https://{self.jira_url}"

        self.testmo_url = self._get_setting("TESTMO_BASE_URL").rstrip('/')
        if self.testmo_url and not self.testmo_url.startswith('http'):
            self.testmo_url = f"https://{self.testmo_url}"
        if not self.testmo_url.endswith('/api/v1'):
            self.testmo_url += '/api/v1'

        # Session Header Ayarları
        self.headers = {
            'Authorization': f'Bearer {testmo_key}',
            # 'Content-Type': 'application/json', # Attachment upload için bunu dinamik yapacağız
            'Accept': 'application/json'
        }
        self.session.headers.update(self.headers)
        self.jira_auth = (jira_email, jira_token)

    def image_to_base64(self, image_content):
        if not image_content: return None
        try:
            img = Image.open(io.BytesIO(image_content))
            if img.mode in ("RGBA", "P"): img = img.convert("RGB")

            if img.width > 800:
                ratio = 800 / float(img.width)
                new_height = int((float(img.height) * float(ratio)))
                img = img.resize((800, new_height), Image.Resampling.LANCZOS)

            buffer = io.BytesIO()
            img.save(buffer, format="JPEG", quality=65, optimize=True)
            b64_str = base64.b64encode(buffer.getvalue()).decode('utf-8')
            return f"data:image/jpeg;base64,{b64_str}"
        except:
            return None

    def get_issue(self, key):
        try:
            r = self.session.get(f"{self.jira_url}/rest/api/3/issue/{key}", auth=self.jira_auth,
                                 params={'expand': 'renderedFields'})
            if r.status_code == 200:
                d = r.json()
                return {
                    'summary': d.get('fields', {}).get('summary', ''),
                    'description_html': d.get('renderedFields', {}).get('description', '')
                }
        except:
            pass
        return {'summary': '', 'description_html': ''}

    def get_comments(self, key):
        try:
            return self.session.get(f"{self.jira_url}/rest/api/3/issue/{key}/comment", auth=self.jira_auth,
                                    params={'expand': 'renderedBody'}).json().get('comments', [])
        except:
            return []

    def get_attachments(self, key):
        try:
            r = self.session.get(f"{self.jira_url}/rest/api/3/issue/{key}", auth=self.jira_auth)
            atts = []
            for a in r.json().get('fields', {}).get('attachment', []):
                if a.get('mimeType', '').startswith('image/'):
                    atts.append({'url': a['content'], 'mime': a['mimeType'], 'filename': a['filename']})
            return atts
        except:
            return []

    def add_jira_comment(self, key, case_name):
        url = f"{self.jira_url}/rest/api/3/issue/{key}/comment"
        msg = f"✅ VeloxCase: Testmo aktarımı tamamlandı.\nOluşturulan Case: {case_name}"
        payload = {"body": {"type": "doc", "version": 1,
                            "content": [{"type": "paragraph", "content": [{"text": msg, "type": "text"}]}]}}
        try:
            # JSON post ederken content-type ekle
            self.session.post(url, json=payload, auth=self.jira_auth, headers={'Content-Type': 'application/json'})
        except:
            pass

    def parse_cases(self, html_txt):
        clean_text = re.sub(r'<[^>]+>', '', html_txt)
        clean_text = html.unescape(clean_text)
        cases = []
        pattern = r'TC(\d+)[ -]*(.+?):.*?Senaryo:\s*(.+?)\s*Beklenen Sonuç:\s*(.+?)\s*Durum:\s*(PASSED|FAILED)'
        for m in re.finditer(pattern, clean_text, re.DOTALL | re.IGNORECASE):
            cases.append({
                'name': f"TC{m.group(1).strip()} - {m.group(2).strip()}",
                'scenario': m.group(3).strip(),
                'expected_result': m.group(4).strip(),
                'status': m.group(5).strip().upper()
            })
        return cases

    def extract_imgs_from_html(self, html_content):
        return re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', html_content)

    def download_image(self, u, j=False):
        try:
            u = u.replace('&amp;', '&')
            if u.startswith('/'): u = f"{self.jira_url}{u}"
            r = self.session.get(u, auth=self.jira_auth if j else None, stream=True)
            if r.status_code == 200 and 'text/html' not in r.headers.get('Content-Type', '').lower():
                return r.content
        except:
            pass
        return None

    def get_folders(self, pid):
        try:
            r = self.session.get(f"{self.testmo_url}/projects/{pid}/folders",
                                 headers={'Content-Type': 'application/json'})
            d = r.json()
            return d.get('result', d.get('name', []))
        except:
            return []

    def create_folder(self, pid, name, prid=None):
        pl = {"name": name}
        if prid: pl["parent_id"] = int(prid)
        return self.session.post(f"{self.testmo_url}/projects/{pid}/folders", json={"folders": [pl]},
                                 headers={'Content-Type': 'application/json'}).json().get('data', {})

    # YENİ: Testmo'ya Dosya Yükleme Fonksiyonu
    def upload_attachment_to_case(self, case_id, file_content, filename="screenshot.jpg"):
        try:
            url = f"{self.testmo_url}/attachments"
            # Multipart upload için 'files' parametresi kullanılır
            # 'entity_id' ve 'entity_type' Testmo API'sinde attachment'ı bir nesneye bağlamak için gerekebilir.
            # Ancak Testmo API dökümanına göre genellikle önce upload edilir, sonra dönen ID kullanılır.
            # Fakat bazı implementasyonlarda direkt entity_id ile gönderilir.
            # Testmo API dökümanına göre doğru yöntem: POST /api/v1/attachments ile yükle, dönen ID'yi case'e ekle DEĞİL
            # Testmo'da genellikle "case_id" parametresi form data içinde gönderilir.

            files = {
                'file': (filename, file_content, 'image/jpeg')
            }
            data = {
                'entity_id': case_id,
                'entity_type': 'case'  # case, run, result vb.
            }

            # Multipart request olduğu için Content-Type header'ını requests kütüphanesine bırakıyoruz (kendisi boundary ekler)
            # Bu yüzden session header'ındaki 'Content-Type': 'application/json' çakışma yapabilir.
            # O yüzden bu istek özelinde header'ı override ediyoruz.
            custom_headers = self.headers.copy()
            if 'Content-Type' in custom_headers:
                del custom_headers['Content-Type']

            r = self.session.post(url, files=files, data=data, headers=custom_headers)
            return r.status_code == 201 or r.status_code == 200
        except Exception as e:
            print(f"Upload error: {e}")
            return False

    def create_case_embedded(self, pid, fid, info, steps, jira_key):
        # Base64 resim gömme işlemini kaldırdık veya sadece description için bıraktık.
        # Ekleri ayrı yükleyeceğiz.
        desc_html = info['description_html']

        # Description içindeki resimleri base64 yapmaya devam edebiliriz (görsel bütünlük için)
        # Ama asıl dosyalar attachment olarak eklenecek.
        desc_img_urls = self.extract_imgs_from_html(desc_html)
        for img_url in desc_img_urls:
            is_jira = "atlassian" in img_url or "/rest/" in img_url or "/secure/" in img_url
            img_content = self.download_image(img_url, is_jira)
            if img_content:
                b64_src = self.image_to_base64(img_content)
                if b64_src: desc_html = desc_html.replace(img_url, b64_src)

        f_steps = []
        for step in steps:
            f_steps.append({
                "text1": f"<p><strong>{step['name']}</strong></p><p>{step['scenario']}</p>",
                "text3": f"<p>{step['expected_result']}</p><p><em>Status: {step['status']}</em></p>"
            })

        pl = {
            "name": info['summary'],
            "folder_id": int(fid),
            "template_id": 2,
            "state_id": 4,
            "priority_id": 2,
            "estimate": 0,
            "issue_ids": [jira_key],
            "custom_description": desc_html,
            "custom_steps": f_steps
        }

        r = self.session.post(f"{self.testmo_url}/projects/{pid}/cases", json={"cases": [pl]},
                              headers={'Content-Type': 'application/json'})

        if r.status_code in [200, 201]:
            d = r.json()
            # Case ID'sini döndür (Result içinde veya cases içinde olabilir)
            if 'result' in d and d['result']: return d['result'][0]  # Genellikle bulk create sonucu liste döner
            if 'cases' in d and d['cases']: return d['cases'][0]
            return d  # Fallback
        return None

    def process_single_task(self, key, pid, fid):
        result = {'task': key, 'status': 'error', 'msg': '', 'case_name': ''}
        try:
            info = self.get_issue(key)
            if not info['summary']:
                result['msg'] = 'Task bulunamadı'
                return result

            steps = []
            for c in self.get_comments(key):
                b = c.get('renderedBody', c.get('body', ''))
                if b: steps.extend(self.parse_cases(b))

            # Attachments (Ekler) İndir - Resim içeriklerini hafızada tut
            attachments = self.get_attachments(key)
            downloaded_images = []  # (content, filename) listesi

            if attachments:
                with ThreadPoolExecutor(max_workers=5) as executor:
                    # download_image artık content dönüyor
                    future_to_att = {executor.submit(self.download_image, att['url'], True): att for att in attachments}
                    for future in as_completed(future_to_att):
                        att = future_to_att[future]
                        if img_content := future.result():
                            # Sadece içerik değil, dosya adını da sakla
                            downloaded_images.append((img_content, att.get('filename', 'image.jpg')))

            # 1. Case Oluştur (Resimler henüz yok, sadece text)
            # create_case_embedded artık images_b64 parametresini description için opsiyonel kullanıyor
            # ama biz asıl yüklemeyi sonraya bıraktık.
            created_case = self.create_case_embedded(pid, fid, info, steps, key)

            if created_case and 'id' in created_case:
                case_id = created_case['id']
                case_name = info['summary']

                # 2. Resimleri Attachment Olarak Yükle
                upload_count = 0
                if downloaded_images:
                    with ThreadPoolExecutor(max_workers=3) as executor:
                        futures = [executor.submit(self.upload_attachment_to_case, case_id, img_data[0], img_data[1])
                                   for img_data in downloaded_images]
                        for future in as_completed(futures):
                            if future.result(): upload_count += 1

                # 3. Jira Yorumu ve Sonuç
                self.add_jira_comment(key, case_name)
                result.update(
                    {'status': 'success', 'case_name': case_name, 'images': upload_count, 'steps': len(steps)})
            else:
                result['msg'] = 'Case oluşturulamadı'
        except Exception as e:
            result['msg'] = str(e)
        return result