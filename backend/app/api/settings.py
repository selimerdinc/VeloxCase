from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.setting import Setting
from app.services.encryption_service import EncryptionService

settings_bp = Blueprint('settings', __name__, url_prefix='/api')

@settings_bp.route('/settings', methods=['GET'])
@jwt_required()
def get_settings():
    """
    Ayarları Görüntüle
    Kullanıcının kayıtlı API yapılandırmalarını getirir.
    ---
    tags:
      - Configuration
    security:
      - Bearer: []
    responses:
      200:
        description: Ayar değerleri
        schema:
          type: object
          properties:
            JIRA_BASE_URL:
              type: string
            JIRA_EMAIL:
              type: string
            JIRA_API_TOKEN:
              type: string
              description: Güvenlik nedeniyle maskeli gelir
            TESTMO_BASE_URL:
              type: string
            TESTMO_API_KEY:
              type: string
              description: Güvenlik nedeniyle maskeli gelir
    """
    current_user = User.query.filter_by(username=get_jwt_identity()).first()
    if not current_user:
        return jsonify({"error": "Kullanıcı bulunamadı"}), 404
    user_settings = Setting.query.filter_by(user_id=current_user.id).all()
    
    # Sadece hassas verileri deşifre et, diğerlerini olduğu gibi al
    sensitive_keys = ["JIRA_API_TOKEN", "TESTMO_API_KEY", "AI_API_KEY"]
    cfg = {}
    for s in user_settings:
        if s.key in sensitive_keys:
            cfg[s.key] = EncryptionService.decrypt(s.value)
        else:
            cfg[s.key] = s.value

    
    # Veritabanında TESTMO_BASE_URL veya TESTMO_API_URL olarak kayıtlı olabilir, ikisini de kontrol et
    testmo_url = cfg.get("TESTMO_BASE_URL") or cfg.get("TESTMO_API_URL", "")
    
    return jsonify({
        "JIRA_BASE_URL": cfg.get("JIRA_BASE_URL", ""),
        "JIRA_EMAIL": cfg.get("JIRA_EMAIL", ""),
        "JIRA_API_TOKEN": "********" if cfg.get("JIRA_API_TOKEN") else "",
        "TESTMO_API_URL": testmo_url,
        "TESTMO_API_KEY": "********" if cfg.get("TESTMO_API_KEY") else "",
        "AI_ENABLED": cfg.get("AI_ENABLED", "false"),
        "AI_API_KEY": "********" if cfg.get("AI_API_KEY") else "",
        "AI_SYSTEM_PROMPT": cfg.get("AI_SYSTEM_PROMPT", ""),
        "AI_VISION_ENABLED": cfg.get("AI_VISION_ENABLED", "false"),
        "AI_AUTOMATION_ENABLED": cfg.get("AI_AUTOMATION_ENABLED", "false"),
        "AI_NEGATIVE_ENABLED": cfg.get("AI_NEGATIVE_ENABLED", "false"),
        "AI_MOCKDATA_ENABLED": cfg.get("AI_MOCKDATA_ENABLED", "false")
    })



@settings_bp.route('/settings', methods=['POST'])
@jwt_required()
def update_settings():
    """
    Ayarları Güncelle
    API anahtarlarını ve URL'leri şifreli olarak kaydeder.
    ---
    tags:
      - Configuration
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            JIRA_BASE_URL:
              type: string
            JIRA_EMAIL:
              type: string
            JIRA_API_TOKEN:
              type: string
            TESTMO_BASE_URL:
              type: string
            TESTMO_API_KEY:
              type: string
    responses:
      200:
        description: Kayıt başarılı
    """
    current_user = User.query.filter_by(username=get_jwt_identity()).first()
    if not current_user:
        return jsonify({"error": "Kullanıcı bulunamadı"}), 404
    data = request.json
    for key, value in data.items():
        if value and value != "********":
            # Frontend TESTMO_API_URL gönderiyor, backend TESTMO_BASE_URL bekliyor
            db_key = "TESTMO_BASE_URL" if key == "TESTMO_API_URL" else key
            
            # AI_API_KEY, JIRA_API_TOKEN ve TESTMO_API_KEY şifrelenmeli
            if db_key in ["JIRA_API_TOKEN", "TESTMO_API_KEY", "AI_API_KEY"]:
                val_enc = EncryptionService.encrypt(value)
            else:
                val_enc = str(value)

            setting = Setting.query.filter_by(user_id=current_user.id, key=db_key).first()
            if setting:
                setting.value = val_enc
            else:
                db.session.add(Setting(user_id=current_user.id, key=db_key, value=val_enc))

    db.session.commit()
    return jsonify({"msg": "Kaydedildi"}), 200