from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, current_user
from datetime import datetime
from app.models.history import History

stats_bp = Blueprint('stats', __name__, url_prefix='/api')

@stats_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    """
    Genel İstatistikleri Getir
    Toplam vaka, işlenen resim ve bugünkü işlem sayılarını döner.
    ---
    tags:
      - Dashboard & Stats
    security:
      - Bearer: []
    responses:
      200:
        description: İstatistik verileri
        schema:
          type: object
          properties:
            total_cases:
              type: integer
            total_images:
              type: integer
            today_syncs:
              type: integer
            total_syncs:
              type: integer
    """
    if not current_user:
        return jsonify({"error": "Kullanıcı bulunamadı"}), 404
    logs = History.query.filter_by(user_id=current_user.id).all()
    today = datetime.now().strftime("%Y-%m-%d")
    return jsonify({
        "total_cases": sum(l.cases_count for l in logs),
        "total_images": sum(l.images_count for l in logs),
        "today_syncs": sum(1 for l in logs if l.date and l.date.startswith(today)),
        "total_syncs": len(logs)
    })

@stats_bp.route('/history', methods=['GET'])
@jwt_required()
def get_history():
    """
    İşlem Geçmişini Getir
    Son yapılan 50 senkronizasyon işlemini listeler.
    ---
    tags:
      - Dashboard & Stats
    security:
      - Bearer: []
    responses:
      200:
        description: Geçmiş kayıtları listesi
        schema:
          type: array
          items:
            type: object
            properties:
              id:
                type: integer
              date:
                type: string
              task:
                type: string
              case:
                type: string
              status:
                type: string
    """
    if not current_user:
        return jsonify({"error": "Kullanıcı bulunamadı"}), 404
    logs = History.query.filter_by(user_id=current_user.id).order_by(History.id.desc()).limit(50).all()
    return jsonify([{"id": l.id, "date": l.date, "task": l.task, "case": l.case_name, "status": l.status} for l in logs])