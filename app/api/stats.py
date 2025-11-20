from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app.models.user import User
from app.models.history import History

stats_bp = Blueprint('stats', __name__, url_prefix='/api')

@stats_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    user = User.query.filter_by(username=get_jwt_identity()).first()
    logs = History.query.filter_by(user_id=user.id).all()
    today = datetime.now().strftime("%Y-%m-%d")
    return jsonify({
        "total_cases": sum(l.cases_count for l in logs),
        "total_images": sum(l.images_count for l in logs),
        "today_syncs": sum(1 for l in logs if l.date.startswith(today)),
        "total_syncs": len(logs)
    })

@stats_bp.route('/history', methods=['GET'])
@jwt_required()
def get_history():
    user = User.query.filter_by(username=get_jwt_identity()).first()
    logs = History.query.filter_by(user_id=user.id).order_by(History.id.desc()).limit(50).all()
    return jsonify([{"id": l.id, "date": l.date, "task": l.task, "case": l.case_name, "status": l.status} for l in logs])