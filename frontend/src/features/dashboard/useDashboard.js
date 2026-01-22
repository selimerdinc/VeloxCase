import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import config from '../../config';
import { useApp } from '../../context/AppContext';

/**
 * useDashboard: Dashboard ekranının tüm veri yönetimi ve iş mantığını yönetir.
 */
export const useDashboard = (token, currentView, onLogout, navigate) => {
    // --- GLOBAL CONTEXT ---
    const {
        settings: settingsData,
        stats,
        fetchGlobalData: fetchStats,
        updateSettings: setSettingsData
    } = useApp();

    // --- CACHE & INITIALIZATION REFS ---
    const lastFetchedRepoId = useRef(null);

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

    // --- LOCAL DATA STATE'leri ---
    const [historyData, setHistoryData] = useState([]);
    const [settingsTab, setSettingsTab] = useState('api');
    const [passwordData, setPasswordData] = useState({ old: '', new: '', confirm: '' });
    const [passwordErrors, setPasswordErrors] = useState({ old: false, new: false, confirm: false });
    const [settingsLoading, setSettingsLoading] = useState(false);


    // --- VERİ ÇEKME İŞLEVLERİ ---
    const fetchFolders = useCallback(async (force = false) => {
        // Eğer repoId aynıysa ve force değilse çekme (Önbellekleme Mantığı)
        if (!force && lastFetchedRepoId.current === repoId && folders.length > 0) {
            return;
        }

        if (!repoId || !token) return;
        setFoldersLoading(true);
        try {
            const res = await axios.get(`${config.API_BASE_URL}/folders/${repoId}`);
            const list = res.data.folders || [];

            // Mevcut tüm ID'leri set olarak tut
            const allIds = new Set(list.map(f => f.id));

            // Orphan check: parent_id var ama listede yoksa, bu folder'ı root gibi davran
            const isOrphan = (folder) => {
                return folder.parent_id && !allIds.has(folder.parent_id);
            };

            // Root mu kontrolü: parent_id yok VEYA orphan
            const isRoot = (folder) => {
                return !folder.parent_id || folder.parent_id === 0 || isOrphan(folder);
            };

            // Tree yapısı oluştur
            const buildTree = (items, parentId = null, level = 0) => {
                let filtered;

                if (parentId === null) {
                    // Root seviyesi: parent_id yok veya orphan olanlar
                    filtered = items.filter(item => isRoot(item));
                } else {
                    // Child seviyesi
                    filtered = items.filter(item => item.parent_id === parentId);
                }

                return filtered
                    .sort((a, b) => a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' }))
                    .flatMap(item => {
                        const prefix = level > 0 ? '   '.repeat(level) + '└📂 ' : '📁 ';
                        return [
                            { ...item, level, displayName: prefix + item.name },
                            ...buildTree(items, item.id, level + 1)
                        ];
                    });
            };

            const processedList = buildTree(list);

            setFolders(processedList);
            lastFetchedRepoId.current = repoId; // CACHE UPDATED

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
    }, [repoId, token, folders.length, onLogout]);


    // --- YAN ETKİLER (USE EFFECT) ---

    // Settings'den Project ID'yi al
    useEffect(() => {
        if (settingsData && settingsData.TESTMO_PROJECT_ID) {
            const pid = parseInt(settingsData.TESTMO_PROJECT_ID, 10);
            if (pid !== repoId) {
                setRepoId(pid);
            }
        }
    }, [settingsData, repoId]);

    // repoId değiştikçe klasörleri çek
    useEffect(() => {
        if (token && repoId && currentView === 'dashboard') {
            fetchFolders();
        }
    }, [repoId, token, currentView, fetchFolders]);


    useEffect(() => {
        if (currentView === 'history' && token && historyData.length === 0) {
            axios.get(`${config.API_BASE_URL}/history`).then(res => setHistoryData(res.data));
        }
        // Settings artık Context'ten geliyor, burada fetch etmeye gerek yok.
    }, [currentView, token, historyData.length]);

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