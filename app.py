from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
# Şifreleme
from cryptography.fernet import Fernet
import requests
import re
import os
import html
import base64
import io
import json
from PIL import Image
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["https://quickcase.vercel.app"]}})

# --- AYARLAR ---
db_uri = os.getenv("DATABASE_URL", "sqlite:///quickcase.db")
if db_uri.startswith("postgres://"):
    db_uri = db_uri.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = db_uri
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "super-secret-quickcase-key")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=7)

# Şifreleme Anahtarı (Eğer .env'de yoksa geçici oluşturur)
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
if not ENCRYPTION_KEY:
    ENCRYPTION_KEY = Fernet.generate_key().decode()
    print(f"🔑 DİKKAT: .env dosyasında ENCRYPTION_KEY yok. Geçici key kullanılıyor.")

cipher_suite = Fernet(ENCRYPTION_KEY)

db = SQLAlchemy(app)
jwt = JWTManager(app)

# Rate Limiter (Login denemelerini sınırlar)
limiter = Limiter(get_remote_address, app=app, default_limits=["2000 per day", "500 per hour"], storage_uri="memory://")


# --- DB MODELLERİ ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)


class Setting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)
    key = db.Column(db.String(50), nullable=False)
    value = db.Column(db.Text, nullable=True)  # Şifreli saklanır


class History(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.String(20))
    task = db.Column(db.String(50))
    repo_id = db.Column(db.Integer)
    folder_id = db.Column(db.Integer)
    cases_count = db.Column(db.Integer)
    images_count = db.Column(db.Integer)
    status = db.Column(db.String(20))
    case_name = db.Column(db.String(255))
    user_id = db.Column(db.Integer, nullable=False)


# --- YARDIMCILAR ---
def encrypt_value(value):
    if not value: return ""
    return cipher_suite.encrypt(value.encode()).decode()


def decrypt_value(value):
    if not value: return ""
    try:
        return cipher_suite.decrypt(value.encode()).decode()
    except:
        return ""


def init_db():
    with app.app_context():
        db.create_all()
        # Admin yoksa oluştur
        if not User.query.filter_by(username='admin').first():
            hashed = generate_password_hash("181394", method='pbkdf2:sha256')
            db.session.add(User(username='admin', password_hash=hashed))

            # Varsayılan boş ayarları ekle
            admin_user = User.query.filter_by(username='admin').first()
            # admin henüz commit edilmediği için id alamayabiliriz, önce commit
            db.session.commit()

            # Şimdi ID var
            admin = User.query.filter_by(username='admin').first()
            keys = ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN", "TESTMO_BASE_URL", "TESTMO_API_KEY"]
            for k in keys:
                db.session.add(Setting(user_id=admin.id, key=k, value=encrypt_value("")))

            db.session.commit()
            print("✅ Veritabanı ve Admin Kullanıcısı Oluşturuldu.")


def get_user_setting(user_id, key):
    s = Setting.query.filter_by(user_id=user_id, key=key).first()
    if s and s.value: return decrypt_value(s.value)
    return ""


def get_corrected_url(user_id, key):
    url = get_user_setting(user_id, key).rstrip('/')
    if url and not url.startswith('http'): url = f"https://{url}"
    if key == 'TESTMO_BASE_URL' and url and not url.endswith('/api/v1'): url += '/api/v1'
    return url


