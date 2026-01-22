// src/features/admin/AdminPanel.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
    ArrowLeft, Ticket, UserCog, Plus, Copy, Trash2,
    Loader2, Shield, Users, History, Calendar, CheckCircle2, XCircle, Search,
    MoreHorizontal, RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import config from '../../config';

function AdminPanel() {
    const navigate = useNavigate();
    const { isAdmin: globalIsAdmin, isInitialized, token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('invites');

    // States
    const [inviteCodes, setInviteCodes] = useState([]);
    const [users, setUsers] = useState([]);
    const [creating, setCreating] = useState(false);
    const [newCodeSettings, setNewCodeSettings] = useState({ max_uses: 1, expires_in_days: 7 });

    // Confirm Modal
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        desc: '',
        action: null,
        confirmText: 'Onayla',
        isDanger: false
    });

    // -------------------------------------------------------------------------
    // 1. GÜVENLİK VE ERİŞİM KONTROLÜ
    // -------------------------------------------------------------------------
    const checkAdminAccess = useCallback(() => {
        // LocalStorage'ı manuel kontrol et (Double Check)
        const storedAdmin = localStorage.getItem('veloxcase_is_admin') === 'true';

        // Eğer hook henüz hazır değilse bekle
        if (!isInitialized) return;

        // Eğer ne Hook ne LocalStorage admin diyor ise at
        if (!globalIsAdmin && !storedAdmin) {
            return false;
        }
        return true;

    }, [globalIsAdmin, isInitialized]);

    // -------------------------------------------------------------------------
    // 2. VERİ ÇEKME
    // -------------------------------------------------------------------------
    const fetchInviteCodes = useCallback(async () => {
        try {
            const res = await axios.get(`${config.API_BASE_URL}/admin/invite-codes`);
            // Sıralama: En yeni en üstte
            const sorted = (res.data.invite_codes || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            setInviteCodes(sorted);
        } catch (err) {
            console.error('Fetch error:', err);
            toast.error("Kodlar yüklenemedi");
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

    const refreshData = async () => {
        setLoading(true);
        await Promise.all([fetchInviteCodes(), fetchUsers()]);
        setLoading(false);
    };

    useEffect(() => {
        if (isInitialized) {
            if (checkAdminAccess()) {
                refreshData();
            } else {
                setLoading(false); // Erişim yoksa loading kapat ki UI "Erişim Engellendi" göstersin
            }
        }
    }, [isInitialized, checkAdminAccess, fetchInviteCodes, fetchUsers]);


    // -------------------------------------------------------------------------
    // 3. AKSİYONLAR
    // -------------------------------------------------------------------------
    const handleCreateCode = async () => {
        setCreating(true);
        try {
            const res = await axios.post(`${config.API_BASE_URL}/admin/invite-codes`, newCodeSettings);
            toast.success('Davet kodu oluşturuldu!', { icon: '✨' });
            setInviteCodes(prev => [res.data.invite_code, ...prev]);
        } catch (err) {
            toast.error(err.response?.data?.msg || 'Kod oluşturulamadı');
        } finally {
            setCreating(false);
        }
    };

    const handleCopyCode = (code) => {
        navigator.clipboard.writeText(code);
        toast.success('Kopyalandı', { icon: '📋' });
    };

    const handleDeleteCode = (code) => {
        setConfirmModal({
            isOpen: true,
            title: 'Kodu Sil',
            desc: `"${code.code}" kodunu silmek istediğinize emin misiniz? Eğer kullanıldıysa, sadece pasif duruma getirilecek.`,
            confirmText: 'Sil',
            isDanger: true,
            action: async () => {
                try {
                    const res = await axios.delete(`${config.API_BASE_URL}/admin/invite-codes/${code.id}`);
                    toast.success(res.data.msg);
                    // Listeden kaldır veya güncelle
                    if (res.data.msg.includes('silindi')) {
                        setInviteCodes(prev => prev.filter(c => c.id !== code.id));
                    } else {
                        // Sadece pasif olduysa tekrar çekelim
                        fetchInviteCodes();
                    }
                } catch (err) {
                    toast.error('Silme işlemi başarısız');
                } finally {
                    setConfirmModal(p => ({ ...p, isOpen: false }));
                }
            }
        });
    };

    const handleToggleAdmin = (userId, currentStatus) => {
        setConfirmModal({
            isOpen: true,
            title: 'Yetkiyi Değiştir',
            desc: `Bu kullanıcının yönetici yetkisini ${currentStatus ? 'ALMAK' : 'VERMEK'} üzeresiniz.`,
            confirmText: currentStatus ? 'Yetkiyi Al' : 'Yönetici Yap',
            isDanger: currentStatus, // Adminliği almak "tehlikeli" sayılsın (kırmızı buton)
            action: async () => {
                try {
                    const res = await axios.post(`${config.API_BASE_URL}/admin/users/${userId}/toggle-admin`);
                    toast.success(res.data.msg);
                    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_admin: res.data.is_admin } : u));
                } catch (err) {
                    toast.error('İşlem başarısız');
                } finally {
                    setConfirmModal(p => ({ ...p, isOpen: false }));
                }
            }
        });
    };

    const handleDeleteUser = (user) => {
        setConfirmModal({
            isOpen: true,
            title: 'Kullanıcıyı Sil',
            desc: `DİKKAT: "${user.username}" kullanıcısı ve tüm verileri silinecektir. Bu işlem geri alınamaz!`,
            confirmText: 'Kullanıcıyı Sil',
            isDanger: true,
            action: async () => {
                try {
                    const res = await axios.delete(`${config.API_BASE_URL}/admin/users/${user.id}`);
                    toast.success(res.data.msg);
                    setUsers(prev => prev.filter(u => u.id !== user.id));
                } catch (err) {
                    toast.error(err.response?.data?.msg || 'Hata oluştu');
                } finally {
                    setConfirmModal(p => ({ ...p, isOpen: false }));
                }
            }
        });
    };


    // -------------------------------------------------------------------------
    // 4. RENDER: YÜKLENİYOR / ERİŞİM YOK
    // -------------------------------------------------------------------------
    if (!isInitialized || loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4">
                <Loader2 className="animate-spin text-blue-600" size={48} />
                <p className="text-slate-400 font-medium">Panel Hazırlanıyor...</p>
            </div>
        );
    }

    if (!checkAdminAccess()) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50 p-4">
                <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-red-50">
                    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Shield size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Erişim Reddedildi</h2>
                    <p className="text-slate-500 mb-8">Bu alana erişim yetkiniz bulunmamaktadır.</p>
                    <button onClick={() => navigate('/')} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all">
                        Ana Sayfaya Dön
                    </button>
                    {/* Debug için: Token varsa ama admin değilse */}
                    {token && <p className="text-xs text-slate-300 mt-4 font-mono">DEBUG: Token Valid, User Not Admin</p>}
                </div>
            </div>
        );
    }

    // -------------------------------------------------------------------------
    // 5. RENDER: ANA PANEL (PREMIUM TASARIM)
    // -------------------------------------------------------------------------
    return (
        <div className="admin-container">

            {/* HEADER */}
            <div className="admin-header-new">
                <div className="admin-header-left">
                    <div className="header-titles">
                        <h1>Admin<span className="text-primary">Panel</span></h1>
                        <p>Sistem Yönetimi ve Davet Kodları</p>
                    </div>
                </div>
                <div className="flex-row gap-md">
                    <button onClick={() => navigate('/')} className="btn-back">
                        <ArrowLeft size={18} /> Geri Dön
                    </button>
                    <button onClick={refreshData} className="btn-icon-sm" title="Yenile">
                        <RefreshCw size={20} className={loading ? 'spinner' : ''} />
                    </button>
                </div>
            </div>

            {/* CREATE BAR & TABS */}
            <div className="premium-control-card">
                <div className="card-header-mini">
                    <Plus size={20} className="text-primary" />
                    <h3>Yeni Kod Oluştur</h3>
                </div>

                <div className="form-row-premium">
                    <div className="form-group-p">
                        <label>Kullanım Hakkı</label>
                        <select
                            className="premium-select"
                            value={newCodeSettings.max_uses}
                            onChange={e => setNewCodeSettings(s => ({ ...s, max_uses: parseInt(e.target.value) }))}
                        >
                            <option value={1}>1 Kişilik (Tek)</option>
                            <option value={5}>5 Kişilik (Ekip)</option>
                            <option value={100}>100 Kişilik (Kurumsal)</option>
                            <option value={1000}>Sınırsız (Genel)</option>
                        </select>
                    </div>

                    <div className="form-group-p">
                        <label>Geçerlilik</label>
                        <select
                            className="premium-select"
                            value={newCodeSettings.expires_in_days}
                            onChange={e => setNewCodeSettings(s => ({ ...s, expires_in_days: parseInt(e.target.value) }))}
                        >
                            <option value={1}>24 Saat</option>
                            <option value={7}>1 Hafta</option>
                            <option value={30}>1 Ay</option>
                            <option value={365}>1 Yıl</option>
                            <option value={0}>Süresiz</option>
                        </select>
                    </div>

                    <button
                        onClick={handleCreateCode}
                        disabled={creating}
                        className="btn-premium"
                        style={{ minWidth: '200px' }}
                    >
                        {creating ? <Loader2 className="spinner" /> : <span>KOD OLUŞTUR</span>}
                    </button>
                </div>
            </div>

            {/* TABS NAVIGATION */}
            <div className="admin-tabs-premium" style={{ marginBottom: '2rem' }}>
                <button
                    onClick={() => setActiveTab('invites')}
                    className={`admin-tab-btn ${activeTab === 'invites' ? 'active' : ''}`}
                >
                    <Ticket size={20} />
                    Kodlar ({inviteCodes.length})
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                >
                    <Users size={20} />
                    Kullanıcılar ({users.length})
                </button>
            </div>

            {/* CONTENT AREA */}
            <div className="fade-in">
                {activeTab === 'invites' && (
                    <div className="admin-grid">
                        {inviteCodes.map(code => (
                            <div key={code.id} className={`invite-card-p ${!code.is_valid ? 'expired' : ''}`}>
                                <div className="invite-card-top">
                                    <div className="code-display">
                                        <div className="premium-code" onClick={() => handleCopyCode(code.code)}>
                                            {code.code}
                                            <Copy size={16} className="text-muted" />
                                        </div>
                                        <span className={code.is_valid ? 'badge-success' : 'badge-danger'}>
                                            {code.is_valid ? 'Aktif' : 'Pasif'}
                                        </span>
                                    </div>
                                    <div className="invite-actions">
                                        <button onClick={() => handleDeleteCode(code)} className="btn-icon-sm-danger">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="invite-card-details">
                                    <div className="detail-item">
                                        <CheckCircle2 size={14} />
                                        <span>{code.current_uses} / {code.max_uses > 900 ? '∞' : code.max_uses} Kullanım</span>
                                    </div>
                                    <div className="detail-item">
                                        <Calendar size={14} />
                                        <span>
                                            {code.expires_at ?
                                                (() => {
                                                    const diff = new Date(code.expires_at) - new Date();
                                                    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                                                    return days > 0 ? `${days} Gün Kaldı` : 'Süresi Doldu';
                                                })()
                                                : 'Süresiz'}
                                        </span>
                                    </div>
                                </div>

                                <div className="usage-history-section">
                                    <div className="history-label">
                                        <History size={14} /> Kullanan Kişiler
                                    </div>
                                    <div className="history-tags">
                                        {code.used_by_usernames && code.used_by_usernames.length > 0 ? (
                                            code.used_by_usernames.map((u, i) => (
                                                <span key={i} className="usage-tag">@{u}</span>
                                            ))
                                        ) : (
                                            <span className="text-muted italic" style={{ fontSize: '0.8rem' }}>Henüz kullanılmadı</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="user-management-list">
                        {users.map(user => (
                            <div key={user.id} className="user-item-premium slide-up-anim">
                                <div className="user-info-p">
                                    <div className={`user-avatar-p ${user.is_admin ? 'admin' : ''}`}>
                                        {user.is_admin ? <Shield size={20} /> : <Users size={20} />}
                                    </div>
                                    <div className="user-text-p">
                                        <span className="user-name">@{user.username}</span>
                                        <span className="user-role">{user.is_admin ? 'Yönetici' : 'Standart Kullanıcı'}</span>
                                    </div>
                                </div>
                                <div className="user-actions-p">
                                    <button
                                        onClick={() => handleToggleAdmin(user.id, user.is_admin)}
                                        className="btn-outline primary"
                                    >
                                        {user.is_admin ? 'Yetkiyi Al' : 'Admin Yap'}
                                    </button>
                                    <button
                                        onClick={() => handleDeleteUser(user)}
                                        className="btn-outline danger"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* CONFIRM MODAL */}
            {confirmModal.isOpen && (
                <div className="modal-overlay" onClick={() => setConfirmModal(p => ({ ...p, isOpen: false }))}>
                    <div className="modal-card" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className={confirmModal.isDanger ? 'icon-box-warning' : 'icon-box-success'} style={{ background: confirmModal.isDanger ? 'var(--error-bg)' : 'var(--success-bg)', color: confirmModal.isDanger ? 'var(--error)' : 'var(--success)' }}>
                                {confirmModal.isDanger ? <Trash2 size={24} /> : <CheckCircle2 size={24} />}
                            </div>
                            <h3 style={{ margin: 0, fontWeight: 800 }}>{confirmModal.title}</h3>
                        </div>
                        <div className="modal-body">
                            <p>{confirmModal.desc}</p>
                        </div>
                        <div className="modal-footer" style={{ flexDirection: 'column', gap: '0.5rem' }}>
                            <button
                                onClick={confirmModal.action}
                                className={confirmModal.isDanger ? 'btn-confirm-danger' : 'btn-premium'}
                                style={{ width: '100%' }}
                            >
                                {confirmModal.confirmText}
                            </button>
                            <button
                                onClick={() => setConfirmModal(p => ({ ...p, isOpen: false }))}
                                className="btn-cancel"
                            >
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