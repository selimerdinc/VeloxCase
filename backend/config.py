import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Güvenlik
    SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-quickcase-key")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-quickcase-key")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)
    ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")

    # Veritabanı
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///veloxcase.db")
    if SQLALCHEMY_DATABASE_URI.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_TRACK_MODIFICATIONS = False