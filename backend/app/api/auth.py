from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.extensions import db, limiter
from app.models.user import User

auth_bp = Blueprint('auth', __name__, url_prefix='/api')

@auth_bp.route('/register', methods=['POST'])
@limiter.limit("10 per minute")
def register():
    """
    Yeni Kullanıcı Kaydı
    Sisteme yeni bir kullanıcı ekler.
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
      201:
        description: Kullanıcı başarıyla oluşturuldu
      400:
        description: Eksik bilgi veya kullanıcı adı dolu
    """
    try:
        data = request.json or {}
        u, p = data.get("username"), data.get("password")
        if not u or not p: return jsonify({"msg": "Kullanıcı adı ve şifre zorunludur"}), 400
        if len(p) < 8: return jsonify({"msg": "Şifre en az 8 karakter olmalıdır"}), 400
        if User.query.filter_by(username=u).first(): return jsonify({"msg": "Bu kullanıcı adı zaten kullanımda"}), 400

        db.session.add(User(username=u, password_hash=generate_password_hash(p, method='pbkdf2:sha256')))
        db.session.commit()
        return jsonify({"msg": "Kullanıcı başarıyla oluşturuldu"}), 201
    except Exception as e:
        return jsonify({"msg": f"Sunucu hatası: {str(e)}"}), 500

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
            return jsonify(access_token=create_access_token(identity=user.username)), 200
        
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
        return jsonify({"msg": f"Sunucu hatası: {str(e)}"}), 500