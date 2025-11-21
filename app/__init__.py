# app/__init__.py
import os
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask
from config import Config
from app.extensions import db, jwt, cors, limiter
from app.utils.db_initializer import init_db


logger = logging.getLogger(__name__)

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # --- LOGLAMA BAŞLANGICI ---
    if not os.path.exists('logs'):
        os.mkdir('logs')

    # Log Formatı: [Zaman] [Seviye] [Dosya:Satır]: Mesaj
    formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)s [%(module)s:%(lineno)d]: %(message)s'
    )

    # 1. Dosyaya Yazma (Maks 10MB, son 10 dosya saklansın)
    file_handler = RotatingFileHandler('logs/veloxcase.log', maxBytes=10240000, backupCount=10)
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)

    # 2. Konsola Yazma (Terminalde görmek için)
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    stream_handler.setLevel(logging.INFO)

    # Flask logger'ına ekle
    app.logger.addHandler(file_handler)
    app.logger.addHandler(stream_handler)
    app.logger.setLevel(logging.INFO)

    app.logger.info('✅ VeloxCase Backend Başlatıldı.')
    # --- LOGLAMA BİTİŞİ ---

    # Eklentileri Başlat
    db.init_app(app)
    jwt.init_app(app)

    # CORS Ayarları
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

    init_db(app)

    return app