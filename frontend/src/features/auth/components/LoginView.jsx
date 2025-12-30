// src/features/auth/components/LoginView.jsx

import React from 'react';
import { Toaster } from 'react-hot-toast';
import { Eye, EyeOff, Loader2, UserPlus, Lock, Sun, Moon } from 'lucide-react';
// DİKKAT: useAuth importunu sildik, çünkü prop olarak alacağız.

function LoginView(props) {
  // Props'tan gelen verileri parçalıyoruz (Destructuring)
  // Artık kendi içinde useAuth() çağırmıyor, App.jsx'in gönderdiklerini kullanıyor.
  const {
    theme,
    handleThemeToggle,
    // Auth Hook'undan gelenler:
    isRegistering, username, password, showPassword,
    authLoading, errors, strengthScore,
    handleAuth, handleForgotPassword,
    setUsername, setPassword, setIsRegistering, setShowPassword
  } = props;

  return (
    <div className="app-container login-container">
      <Toaster position="top-center" toastOptions={{ style: { fontSize: '0.9rem', fontWeight: 500 } }} />

      {/* TEMA DEĞİŞTİRME BUTONU */}
      <div style={{ position: 'absolute', top: 30, right: 30 }}>
        <button
          onClick={handleThemeToggle}
          className="btn btn-text"
          title="Temayı Değiştir"
          style={{ color: 'var(--text-main)' }}
        >
          {theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
        </button>
      </div>

      <div className="login-card">
        <div className="login-header">
          <img src="/logo.png" alt="VeloxCase" style={{ height: 60, marginBottom: 16 }} className="mx-auto" />
          <h1>VeloxCase</h1>
          <p>{isRegistering ? 'Kurumsal Hesap Oluştur' : 'Yetkili Girişi'}</p>
        </div>

        <form onSubmit={handleAuth} aria-label={isRegistering ? 'Kayıt Formu' : 'Giriş Formu'}>
          <div className="form-group">
            <label className="form-label" htmlFor="username-input">Kullanıcı Adı</label>
            <input
              id="username-input"
              className={`form-input ${errors.username ? 'input-error' : ''}`}
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Kullanıcı Adınızı Girin"
              aria-required="true"
              aria-invalid={errors.username}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password-input">Parola</label>
            <div className="input-wrapper">
              <input
                id="password-input"
                type={showPassword ? "text" : "password"}
                className={`form-input ${errors.password ? 'input-error' : ''}`}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={isRegistering ? "En Az 8 Karakter Şifre Belirleyin" : "Şifrenizi Girin"}
                style={{ paddingRight: '40px' }}
                aria-required="true"
                aria-invalid={errors.password}
                autoComplete={isRegistering ? "new-password" : "current-password"}
              />

              <button
                type="button"
                className="eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Şifreyi Gizle" : "Şifreyi Göster"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Hata Mesajları */}
            {errors.password && <p className="helper-text text-red" style={{ color: 'var(--error)' }} role="alert">Parola Alanı Boş Bırakılamaz.</p>}
            {errors.username && !errors.password && <p className="helper-text text-red" style={{ color: 'var(--error)' }} role="alert">Kullanıcı Adı Alanı Boş Bırakılamaz.</p>}

            {isRegistering && password.length > 0 && (
              <div className="strength-meter" role="progressbar" aria-valuenow={strengthScore} aria-valuemin="0" aria-valuemax="100" aria-label="Şifre Güvenlik Seviyesi">
                <div className="strength-bar" style={{
                  width: `${strengthScore}%`,
                  backgroundColor: strengthScore < 50 ? '#ef4444' : strengthScore < 75 ? '#eab308' : '#22c55e'
                }}></div>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={authLoading}
            style={{ width: '100%', marginBottom: '1rem' }}
            aria-label={isRegistering ? 'Kaydı Tamamla' : 'Güvenli Giriş Yap'}
          >
            {authLoading ? <Loader2 className="spinner" /> : (isRegistering ? <><UserPlus size={18} /> Kaydı Tamamla</> : <><Lock size={18} /> Güvenli Giriş</>)}
          </button>
        </form>


        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>{isRegistering ? 'Zaten hesabınız var mı?' : 'Hesabınız yok mu?'}</span>
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              className="btn-text"
              style={{ marginLeft: '5px', fontSize: '0.9rem' }}
            >
              {isRegistering ? 'Giriş Yap' : 'Hemen Kayıt Ol'}
            </button>
          </div>

          {!isRegistering && (
            <button
              onClick={handleForgotPassword}
              className="btn-text"
              style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}
            >
              Şifremi Unuttum
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginView;