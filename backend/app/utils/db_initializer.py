import secrets
import string
import os
from werkzeug.security import generate_password_hash
from app.extensions import db
from app.models.user import User
from app.models.setting import Setting
from app.models.invite_code import InviteCode
from app.services.encryption_service import EncryptionService


def generate_secure_password(length=12):
    """Güvenli rastgele şifre üretir"""
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    password = ''.join(secrets.choice(alphabet) for _ in range(length))
    return password


def init_db(app):
    with app.app_context():
        db.create_all()

        # Admin kullanıcısı yoksa oluştur
        admin_user = User.query.filter_by(username='admin').first()
        if not admin_user:
            # Güvenli rastgele şifre üret
            admin_password = generate_secure_password()
            hashed = generate_password_hash(admin_password, method='pbkdf2:sha256')
            admin_user = User(username='admin', password_hash=hashed, is_admin=True)
            db.session.add(admin_user)
            db.session.commit()

            # Varsayılan boş ayarları oluştur
            keys = ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN", "TESTMO_BASE_URL", "TESTMO_API_KEY"]
            for k in keys:
                # Boş stringi şifreleyip kaydet
                encrypted_val = EncryptionService.encrypt("")
                db.session.add(Setting(user_id=admin_user.id, key=k, value=encrypted_val))

            db.session.commit()
            
            # Şifreyi güvenli dosyaya yaz (konsola değil!)
            credentials_dir = os.path.join(app.instance_path)
            os.makedirs(credentials_dir, exist_ok=True)
            credentials_file = os.path.join(credentials_dir, 'admin_credentials.txt')
            
            with open(credentials_file, 'w') as f:
                f.write("=" * 60 + "\n")
                f.write("VeloxCase Admin Credentials\n")
                f.write("=" * 60 + "\n")
                f.write(f"Username: admin\n")
                f.write(f"Password: {admin_password}\n")
                f.write("=" * 60 + "\n")
                f.write("DELETE THIS FILE AFTER FIRST LOGIN!\n")
                f.write("=" * 60 + "\n")
            
            # Dosya izinlerini kısıtla (sadece owner okuyabilir)
            try:
                os.chmod(credentials_file, 0o600)
            except Exception:
                pass  # Windows'ta çalışmayabilir
            
            # Konsola sadece dosya konumunu bildir
            print("=" * 60)
            print("🔐 VeloxCase Admin Hesabı Oluşturuldu")
            print("=" * 60)
            print(f"   Credentials saved to: {credentials_file}")
            print("=" * 60)
            print("⚠️  İlk girişten sonra şifrenizi değiştirin ve dosyayı silin!")
            print("=" * 60)
        else:
            # Mevcut admin'in is_admin alanını güncelle (migration için)
            if not admin_user.is_admin:
                admin_user.is_admin = True
                db.session.commit()

        # selimerdinc kullanıcısını admin yap (eğer varsa)
        selimerdinc = User.query.filter_by(username='selimerdinc').first()
        if selimerdinc and not selimerdinc.is_admin:
            selimerdinc.is_admin = True
            db.session.commit()
            print("✅ 'selimerdinc' kullanıcısına admin yetkisi verildi.")