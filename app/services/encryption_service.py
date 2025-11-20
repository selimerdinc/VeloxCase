import os
from cryptography.fernet import Fernet
from flask import current_app

class EncryptionService:
    _cipher_suite = None

    @classmethod
    def get_cipher(cls):
        if cls._cipher_suite is None:
            key = current_app.config.get('ENCRYPTION_KEY')
            if not key:
                # Key yoksa geçici oluştur (Uyarı verilebilir)
                key = Fernet.generate_key().decode()
                print("⚠️ UYARI: ENCRYPTION_KEY bulunamadı, geçici key kullanılıyor.")
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