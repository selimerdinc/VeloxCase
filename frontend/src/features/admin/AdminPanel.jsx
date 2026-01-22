// src/features/admin/AdminPanel.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
    ArrowLeft, Ticket, UserCog, Plus, Copy, Trash2,
    Loader2, Shield, Users, History, Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import config from '../../config';

function AdminPanel() {
    const navigate = useNavigate();
    const { isAdmin: globalIsAdmin } = useAuth();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('invites');

    // Invite codes state
    const [inviteCodes, setInviteCodes] = useState([]);
    const [creating, setCreating] = useState(false);
    const [newCodeSettings, setNewCodeSettings] = useState({ max_uses: 1, expires_in_days: 7 });

    // Users state
    const [users, setUsers] = useState([]);

    // Confirm Modal state
    const [confirmSheet, setConfirmSheet] = useState({
        isOpen: false,
        title: '',
        desc: '',
        onConfirm: null,
        confirmText: 'Sil',
        type: 'danger'
    });

    const openConfirm = (title, desc, onConfirm, confirmText = 'Sil') => {
        setConfirmSheet({ isOpen: true, title, desc, onConfirm, confirmText });
    };

    const closeConfirm = () => setConfirmSheet(prev => ({ ...prev, isOpen: false }));

    const fetchInviteCodes = useCallback(async () => {
        try {
            const res = await axios.get(`${config.API_BASE_URL}/admin/invite-codes`);
            setInviteCodes(res.data.invite_codes || []);
        } catch (err) {
            console.error('Invite codes fetch error:', err);
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
        if (globalIsAdmin) {
            fetchInviteCodes();
            fetchUsers();
        } else {
            setLoading(false);
        }
    }, [globalIsAdmin, fetchInviteCodes, fetchUsers]);

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

    const handleRevokeCode = (codeId) => {
        openConfirm(
            'Davet Kodunu İptal Et',
            'Bu davet kodunu iptal ettiğinizde yeni kullanıcılar bu kodu kullanamayacaktır. Bu işlem geri alınamaz.',
            async () => {
                try {
                    await axios.delete(`${config.API_BASE_URL}/admin/invite-codes/${codeId}`);
                    toast.success('Davet kodu iptal edildi');
                    setInviteCodes(prev => prev.map(c => c.id === codeId ? { ...c, is_active: false, is_valid: false } : c));
                } catch (err) {
                    toast.error('İptal işlemi başarısız');
                } finally {
                    closeConfirm();
                }
            },
            'Devre Dışı Bırak'
        );
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

    const handleDeleteUser = (user) => {
        openConfirm(
            'Kullanıcıyı Sil',
            `'${user.username}' kullanıcısını ve bu kullanıcıya ait tüm ayarları ve işlem geçmişini kalıcı olarak silmek istediğinize emin misiniz?`,
            async () => {
                try {
                    const res = await axios.delete(`${config.API_BASE_URL}/admin/users/${user.id}`);
                    toast.success(res.data.msg, { icon: '🗑️' });
                    setUsers(prev => prev.filter(u => u.id !== user.id));
                } catch (err) {
                    toast.error(err.response?.data?.msg || 'Silme işlemi başarısız');
                } finally {
                    closeConfirm();
                }
            },
            'Kullanıcıyı Tamamen Sil'
        );
    };

    if (loading) {
        return (
            <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <Loader2 className="spinner" size={40} />
            </div>
        );
    }

    if (!globalIsAdmin) {
        return (
            <div className="app-container">
                <div className="card" style={{ textAlign: 'center', padding: '80px 40px', maxWidth: 500, margin: '40px auto' }}>
                    <div className="icon-box-warning mx-auto" style={{ width: 80, height: 80, marginBottom: 25 }}>
                        <Shield size={40} />
                    </div>
                    <h2 style={{ fontSize: '1.8rem', marginBottom: 15 }}>Erişim Engellendi</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 30, fontSize: '1.1rem' }}>Bu sayfaya erişim için yönetici yetkisi gereklidir.</p>
                    <button onClick={() => navigate('/')} className="btn-premium" style={{ width: '100%' }}>Ana Sayfaya Dön</button>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-container fade-in">
            {/* Header Area */}
            <div className="admin-header-new">
                <div className="admin-header-left">
                    <button onClick={() => navigate('/')} className="btn-icon-round" title="Geri Dön">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="header-titles">
                        <h1>Yönetim Paneli</h1>
                        <p>Kullanıcı yetkileri ve davet sistemi kontrol merkezi</p>
                    </div>
                </div>

                <div className="admin-tabs-premium">
                    <button className={`admin-tab-btn ${activeTab === 'invites' ? 'active' : ''}`} onClick={() => setActiveTab('invites')}>
                        <Ticket size={18} /> Davet Kodları
                    </button>
                    <button className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
                        <Users size={18} /> Kullanıcılar
                    </button>
                </div>
            </div>

            <div className="admin-content">
                {activeTab === 'invites' ? (
                    <div className="slide-up">
                        {/* New Invite Form */}
                        <div className="premium-control-card">
                            <div className="card-header-mini">
                                <Plus size={16} /> <h3>Yeni Davet Kodu Oluştur</h3>
                            </div>
                            <div className="form-row-premium">
                                <div className="form-group-p">
                                    <label>Kullanım Limiti</label>
                                    <select
                                        className="premium-select"
                                        value={newCodeSettings.max_uses}
                                        onChange={e => setNewCodeSettings(s => ({ ...s, max_uses: parseInt(e.target.value) }))}
                                    >
                                        <option value={1}>1 Kullanım (Tek Seferlik)</option>
                                        <option value={5}>5 Kullanım</option>
                                        <option value={10}>10 Kullanım</option>
                                        <option value={50}>50 Kullanım (Kurumsal)</option>
                                    </select>
                                </div>
                                <div className="form-group-p">
                                    <label>Geçerlilik Süresi</label>
                                    <select
                                        className="premium-select"
                                        value={newCodeSettings.expires_in_days}
                                        onChange={e => setNewCodeSettings(s => ({ ...s, expires_in_days: parseInt(e.target.value) }))}
                                    >
                                        <option value={1}>1 Gün</option>
                                        <option value={7}>7 Gün (Önerilen)</option>
                                        <option value={30}>30 Gün</option>
                                        <option value={0}>Sınırsız Süre</option>
                                    </select>
                                </div>
                                <button onClick={handleCreateCode} className="btn-premium" disabled={creating}>
                                    {creating ? <Loader2 className="spinner" size={20} /> : "Kod Üret"}
                                </button>
                            </div>
                        </div>

                        {/* Code List Area */}
                        <div className="admin-grid">
                            {inviteCodes.length === 0 ? (
                                <div className="empty-state">
                                    <p>Henüz bir davet kodu oluşturulmamış.</p>
                                </div>
                            ) : inviteCodes.map(code => (
                                <div key={code.id} className={`invite-card-p ${!code.is_valid ? 'expired' : ''}`}>
                                    <div className="invite-card-top">
                                        <div className="code-display">
                                            <code className="premium-code">{code.code}</code>
                                            {code.is_valid ?
                                                <span className="badge-success">Aktif</span> :
                                                <span className="badge-danger">Geçersiz</span>
                                            }
                                        </div>
                                        <div className="invite-actions">
                                            {code.is_valid && (
                                                <button onClick={() => handleCopyCode(code.code)} className="btn-icon-sm" title="Kopyala">
                                                    <Copy size={14} />
                                                </button>
                                            )}
                                            {code.is_active && (
                                                <button onClick={() => handleRevokeCode(code.id)} className="btn-icon-sm-danger" title="İptal Et">
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="invite-card-details">
                                        <div className="detail-item">
                                            <Users size={14} />
                                            <span>{code.current_uses} / {code.max_uses} Kullanıldı</span>
                                        </div>
                                        <div className="detail-item">
                                            <Calendar size={14} />
                                            <span>{code.expires_at ? new Date(code.expires_at).toLocaleDateString('tr-TR') : 'Sınırsız Süre'}</span>
                                        </div>
                                    </div>

                                    {/* Usage History Section */}
                                    {code.used_by && code.used_by.length > 0 && (
                                        <div className="usage-history-section">
                                            <div className="history-label"><History size={12} /> Kullanan Kullanıcılar</div>
                                            <div className="history-tags">
                                                {code.used_by.map((usage, i) => (
                                                    <div key={i} className="usage-tag" title={new Date(usage.used_at).toLocaleString('tr-TR')}>
                                                        {usage.username}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="slide-up">
                        <div className="user-management-list">
                            {users.map(user => (
                                <div key={user.id} className="user-item-premium">
                                    <div className="user-info-p">
                                        <div className={`user-avatar-p ${user.is_admin ? 'admin' : ''}`}>
                                            {user.is_admin ? <Shield size={18} /> : <UserCog size={18} />}
                                        </div>
                                        <div className="user-text-p">
                                            <span className="user-name">{user.username}</span>
                                            <span className="user-role">{user.is_admin ? 'Yönetici (Admin)' : 'Standart Kullanıcı'}</span>
                                        </div>
                                    </div>

                                    <div className="user-actions-p">
                                        <button
                                            onClick={() => handleToggleAdmin(user.id)}
                                            className={`btn-outline ${user.is_admin ? 'warning' : 'primary'}`}
                                        >
                                            {user.is_admin ? 'Admin Yetkisini Al' : 'Admin Yetkisi Ver'}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteUser(user)}
                                            className="btn-outline danger"
                                            title="Kullanıcıyı Sil"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* CONFIRM BOTTOM SHEET */}
            {confirmSheet.isOpen && (
                <div className="bottom-sheet-overlay" onClick={closeConfirm}>
                    <div className="bottom-sheet slide-up-anim" onClick={e => e.stopPropagation()}>
                        <div className="bottom-sheet-header">
                            <div className="icon-box-warning mx-auto">
                                <Trash2 size={24} />
                            </div>
                            <h3 className="bottom-sheet-title">{confirmSheet.title}</h3>
                            <p className="bottom-sheet-desc">{confirmSheet.desc}</p>
                        </div>
                        <div className="bottom-sheet-footer">
                            <button onClick={confirmSheet.onConfirm} className="btn-confirm-danger">
                                {confirmSheet.confirmText}
                            </button>
                            <button onClick={closeConfirm} className="btn-cancel">
                                İptal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminPanel;
