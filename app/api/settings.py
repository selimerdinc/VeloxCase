from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.models.setting import Setting
from app.services.encryption_service import EncryptionService

settings_bp = Blueprint('settings', __name__, url_prefix='/api')


@settings_bp.route('/settings', methods=['GET', 'POST'])
@jwt_required()
def settings():
    current_user = User.query.filter_by(username=get_jwt_identity()).first()

    if request.method == 'GET':
        user_settings = Setting.query.filter_by(user_id=current_user.id).all()
        cfg = {s.key: EncryptionService.decrypt(s.value) for s in user_settings}
        return jsonify({
            "JIRA_BASE_URL": cfg.get("JIRA_BASE_URL", ""),
            "JIRA_EMAIL": cfg.get("JIRA_EMAIL", ""),
            "JIRA_API_TOKEN": "********" if cfg.get("JIRA_API_TOKEN") else "",
            "TESTMO_BASE_URL": cfg.get("TESTMO_BASE_URL", ""),
            "TESTMO_API_KEY": "********" if cfg.get("TESTMO_API_KEY") else ""
        })

    if request.method == 'POST':
        data = request.json
        for key, value in data.items():
            if value and value != "********":
                val_enc = EncryptionService.encrypt(value)
                setting = Setting.query.filter_by(user_id=current_user.id, key=key).first()
                if setting:
                    setting.value = val_enc
                else:
                    db.session.add(Setting(user_id=current_user.id, key=key, value=val_enc))
        db.session.commit()
        return jsonify({"msg": "Kaydedildi"}), 200