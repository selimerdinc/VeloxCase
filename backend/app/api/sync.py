# app/api/sync.py

import re
import logging
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from concurrent.futures import ThreadPoolExecutor, as_completed
from app.extensions import db
from app.models.user import User
from app.models.history import History
from app.services.sync_service import VeloxCaseSyncService

logger = logging.getLogger(__name__)

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
    if not user:
        return jsonify({'error': 'Kullanıcı bulunamadı'}), 404
    return jsonify({'folders': VeloxCaseSyncService(user.id).get_folders(id)})


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
        if not user:
            return jsonify({'error': 'Kullanıcı bulunamadı'}), 404
        return jsonify(VeloxCaseSyncService(user.id).create_folder(id, request.json.get('name', 'Yeni'),
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
        if not user:
            return jsonify({'error': 'Kullanıcı bulunamadı'}), 404
        qc = VeloxCaseSyncService(user.id)

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


@sync_bp.route('/analyze', methods=['POST'])
@jwt_required()
def analyze_task():
    """
    AI Analizi (Önizleme)
    Jira Task'ı AI ile analiz eder, Testmo'ya göndermeden önizleme sunar.
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
        description: AI analiz sonuçları
    """
    try:
        d = request.json
        user = User.query.filter_by(username=get_jwt_identity()).first()
        if not user:
            return jsonify({'error': 'Kullanıcı bulunamadı'}), 404
        qc = VeloxCaseSyncService(user.id)

        key = d.get('task_key', '').strip()
        if not key:
            return jsonify({'error': 'Task key gerekli'}), 400

        key = re.split(r'browse/', key)[-1].strip()
        
        # Jira bilgilerini al
        info = qc.get_issue(key)
        if not info['summary']:
            return jsonify({'error': 'Jira Task bulunamadı'}), 404
        
        # AI analizi yap
        from app.services.ai_service import AIService
        from app.models.setting import Setting
        
        ai_enabled_setting = Setting.query.filter_by(user_id=user.id, key='AI_ENABLED').first()
        ai_enabled = ai_enabled_setting and ai_enabled_setting.value.lower() == 'true'
        
        if ai_enabled:
            ai_service = AIService(user.id)
            custom_prompt_setting = Setting.query.filter_by(user_id=user.id, key='AI_SYSTEM_PROMPT').first()
            custom_prompt = custom_prompt_setting.value if custom_prompt_setting else None
            
            jira_desc = info.get('description', '') or ''
            # Yorumları ayrıca çek
            jira_comments = ''
            for c in qc.get_comments(key):
                jira_comments += c.get('body', '') + '\n'
            
            ai_result = ai_service.generate_test_cases(
                info['summary'], 
                jira_desc, 
                jira_comments, 
                custom_prompt
            )
            
            ai_cases = ai_result.get('test_cases', [])
            candidates = ai_result.get('automation_candidates', [])
            
            # AI başarısız olursa veya boş dönerse fallback kullan
            if not ai_cases:
                ai_cases = [{
                    'name': f'TC01: {info["summary"]}',
                    'scenario': jira_desc if jira_desc else 'Jira açıklamasından senaryo oluşturulamadı. AI kota sınırına ulaşmış olabilir.',
                    'expected_result': 'AI yanıt veremedi. Lütfen birkaç dakika bekleyip tekrar deneyin veya manuel olarak düzenleyin.',
                    'status': 'NO RUN',
                    'ai_error': True
                }]
            
            return jsonify({
                'task_key': key,
                'summary': info['summary'],
                'ai_enabled': True,
                'test_cases': ai_cases,
                'automation_candidates': candidates
            })
        else:
            # AI kapalı - regex bazlı basit analiz
            return jsonify({
                'task_key': key,
                'summary': info['summary'],
                'ai_enabled': False,
                'test_cases': [{
                    'name': f'TC01: {info["summary"]}',
                    'scenario': info.get('description', 'Senaryo bilgisi mevcut değil'),
                    'expected_result': 'Beklenen sonuç manuel olarak girilmelidir',
                    'status': 'NO RUN'
                }]
            })

    except Exception as e:
        logger.error(f"Analyze error: {e}")
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
    if not user:
        return jsonify({'error': 'Kullanıcı bulunamadı'}), 404
    qc = VeloxCaseSyncService(user.id)

    task_keys = [k.strip() for k in d.get('jira_input', '').split(',') if k.strip()]
    if len(task_keys) > 3: return jsonify({'error': 'Maksimum 3 Task'}), 400
    if not task_keys: return jsonify({'error': 'Task giriniz'}), 400

    # folder_id ve project_id'yi integer'a çevir
    try:
        pid = int(d.get('project_id', 0))
        fid = int(d.get('folder_id', 0))
    except (ValueError, TypeError):
        return jsonify({'error': 'Geçersiz Proje veya Klasör ID'}), 400
    
    if not pid or not fid:
        return jsonify({'error': 'Proje ID ve Klasör ID gereklidir'}), 400

    # YENİ: force_update parametresini al (Varsayılan False)
    force_update = d.get('force_update', False)

    results = []

    # ThreadPoolExecutor yerine sıralı işlem - Flask app context sorununu önler
    for k in task_keys:
        task_key = re.split(r'browse/', k)[-1].strip()
        try:
            res = qc.process_single_task(task_key, pid, fid, force_update)
            results.append(res)

            # Sadece başarılı işlemde (Created veya Updated) history'ye kaydet
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
        except Exception as e:
            results.append({'task': task_key, 'status': 'error', 'msg': str(e)})
    
    db.session.commit()

    return jsonify({'results': results})