# --- CORE CLASS ---
class QuickCaseSync:
    def __init__(self, user_id):
        self.user_id = user_id
        self.session = requests.Session()
        self.headers = {
            'Authorization': f'Bearer {get_user_setting(user_id, "TESTMO_API_KEY")}',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        self.session.headers.update(self.headers)
        self.jira_auth = (get_user_setting(user_id, 'JIRA_EMAIL'), get_user_setting(user_id, 'JIRA_API_TOKEN'))
        self.jira_url = get_corrected_url(user_id, 'JIRA_BASE_URL')
        self.testmo_url = get_corrected_url(user_id, 'TESTMO_BASE_URL')

    def clean_html(self, raw_html):
        if not raw_html: return ""
        text = re.sub(r'<(script|style).*?>.*?</\1>', '', raw_html, flags=re.DOTALL)
        text = re.sub(r'<(br|p|li|/ul|/ol|div)[^>]*>', '\n', text)
        text = re.sub(r'<[^>]+>', '', text)
        return html.unescape(text).strip()

    def compress_and_base64(self, image_content):
        if not image_content: return None
        try:
            img = Image.open(io.BytesIO(image_content))
            if img.mode in ("RGBA", "P"): img = img.convert("RGB")
            if img.width > 800:
                ratio = 800 / float(img.width)
                img = img.resize((800, int((float(img.height) * float(ratio)))), Image.Resampling.LANCZOS)
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
                return {'summary': d.get('fields', {}).get('summary', ''),
                        'desc_html': d.get('renderedFields', {}).get('description', '')}
        except:
            pass
        return {'summary': '', 'desc_html': ''}

    def get_comments(self, key):
        try:
            return self.session.get(f"{self.jira_url}/rest/api/3/issue/{key}/comment", auth=self.jira_auth,
                                    params={'expand': 'renderedBody'}).json().get('comments', [])
        except:
            return []

    def get_attachments(self, key):
        try:
            r = self.session.get(f"{self.jira_url}/rest/api/3/issue/{key}", auth=self.jira_auth)
            return [{'url': a['content']} for a in r.json().get('fields', {}).get('attachment', []) if
                    a.get('mimeType', '').startswith('image/')]
        except:
            return []

    def add_jira_comment(self, key, case_name):
        url = f"{self.jira_url}/rest/api/3/issue/{key}/comment"
        msg = f"✅ QuickCase: Testmo aktarımı tamamlandı.\nOluşturulan Case: {case_name}"
        payload = {"body": {"type": "doc", "version": 1,
                            "content": [{"type": "paragraph", "content": [{"text": msg, "type": "text"}]}]}}
        try:
            self.session.post(url, json=payload, auth=self.jira_auth)
        except:
            pass

    def parse_cases(self, html_txt):
        clean = re.sub(r'<[^>]+>', '', html_txt)
        clean = html.unescape(clean)
        cases = []
        for m in re.finditer(
                r'TC(\d+)[ -]*(.+?):.*?Senaryo:\s*(.+?)\s*Beklenen Sonuç:\s*(.+?)\s*Durum:\s*(PASSED|FAILED)', clean,
                re.DOTALL | re.IGNORECASE):
            cases.append({'name': f"TC{m.group(1).strip()} - {m.group(2).strip()}", 'scen': m.group(3).strip(),
                          'exp': m.group(4).strip(), 'status': m.group(5).upper()})
        return cases

    def extract_imgs(self, h):
        return re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', h)

    def download(self, u, j=False):
        try:
            u = u.replace('&amp;', '&')
            if u.startswith('/'): u = f"{self.jira_url}{u}"
            r = self.session.get(u, auth=self.jira_auth if j else None, stream=True)
            if r.status_code == 200 and 'image' in r.headers.get('Content-Type', ''):
                return r.content
        except:
            pass
        return None

    def get_folders(self, pid):
        r = self.session.get(f"{self.testmo_url}/projects/{pid}/folders")
        d = r.json()
        return d.get('result', d.get('name', []))

    def create_folder(self, pid, name, prid=None):
        pl = {"name": name}
        if prid: pl["parent_id"] = int(prid)
        return self.session.post(f"{self.testmo_url}/projects/{pid}/folders", json={"folders": [pl]}).json().get('data',
                                                                                                                 {})

    def create_case(self, pid, fid, info, steps, imgs):
        desc = info['desc_html']
        # Gömülü Resimler (Paralel)
        embedded_urls = self.extract_imgs(desc)
        if embedded_urls:
            with ThreadPoolExecutor(max_workers=5) as executor:
                futures = {executor.submit(self.download, url, "atlassian" in url or "/rest/" in url): url for url in
                           embedded_urls}
                for future in as_completed(futures):
                    url = futures[future]
                    if d := future.result():
                        if b64 := self.compress_and_base64(d): desc = desc.replace(url, b64)

        # Ek Resimler (Markdown/HTML Olarak Ekle)
        if imgs:
            desc += "<br><hr><h3>📸 Ekler:</h3>" + "".join([
                                                              f'<div style="margin:10px 0"><img src="{i}" style="max-width:100%; border:1px solid #ddd; border-radius:6px;"/></div>'
                                                              for i in imgs])

        f_steps = [{"text1": f"<p><strong>{s['name']}</strong></p><p>{s['scen']}</p>",
                    "text3": f"<p>{s['exp']}</p><p><em>{s['status']}</em></p>"} for s in steps]

        pl = {
            "name": info['summary'], "folder_id": int(fid), "template_id": 2, "state_id": 1, "priority_id": 2,
            "custom_description": desc, "custom_steps": f_steps
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
            imgs = []
            if attachments:
                with ThreadPoolExecutor(max_workers=5) as executor:
                    futures = [executor.submit(self.download, att['url'], True) for att in attachments]
                    for future in as_completed(futures):
                        if d := future.result():
                            if b64 := self.compress_and_base64(d): imgs.append(b64)

            if res := self.create_case(pid, fid, info, steps, imgs):
                self.add_jira_comment(key, info['summary'])
                result.update(
                    {'status': 'success', 'case_name': info['summary'], 'images': len(imgs), 'steps': len(steps)})
            else:
                result['msg'] = 'Case oluşturulamadı'
        except Exception as e:
            result['msg'] = str(e)
        return result


# --- ROUTES ---

@app.route('/api/register', methods=['POST'])
@limiter.limit("10 per minute")
def register():
    try:
        data = request.json or {}
        u, p = data.get("username"), data.get("password")
        if not u or not p: return jsonify({"msg": "Eksik bilgi"}), 400
        if User.query.filter_by(username=u).first(): return jsonify({"msg": "Kullanıcı adı alınmış"}), 400

        db.session.add(User(username=u, password_hash=generate_password_hash(p, method='pbkdf2:sha256')))
        db.session.commit()
        return jsonify({"msg": "Başarılı"}), 201
    except Exception as e:
        return jsonify({"msg": str(e)}), 500


@app.route('/api/login', methods=['POST'])
@limiter.limit("20 per minute")
def login():
    try:
        data = request.json or {}
        user = User.query.filter_by(username=data.get("username")).first()
        if user and check_password_hash(user.password_hash, data.get("password")):
            return jsonify(access_token=create_access_token(identity=user.username)), 200
        return jsonify({"msg": "Hatalı giriş"}), 401
    except Exception as e:
        return jsonify({"msg": str(e)}), 500


@app.route('/api/settings', methods=['GET', 'POST'])
@jwt_required()
def settings():
    current_user = User.query.filter_by(username=get_jwt_identity()).first()
    if request.method == 'GET':
        user_settings = Setting.query.filter_by(user_id=current_user.id).all()
        cfg = {s.key: decrypt_value(s.value) for s in user_settings}
        return jsonify({
            "JIRA_BASE_URL": cfg.get("JIRA_BASE_URL", ""),
            "JIRA_EMAIL": cfg.get("JIRA_EMAIL", ""),
            "JIRA_API_TOKEN": "********" if cfg.get("JIRA_API_TOKEN") else "",
            "TESTMO_BASE_URL": cfg.get("TESTMO_BASE_URL", ""),
            "TESTMO_API_KEY": "********" if cfg.get("TESTMO_API_KEY") else ""
        })

    if request.method == 'POST':
        data = request.json
        for key, value in data.items():
            if value and value != "********":
                setting = Setting.query.filter_by(user_id=current_user.id, key=key).first()
                val_enc = encrypt_value(value)
                if setting:
                    setting.value = val_enc
                else:
                    db.session.add(Setting(user_id=current_user.id, key=key, value=val_enc))
        db.session.commit()
        return jsonify({"msg": "Kaydedildi"}), 200


@app.route('/api/stats', methods=['GET'])
@jwt_required()
def get_stats():
    user = User.query.filter_by(username=get_jwt_identity()).first()
    logs = History.query.filter_by(user_id=user.id).all()
    today = datetime.now().strftime("%Y-%m-%d")
    return jsonify({
        "total_cases": sum(l.cases_count for l in logs),
        "total_images": sum(l.images_count for l in logs),
        "today_syncs": sum(1 for l in logs if l.date.startswith(today)),
        "total_syncs": len(logs)
    })


@app.route('/api/history', methods=['GET'])
@jwt_required()
def get_history():
    user = User.query.filter_by(username=get_jwt_identity()).first()
    logs = History.query.filter_by(user_id=user.id).order_by(History.id.desc()).limit(50).all()
    return jsonify(
        [{"id": l.id, "date": l.date, "task": l.task, "case": l.case_name, "status": l.status} for l in logs])


@app.route('/api/folders/<int:id>', methods=['GET'])
@jwt_required()
def get_folders(id):
    user = User.query.filter_by(username=get_jwt_identity()).first()
    return jsonify({'folders': QuickCaseSync(user.id).get_folders(id)})


@app.route('/api/folders/<int:id>', methods=['POST'])
@jwt_required()
def create_folder(id):
    try:
        user = User.query.filter_by(username=get_jwt_identity()).first()
        return jsonify(
            QuickCaseSync(user.id).create_folder(id, request.json.get('name', 'Yeni'), request.json.get('parent_id')))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/sync', methods=['POST'])
@jwt_required()
def sync():
    d = request.json
    user = User.query.filter_by(username=get_jwt_identity()).first()
    qc = QuickCaseSync(user.id)

    task_keys = [k.strip() for k in d.get('jira_input', '').split(',') if k.strip()]
    if len(task_keys) > 3: return jsonify({'error': 'Maksimum 3 Task'}), 400
    if not task_keys: return jsonify({'error': 'Task giriniz'}), 400

    pid, fid = d['project_id'], d['folder_id']
    results = []

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(qc.process_single_task, re.split(r'browse/', k)[-1].strip(), pid, fid) for k in
                   task_keys]
        for future in as_completed(futures):
            res = future.result()
            results.append(res)
            if res['status'] == 'success':
                db.session.add(History(date=datetime.now().strftime("%Y-%m-%d %H:%M"), task=res['task'], repo_id=pid,
                                       folder_id=fid, cases_count=1, images_count=res.get('images', 0),
                                       status="SUCCESS", case_name=res['case_name'], user_id=user.id))
        db.session.commit()

    return jsonify({'results': results})


with app.app_context():
    init_db()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)