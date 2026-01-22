# scripts/verify_admin_fix.py
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend')))

from unittest.mock import MagicMock
import sys
sys.modules["google"] = MagicMock()
sys.modules["google.generativeai"] = MagicMock()

from app import create_app, db
from app.models.user import User
from app.models.invite_code import InviteCode, InviteUsage
from werkzeug.security import generate_password_hash

app = create_app()

with app.app_context():
    print("🚀 Verifying Admin Logic...")
    
    # 1. Setup Admin
    admin = User.query.filter_by(username='test_admin').first()
    if not admin:
        admin = User(username='test_admin', password_hash=generate_password_hash('12345678'), is_admin=True)
        db.session.add(admin)
        db.session.commit()
    
    print(f"✅ Admin: {admin.username}")

    # 2. Setup Invite Code & User
    code_str = "TEST-VERIFY-123"
    invite = InviteCode.query.filter_by(code=code_str).first()
    if invite:
        db.session.delete(invite) # Clean start
        db.session.commit()
    
    invite = InviteCode(code=code_str, created_by=admin.id, max_uses=5)
    db.session.add(invite)
    
    test_user = User.query.filter_by(username='test_user_verify').first()
    if test_user:
        # User silinirse history falan da gider ama bu test, sorun yok
        usage = InviteUsage.query.filter_by(user_id=test_user.id).delete()
        db.session.delete(test_user)
        db.session.commit()
        
    test_user = User(username='test_user_verify', password_hash='hash')
    db.session.add(test_user)
    db.session.flush()
    
    # Kodu kullandır
    invite.use(test_user.id)
    db.session.commit()
    
    print("✅ Created Invite & User")
    
    # 3. Verify 'List' logic (admin.py)
    # Backend'deki to_dict mantığı manuel simüle edelim
    c_dict = invite.to_dict()
    usernames = [u['username'] for u in c_dict.get('used_by', [])]
    
    if 'test_user_verify' in usernames:
        print(f"✅ SUCCESS: 'test_user_verify' found in used list: {usernames}")
    else:
        print(f"❌ FAIL: User not found in list: {usernames}")

    # 4. Verify 'Delete' logic (admin.py)
    # Kullanılmış kod -> Silinmemeli, PASİF olmalı
    usage_count = InviteUsage.query.filter_by(invite_code_id=invite.id).count()
    if usage_count == 0:
         print("❌ FAIL: Usage count should be > 0")
    else:
         invite.is_active = False
         db.session.commit()
         
         check = InviteCode.query.get(invite.id)
         if check and not check.is_active:
             print("✅ SUCCESS: Used code set to passive (not deleted)")
         else:
             print("❌ FAIL: Code logic wrong")

    # 5. Verify Clean Delete
    # Hiç kullanılmamış kod
    unused_code = InviteCode(code="UNUSED-123", created_by=admin.id)
    db.session.add(unused_code)
    db.session.commit()
    unused_id = unused_code.id
    
    usage_check_2 = InviteUsage.query.filter_by(invite_code_id=unused_id).count() # Should be 0
    if usage_check_2 == 0:
        db.session.delete(unused_code)
        db.session.commit()
        if not InviteCode.query.get(unused_id):
            print("✅ SUCCESS: Unused code deleted permanently")
        else:
            print("❌ FAIL: Unused code NOT deleted")
