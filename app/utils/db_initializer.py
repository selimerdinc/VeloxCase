from werkzeug.security import generate_password_hash
from app.extensions import db
from app.models.user import User
from app.models.setting import Setting
from app.services.encryption_service import EncryptionService


def init_db(app):
    with app.app_context():
        db.create_all()

        # Admin kullanıcısı yoksa oluştur
        if not User.query.filter_by(username='admin').first():
            hashed = generate_password_hash("123456", method='pbkdf2:sha256')
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
            print("✅ Veritabanı ve Admin Kullanıcısı (admin/123456) Başarıyla Oluşturuldu.")