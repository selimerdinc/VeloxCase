# app/api/admin.py
"""
Admin API endpoints - Davet kodu yönetimi
Sadece is_admin=True olan kullanıcılar erişebilir
"""
import secrets
import logging
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, current_user
from app.extensions import db, limiter
from app.models.invite_code import InviteCode

# Loglama yapılandırması
logger = logging.getLogger(__name__)

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')


def require_admin():
    """Admin yetkisi kontrolü - current_user kullanarak optimize edildi"""
    if not current_user or not current_user.is_admin:
        return None
    return current_user


def generate_invite_code():
    """Benzersiz davet kodu üret: VLX-XXXXXX"""
    while True:
        code = f"VLX-{secrets.token_hex(3).upper()}"
        if not InviteCode.query.filter_by(code=code).first():
            return code


@admin_bp.route('/invite-codes', methods=['GET'])
@jwt_required()
def list_invite_codes():
    """
    Tüm davet kodlarını listele
    ---
    tags:
      - Admin
    security:
      - Bearer: []
    responses:
      200:
        description: Davet kodları listesi (Kullanan kullanıcı adları dahil)
      403:
        description: Admin yetkisi gerekli
    """
    admin = require_admin()
    if not admin:
        return jsonify({"msg": "Bu işlem için admin yetkisi gereklidir"}), 403

    codes = InviteCode.query.order_by(InviteCode.created_at.desc()).all()

    # Premium: Kodları kullanan kullanıcıların listesini de ekliyoruz
    result = []
    for code in codes:
        c_dict = code.to_dict()
        # InviteCode.to_dict() zaten 'used_by' içinde detayları veriyor.
        # Biz burada sadece frontend'in beklediği formatta username listesi oluşturacağız.
        c_dict['used_by_usernames'] = [u['username'] for u in c_dict.get('used_by', [])]
        result.append(c_dict)

    return jsonify({
        "invite_codes": result
    })


@admin_bp.route('/invite-codes', methods=['POST'])
@jwt_required()
@limiter.limit("20 per hour")
def create_invite_code():
    """
    Yeni davet kodu oluştur
    ---
    tags:
      - Admin
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        schema:
          type: object
          properties:
            max_uses:
              type: integer
              default: 1
              description: Maksimum kullanım sayısı
            expires_in_days:
              type: integer
              default: 7
              description: Kaç gün geçerli (0 = sınırsız)
    responses:
      201:
        description: Davet kodu oluşturuldu
      403:
        description: Admin yetkisi gerekli
    """
    admin = require_admin()
    if not admin:
        return jsonify({"msg": "Bu işlem için admin yetkisi gereklidir"}), 403

    data = request.json or {}
    max_uses = data.get('max_uses', 1)
    expires_in_days = data.get('expires_in_days', 7)

    # Validasyon
    if max_uses < 1 or max_uses > 100:
        return jsonify({"msg": "Kullanım limiti 1-100 arasında olmalıdır"}), 400

    # Expire tarihi hesapla
    expires_at = None
    if expires_in_days > 0:
        expires_at = datetime.utcnow() + timedelta(days=expires_in_days)

    # Kod oluştur
    invite = InviteCode(
        code=generate_invite_code(),
        created_by=admin.id,
        max_uses=max_uses,
        expires_at=expires_at
    )
    db.session.add(invite)
    db.session.commit()

    res = invite.to_dict()
    res['used_by_usernames'] = []

    return jsonify({
        "msg": "Davet kodu oluşturuldu",
        "invite_code": res
    }), 201


