import os
from cryptography.fernet import Fernet
from flask import current_app
import logging

logger = logging.getLogger(__name__)
class EncryptionService:
    _cipher_suite = None

    @classmethod
    def get_cipher(cls):
        if cls._cipher_suite is None:
            key = current_app.config.get('ENCRYPTION_KEY')
            if not key:
                logger.error(
                    "❌ KRİTİK HATA: ENCRYPTION_KEY bulunamadı! Ayarlar deşifre edilemez. Lütfen .env dosyasını kontrol edin.")
                raise ValueError("ENCRYPTION_KEY is required for encryption/decryption")
            cls._cipher_suite = Fernet(key)
        return cls._cipher_suite

    @classmethod
    def encrypt(cls, value):
        if not value: return ""
        return cls.get_cipher().encrypt(value.encode()).decode()

    @classmethod
    def decrypt(cls, value):
        if not value: return ""
        try:
            return cls.get_cipher().decrypt(value.encode()).decode()
        except Exception as e:
            logger.warning(f"Decryption failed (key değişmiş olabilir): {str(e)[:50]}")
            return ""