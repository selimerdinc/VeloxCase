import os
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask
from flasgger import Swagger
from config import Config
from app.extensions import db, jwt, cors, limiter, migrate
from app.utils.db_initializer import init_db

logger = logging.getLogger(__name__)


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # --- SWAGGER AYARLARI (BAŞLANGIÇ) ---
    swagger_config = {
        "headers": [],
        "specs": [
            {
                "endpoint": 'apispec_1',
                "route": '/apispec_1.json',
                "rule_filter": lambda rule: True,
                "model_filter": lambda tag: True,
            }
        ],
        "static_url_path": "/flasgger_static",
        "swagger_ui": True,
        "specs_route": "/apidocs"  # Dokümana bu adresten ulaşacaksın
    }

    template = {
        "swagger": "2.0",
        "info": {
            "title": "VeloxCase API",
            "description": "Jira ve Testmo Entegrasyon API Dokümantasyonu",
            "contact": {
                "responsibleOrganization": "VeloxCase",
                "email": "admin@veloxcase.com",
            },
            "version": "1.0.0"
        },
        "securityDefinitions": {
            "Bearer": {
                "type": "apiKey",
                "name": "Authorization",
                "in": "header",
                "description": "JWT Token başına 'Bearer ' ekleyerek giriniz. Örn: 'Bearer eyJhb...'"
            }
        },
        "security": [
            {
                "Bearer": []
            }
        ]
    }

    Swagger(app, config=swagger_config, template=template)
    # --- SWAGGER AYARLARI (BİTİŞ) ---

    # --- LOGLAMA ---
    if not os.path.exists('logs'):
        os.mkdir('logs')

    formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)s [%(module)s:%(lineno)d]: %(message)s'
    )

    file_handler = RotatingFileHandler('logs/veloxcase.log', maxBytes=10240000, backupCount=10)
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    stream_handler.setLevel(logging.INFO)

    app.logger.addHandler(file_handler)
    app.logger.addHandler(stream_handler)
    app.logger.setLevel(logging.INFO)

    app.logger.info('✅ VeloxCase Backend Başlatıldı.')

    # Eklentileri Başlat
    db.init_app(app)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {
        "origins": [
            "http://localhost:5173",
            "https://velox-case-7kqcisaz4-selimerdincs-projects.vercel.app",
            "https://velox-case.vercel.app",
            "*"
        ]
    }})
    limiter.init_app(app)
    migrate.init_app(app, db)

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