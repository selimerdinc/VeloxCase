// src/features/dashboard/useDashboard.js

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import config from '../../config';

/**
 * useDashboard: Dashboard ekranının tüm veri yönetimi ve iş mantığını yönetir.
 */
export const useDashboard = (token, currentView, onLogout, navigate) => {
    // --- DASHBOARD STATE'leri ---
    const [repoId, setRepoId] = useState(1);
    const [folders, setFolders] = useState([]);
    const [selectedFolder, setSelectedFolder] = useState(null);  // null = seçilmemiş
    const [jiraInput, setJiraInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [foldersLoading, setFoldersLoading] = useState(false);
    const [syncResults, setSyncResults] = useState([]);
    const [showNewFolder, setShowNewFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [parentFolderForNew, setParentFolderForNew] = useState(null);  // Yeni klasör için parent

    // YENİ: Dashboard Input Hata State'i
    const [dashboardErrors, setDashboardErrors] = useState({
        jiraInput: false,
        selectedFolder: false,
        newFolderName: false
    });

    // YENİ: Duplicate (Aynı Kayıt) Yönetimi İçin State'ler
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [duplicateItem, setDuplicateItem] = useState(null);

    // --- PREVIEW STATE ---
    const [previewTask, setPreviewTask] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    // --- AI ANALYSIS STATE (YENİ) ---
    const [analysisResult, setAnalysisResult] = useState(null);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);

    // --- SETTINGS & DATA STATE'leri ---

    const [settingsData, setSettingsData] = useState({});
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [historyData, setHistoryData] = useState([]);
    const [stats, setStats] = useState({ total_cases: 0, total_images: 0, today_syncs: 0 });
    const [settingsTab, setSettingsTab] = useState('api');
    const [passwordData, setPasswordData] = useState({ old: '', new: '', confirm: '' });
    const [passwordErrors, setPasswordErrors] = useState({ old: false, new: false, confirm: false });


    // --- VERİ ÇEKME İŞLEVLERİ ---
    const fetchFolders = useCallback(async () => {
        if (!repoId || !token || currentView !== 'dashboard') return;
        setFoldersLoading(true);
        try {
            const res = await axios.get(`${config.API_BASE_URL}/folders/${repoId}`);
            let list = res.data.folders || [];

            // Tree yapısı oluştur - parent_id: null, undefined, 0 hepsini root olarak say
            const buildTree = (items, parentId = null, level = 0) => {
                const isRoot = (pid) => pid === null || pid === undefined || pid === 0;

                return items
                    .filter(item => {
                        if (parentId === null) {
                            return isRoot(item.parent_id);
                        }
                        return item.parent_id === parentId;
                    })
                    .sort((a, b) => a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' }))
                    .flatMap(item => [
                        { ...item, level, displayName: '  '.repeat(level) + (level > 0 ? '└─ ' : '') + item.name },
                        ...buildTree(items, item.id, level + 1)
                    ]);
            };

            // Tree yap, eğer bazı klasörler kaybolursa flat listeye dön
            const treeList = buildTree(list);
            const processedList = treeList.length >= list.length
                ? treeList
                : list.sort((a, b) => a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' }));

            setFolders(processedList);

            // LocalStorage'dan son seçilen klasörü restore et
            const savedFolderId = localStorage.getItem(`veloxcase_folder_${repoId}`);
            if (savedFolderId && processedList.some(f => f.id === parseInt(savedFolderId, 10))) {
                setSelectedFolder(parseInt(savedFolderId, 10));
            }
        } catch (err) {
            if (err.response?.status === 401) onLogout();
            console.error('Folder fetch error:', err);
        } finally {
            setFoldersLoading(false);
        }
    }, [repoId, token, currentView, onLogout]);

    const fetchStats = useCallback(async () => {
        if (!token || currentView !== 'dashboard') return;
        try {
            const res = await axios.get(`${config.API_BASE_URL}/stats`);
            setStats(res.data);
        } catch (err) {
            console.error(err);
        }
    }, [token, currentView]);


    // --- YAN ETKİLER (USE EFFECT) ---
    useEffect(() => {
        if (token && currentView === 'dashboard') {
            // Dashboard yüklendiğinde ÖNCE ayarları çek (Project ID için)
            axios.get(`${config.API_BASE_URL}/settings`)
                .then(res => {
                    setSettingsData(res.data);
                    if (res.data.TESTMO_PROJECT_ID) {
                        setRepoId(parseInt(res.data.TESTMO_PROJECT_ID, 10));
                    }
                })
                .catch(err => console.error('Settings fetch error:', err));

            fetchStats();
        }
    }, [token, currentView, fetchStats]);

    // repoId değiştikçe klasörleri çek
    useEffect(() => {
        if (token && currentView === 'dashboard' && repoId) {
            fetchFolders();
        }
    }, [repoId, token, currentView, fetchFolders]);


    useEffect(() => {
        if (currentView === 'history' && token) {
            axios.get(`${config.API_BASE_URL}/history`).then(res => setHistoryData(res.data));
        }
        if (currentView === 'settings' && token) {
            axios.get(`${config.API_BASE_URL}/settings`).then(res => {
                // eslint-disable-next-line no-unused-vars
                const { ...cleanData } = res.data;
                setSettingsData(cleanData);
            });
        }
    }, [currentView, token]);

    useEffect(() => {
        setPreviewTask(null);
        const delay = setTimeout(async () => {
            if (token && jiraInput.length > 5 && !jiraInput.includes(',')) {
                setPreviewLoading(true);
                try {
                    const res = await axios.post(`${config.API_BASE_URL}/preview`, { task_key: jiraInput });
                    setPreviewTask(res.data);
                } catch {
                    setPreviewTask(null);
                } finally {
                    setPreviewLoading(false);
                }
            } else {
                setPreviewTask(null);
            }
        }, 800);
        return () => clearTimeout(delay);
    }, [jiraInput, token]);


    // --- İŞLEVLER: CRUD/AKSYONLAR ---

    // 0. AI Analizi (YENİ - Testmo'ya göndermeden önce önizleme)
    const handleAnalyze = async () => {
        if (!jiraInput || jiraInput.trim() === '') {
            setDashboardErrors(e => ({ ...e, jiraInput: true }));
            return toast.error("Lütfen Jira Görev Anahtarı Girin.", { icon: '🛑' });
        }

        setAnalysisLoading(true);
        setAnalysisResult(null);
        const tId = toast.loading('AI Analizi Yapılıyor...');

        try {
            const res = await axios.post(`${config.API_BASE_URL}/analyze`, {
                task_key: jiraInput.trim().split(',')[0] // İlk task'ı analiz et
            });

            setAnalysisResult(res.data);
            setShowAnalysisPanel(true);
            toast.success('AI Analizi Tamamlandı! Sonuçları İnceleyin.', { id: tId, duration: 3000 });
        } catch (err) {
            const msg = err.response?.data?.error || 'Analiz sırasında hata oluştu.';
            toast.error(msg, { id: tId });
        } finally {
            setAnalysisLoading(false);
        }
    };

    // 1. Senkronizasyon Başlatma (GÜNCELLENDİ: Duplicate Kontrolü)
    const handleSync = async () => {

        const newErrors = {
            jiraInput: !jiraInput || jiraInput.trim() === '',
            selectedFolder: selectedFolder === null || selectedFolder === undefined
        };
        setDashboardErrors(e => ({ ...e, ...newErrors }));

        if (newErrors.jiraInput || newErrors.selectedFolder) {
            return toast.error("Lütfen Jira Anahtarı ve Hedef Klasör alanlarını doldurunuz.", { icon: '🛑' });
        }

        setLoading(true); setSyncResults([]);
        const tId = toast.loading('Entegrasyon başlatıldı, veriler işleniyor...');

        try {
            const res = await axios.post(`${config.API_BASE_URL}/sync`, {
                jira_input: jiraInput,
                folder_id: parseInt(selectedFolder, 10),
                project_id: parseInt(repoId, 10)

            });

            const results = res.data.results || [];
            setSyncResults(results);

            // --- DUPLICATE KONTROLÜ ---
            const duplicate = results.find(r => r.status === 'duplicate');

            if (duplicate) {
                // Duplicate varsa modalı aç, loading'i kapat (kullanıcı karar verecek)
                setDuplicateItem(duplicate);
                setShowDuplicateModal(true);
                toast.dismiss(tId);
            } else {
                // Duplicate yoksa normal başarı akışı
                const success = results.filter(r => r.status === 'success').length;
                const failed = results.length - success;

                if (success > 0) {
                    toast.success(`İşlem Tamamlandı! ${success} kayıt başarıyla aktarıldı. ${failed > 0 ? `(${failed} hata)` : ''}`, { id: tId, duration: 5000 });
                    setJiraInput('');
                    fetchStats();
                } else {
                    toast.error("İşlem sırasında hata oluştu.", { id: tId });
                }
            }
        } catch (err) {
            toast.error("Sunucu ile iletişim kurulamadı.", { id: tId });
        } finally {
            setLoading(false);
        }
    };

    // 2. Force Update (Kullanıcı "Evet, Güncelle" dediğinde çalışır)
    const handleForceUpdate = async () => {
        if (!duplicateItem) return;

        setShowDuplicateModal(false); // Modalı kapat
        setLoading(true);
        const tId = toast.loading('Güncelleme yapılıyor...');

        try {
            // force_update: true parametresi ile tekrar istek atıyoruz
            const res = await axios.post(`${config.API_BASE_URL}/sync`, {
                jira_input: duplicateItem.task,
                folder_id: parseInt(selectedFolder, 10),
                project_id: parseInt(repoId, 10),
                force_update: true // <--- Backend bu bayrağı görünce güncelleyecek
            });

            const newResult = res.data.results[0]; // Tek task olduğu için ilk sonucu al

            // Listeyi güncelle: Eski duplicate satırını sil, yeni sonucu ekle
            setSyncResults(prev => [
                newResult,
                ...prev.filter(r => r.task !== duplicateItem.task)
            ]);

            if (newResult.status === 'success') {
                toast.success(`Case Başarıyla Güncellendi: ${newResult.case_name}`, { id: tId });
                fetchStats();
            } else {
                toast.error("Güncelleme başarısız oldu.", { id: tId });
            }

        } catch (err) {
            toast.error("Güncelleme sırasında hata oluştu.", { id: tId });
        } finally {
            setLoading(false);
            setDuplicateItem(null);
        }
    };

    // 3. Yeni Klasör Oluşturma
    const handleCreateFolder = async () => {
        // Boşluk kontrolü
        if (!newFolderName || newFolderName.trim() === '') {
            setDashboardErrors(e => ({ ...e, newFolderName: true }));
            return toast.error("Lütfen klasör adı giriniz.");
        }

        const finalName = newFolderName.trim();

        // İsim Tekrarı Kontrolü (Frontend)
        const isDuplicate = folders.some(
            f => f.name.toLowerCase() === finalName.toLowerCase()
        );

        if (isDuplicate) {
            setDashboardErrors(e => ({ ...e, newFolderName: true }));
            return toast.error("Bu isimde bir klasör zaten mevcut!", { icon: '⚠️' });
        }

        try {
            const res = await axios.post(`${config.API_BASE_URL}/folders/${repoId}`, { name: finalName, parent_id: parentFolderForNew || null });

            const newFolderId = res.data.id || res.data.data?.id;

            // Listeyi güncelle ve sırala
            const listRes = await axios.get(`${config.API_BASE_URL}/folders/${repoId}`);
            let allFolders = listRes.data.folders || [];

            const createdFolderObj = allFolders.find(f => f.id === newFolderId) || { id: newFolderId, name: finalName };
            const otherFolders = allFolders.filter(f => f.id !== newFolderId);

            // A-Z Sırala
            otherFolders.sort((a, b) => a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' }));

            // Yeni klasörü en başa ekle
            setFolders([createdFolderObj, ...otherFolders]);

            if (newFolderId) setSelectedFolder(newFolderId);

            setNewFolderName('');
            setShowNewFolder(false);
            setDashboardErrors(e => ({ ...e, newFolderName: false }));

            toast.success(`Klasör başarıyla oluşturuldu: ${finalName}`, { icon: '📁' });
        } catch (err) {
            setDashboardErrors(e => ({ ...e, newFolderName: true }));
            const msg = err.response?.data?.msg || "Klasör oluşturma hatası.";
            toast.error(msg);
        }
    };

    // 4. Ayarları Kaydetme
    const saveSettings = async () => {
        setSettingsLoading(true);
        try {
            await axios.post(`${config.API_BASE_URL}/settings`, settingsData);
            toast.success("Yapılandırma ayarları başarıyla güncellendi.", { icon: '💾' });
            // Ayarlar kaydedilince Dashboard'a dön (Opsiyonel, navigate kullanarak)
            setTimeout(() => navigate('/'), 1000);
        } catch {
            toast.error("Ayarlar kaydedilemedi. Lütfen tüm alanların doğru olduğundan emin olun.");
        } finally {
            setSettingsLoading(false);
        }
    };

    // 5. Şifre Değiştirme
    const handleChangePassword = async () => {
        setPasswordErrors({ old: false, new: false, confirm: false });

        let hasError = false;
        const tempErrors = { old: false, new: false, confirm: false };

        if (!passwordData.old) { tempErrors.old = true; hasError = true; }
        if (!passwordData.new) { tempErrors.new = true; hasError = true; }
        if (!passwordData.confirm) { tempErrors.confirm = true; hasError = true; }

        if (hasError) {
            setPasswordErrors(tempErrors);
            return toast.error("Lütfen şifre alanlarını eksiksiz doldurunuz.");
        }

        if (passwordData.new !== passwordData.confirm) {
            setPasswordErrors(e => ({ ...e, new: true, confirm: true }));
            return toast.error("Yeni şifreler birbiriyle uyuşmuyor.");
        }

        if (passwordData.new.length < 8) {
            setPasswordErrors(e => ({ ...e, new: true, confirm: true }));
            return toast.error("Yeni şifreniz en az 8 karakter olmalıdır.");
        }

        setSettingsLoading(true);
        try {
            await axios.post(`${config.API_BASE_URL}/change-password`, { old_password: passwordData.old, new_password: passwordData.new });
            toast.success("Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapınız.", { icon: '🔒' });
            setPasswordData({ old: '', new: '', confirm: '' });
        } catch (err) {
            const msg = err.response?.data?.msg || "Şifre değiştirilemedi.";
            if (msg.includes('Mevcut şifre hatalı') || msg.includes('old password')) {
                setPasswordErrors(e => ({ ...e, old: true }));
                toast.error("Mevcut şifreniz hatalı. Lütfen doğru şifrenizi giriniz.");
            } else {
                toast.error(msg);
            }
        } finally {
            setSettingsLoading(false);
        }
    };

    // --- KAPSÜLLENMİŞ ARAYÜZ (RETURN) ---
    return {
        // State'ler
        repoId, folders, selectedFolder, jiraInput, loading, foldersLoading, syncResults,
        showNewFolder, newFolderName, previewTask, previewLoading, settingsData, settingsLoading,
        historyData, stats, settingsTab, passwordData, passwordErrors, dashboardErrors,

        // YENİ STATE'LER
        showDuplicateModal, duplicateItem,

        // AI ANALYSIS STATE'LER (YENİ)
        analysisResult, analysisLoading, showAnalysisPanel,

        // Setters
        setRepoId,
        setSelectedFolder: (value) => {
            setSelectedFolder(value);
            if (dashboardErrors.selectedFolder) setDashboardErrors(e => ({ ...e, selectedFolder: false }));
        },
        setJiraInput: (value) => {
            setJiraInput(value);
            if (dashboardErrors.jiraInput) setDashboardErrors(e => ({ ...e, jiraInput: false }));
        },
        setNewFolderName: (value) => {
            setNewFolderName(value);
            if (dashboardErrors.newFolderName) setDashboardErrors(e => ({ ...e, newFolderName: false }));
        },
        setShowNewFolder, setSettingsData, setSettingsTab, setPasswordData,
        setPasswordErrors, setShowDuplicateModal, setShowAnalysisPanel,
        parentFolderForNew, setParentFolderForNew,

        // İşlevler
        handleSync, handleCreateFolder, saveSettings, handleChangePassword,
        handleForceUpdate, handleAnalyze, // <--- YENİ
        fetchFolders, fetchStats
    };
};