@admin_bp.route('/invite-codes/<int:code_id>', methods=['DELETE'])
@jwt_required()
def revoke_invite_code(code_id):
    """
    Davet kodunu iptal et veya tamamen sil
    ---
    tags:
      - Admin
    security:
      - Bearer: []
    parameters:
      - name: code_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Kod silindi veya iptal edildi
      403:
        description: Admin yetkisi gerekli
      404:
        description: Kod bulunamadı
    """
    admin = require_admin()
    if not admin:
        return jsonify({"msg": "Bu işlem için admin yetkisi gereklidir"}), 403

    invite = InviteCode.query.get(code_id)
    if not invite:
        return jsonify({"msg": "Davet kodu bulunamadı"}), 404

    # Premium Mantık: Eğer kod hiç kullanılmadıysa veritabanından tamamen sileriz.
    # Kullanıldıysa, veritabanı bütünlüğü için sadece pasife çekeriz.
    # User modelinde invite_code_id yok, InviteUsage tablosuna bakmalıyız.
    from app.models.invite_code import InviteUsage
    usage_count = InviteUsage.query.filter_by(invite_code_id=code_id).count()

    if usage_count == 0:
        db.session.delete(invite)
        db.session.commit()
        return jsonify({"msg": "Davet kodu kalıcı olarak silindi"})
    else:
        invite.is_active = False
        db.session.commit()
        return jsonify({"msg": "Kod kullanıldığı için silinemedi, ancak kullanıma kapatıldı"})


@admin_bp.route('/users', methods=['GET'])
@jwt_required()
def list_users():
    """
    Tüm kullanıcıları listele (Admin only)
    ---
    tags:
      - Admin
    security:
      - Bearer: []
    responses:
      200:
        description: Kullanıcı listesi
      403:
        description: Admin yetkisi gerekli
    """
    admin = require_admin()
    if not admin:
        return jsonify({"msg": "Bu işlem için admin yetkisi gereklidir"}), 403

    users = User.query.all()
    return jsonify({
        "users": [{
            "id": u.id,
            "username": u.username,
            "is_admin": u.is_admin
        } for u in users]
    })


@admin_bp.route('/users/<int:user_id>/toggle-admin', methods=['POST'])
@jwt_required()
def toggle_admin(user_id):
    """
    Kullanıcının admin yetkisini değiştir
    ---
    tags:
      - Admin
    security:
      - Bearer: []
    parameters:
      - name: user_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Yetki güncellendi
      403:
        description: Admin yetkisi gerekli
      404:
        description: Kullanıcı bulunamadı
    """
    admin = require_admin()
    if not admin:
        return jsonify({"msg": "Bu işlem için admin yetkisi gereklidir"}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({"msg": "Kullanıcı bulunamadı"}), 404

    # Kendini admin'den düşüremez
    if user.id == admin.id:
        return jsonify({"msg": "Kendinizin admin yetkisini kaldıramazsınız"}), 400

    user.is_admin = not user.is_admin
    db.session.commit()

    return jsonify({
        "msg": f"'{user.username}' artık {'admin' if user.is_admin else 'normal kullanıcı'}",
        "is_admin": user.is_admin
    })


@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    """
    Kullanıcıyı ve tüm verilerini sil (Admin only)
    ---
    tags:
      - Admin
    security:
      - Bearer: []
    parameters:
      - name: user_id
        in: path
        type: integer
        required: true
    responses:
      200:
        description: Kullanıcı silindi
      400:
        description: Kendi hesabınızı silemezsiniz
      403:
        description: Admin yetkisi gerekli
      404:
        description: Kullanıcı bulunamadı
    """
    admin = require_admin()
    if not admin:
        return jsonify({"msg": "Bu işlem için admin yetkisi gereklidir"}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({"msg": "Kullanıcı bulunamadı"}), 404

    # Kendini silemez
    if user.id == admin.id:
        return jsonify({"msg": "Kendi hesabınızı silemezsiniz. Başka bir adminin sizi silmesi gerekir."}), 400

    username = user.username

    try:
        # 1. Ayarları sil
        from app.models.setting import Setting
        Setting.query.filter_by(user_id=user.id).delete()

        # 2. Geçmişi sil
        from app.models.history import History
        History.query.filter_by(user_id=user.id).delete()

        # 3. Kullanıcıyı sil
        db.session.delete(user)
        db.session.commit()

        return jsonify({"msg": f"'{username}' kullanıcısı ve tüm verileri başarıyla silindi"})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting user {user_id}: {str(e)}")
        return jsonify({"msg": "Silme işlemi sırasında sunucu tarafında bir hata oluştu"}), 500