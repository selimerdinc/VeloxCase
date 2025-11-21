import os

import logger
from cryptography.fernet import Fernet
from flask import current_app
import logging

class EncryptionService:
    _cipher_suite = None

    @classmethod
    def get_cipher(cls):
        if cls._cipher_suite is None:
            key = current_app.config.get('ENCRYPTION_KEY')
            if not key:
                # print yerine warning
                key = Fernet.generate_key().decode()
                logger.warning(
                    "⚠️ ENCRYPTION_KEY bulunamadı, geçici key kullanılıyor. Uygulama yeniden başlayınca veriler çözülemeyebilir!")
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
        except:
            return ""