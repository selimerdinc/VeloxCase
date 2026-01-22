import re
from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.extensions import db, limiter
from app.models.user import User
from app.models.invite_code import InviteCode

auth_bp = Blueprint('auth', __name__, url_prefix='/api')


def validate_username(username):
    """Username validation - güvenlik için"""
    if not username or len(username) < 3:
        return "Kullanıcı adı en az 3 karakter olmalıdır"
    if len(username) > 30:
        return "Kullanıcı adı en fazla 30 karakter olabilir"
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        return "Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir"
    return None


@auth_bp.route('/register', methods=['POST'])
@limiter.limit("10 per minute")
def register():
    """
    Yeni Kullanıcı Kaydı
    Sisteme yeni bir kullanıcı ekler. Geçerli davet kodu gerektirir.
    ---
    tags:
      - Authentication
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - username
            - password
            - invite_code
          properties:
            username:
              type: string
              example: "newuser"
            password:
              type: string
              example: "secret123"
            invite_code:
              type: string
              example: "VLX-ABC123"
    responses:
      201:
        description: Kullanıcı başarıyla oluşturuldu
      400:
        description: Eksik bilgi, geçersiz davet kodu veya kullanıcı adı dolu
    """
    try:
        data = request.json or {}
        username = data.get("username", "").strip()
        password = data.get("password", "")
        invite_code_str = data.get("invite_code", "").strip().upper()

        # Temel validasyonlar
        if not username or not password:
            return jsonify({"msg": "Kullanıcı adı ve şifre zorunludur"}), 400
        
        # Username validation
        username_error = validate_username(username)
        if username_error:
            return jsonify({"msg": username_error}), 400

        if len(password) < 8:
            return jsonify({"msg": "Şifre en az 8 karakter olmalıdır"}), 400

        # Davet kodu kontrolü
        if not invite_code_str:
            return jsonify({"msg": "Davet kodu zorunludur"}), 400

        invite = InviteCode.query.filter_by(code=invite_code_str).first()
        if not invite:
            return jsonify({"msg": "Geçersiz davet kodu"}), 400
        
        if not invite.is_valid():
            return jsonify({"msg": "Davet kodu geçersiz veya süresi dolmuş"}), 400

        # Kullanıcı adı kontrolü
        if User.query.filter_by(username=username).first():
            return jsonify({"msg": "Bu kullanıcı adı zaten kullanımda"}), 400

        # Kullanıcı oluştur
        new_user = User(
            username=username,
            password_hash=generate_password_hash(password, method='pbkdf2:sha256')
        )
        db.session.add(new_user)
        db.session.flush()  # ID alabilmek için flush et
        
        # Davet kodunu kullandı olarak işaretle (Kullanıcı ID ile)
        invite.use(new_user.id)
        
        db.session.commit()
        return jsonify({"msg": "Kullanıcı başarıyla oluşturuldu"}), 201
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Register error: {e}")
        return jsonify({"msg": "Kayıt sırasında bir hata oluştu"}), 500


@auth_bp.route('/login', methods=['POST'])
@limiter.limit("20 per minute")
def login():
    """
    Sisteme Giriş (Login)
    JWT Token almak için kullanılır.
    ---
    tags:
      - Authentication
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - username
            - password
          properties:
            username:
              type: string
              example: "admin"
            password:
              type: string
              example: "secret123"
    responses:
      200:
        description: Giriş başarılı, token döner
        schema:
          type: object
          properties:
            access_token:
              type: string
      401:
        description: Hatalı giriş
    """
    try:
        data = request.json or {}
        username = data.get("username", "").strip()
        password = data.get("password", "")
        
        if not username or not password:
            return jsonify({"msg": "Kullanıcı adı ve şifre gereklidir"}), 400
        
        user = User.query.filter_by(username=username).first()
        if user and check_password_hash(user.password_hash, password):
            return jsonify(
                access_token=create_access_token(identity=user.username),
                is_admin=user.is_admin
            ), 200
        
        # Güvenlik: Kullanıcı var/yok ayırt edilmemeli
        return jsonify({"msg": "Geçersiz kullanıcı adı veya şifre"}), 401
    except Exception as e:
        return jsonify({"msg": "Giriş işlemi sırasında bir hata oluştu"}), 500


@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """
    Şifre Değiştirme
    Mevcut kullanıcının şifresini günceller.
    ---
    tags:
      - Authentication
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - old_password
            - new_password
          properties:
            old_password:
              type: string
            new_password:
              type: string
    responses:
      200:
        description: Şifre güncellendi
      400:
        description: Yeni şifre kurallara uymuyor
      401:
        description: Eski şifre yanlış
    """
    try:
        user = User.query.filter_by(username=get_jwt_identity()).first()
        if not user:
            return jsonify({"msg": "Kullanıcı bulunamadı"}), 404
            
        d = request.json or {}

        if not check_password_hash(user.password_hash, d.get('old_password')):
            return jsonify({"msg": "Mevcut şifre hatalı"}), 401

        new_password = d.get('new_password', '')
        if len(new_password) < 8:
            return jsonify({"msg": "Yeni şifre en az 8 karakter olmalıdır"}), 400

        user.password_hash = generate_password_hash(new_password, method='pbkdf2:sha256')
        db.session.commit()
        return jsonify({"msg": "Şifreniz başarıyla güncellendi"}), 200
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Change password error: {e}")
        return jsonify({"msg": "Şifre değiştirme sırasında bir hata oluştu"}), 500