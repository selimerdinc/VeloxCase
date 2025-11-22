# app/services/sync_service.py
import requests
import re
import html
import base64
import io
import logging
import mimetypes
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
            img.save(buffer, format="JPEG", quality=70, optimize=True)
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
                    'id': d.get('id'),
                    'summary': d.get('fields', {}).get('summary', ''),
                    'description_html': d.get('renderedFields', {}).get('description', '')
                }
        except:
            pass
        return {'id': None, 'summary': '', 'description_html': ''}

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

    def add_jira_comment(self, key, case_name, is_update=False):
        url = f"{self.jira_url}/rest/api/3/issue/{key}/comment"
        action_text = "GÜNCELLENEN Case" if is_update else "Oluşturulan Case"
        msg = f"✅ VeloxCase: Testmo aktarımı tamamlandı.\n{action_text}: {case_name}"
        payload = {"body": {"type": "doc", "version": 1,
                            "content": [{"type": "paragraph", "content": [{"text": msg, "type": "text"}]}]}}
        try:
            self.session.post(url, json=payload, auth=self.jira_auth, headers={'Content-Type': 'application/json'})
        except:
            pass

    def parse_cases(self, html_txt):
        txt = html_txt.replace('<br>', '\n').replace('<br/>', '\n').replace('</p>', '\n').replace('</div>', '\n')
        clean_text = re.sub(r'<[^>]+>', '', txt)
        clean_text = html.unescape(clean_text)

        cases = []

        pattern = (
            r'TC(\d+)[ -]*(.+?)[:|-]?\s*'
            r'(?:Senaryo|Scenario)[:]?\s*'
            r'((?:(?!(?:Beklenen Sonuç|Expected Result)).)+)\s*'
            r'(?:Beklenen Sonuç|Expected Result)[:]?\s*'
            r'((?:(?!(?:Durum|Status)[:]|TC\d).)+)\s*'
            r'(?:(?:Durum|Status)[:]?\s*([^\n\r]+))?'
            r'.*?'
            r'(?=TC\d|$)'
        )

        for m in re.finditer(pattern, clean_text, re.DOTALL | re.IGNORECASE):
            status = "NO RUN"
            if m.group(5) and m.group(5).strip():
                raw_status = m.group(5).strip()
                if ":" in raw_status:
                    status = raw_status.split(':')[0].strip().upper()
                else:
                    status = raw_status.upper()

            cases.append({
                'name': f"TC{m.group(1).strip()} - {m.group(2).strip()}",
                'scenario': m.group(3).strip(),
                'expected_result': m.group(4).strip(),
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

            r = self.session.get(u, auth=self.jira_auth if j else None, stream=True, allow_redirects=True)

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
            return d.get('folders', d.get('result', []))
        except Exception as e:
            logger.error(f"Get Folders Error: {e}")
            return []

    def create_folder(self, pid, name, prid=None):
        pl = {"name": name}
        if prid: pl["parent_id"] = int(prid)

        try:
            r = self.session.post(f"{self.testmo_url}/projects/{pid}/folders", json={"folders": [pl]},
                                  headers={'Content-Type': 'application/json'})
            d = r.json()
            if 'folders' in d and len(d['folders']) > 0:
                return d['folders'][0]
            return d.get('data', d)
        except Exception as e:
            logger.error(f"Create Folder Error: {e}")
            return {}

    def upload_attachment_to_case(self, case_id, file_content, filename="screenshot.jpg", project_id=None):
        try:
            url = f"{self.testmo_url}/cases/{case_id}/attachments/single"

            mime_type, _ = mimetypes.guess_type(filename)
            if not mime_type: mime_type = 'image/jpeg'

            files = {'file': (filename, file_content, mime_type)}

            custom_headers = self.headers.copy()
            if 'Content-Type' in custom_headers:
                del custom_headers['Content-Type']

            r = self.session.post(url, files=files, headers=custom_headers)

            if r.status_code not in [200, 201]:
                logger.error(f"Testmo Upload Error ({r.status_code}): {r.text} | URL: {url}")
                return False

            try:
                resp = r.json()
                res_list = resp.get('result', [])
                att_id = res_list[0].get('id', 'Unknown') if res_list else 'Unknown'
                logger.info(f"Attachment Uploaded Successfully! ID: {att_id} -> Case: {case_id}")
            except:
                logger.info(f"Attachment Uploaded Successfully! Case: {case_id}")

            return True
        except Exception as e:
            logger.exception(f"Upload Exception: {e}")
            return False

    # --- YENİ: Case'e ait mevcut ekleri getirir (Resim İkilemesini Önlemek İçin) ---
    def get_case_attachments(self, case_id):
        try:
            url = f"{self.testmo_url}/cases/{case_id}/attachments"
            r = self.session.get(url, headers={'Content-Type': 'application/json'})
            if r.status_code == 200:
                d = r.json()
                return d.get('result', d)
            return []
        except Exception as e:
            logger.error(f"Get Case Attachments Error: {e}")
            return []

    # --- DUPLICATE CHECK (Pagination Destekli) ---
    def find_case_in_folder(self, pid, fid, case_name):
        try:
            page = 1
            target_name = case_name.strip().lower()

            while True:
                url = f"{self.testmo_url}/projects/{pid}/cases?folder_id={fid}&page={page}&per_page=100"
                r = self.session.get(url, headers={'Content-Type': 'application/json'})

                if r.status_code != 200:
                    logger.error(f"Find Case API Error: {r.status_code}")
                    break

                data = r.json()
                cases = data.get('cases', data.get('result', []))

                for c in cases:
                    if c.get('name', '').strip().lower() == target_name:
                        logger.info(f"Duplicate Found: {c.get('name')} (ID: {c.get('id')})")
                        return c

                next_page = data.get('next_page') or data.get('meta', {}).get('pagination', {}).get('next_page')
                if not next_page:
                    break
                page = next_page

            return None
        except Exception as e:
            logger.error(f"Find Case Error: {e}")
            return None

    # --- CASE GÜNCELLEME (Bulk PATCH ile Düzeltilmiş) ---
    def update_case_embedded(self, pid, case_id, info, steps, jira_key, jira_id=None):
        """
        Case Güncelleme (PATCH /api/v1/projects/{pid}/cases)
        Payload: ids: [case_id]
        """
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

        # ID'yi 'ids' listesi içinde gönderiyoruz
        pl = {
            "ids": [int(case_id)],
            "name": info['summary'],
            "template_id": 2,
            "state_id": 4,
            "priority_id": 2,
            "estimate": 0,
            "refs": str(jira_key),
            "custom_description": desc_html,
            "custom_steps": f_steps
        }

        if jira_id:
            pl["issues"] = [int(jira_id)]

        # URL DÜZELTİLDİ: Sondaki case_id kalktı
        url = f"{self.testmo_url}/projects/{pid}/cases"

        r = self.session.patch(url, json=pl, headers={'Content-Type': 'application/json'})

        if r.status_code in [200, 201]:
            d = r.json()
            if 'cases' in d and d['cases']: return d['cases'][0]
            return d.get('data', d)
        else:
            # Fallback PUT (Nadir durumlar için)
            if r.status_code == 405:
                r = self.session.put(url, json=pl, headers={'Content-Type': 'application/json'})
                if r.status_code in [200, 201]:
                    d = r.json()
                    if 'cases' in d and d['cases']: return d['cases'][0]
                    return d

            logger.error(f"Update Case Error: {r.status_code} - {r.text} | URL: {url}")
            return None

    def create_case_embedded(self, pid, fid, info, steps, jira_key, jira_id=None):
        try:
            folder_id_int = int(fid)
        except (ValueError, TypeError):
            logger.error(f"GECERSIZ FOLDER ID: {fid}.")
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
            "folder_id": folder_id_int,
            "template_id": 2,
            "state_id": 4,
            "priority_id": 2,
            "estimate": 0,
            "refs": str(jira_key),
            "custom_description": desc_html,
            "custom_steps": f_steps
        }

        if jira_id:
            pl["issues"] = [int(jira_id)]

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

    def process_single_task(self, key, pid, fid, force_update=False):
        key = key.strip().upper()
        result = {'task': key, 'status': 'error', 'msg': '', 'case_name': ''}

        try:
            info = self.get_issue(key)
            if not info['summary']:
                result['msg'] = 'Task bulunamadı'
                return result

            if not force_update:
                existing_case = self.find_case_in_folder(pid, fid, info['summary'])
                if existing_case:
                    logger.info(f"Duplicate found for {key}. Returning status='duplicate'.")
                    result['status'] = 'duplicate'
                    result['case_name'] = info['summary']
                    result['case_id'] = existing_case.get('id')
                    result['msg'] = 'Aynı isimde kayıt mevcut'
                    return result

            steps = []
            for c in self.get_comments(key):
                b = c.get('renderedBody', c.get('body', ''))
                if b: steps.extend(self.parse_cases(b))

            attachments = self.get_attachments(key)
            downloaded_images = []

            if attachments:
                logger.info(f"Task {key} için {len(attachments)} attachment bulundu...")
                with ThreadPoolExecutor(max_workers=5) as executor:
                    future_to_att = {executor.submit(self.download_image, att['url'], True): att for att in attachments}
                    for future in as_completed(future_to_att):
                        att = future_to_att[future]
                        img_content = future.result()
                        if img_content:
                            fname = att.get('filename', 'image.jpg')
                            downloaded_images.append((img_content, fname))

            target_case = None
            action_type = "created"

            if force_update:
                existing_case = self.find_case_in_folder(pid, fid, info['summary'])
                if existing_case:
                    target_case = self.update_case_embedded(pid, existing_case['id'], info, steps, key, info.get('id'))
                    action_type = "updated"
                else:
                    target_case = self.create_case_embedded(pid, fid, info, steps, key, info.get('id'))
            else:
                target_case = self.create_case_embedded(pid, fid, info, steps, key, info.get('id'))

            if target_case:
                case_id = target_case.get('id')
                case_name = info['summary']
                logger.info(f"Case {action_type.upper()}! ID: {case_id}.")

                upload_count = 0

                # --- AKILLI RESİM FİLTRELEME (GERİ GELDİ) ---
                images_to_upload = downloaded_images

                if action_type == "updated" and downloaded_images:
                    try:
                        existing_atts = self.get_case_attachments(case_id)
                        existing_filenames = {att.get('name') for att in existing_atts}

                        images_to_upload = []
                        for img_content, filename in downloaded_images:
                            if filename not in existing_filenames:
                                images_to_upload.append((img_content, filename))
                            else:
                                logger.info(f"Skipping existing image: {filename}")
                    except Exception as e:
                        logger.error(f"Error filtering images: {e}")
                        images_to_upload = downloaded_images

                if images_to_upload and case_id:
                    with ThreadPoolExecutor(max_workers=3) as executor:
                        futures = [
                            executor.submit(self.upload_attachment_to_case, case_id, img_content, filename, pid)
                            for img_content, filename in images_to_upload]
                        for future in as_completed(futures):
                            if future.result(): upload_count += 1

                self.add_jira_comment(key, case_name, is_update=(action_type == "updated"))

                result.update({
                    'status': 'success',
                    'case_name': case_name,
                    'images': upload_count,
                    'steps': len(steps),
                    'action': action_type
                })
            else:
                result['msg'] = 'Case oluşturulamadı veya güncellenemedi'
        except Exception as e:
            logger.exception(f"Process Error General: {e}")
            result['msg'] = str(e)
        return result