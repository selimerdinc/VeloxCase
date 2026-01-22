import os
import secrets
import logging
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

class Config:
    # Güvenlik - JWT Secret Key
    _jwt_key = os.getenv("JWT_SECRET_KEY")
    if not _jwt_key:
        # Development mode: Generate random key (session-based, not persistent)
        _jwt_key = secrets.token_urlsafe(32)
        logger.warning("⚠️ JWT_SECRET_KEY not set! Using temporary key. Set JWT_SECRET_KEY in production!")
    
    SECRET_KEY = _jwt_key
    JWT_SECRET_KEY = _jwt_key
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)
    ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
    if not ENCRYPTION_KEY:
         logger.error("❌ ENCRYPTION_KEY set edilmemiş! Hassas veriler şifrelenemez/çözülemez.")

    # Veritabanı
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///veloxcase.db")
    if SQLALCHEMY_DATABASE_URI.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_TRACK_MODIFICATIONS = False