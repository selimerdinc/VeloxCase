# app/api/sync.py

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
    """
    Testmo Klasörlerini Getir
    Belirtilen Proje ID'sine ait klasörleri listeler.
    ---
    tags:
      - Sync Operations
    security:
      - Bearer: []
    parameters:
      - name: id
        in: path
        type: integer
        required: true
        description: Testmo Proje ID (Repo ID)
    responses:
      200:
        description: Klasör listesi
    """
    user = User.query.filter_by(username=get_jwt_identity()).first()
    return jsonify({'folders': QuickCaseSyncService(user.id).get_folders(id)})


@sync_bp.route('/folders/<int:id>', methods=['POST'])
@jwt_required()
def create_folder(id):
    """
    Yeni Klasör Oluştur
    Testmo üzerinde yeni bir klasör oluşturur.
    ---
    tags:
      - Sync Operations
    security:
      - Bearer: []
    parameters:
      - name: id
        in: path
        type: integer
        required: true
        description: Testmo Proje ID
      - name: body
        in: body
        schema:
          type: object
          properties:
            name:
              type: string
              example: "Yeni Test Klasörü"
            parent_id:
              type: integer
              example: 12
    responses:
      200:
        description: Oluşturulan klasör bilgisi
    """
    try:
        user = User.query.filter_by(username=get_jwt_identity()).first()
        return jsonify(QuickCaseSyncService(user.id).create_folder(id, request.json.get('name', 'Yeni'),
                                                                   request.json.get('parent_id')))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@sync_bp.route('/preview', methods=['POST'])
@jwt_required()
def preview_task():
    """
    Jira Task Önizleme
    Girilen Jira Key için özet bilgileri getirir.
    ---
    tags:
      - Sync Operations
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        schema:
          type: object
          required:
            - task_key
          properties:
            task_key:
              type: string
              example: "PROJ-123"
    responses:
      200:
        description: Task bulundu
      404:
        description: Task bulunamadı
    """
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
    """
    Jira -> Testmo Senkronizasyonu (Sync)
    Jira Task'larını okur, Testmo'ya Case olarak aktarır.
    ---
    tags:
      - Sync Operations
    security:
      - Bearer: []
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          required:
            - jira_input
            - project_id
            - folder_id
          properties:
            jira_input:
              type: string
              description: Virgülle ayrılmış Jira Keyleri
              example: "PROJ-123, PROJ-456"
            project_id:
              type: integer
              description: Testmo Proje ID
              example: 1
            folder_id:
              type: integer
              description: Testmo Klasör ID
              example: 15
            force_update:
              type: boolean
              description: Eğer true ise, aynı isimdeki case'in üzerine yazar.
              default: false
    responses:
      200:
        description: İşlem sonuçları
    """
    d = request.json
    user = User.query.filter_by(username=get_jwt_identity()).first()
    qc = QuickCaseSyncService(user.id)

    task_keys = [k.strip() for k in d.get('jira_input', '').split(',') if k.strip()]
    if len(task_keys) > 3: return jsonify({'error': 'Maksimum 3 Task'}), 400
    if not task_keys: return jsonify({'error': 'Task giriniz'}), 400

    pid, fid = d['project_id'], d['folder_id']

    # YENİ: force_update parametresini al (Varsayılan False)
    force_update = d.get('force_update', False)

    results = []

    with ThreadPoolExecutor(max_workers=3) as executor:
        # qc.process_single_task'a force_update parametresini iletiyoruz
        futures = [executor.submit(qc.process_single_task, re.split(r'browse/', k)[-1].strip(), pid, fid, force_update)
                   for k in task_keys]

        for future in as_completed(futures):
            res = future.result()
            results.append(res)

            # Sadece başarılı işlemde (Created veya Updated) history'ye kaydet
            # Duplicate durumunda history eklenmez
            if res['status'] == 'success':
                status_text = "UPDATED" if res.get('action') == 'updated' else "SUCCESS"

                db.session.add(History(
                    date=datetime.now().strftime("%Y-%m-%d %H:%M"),
                    task=res['task'],
                    repo_id=pid,
                    folder_id=fid,
                    cases_count=1,
                    images_count=res.get('images', 0),
                    status=status_text,
                    case_name=res['case_name'],
                    user_id=user.id
                ))
        db.session.commit()

    return jsonify({'results': results})