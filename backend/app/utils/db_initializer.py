import secrets
import string
from werkzeug.security import generate_password_hash
from app.extensions import db
from app.models.user import User
from app.models.setting import Setting
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
        if not User.query.filter_by(username='admin').first():
            # Güvenli rastgele şifre üret
            admin_password = generate_secure_password()
            hashed = generate_password_hash(admin_password, method='pbkdf2:sha256')
            admin_user = User(username='admin', password_hash=hashed)
            db.session.add(admin_user)
            db.session.commit()

            # Varsayılan boş ayarları oluştur
            keys = ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN", "TESTMO_BASE_URL", "TESTMO_API_KEY"]
            for k in keys:
                # Boş stringi şifreleyip kaydet
                encrypted_val = EncryptionService.encrypt("")
                db.session.add(Setting(user_id=admin_user.id, key=k, value=encrypted_val))

            db.session.commit()
            
            # Şifreyi konsola yazdır (sadece ilk kurulumda görünür)
            print("=" * 60)
            print("🔐 VeloxCase Admin Hesabı Oluşturuldu")
            print("=" * 60)
            print(f"   Kullanıcı Adı: admin")
            print(f"   Şifre: {admin_password}")
            print("=" * 60)
            print("⚠️  Bu şifreyi güvenli bir yere kaydedin!")
            print("⚠️  İlk girişten sonra şifrenizi değiştirmeniz önerilir.")
            print("=" * 60)