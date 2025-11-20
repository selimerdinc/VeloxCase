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
            'Content-Type': 'application/json',
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
                    atts.append({'url': a['content'], 'mime': a['mimeType']})
            return atts
        except:
            return []

    def add_jira_comment(self, key, case_name):
        url = f"{self.jira_url}/rest/api/3/issue/{key}/comment"
        msg = f"✅ VeloxCase: Testmo aktarımı tamamlandı.\nOluşturulan Case: {case_name}"
        payload = {"body": {"type": "doc", "version": 1,
                            "content": [{"type": "paragraph", "content": [{"text": msg, "type": "text"}]}]}}
        try:
            self.session.post(url, json=payload, auth=self.jira_auth)
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
            r = self.session.get(f"{self.testmo_url}/projects/{pid}/folders")
            d = r.json()
            return d.get('result', d.get('name', []))
        except:
            return []

    def create_folder(self, pid, name, prid=None):
        pl = {"name": name}
        if prid: pl["parent_id"] = int(prid)
        return self.session.post(f"{self.testmo_url}/projects/{pid}/folders", json={"folders": [pl]}).json().get('data',
                                                                                                                 {})

    # GÜNCELLENDİ: jira_key parametresi ile Testmo 'refs' alanını doldurur
    def create_case_embedded(self, pid, fid, info, steps, images_b64, jira_key):
        desc_html = info['description_html']
        desc_img_urls = self.extract_imgs_from_html(desc_html)

        for img_url in desc_img_urls:
            is_jira = "atlassian" in img_url or "/rest/" in img_url or "/secure/" in img_url
            img_content = self.download_image(img_url, is_jira)
            if img_content:
                b64_src = self.image_to_base64(img_content)
                if b64_src: desc_html = desc_html.replace(img_url, b64_src)

        if images_b64:
            desc_html += "<br><hr><h3>📸 Ekran Görüntüleri:</h3>"
            for b64_img in images_b64:
                desc_html += f'<div style="margin: 10px 0;"><img src="{b64_img}" style="max-width: 100%; border: 1px solid #ddd; border-radius: 4px;" /></div>'

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
            "state_id": 2,
            "priority_id": 3,
            "estimate": 0,
            "custom_description": desc_html,
            "custom_steps": f_steps
        }

        r = self.session.post(f"{self.testmo_url}/projects/{pid}/cases", json={"cases": [pl]})
        if r.status_code in [200, 201]:
            d = r.json()
            if 'result' in d and d['result']: return d['result'][0]
            if 'cases' in d and d['cases']: return d['cases'][0]
            return d
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

            attachments = self.get_attachments(key)
            imgs_b64 = []

            if attachments:
                with ThreadPoolExecutor(max_workers=5) as executor:
                    futures = [executor.submit(self.download_image, att['url'], True) for att in attachments]
                    for future in as_completed(futures):
                        if img_content := future.result():
                            if b64 := self.image_to_base64(img_content):
                                imgs_b64.append(b64)

            # create_case_embedded çağrılırken 'key' parametresi GÖNDERİLİYOR
            if res := self.create_case_embedded(pid, fid, info, steps, imgs_b64, key):
                self.add_jira_comment(key, info['summary'])
                result.update(
                    {'status': 'success', 'case_name': info['summary'], 'images': len(imgs_b64), 'steps': len(steps)})
            else:
                result['msg'] = 'Case oluşturulamadı'
        except Exception as e:
            result['msg'] = str(e)
        return result