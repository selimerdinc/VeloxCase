from datetime import datetime
from app.extensions import db


class InviteCode(db.Model):
    """Davet kodu modeli - Kayıt için gerekli"""
    __tablename__ = 'invite_codes'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(32), unique=True, nullable=False, index=True)
    
    # Kim oluşturdu
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Geçerlilik
    expires_at = db.Column(db.DateTime, nullable=True)  # None = sınırsız
    max_uses = db.Column(db.Integer, default=1)
    current_uses = db.Column(db.Integer, default=0)
    
    # Durum
    is_active = db.Column(db.Boolean, default=True)
    
    # İlişkiler
    creator = db.relationship('User', backref=db.backref('created_invites', lazy='dynamic'))

    def is_valid(self):
        """Kodun hala geçerli olup olmadığını kontrol et"""
        if not self.is_active:
            return False
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return False
        if self.current_uses >= self.max_uses:
            return False
        return True

    def use(self):
        """Kodu kullan (sayacı artır)"""
        self.current_uses += 1

    def to_dict(self):
        return {
            'id': self.id,
            'code': self.code,
            'created_by': self.creator.username if self.creator else 'Unknown',
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'max_uses': self.max_uses,
            'current_uses': self.current_uses,
            'is_active': self.is_active,
            'is_valid': self.is_valid()
        }

    def __repr__(self):
        return f"<InviteCode {self.code}>"
