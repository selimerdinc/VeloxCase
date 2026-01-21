// src/features/admin/AdminPanel.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ArrowLeft, Ticket, UserCog, Plus, Copy, Trash2, Loader2, Shield, Users, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import config from '../../config';

function AdminPanel() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [activeTab, setActiveTab] = useState('invites');

    // Invite codes state
    const [inviteCodes, setInviteCodes] = useState([]);
    const [creating, setCreating] = useState(false);
    const [newCodeSettings, setNewCodeSettings] = useState({ max_uses: 1, expires_in_days: 7 });

    // Users state
    const [users, setUsers] = useState([]);

    const fetchInviteCodes = useCallback(async () => {
        try {
            const res = await axios.get(`${config.API_BASE_URL}/admin/invite-codes`);
            setInviteCodes(res.data.invite_codes || []);
            setIsAdmin(true);
        } catch (err) {
            if (err.response?.status === 403) {
                setIsAdmin(false);
                toast.error('Bu sayfaya erişim için admin yetkisi gereklidir.');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchUsers = useCallback(async () => {
        try {
            const res = await axios.get(`${config.API_BASE_URL}/admin/users`);
            setUsers(res.data.users || []);
        } catch (err) {
            console.error('Users fetch error:', err);
        }
    }, []);

    useEffect(() => {
        fetchInviteCodes();
        fetchUsers();
    }, [fetchInviteCodes, fetchUsers]);

    const handleCreateCode = async () => {
        setCreating(true);
        try {
            const res = await axios.post(`${config.API_BASE_URL}/admin/invite-codes`, newCodeSettings);
            toast.success('Davet kodu oluşturuldu!', { icon: '🎟️' });
            setInviteCodes(prev => [res.data.invite_code, ...prev]);
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Kod oluşturulamadı');
        } finally {
            setCreating(false);
        }
    };

    const handleCopyCode = (code) => {
        navigator.clipboard.writeText(code);
        toast.success('Kod kopyalandı!', { icon: '📋' });
    };

    const handleRevokeCode = async (codeId) => {
        if (!window.confirm('Bu davet kodunu iptal etmek istediğinize emin misiniz?')) return;
        try {
            await axios.delete(`${config.API_BASE_URL}/admin/invite-codes/${codeId}`);
            toast.success('Davet kodu iptal edildi');
            setInviteCodes(prev => prev.map(c => c.id === codeId ? { ...c, is_active: false, is_valid: false } : c));
        } catch (err) {
            toast.error('İptal işlemi başarısız');
        }
    };

    const handleToggleAdmin = async (userId) => {
        try {
            const res = await axios.post(`${config.API_BASE_URL}/admin/users/${userId}/toggle-admin`);
            toast.success(res.data.msg);
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_admin: res.data.is_admin } : u));
        } catch (err) {
            toast.error(err.response?.data?.msg || 'İşlem başarısız');
        }
    };

    if (loading) {
        return (
            <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <Loader2 className="spinner" size={40} />
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="app-container">
                <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                    <Shield size={60} style={{ color: 'var(--error)', marginBottom: 20 }} />
                    <h2>Erişim Engellendi</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Bu sayfaya erişim için admin yetkisi gereklidir.</p>
                    <button onClick={() => navigate('/')} className="btn btn-primary">Ana Sayfaya Dön</button>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-panel card" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div className="page-header">
                <button onClick={() => navigate('/')} className="btn-back"><ArrowLeft size={20} /> Geri Dön</button>
                <div><h2>Admin Paneli</h2><p>Kullanıcı ve Davet Kodu Yönetimi</p></div>
            </div>

            {/* Tabs */}
            <div className="settings-tabs">
                <button className={`tab-btn ${activeTab === 'invites' ? 'active' : ''}`} onClick={() => setActiveTab('invites')}>
                    <Ticket size={18} /> Davet Kodları
                </button>
                <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
                    <Users size={18} /> Kullanıcılar
                </button>
            </div>

            {activeTab === 'invites' ? (
                <div className="tab-content fade-in">
                    {/* Yeni Kod Oluştur */}
                    <div style={{ display: 'flex', gap: 15, alignItems: 'flex-end', marginBottom: 25, padding: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Kullanım Limiti</label>
                            <select
                                className="form-input"
                                value={newCodeSettings.max_uses}
                                onChange={e => setNewCodeSettings(s => ({ ...s, max_uses: parseInt(e.target.value) }))}
                            >
                                <option value={1}>1 Kez</option>
                                <option value={5}>5 Kez</option>
                                <option value={10}>10 Kez</option>
                                <option value={50}>50 Kez</option>
                            </select>
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Geçerlilik Süresi</label>
                            <select
                                className="form-input"
                                value={newCodeSettings.expires_in_days}
                                onChange={e => setNewCodeSettings(s => ({ ...s, expires_in_days: parseInt(e.target.value) }))}
                            >
                                <option value={1}>1 Gün</option>
                                <option value={7}>7 Gün</option>
                                <option value={30}>30 Gün</option>
                                <option value={0}>Sınırsız</option>
                            </select>
                        </div>
                        <button onClick={handleCreateCode} className="btn-premium" disabled={creating} style={{ height: 44 }}>
                            {creating ? <Loader2 className="spinner" size={18} /> : <><Plus size={18} /> Kod Oluştur</>}
                        </button>
                    </div>

                    {/* Kod Listesi */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {inviteCodes.length === 0 ? (
                            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 40 }}>Henüz davet kodu oluşturulmamış.</p>
                        ) : inviteCodes.map(code => (
                            <div key={code.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '15px 20px',
                                background: code.is_valid ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                border: `1px solid ${code.is_valid ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                borderRadius: 10
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                                    <code style={{
                                        fontSize: '1.1rem',
                                        fontWeight: 600,
                                        letterSpacing: '1px',
                                        color: code.is_valid ? 'var(--success)' : 'var(--text-secondary)',
                                        textDecoration: code.is_valid ? 'none' : 'line-through'
                                    }}>{code.code}</code>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {code.current_uses}/{code.max_uses} kullanım
                                    </span>
                                    {code.expires_at && (
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Clock size={12} />
                                            {new Date(code.expires_at).toLocaleDateString('tr-TR')}
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {code.is_valid && (
                                        <button onClick={() => handleCopyCode(code.code)} className="btn btn-text" title="Kopyala">
                                            <Copy size={16} />
                                        </button>
                                    )}
                                    {code.is_active && (
                                        <button onClick={() => handleRevokeCode(code.id)} className="btn btn-text" style={{ color: 'var(--error)' }} title="İptal Et">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="tab-content fade-in">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {users.map(user => (
                            <div key={user.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '15px 20px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid var(--border)',
                                borderRadius: 10
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <UserCog size={20} style={{ color: user.is_admin ? 'var(--primary)' : 'var(--text-secondary)' }} />
                                    <span style={{ fontWeight: 500 }}>{user.username}</span>
                                    {user.is_admin && (
                                        <span style={{
                                            fontSize: '0.7rem',
                                            padding: '2px 8px',
                                            background: 'var(--primary)',
                                            color: '#fff',
                                            borderRadius: 20,
                                            fontWeight: 600,
                                            textTransform: 'uppercase'
                                        }}>Admin</span>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleToggleAdmin(user.id)}
                                    className="btn btn-text"
                                    style={{ fontSize: '0.85rem' }}
                                >
                                    {user.is_admin ? 'Admin Yetkisini Kaldır' : 'Admin Yap'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminPanel;
