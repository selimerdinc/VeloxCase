import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'; // <--- Router Hookları
import { Toaster } from 'react-hot-toast';
import { Settings, Clock, LogOut, Sun, Moon, Loader2, LayoutDashboard } from 'lucide-react';
import './App.css';

// Hook'lar
import { useAuth } from './features/auth/useAuth';
import { useDashboard } from './features/dashboard/useDashboard';

// Bileşenler
import LoginView from './features/auth/components/LoginView';
import DashboardView from './features/dashboard/components/DashboardView';
import HistoryView from './features/dashboard/components/HistoryView';
import SettingsView from './features/settings/components/SettingsView';


const getInitialTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) return savedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function App() {
  const [theme, setTheme] = useState(getInitialTheme);

  // Router Hookları
  const navigate = useNavigate();
  const location = useLocation();

  // Auth Logic
  const authLogic = useAuth();
  const { token, handleLogout, authKey, isInitialized } = authLogic;

  // Dashboard Logic (view yerine location.pathname kullanıyoruz)
  // pathname: '/' ise 'dashboard', '/settings' ise 'settings' gibi mapliyoruz.
  const currentView = location.pathname === '/' ? 'dashboard' : location.pathname.replace('/', '');

  const dashboardLogic = useDashboard(token, currentView, handleLogout, navigate); // setView yerine navigate gönderdik

  const handleThemeToggle = () => { setTheme(t => (t === 'light' ? 'dark' : 'light')); };

  useEffect(() => { document.body.className = theme === 'dark' ? 'dark-mode' : ''; localStorage.setItem('theme', theme); }, [theme]);

  // --- YÜKLENİYOR ---
  if (!isInitialized) {
    return (
      <div className="app-container" style={{justifyContent: 'center', alignItems: 'center'}}>
        <Loader2 className="spinner" size={36} color="var(--primary)"/>
      </div>
    );
  }

  // --- LOGIN ---
  if (!token) {
      return (
        <LoginView
            {...authLogic}
            theme={theme}
            handleThemeToggle={handleThemeToggle}
        />
      );
  }

  // --- MAIN APP ---
  return (
    <div className="app-container" key={authKey}>
      <Toaster position="top-center" toastOptions={{duration: 4000, style:{fontSize:'0.9rem', fontWeight:500}}}/>
      <div className="main-wrapper">

        {/* HEADER */}
        <div className="header-card">
          <div className="header-brand" style={{cursor:'pointer'}} onClick={() => navigate('/')}>
             <img src="/logo.png" alt="VeloxCase" style={{height:40, marginRight:15}}/>
             <div className="brand-text"><h1>VeloxCase</h1><p>Saniyeler İçinde Sync</p></div>
          </div>

          <div style={{display:'flex', gap:'10px', alignItems: 'center'}}>
            <button onClick={handleThemeToggle} className="btn btn-text" title="Temayı Değiştir">
                {theme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}
            </button>

            {/* Navigasyon Butonları (Artık Link Gibi Çalışıyor) */}
            <button onClick={() => navigate('/')} className={`btn btn-text ${location.pathname === '/' ? 'text-primary' : ''}`} title="Panel">
                <LayoutDashboard size={18}/> Panel
            </button>
            <button onClick={() => navigate('/history')} className={`btn btn-text ${location.pathname === '/history' ? 'text-primary' : ''}`} title="Geçmiş">
                <Clock size={18}/> Geçmiş
            </button>
            <button onClick={() => navigate('/settings')} className={`btn btn-text ${location.pathname === '/settings' ? 'text-primary' : ''}`} title="Ayarlar">
                <Settings size={18}/> Ayarlar
            </button>

            <div style={{width:1, height:20, background:'var(--border)', margin:'0 5px'}}></div>

            <button onClick={handleLogout} className="btn btn-text text-red" title="Çıkış">
                <LogOut size={20}/>
            </button>
          </div>
        </div>

        {/* ROUTING ALANI */}
        <Routes>
          <Route path="/" element={<DashboardView {...dashboardLogic} />} />
          <Route path="/history" element={<HistoryView {...dashboardLogic} />} />
          <Route path="/settings" element={<SettingsView {...dashboardLogic} />} />
          {/* Hatalı link gelirse ana sayfaya at */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

      </div>
    </div>
  );
}

export default App;