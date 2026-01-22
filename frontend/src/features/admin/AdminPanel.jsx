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
        <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 font-sans text-slate-800">

            {/* HEADER */}
            <div className="max-w-7xl mx-auto mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">
                        Admin<span className="text-blue-600">Panel</span>
                    </h1>
                    <p className="text-slate-500 font-medium flex items-center gap-2">
                        <UserCog size={18} /> Sistem Yönetimi ve Davet Kodları
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:shadow-lg hover:border-blue-200 transition-all flex items-center gap-2">
                        <ArrowLeft size={18} /> Geri Dön
                    </button>
                    <button onClick={refreshData} className="p-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:text-blue-600 hover:rotate-180 transition-all duration-500">
                        <RefreshCw size={20} />
                    </button>
                </div>
            </div>

            {/* CREATE BAR & TABS */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">

                {/* SOL: QUICK ACTIONS (CREATE CODE) */}
                <div className="lg:col-span-8 bg-white rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 border border-white">
                    <div className="flex flex-col md:flex-row items-end gap-6">
                        <div className="flex-1 w-full">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Kullanım Hakkı</label>
                            <div className="relative">
                                <select
                                    className="w-full bg-slate-50 border-none rounded-2xl py-4 px-5 font-bold text-slate-700 appearance-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    value={newCodeSettings.max_uses}
                                    onChange={e => setNewCodeSettings(s => ({ ...s, max_uses: parseInt(e.target.value) }))}
                                >
                                    <option value={1}>1 Kişilik (Tek)</option>
                                    <option value={5}>5 Kişilik (Ekip)</option>
                                    <option value={100}>100 Kişilik (Kurumsal)</option>
                                    <option value={1000}>Sınırsız (Genel)</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><MoreHorizontal size={16} /></div>
                            </div>
                        </div>
                        <div className="flex-1 w-full">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Geçerlilik</label>
                            <div className="relative">
                                <select
                                    className="w-full bg-slate-50 border-none rounded-2xl py-4 px-5 font-bold text-slate-700 appearance-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    value={newCodeSettings.expires_in_days}
                                    onChange={e => setNewCodeSettings(s => ({ ...s, expires_in_days: parseInt(e.target.value) }))}
                                >
                                    <option value={1}>24 Saat</option>
                                    <option value={7}>1 Hafta</option>
                                    <option value={30}>1 Ay</option>
                                    <option value={365}>1 Yıl</option>
                                    <option value={0}>Süresiz</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><Calendar size={16} /></div>
                            </div>
                        </div>
                        <button
                            onClick={handleCreateCode}
                            disabled={creating}
                            className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all flex items-center gap-2 justify-center min-w-[160px]"
                        >
                            {creating ? <Loader2 className="animate-spin" /> : <><Plus size={20} strokeWidth={3} /> KOD OLUŞTUR</>}
                        </button>
                    </div>
                </div>

                {/* SAĞ: NAVIGATION TABS */}
                <div className="lg:col-span-4 bg-slate-100 rounded-[2rem] p-2 flex items-center">
                    <button
                        onClick={() => setActiveTab('invites')}
                        className={`flex-1 flex items-center justify-center gap-2 py-6 rounded-[1.5rem] font-black transition-all ${activeTab === 'invites' ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Ticket size={20} />
                        Kodlar
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md text-xs text-slate-500">{inviteCodes.length}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`flex-1 flex items-center justify-center gap-2 py-6 rounded-[1.5rem] font-black transition-all ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Users size={20} />
                        Kullanıcılar
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md text-xs text-slate-500">{users.length}</span>
                    </button>
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="max-w-7xl mx-auto">
                {activeTab === 'invites' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {inviteCodes.map(code => (
                            <div key={code.id} className={`group relative bg-white rounded-[2.5rem] p-8 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-200/50 border-2 ${code.is_valid ? 'border-transparent' : 'border-red-50 opacity-80'}`}>

                                {/* Üst Kısım: Kod ve Status */}
                                <div className="flex justify-between items-start mb-6">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleCopyCode(code.code)}>
                                            <h3 className="text-3xl font-black text-slate-800 tracking-tighter">{code.code}</h3>
                                            <Copy size={18} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                                        </div>
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${code.is_valid ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-500 border-red-100'}`}>
                                            {code.is_valid ? 'Aktif' : 'Pasif'}
                                        </span>
                                    </div>
                                    <button onClick={() => handleDeleteCode(code)} className="p-3 rounded-2xl bg-slate-50 text-slate-400 hover:bg-red-500 hover:text-white transition-all">
                                        <Trash2 size={20} />
                                    </button>
                                </div>

                                {/* Bilgi Kartları */}
                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                        <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">Kullanım</span>
                                        <div className="text-lg font-bold text-slate-700">
                                            {code.current_uses} <span className="text-slate-400 text-sm">/ {code.max_uses > 900 ? '∞' : code.max_uses}</span>
                                        </div>
                                        <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                                            <div
                                                className="bg-blue-500 h-full rounded-full transition-all"
                                                style={{ width: `${Math.min((code.current_uses / (code.max_uses || 1)) * 100, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                        <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">Kalan Süre</span>
                                        <div className="text-lg font-bold text-slate-700">
                                            {code.expires_at ?
                                                (() => {
                                                    const diff = new Date(code.expires_at) - new Date();
                                                    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                                                    return days > 0 ? `${days} Gün` : 'Doldu';
                                                })()
                                                : 'Süresiz'}
                                        </div>
                                    </div>
                                </div>

                                {/* Kullananlar Listesi */}
                                <div className="border-t border-slate-100 pt-5">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <History size={12} /> Kullanan Kişiler ({code.used_by_usernames?.length || 0})
                                    </p>
                                    <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto">
                                        {code.used_by_usernames && code.used_by_usernames.length > 0 ? (
                                            code.used_by_usernames.map((u, i) => (
                                                <span key={i} className="text-xs font-bold px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl">
                                                    @{u}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">Henüz kullanılmadı.</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="bg-white rounded-[3rem] p-2 shadow-2xl shadow-slate-200/50">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                    <th className="p-6 pl-10">Kullanıcı</th>
                                    <th className="p-6">Rol</th>
                                    <th className="p-6">ID</th>
                                    <th className="p-6 text-right pr-10">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user.id} className="group hover:bg-slate-50 transition-colors">
                                        <td className="p-6 pl-10">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black ${user.is_admin ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-200 text-slate-500'}`}>
                                                    {user.username.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-bold text-slate-800 text-lg">@{user.username}</span>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            {user.is_admin ?
                                                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 text-xs font-black uppercase tracking-wider">
                                                    <Shield size={12} /> Admin
                                                </span> :
                                                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-100 text-slate-500 text-xs font-black uppercase tracking-wider">
                                                    User
                                                </span>
                                            }
                                        </td>
                                        <td className="p-6 font-mono text-slate-400">#{user.id}</td>
                                        <td className="p-6 pr-10 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                                <button
                                                    onClick={() => handleToggleAdmin(user.id, user.is_admin)}
                                                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:border-blue-500 hover:text-blue-600 transition-all"
                                                >
                                                    {user.is_admin ? 'Yetkiyi Al' : 'Admin Yap'}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(user)}
                                                    className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* CONFIRM MODAL */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setConfirmModal(p => ({ ...p, isOpen: false }))}>
                    <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl transform scale-100 animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-6 mx-auto ${confirmModal.isDanger ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                            {confirmModal.isDanger ? <Trash2 size={32} /> : <CheckCircle2 size={32} />}
                        </div>
                        <h3 className="text-xl font-black text-center text-slate-900 mb-2">{confirmModal.title}</h3>
                        <p className="text-center text-slate-500 font-medium mb-8 leading-relaxed">
                            {confirmModal.desc}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmModal(p => ({ ...p, isOpen: false }))}
                                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={confirmModal.action}
                                className={`flex-1 py-3 text-white rounded-2xl font-bold shadow-lg transition-all ${confirmModal.isDanger ? 'bg-red-500 hover:bg-red-600 shadow-red-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
                            >
                                {confirmModal.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scale-in { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.2s ease-out; }
                .animate-scale-in { animation: scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
            `}</style>
        </div>
    );
}

export default AdminPanel;