import React from 'react';
import { ArrowLeft, Zap, Shield, Loader2, Save, Lock, Brain } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // <--- YENİ

function SettingsView(props) {
    const {
        settingsTab, setSettingsTab, settingsData, setSettingsData,
        saveSettings, settingsLoading, passwordData, setPasswordData,
        handleChangePassword,
        passwordErrors
    } = props;

    const navigate = useNavigate(); // <--- Hook

    return (
        <div className="settings-view card" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div className="page-header">
                <button onClick={() => navigate('/')} className="btn-back"><ArrowLeft size={20} /> Geri Dön</button>
                <div><h2>Sistem Ayarları</h2><p>API ve Güvenlik Yönetimi</p></div>
            </div>

            {/* Sekmeler */}
            <div className="settings-tabs">
                <button className={`tab-btn ${settingsTab === 'api' ? 'active' : ''}`} onClick={() => setSettingsTab('api')}><Zap size={18} /> API Bağlantıları</button>
                <button className={`tab-btn ${settingsTab === 'ai' ? 'active' : ''}`} onClick={() => setSettingsTab('ai')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Brain size={18} /> AI Ayarları</button>
                <button className={`tab-btn ${settingsTab === 'security' ? 'active' : ''}`} onClick={() => setSettingsTab('security')}><Shield size={18} /> Güvenlik</button>
            </div>

            {settingsTab === 'api' ? (
                <div className="settings-grid tab-content fade-in">
                    {Object.keys(settingsData)
                        .filter(key => !['AI_ENABLED', 'AI_API_KEY', 'AI_SYSTEM_PROMPT', 'AI_VISION_ENABLED', 'AI_AUTOMATION_ENABLED', 'AI_NEGATIVE_ENABLED', 'AI_MOCKDATA_ENABLED'].includes(key))
                        .map(key => {

                            const labels = {
                                'JIRA_BASE_URL': 'Jira Sunucu Adresi',
                                'JIRA_EMAIL': 'Jira E-posta Hesabı',
                                'JIRA_API_TOKEN': 'Jira API Anahtarı',
                                'TESTMO_BASE_URL': 'Testmo Sunucu Adresi',
                                'TESTMO_API_URL': 'Testmo API Endpoint',
                                'TESTMO_API_KEY': 'Testmo API Anahtarı',
                                'TESTMO_PROJECT_ID': 'Testmo Proje ID (Repository ID)'
                            };
                            const placeholders = {
                                'JIRA_BASE_URL': 'https://kurum.atlassian.net',
                                'JIRA_EMAIL': 'ad.soyad@kurum.com',
                                'JIRA_API_TOKEN': 'Jira API Erişim Anahtarı',

                                'TESTMO_BASE_URL': 'https://kurum.testmo.net',
                                'TESTMO_API_URL': 'API Erişim Adresi (Otomatik)',
                                'TESTMO_API_KEY': 'Testmo API Erişim Anahtarı',
                                'TESTMO_PROJECT_ID': '1'
                            };


                            const helperTexts = {
                                'JIRA_BASE_URL': 'Jira Cloud veya Server adresiniz',
                                'JIRA_EMAIL': 'Jira hesabınıza bağlı e-posta',
                                'JIRA_API_TOKEN': 'API Token\'ı Jira Profil Ayarlarından Oluşturun',
                                'TESTMO_BASE_URL': 'Testmo örneğinizin ana adresi',
                                'TESTMO_API_URL': 'Genellikle /api/v1 ile biter',
                                'TESTMO_API_KEY': 'Testmo Kullanıcı Ayarlarından API Key Oluşturun',
                                'TESTMO_PROJECT_ID': 'Testmo\'daki proje numarası (Repo ID)'
                            };

                            return (
                                <div key={key} className="form-group">
                                    <label htmlFor={`setting-${key}`}>{labels[key] || key.replace(/_/g, ' ')}</label>
                                    <input
                                        id={`setting-${key}`}
                                        className="form-input"
                                        type={key.includes('TOKEN') || key.includes('KEY') ? "password" : "text"}
                                        value={settingsData[key] || ''}
                                        onChange={e => setSettingsData({ ...settingsData, [key]: e.target.value })}
                                        placeholder={placeholders[key] || key}
                                        aria-label={labels[key] || key}
                                        autoComplete={key.includes('TOKEN') || key.includes('KEY') ? 'off' : 'on'}
                                    />
                                    {helperTexts[key] && <p className="helper-text">{helperTexts[key]}</p>}
                                </div>
                            );
                        })}

                    <div style={{ gridColumn: 'span 2', textAlign: 'right', marginTop: '10px' }}>
                        <button onClick={saveSettings} className="btn-premium" disabled={settingsLoading}>
                            {settingsLoading ? <Loader2 className="spinner" size={20} /> : (
                                <>
                                    <Save size={20} />
                                    <span>Değişiklikleri Kaydet</span>
                                </>
                            )}
                        </button>
                    </div>



                </div>

            ) : settingsTab === 'ai' ? (
                <div className="tab-content fade-in" style={{ maxWidth: '600px' }}>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', marginBottom: '20px' }}>
                        <div>
                            <label style={{ marginBottom: '4px', fontSize: '1.1rem', color: 'var(--primary)' }}>Yapay Zeka Destekli Senkronizasyon</label>
                            <p style={{ fontSize: '0.85rem', opacity: 0.7, color: '#fff' }}>Test projelerinizi Google Gemini altyapısı ile otomatikleştirin.</p>
                        </div>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={settingsData.AI_ENABLED === 'true'}
                                onChange={e => setSettingsData({ ...settingsData, AI_ENABLED: e.target.checked ? 'true' : 'false' })}
                            />
                            <span className="slider"></span>
                        </label>

                    </div>

                    <div className="form-group">
                        <label htmlFor="ai-api-key">Google Gemini API Anahtarı</label>
                        <input
                            id="ai-api-key"
                            className="form-input"
                            type="password"
                            value={settingsData.AI_API_KEY || ''}
                            onChange={e => setSettingsData({ ...settingsData, AI_API_KEY: e.target.value })}
                            placeholder="API Erişim Anahtarını Girin"
                            aria-label="Gemini API Anahtarı"
                            autoComplete="off"
                        />
                        <p className="helper-text">Anahtarınızı Google AI Studio üzerinden temin edebilirsiniz.</p>
                    </div>

                    <div className="form-group">
                        <label htmlFor="ai-prompt">Özel Analiz Talimatları</label>
                        <textarea
                            id="ai-prompt"
                            className="form-input"
                            style={{ height: '100px', resize: 'vertical', fontSize: '0.9rem', lineHeight: '1.5' }}
                            value={settingsData.AI_SYSTEM_PROMPT || ''}
                            onChange={e => setSettingsData({ ...settingsData, AI_SYSTEM_PROMPT: e.target.value })}
                            placeholder="Örn: Test Adımlarını İngilizce Yapılandır Veya Belirli Modüllere Öncelik Ver..."
                            aria-label="Özel AI Talimatları"
                        />
                        <p className="helper-text">Ek talimatlar, sistemin temel QA standartlarına ilave olarak uygulanır.</p>
                    </div>


                    {/* Power-Ups Section Visible ONLY when AI is enabled */}
                    {settingsData.AI_ENABLED === 'true' && (
                        <div className="advanced-ai-section" style={{ marginTop: '25px', padding: '20px', border: '1px solid var(--border)', borderRadius: '12px', background: 'rgba(255,255,255,0.02)' }}>
                            <h4 style={{ marginBottom: '15px', fontSize: '0.95rem', color: 'var(--primary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gelişmiş AI Power-Ups</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                {[
                                    { key: 'AI_VISION_ENABLED', label: 'Vision (Görsel Analiz)', desc: 'Ekran Görüntülerini Analiz Et' },
                                    { key: 'AI_AUTOMATION_ENABLED', label: 'Auto-Automation', desc: 'Otomasyon Kodu Üret' },
                                    { key: 'AI_NEGATIVE_ENABLED', label: 'Edge-Case Predictor', desc: 'Negatif Senaryoları Türet' },
                                    { key: 'AI_MOCKDATA_ENABLED', label: 'Smart Data Factory', desc: 'Gerçekçi Test Verisi Üret' }
                                ].map(p => (
                                    <div key={p.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                                        <div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>{p.label}</div>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{p.desc}</div>
                                        </div>
                                        <label className="switch">
                                            <input
                                                type="checkbox"
                                                checked={settingsData[p.key] === 'true'}
                                                onChange={e => setSettingsData({ ...settingsData, [p.key]: e.target.checked ? 'true' : 'false' })}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}





                    <div style={{ textAlign: 'right', marginTop: '20px' }}>
                        <button onClick={saveSettings} className="btn-premium" disabled={settingsLoading}>
                            {settingsLoading ? <Loader2 className="spinner" size={20} /> : (
                                <>
                                    <Save size={20} />
                                    <span>Değişiklikleri Kaydet</span>
                                </>
                            )}
                        </button>
                    </div>



                </div>
            ) : (

                <div className="tab-content fade-in" style={{ maxWidth: '400px' }}>
                    <div className="form-group">
                        <label>Mevcut Şifre</label>
                        <input
                            type="password"
                            className={`form-input ${passwordErrors.old ? 'input-error' : ''}`}
                            value={passwordData.old}
                            onChange={e => setPasswordData({ ...passwordData, old: e.target.value })}
                            placeholder="Mevcut Şifrenizi Doğrulayın"
                        />
                    </div>
                    <div className="form-group">
                        <label>Yeni Şifre</label>
                        <input
                            type="password"
                            className={`form-input ${passwordErrors.new ? 'input-error' : ''}`}
                            value={passwordData.new}
                            onChange={e => setPasswordData({ ...passwordData, new: e.target.value })}
                            placeholder="En Az 8 Karakterli Yeni Şifre"
                        />
                    </div>
                    <div className="form-group">
                        <label>Yeni Şifre (Tekrar)</label>
                        <input
                            type="password"
                            className={`form-input ${passwordErrors.confirm ? 'input-error' : ''}`}
                            value={passwordData.confirm}
                            onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                            placeholder="Yeni Şifreyi Tekrar Girin"
                        />
                    </div>

                    <div style={{ textAlign: 'right', marginTop: '20px' }}>
                        <button onClick={handleChangePassword} className="btn-premium" disabled={settingsLoading}>
                            {settingsLoading ? <Loader2 className="spinner" size={20} /> : (
                                <>
                                    <Lock size={20} />
                                    <span>Şifreyi Güncelle</span>
                                </>
                            )}
                        </button>
                    </div>


                </div>

            )}
        </div>
    );
}

export default SettingsView;