# app/services/sync_service.py
import requests
import re
import html
import base64
import io
import logging
from PIL import Image
from concurrent.futures import ThreadPoolExecutor, as_completed
from app.models.setting import Setting
from app.services.encryption_service import EncryptionService

# Logger tanımla
logger = logging.getLogger(__name__)


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
        testmo_key = self._get_setting("TESTMO_API_KEY")
        jira_email = self._get_setting("JIRA_EMAIL")
        jira_token = self._get_setting("JIRA_API_TOKEN")

        self.jira_url = self._get_setting("JIRA_BASE_URL").rstrip('/')
        if self.jira_url and not self.jira_url.startswith('http'):
            self.jira_url = f"https://{self.jira_url}"

        self.testmo_url = self._get_setting("TESTMO_BASE_URL").rstrip('/')
        if self.testmo_url and not self.testmo_url.startswith('http'):
            self.testmo_url = f"https://{self.testmo_url}"
        if not self.testmo_url.endswith('/api/v1'):
            self.testmo_url += '/api/v1'

        self.headers = {
            'Authorization': f'Bearer {testmo_key}',
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
            if r.status_code != 200:
                logger.error(f"Jira Attachment Error: {r.status_code} - {r.text}")
                return []

            atts = []
            for a in r.json().get('fields', {}).get('attachment', []):
                if a.get('mimeType', '').startswith('image/'):
                    atts.append({'url': a['content'], 'mime': a['mimeType'], 'filename': a['filename']})
            return atts
        except Exception as e:
            logger.exception(f"Get Attachments Exception: {e}")
            return []

    def add_jira_comment(self, key, case_name):
        url = f"{self.jira_url}/rest/api/3/issue/{key}/comment"
        msg = f"✅ VeloxCase: Testmo aktarımı tamamlandı.\nOluşturulan Case: {case_name}"
        payload = {"body": {"type": "doc", "version": 1,
                            "content": [{"type": "paragraph", "content": [{"text": msg, "type": "text"}]}]}}
        try:
            self.session.post(url, json=payload, auth=self.jira_auth, headers={'Content-Type': 'application/json'})
        except:
            pass

    def parse_cases(self, html_txt):
        # HTML temizliği
        clean_text = re.sub(r'<[^>]+>', '', html_txt)
        clean_text = html.unescape(clean_text)

        cases = []

        # GÜÇLENDİRİLMİŞ REGEX MANTIĞI:
        # 1. Grup: TC ID (Örn: 07)
        # 2. Grup: Başlık (Örn: Favorileme Kontrolü)
        # 3. Grup: Senaryo (Beklenen Sonuç kelimesini görene kadar her şeyi al)
        # 4. Grup: Beklenen Sonuç (Durum kelimesini VEYA bir sonraki TC'yi görene kadar her şeyi al)
        # 5. Grup: Durum (OPSİYONEL - Eğer varsa al, yoksa yoksay)

        pattern = (
            r'TC(\d+)[ -]*(.+?)[:|-]?\s*'  # ID ve Başlık

            r'(?:Senaryo|Scenario)[:]?\s*'  # Senaryo Etiketi
            r'((?:(?!(?:Beklenen Sonuç|Expected Result)).)+)\s*'  # Senaryo İçeriği

            r'(?:Beklenen Sonuç|Expected Result)[:]?\s*'  # Beklenen Sonuç Etiketi

            # KRİTİK NOKTA BURASI:
            # Aşağıdaki yapı: "Durum:" kelimesini YA DA "TC<sayı>" yapısını görene kadar okumaya devam et.
            # Böylece Durum satırı hiç yazılmamışsa bile, bir sonraki TC'ye kadar olan metni "Beklenen Sonuç" kabul eder.
            r'((?:(?!(?:Durum|Status)\s*[:]|TC\d).)+)\s*'

            # Durum Kısmı (Tamamen Opsiyonel Yapıldı - ? işareti ile)
            r'(?:(?:Durum|Status)[:]?\s*(.+?))?\s*'

            # Bitiş Kontrolü (Ya yeni TC başlar ya da metin biter)
            r'(?=TC\d|$)'
        )

        for m in re.finditer(pattern, clean_text, re.DOTALL | re.IGNORECASE):
            status = "NO RUN"  # Varsayılan durum (Eğer Durum satırı yoksa bu atanır)

            # Eğer 5. Grup (Durum) regex tarafından yakalandıysa onu kullan
            if m.group(5) and m.group(5).strip():
                status = m.group(5).strip().upper()

            cases.append({
                'name': f"TC{m.group(1).strip()} - {m.group(2).strip()}",
                'scenario': m.group(3).strip(),
                'expected_result': m.group(4).strip(),  # Artık kesilmeden tam gelir
                'status': status
            })

        return cases

    def extract_imgs_from_html(self, html_content):
        return re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', html_content)

    def download_image(self, u, j=False):
        try:
            u = u.replace('&amp;', '&')
            if u.startswith('/') and not u.startswith('http'):
                u = f"{self.jira_url}{u}"

            r = self.session.get(u, auth=self.jira_auth if j else None, stream=True)

            if r.status_code == 200:
                if 'text/html' in r.headers.get('Content-Type', '').lower():
                    return None
                return r.content
            else:
                logger.warning(f"Image Download Failed: {r.status_code} for {u}")
                return None
        except Exception as e:
            logger.error(f"Download Exception: {e} for {u}")
            return None

    def get_folders(self, pid):
        try:
            r = self.session.get(f"{self.testmo_url}/projects/{pid}/folders",
                                 headers={'Content-Type': 'application/json'})
            d = r.json()
            # Testmo versiyonuna göre yanıt yapısı değişebilir
            return d.get('folders', d.get('result', []))
        except Exception as e:
            logger.error(f"Get Folders Error: {e}")
            return []

    def create_folder(self, pid, name, prid=None):
        """
        DÜZELTME 1: API Yanıtından ID'yi doğru çekmek
        """
        pl = {"name": name}
        if prid: pl["parent_id"] = int(prid)

        try:
            r = self.session.post(f"{self.testmo_url}/projects/{pid}/folders", json={"folders": [pl]},
                                  headers={'Content-Type': 'application/json'})
            d = r.json()

            # Yanıtın içinde 'folders' listesi varsa ilk elemanı al
            if 'folders' in d and len(d['folders']) > 0:
                return d['folders'][0]

            # Yoksa 'data' veya kendisini döndür
            return d.get('data', d)

        except Exception as e:
            logger.error(f"Create Folder Error: {e}")
            return {}

    def upload_attachment_to_case(self, case_id, file_content, filename="screenshot.jpg"):
        try:
            url = f"{self.testmo_url}/attachments"

            files = {
                'file': (filename, file_content, 'image/jpeg')
            }
            data = {
                'entity_id': str(case_id),
                'entity_type': 'case'
            }

            custom_headers = self.headers.copy()
            if 'Content-Type' in custom_headers:
                del custom_headers['Content-Type']

            r = self.session.post(url, files=files, data=data, headers=custom_headers)

            if r.status_code not in [200, 201]:
                logger.error(f"Testmo Upload Error ({r.status_code}): {r.text}")
                return False

            logger.info(f"Testmo Upload Success: {r.status_code}")
            return True
        except Exception as e:
            logger.exception(f"Upload Exception: {e}")
            return False

    def create_case_embedded(self, pid, fid, info, steps, jira_key):
        """
        DÜZELTME 2: Folder ID Kontrolü (Hata vermeden durdurma)
        """
        try:
            folder_id_int = int(fid)
        except (ValueError, TypeError):
            # Eğer ID yerine isim geldiyse burada yakalar ve log basar
            logger.error(f"GECERSIZ FOLDER ID: {fid}. Case oluşturma iptal edildi. Lütfen klasörleri yenileyin.")
            return None

        desc_html = info['description_html']
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
            "folder_id": folder_id_int,  # Artık güvenli sayı
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
            if 'result' in d and d['result']: return d['result'][0]
            if 'cases' in d and d['cases']: return d['cases'][0]
            return d
        else:
            logger.error(f"Create Case Error: {r.status_code} - {r.text}")
            return None

    def process_single_task(self, key, pid, fid):
        result = {'task': key, 'status': 'error', 'msg': '', 'case_name': ''}
        try:
            info = self.get_issue(key)
            if not info['summary']:
                result['msg'] = 'Task bulunamadı'
                logger.warning(f"Task not found or empty summary: {key}")
                return result

            steps = []
            for c in self.get_comments(key):
                b = c.get('renderedBody', c.get('body', ''))
                if b: steps.extend(self.parse_cases(b))

            attachments = self.get_attachments(key)
            downloaded_images = []

            logger.info(f"Task {key} için {len(attachments)} attachment bulundu.")

            if attachments:
                with ThreadPoolExecutor(max_workers=5) as executor:
                    future_to_att = {executor.submit(self.download_image, att['url'], True): att for att in attachments}
                    for future in as_completed(future_to_att):
                        att = future_to_att[future]
                        img_content = future.result()
                        if img_content:
                            fname = att.get('filename', 'image.jpg')
                            downloaded_images.append((img_content, fname))
                        else:
                            logger.warning(f"Failed download: {att['url']}")

            created_case = self.create_case_embedded(pid, fid, info, steps, key)

            if created_case and 'id' in created_case:
                case_id = created_case['id']
                case_name = info['summary']

                logger.info(f"Case ID: {case_id}. Resimler yükleniyor...")

                upload_count = 0
                if downloaded_images:
                    with ThreadPoolExecutor(max_workers=3) as executor:
                        futures = [executor.submit(self.upload_attachment_to_case, case_id, img_data[0], img_data[1])
                                   for img_data in downloaded_images]
                        for future in as_completed(futures):
                            if future.result(): upload_count += 1

                logger.info(f"Yüklenen resim: {upload_count}")

                self.add_jira_comment(key, case_name)
                result.update(
                    {'status': 'success', 'case_name': case_name, 'images': upload_count, 'steps': len(steps)})
            else:
                result['msg'] = 'Case oluşturulamadı'
                if not result.get('msg'): result['msg'] = "API Hatası"
        except Exception as e:
            logger.exception(f"Process Error General: {e}")
            result['msg'] = str(e)
        return result