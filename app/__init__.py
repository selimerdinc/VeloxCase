from flask import Flask
from config import Config
from app.extensions import db, jwt, cors, limiter
from app.utils.db_initializer import init_db

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Eklentileri Başlat
    db.init_app(app)
    jwt.init_app(app)
    # CORS ayarları: İzin verilen domainleri buraya ekleyebilirsiniz
    cors.init_app(app, resources={r"/api/*": {
        "origins": [
            "http://localhost:5173",
            "https://velox-case-7kqcisaz4-selimerdincs-projects.vercel.app",
            "https://velox-case.vercel.app",
            "*"
        ]
    }})
    limiter.init_app(app)

    # Blueprint'leri Kaydet
    from app.api.auth import auth_bp
    from app.api.settings import settings_bp
    from app.api.sync import sync_bp
    from app.api.stats import stats_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(sync_bp)
    app.register_blueprint(stats_bp)

    # Veritabanını Başlat (Varsa tabloları oluşturur)
    init_db(app)

    return app