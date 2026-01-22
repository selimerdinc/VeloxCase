// src/features/auth/useAuth.js

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import config from '../../config';

/**
 * useAuth: Kimlik doğrulama (Giriş/Kayıt) mantığını yöneten özel Hook.
 */
export const useAuth = () => {
    // --- AUTH STATE'leri ---
    const [token, setToken] = useState(() => localStorage.getItem(config.TOKEN_KEY));
    const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('veloxcase_is_admin') === 'true');
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);

    // Axios header'ı beklemeden set et (Refresh için kritik)
    if (token && !axios.defaults.headers.common['Authorization']) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    const [isRegistering, setIsRegistering] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);
    const [errors, setErrors] = useState({ username: false, password: false, inviteCode: false });

    // Login Hang Fix için anahtar
    const [authKey, setAuthKey] = useState(0);

    // --- YAN ETKİLER ---
    useEffect(() => {
        // Zaten useState initializer ile aldık, burada sadece init bitiriyoruz
        setIsLoadingInitial(false);
    }, []);

    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
            delete axios.defaults.headers.common['Authorization'];
        }
    }, [token]);


    // --- YARDIMCI FONKSİYON: Şifre Gücü ---
    const getStrength = (pass) => {
        if (!pass) return 0;
        let score = 0;
        if (pass.length > 7) score += 25;
        if (/[A-Z]/.test(pass)) score += 25;
        if (/[0-9]/.test(pass)) score += 25;
        if (/[^A-Za-z0-9]/.test(pass)) score += 25;
        return score;
    }
    const strengthScore = getStrength(password);

    // --- İŞLEV: Oturum Açma / Kayıt Olma ---
    const handleAuth = useCallback(async (e) => {
        e.preventDefault();

        // 1. Validasyon
        const newErrors = {
            username: !username.trim(),
            password: !password.trim(),
            inviteCode: isRegistering && !inviteCode.trim()
        };
        setErrors(newErrors);

        if (newErrors.username || newErrors.password || (isRegistering && newErrors.inviteCode)) {
            return toast.error("Zorunlu alanları eksiksiz doldurunuz.", {
                style: { border: '1px solid #ef4444', color: '#7f1d1d' }
            });
        }
        if (isRegistering && password.length < 8) {
            setErrors(e => ({ ...e, password: true }));
            return toast.error("Parola en az 8 karakter olmalıdır.", { icon: '🔑' });
        }

        setAuthLoading(true);
        const endpoint = isRegistering ? '/register' : '/login';
        const payload = isRegistering
            ? { username, password, invite_code: inviteCode.toUpperCase() }
            : { username, password };

        try {
            const res = await axios.post(`${config.API_BASE_URL}${endpoint}`, payload);

            if (isRegistering) {
                // --- KAYIT BAŞARILI ---
                toast.success(`Hesabınız oluşturuldu. Şimdi giriş yapabilirsiniz.`, { icon: '✅', duration: 5000 });

                // 1. Görünümü Login'e çevir
                setIsRegistering(false);

                // 2. Hataları temizle
                setErrors({ username: false, password: false, inviteCode: false });

                // 3. Şifreyi ve davet kodunu temizle (Kullanıcı tekrar girmeli)
                setPassword('');
                setInviteCode('');

                // NOT: 'username' state'ini özellikle temizlemiyoruz (setUsername('') YOK).
                // Böylece kullanıcı adı input alanında yazılı kalır.

            } else {
                // --- GİRİŞ BAŞARILI ---
                const receivedToken = res.data.access_token;
                const receivedIsAdmin = res.data.is_admin || false;
                if (!receivedToken) { throw new Error("API'den geçerli token alınamadı."); }

                localStorage.setItem(config.TOKEN_KEY, receivedToken);
                localStorage.setItem('veloxcase_is_admin', receivedIsAdmin.toString());
                setToken(receivedToken);
                setIsAdmin(receivedIsAdmin);
                setAuthKey(prev => prev + 1);

                // Giriş yapıldıktan sonra formları tamamen temizle
                setUsername('');
                setPassword('');
                setErrors({ username: false, password: false });

                toast.success(`Hoş geldiniz, ${username}.`, { icon: '👋' });
            }
        } catch (err) {
            const apiMsg = err.response?.data?.msg;
            let displayMsg = "İşlem başarısız. Lütfen bilgileri kontrol edin.";

            // Backend'den gelen Türkçe mesajları yakala
            if (apiMsg) {
                if (apiMsg.includes('zaten kullanımda') || apiMsg.includes('already exists')) {
                    displayMsg = "Bu kullanıcı adı zaten kullanımda.";
                } else if (apiMsg.includes('Hatalı giriş') || apiMsg.includes('Invalid')) {
                    displayMsg = "Kullanıcı adı veya parola hatalı.";
                } else if (apiMsg.includes('8 karakter')) {
                    displayMsg = "Şifre en az 8 karakter olmalıdır.";
                } else {
                    displayMsg = apiMsg;
                }
            }

            toast.error(displayMsg, {
                icon: '⚠️',
                style: { border: '1px solid #ef4444', color: '#b91c1c' }
            });
        } finally {
            setAuthLoading(false);
        }
    }, [username, password, inviteCode, isRegistering]);

    // --- İŞLEV: Oturumu Kapatma ---
    const handleLogout = useCallback(() => {
        localStorage.removeItem(config.TOKEN_KEY);
        localStorage.removeItem('veloxcase_is_admin');
        setToken(null);
        setIsAdmin(false);
        setAuthKey(prev => prev + 1);
        setUsername('');
        setPassword('');
        setInviteCode('');
        setErrors({ username: false, password: false, inviteCode: false });
        toast('Oturum kapatıldı.', { icon: '🔒' });
    }, []);

    // --- İŞLEV: Şifremi Unuttum ---
    const handleForgotPassword = useCallback(() => {
        toast("Lütfen yönetici ile iletişime geçiniz.", { icon: '📧' });
    }, []);

    // --- ARAYÜZ ---
    return {
        token,
        isAdmin,
        authKey,
        strengthScore,
        isRegistering,
        username,
        password,
        inviteCode,
        showPassword,
        authLoading,
        errors,
        isInitialized: !isLoadingInitial,

        setUsername: (value) => { setUsername(value); if (errors.username) setErrors(e => ({ ...e, username: false })); },
        setPassword: (value) => { setPassword(value); if (errors.password) setErrors(e => ({ ...e, password: false })); },
        setInviteCode: (value) => { setInviteCode(value); if (errors.inviteCode) setErrors(e => ({ ...e, inviteCode: false })); },
        setIsRegistering,
        setShowPassword,
        handleAuth,
        handleLogout,
        handleForgotPassword,
    };
};