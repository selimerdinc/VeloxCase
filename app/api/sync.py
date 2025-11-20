import re
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from concurrent.futures import ThreadPoolExecutor, as_completed
from app.extensions import db
from app.models.user import User
from app.models.history import History
from app.services.sync_service import QuickCaseSyncService

sync_bp = Blueprint('sync', __name__, url_prefix='/api')

@sync_bp.route('/folders/<int:id>', methods=['GET'])
@jwt_required()
def get_folders(id):
    user = User.query.filter_by(username=get_jwt_identity()).first()
    return jsonify({'folders': QuickCaseSyncService(user.id).get_folders(id)})

@sync_bp.route('/folders/<int:id>', methods=['POST'])
@jwt_required()
def create_folder(id):
    try:
        user = User.query.filter_by(username=get_jwt_identity()).first()
        return jsonify(QuickCaseSyncService(user.id).create_folder(id, request.json.get('name', 'Yeni'), request.json.get('parent_id')))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sync_bp.route('/preview', methods=['POST'])
@jwt_required()
def preview_task():
    try:
        d = request.json
        user = User.query.filter_by(username=get_jwt_identity()).first()
        qc = QuickCaseSyncService(user.id)

        key = d.get('task_key', '').strip()
        if not key: return jsonify({'error': 'Boş ID'}), 400

        key = re.split(r'browse/', key)[-1].strip().split(',')[0]
        info = qc.get_issue(key)

        if info['summary']:
            return jsonify({'found': True, 'key': key, 'summary': info['summary'], 'status': 'Active', 'icon': ''})
        else:
            return jsonify({'found': False}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@sync_bp.route('/sync', methods=['POST'])
@jwt_required()
def sync():
    d = request.json
    user = User.query.filter_by(username=get_jwt_identity()).first()
    qc = QuickCaseSyncService(user.id)

    task_keys = [k.strip() for k in d.get('jira_input', '').split(',') if k.strip()]
    if len(task_keys) > 3: return jsonify({'error': 'Maksimum 3 Task'}), 400
    if not task_keys: return jsonify({'error': 'Task giriniz'}), 400

    pid, fid = d['project_id'], d['folder_id']
    results = []

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(qc.process_single_task, re.split(r'browse/', k)[-1].strip(), pid, fid) for k in task_keys]
        for future in as_completed(futures):
            res = future.result()
            results.append(res)
            if res['status'] == 'success':
                db.session.add(History(
                    date=datetime.now().strftime("%Y-%m-%d %H:%M"),
                    task=res['task'],
                    repo_id=pid,
                    folder_id=fid,
                    cases_count=1,
                    images_count=res.get('images', 0),
                    status="SUCCESS",
                    case_name=res['case_name'],
                    user_id=user.id
                ))
        db.session.commit()

    return jsonify({'results': results})