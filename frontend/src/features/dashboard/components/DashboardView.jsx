// src/features/dashboard/components/DashboardView.jsx

import React, { useEffect } from 'react';

import {
  Zap, FolderPlus, ArrowRight, Image as ImageIcon, Loader2,
  PlusCircle, List, XCircle, BarChart3, Calendar, Check, AlertTriangle,
  Brain, Send, Code, Database, Eye, X
} from 'lucide-react';

function DashboardView(props) {
  const {
    stats, repoId, setRepoId,
    folders, foldersLoading, selectedFolder, setSelectedFolder,
    showNewFolder, setShowNewFolder, newFolderName, setNewFolderName, handleCreateFolder,
    jiraInput, setJiraInput, previewTask, previewLoading,
    loading, handleSync, syncResults,
    dashboardErrors,
    // YENİ PROP'LAR
    showDuplicateModal, setShowDuplicateModal, duplicateItem, handleForceUpdate,
    // AI ANALYSIS PROP'LARI (YENİ)
    analysisResult, analysisLoading, showAnalysisPanel, setShowAnalysisPanel, handleAnalyze,
    // PARENT FOLDER SEÇİMİ
    parentFolderForNew, setParentFolderForNew,
    // SETTINGS DATA (AI TOGGLE İÇİN)
    settingsData
  } = props;

  // AI Aktif mi kontrolü
  const isAIEnabled = settingsData?.AI_ENABLED === 'true';

  // AI kapatıldığında modalı da kapat
  useEffect(() => {
    if (!isAIEnabled && showAnalysisPanel) {
      setShowAnalysisPanel(false);
    }
  }, [isAIEnabled, showAnalysisPanel, setShowAnalysisPanel]);



  return (
    <>
      {/* --- DUPLICATE MODAL --- */}
      {showDuplicateModal && duplicateItem && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div className="icon-box-warning"><AlertTriangle size={24} /></div>
              <h3>Kayıt Zaten Mevcut</h3>
            </div>
            <div className="modal-body">
              <p><strong>{duplicateItem.case_name}</strong></p>
              <p>Bu case, seçili klasörde zaten bulunuyor.</p>
              <p>Mevcut kaydın üzerine yazmak (güncellemek) ister misiniz?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-text" onClick={() => setShowDuplicateModal(false)}>
                İptal Et
              </button>
              <button className="btn btn-primary" onClick={handleForceUpdate} disabled={loading}>
                {loading ? <Loader2 className="spinner" /> : 'Evet, Güncelle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MEVCUT KODLAR */}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-icon bg-blue"><BarChart3 size={24} color="#2563eb" /></div><div className="stat-info"><h3>{stats.total_cases || 0}</h3><p>Toplam Senaryo</p></div></div>
        <div className="stat-card"><div className="stat-icon bg-purple"><ImageIcon size={24} color="#9333ea" /></div><div className="stat-info"><h3>{stats.total_images || 0}</h3><p>İşlenen Görsel</p></div></div>
        <div className="stat-card"><div className="stat-icon bg-green"><Calendar size={24} color="#16a34a" /></div><div className="stat-info"><h3>{stats.today_syncs || 0}</h3><p>Bugünkü İşlem</p></div></div>
      </div>

      <div className="grid-layout">
        {/* SIDEBAR */}
        <div className="sidebar">
          <div className="card">
            <div className="form-group">
              <label className="form-label">Testmo Proje Kimliği</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="form-input"
                value={repoId}
                onChange={e => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  if (val === '' || parseInt(val, 10) > 0) {
                    setRepoId(val);
                  }
                }}
                placeholder="Proje ID Numarasını Girin"
                aria-label="Testmo Proje ID"
                style={{ MozAppearance: 'textfield' }}
              />
              <p className="helper-text">Testmo'daki projenizin benzersiz kimlik numarası.</p>
            </div>
          </div>

          <div className="card">
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Hedef Klasör
                <button onClick={() => setShowNewFolder(!showNewFolder)} className="btn-text" aria-label="Yeni Klasör Oluştur">
                  <FolderPlus size={16} /> Yeni Klasör
                </button>
              </label>

              {showNewFolder && (
                <div className="new-folder-wrapper" style={{ flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      className={`form-input ${dashboardErrors.newFolderName ? 'input-error' : ''}`}
                      placeholder="Klasör Adını Yazın"
                      value={newFolderName}
                      onChange={e => setNewFolderName(e.target.value)}
                      aria-label="Yeni Klasör Adı"
                      style={{ flex: 1 }}
                    />
                    <button onClick={handleCreateFolder} className="btn btn-success" aria-label="Klasör Oluştur">
                      <PlusCircle size={18} /> Oluştur
                    </button>
                  </div>
                  <select
                    className="form-select"
                    value={parentFolderForNew || ''}
                    onChange={e => setParentFolderForNew(e.target.value ? parseInt(e.target.value, 10) : null)}
                    style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}
                    aria-label="Ana Klasör Seçimi"
                  >
                    <option value="">📁 Ana Dizinde Oluştur (Kök)</option>
                    {folders.map(f => (
                      <option key={f.id} value={f.id}>
                        └─ {f.displayName || f.name} altında
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="input-container">
                <select
                  className={`form-select ${dashboardErrors.selectedFolder ? 'input-error' : ''}`}
                  value={selectedFolder || ''}
                  onChange={e => {
                    const val = e.target.value ? parseInt(e.target.value, 10) : null;
                    setSelectedFolder(val);
                    // LocalStorage'a kaydet
                    if (val) {
                      localStorage.setItem(`veloxcase_folder_${repoId}`, val.toString());
                    }
                  }}
                  disabled={foldersLoading}
                  aria-label="Hedef Klasör Seçimi"
                  style={{ fontFamily: 'monospace' }}
                >
                  <option value="">{foldersLoading ? 'Klasörler Yükleniyor...' : '📁 Hedef Klasörü Seçin'}</option>
                  {folders.length === 0 && !foldersLoading && (
                    <option value="" disabled>Henüz Klasör Bulunmuyor</option>
                  )}
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.displayName || f.name}
                    </option>
                  ))}
                </select>
                {dashboardErrors.selectedFolder && <p className="helper-text text-red" style={{ color: 'var(--error)' }}>Lütfen Test Kayıtları İçin Hedef Klasör Seçin.</p>}
              </div>
            </div>
          </div>
        </div>


        {/* CONTENT AREA */}
        <div className="content-area">
          <div className="card">
            <label className="form-label" style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Jira Görev Aktarımı</label>

            {previewLoading ? (
              <div className="preview-card" role="status" aria-live="polite">
                <Loader2 className="spinner" size={20} /> Görev Bilgileri Yükleniyor...
              </div>
            ) : previewTask && (
              <div className="preview-card" role="region" aria-label="Görev Önizlemesi">
                {previewTask.icon && <img src={previewTask.icon} alt="Görev Tipi" style={{ width: 20, height: 20 }} />}
                <div>
                  <strong>{previewTask.key}:</strong> {previewTask.summary}
                  <span className={`status-tag ${previewTask.status === 'Done' ? 'status-done' : ''}`}>{previewTask.status}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '1rem' }}>
              <div style={{ flex: 1 }}>
                <input
                  className={`form-input ${dashboardErrors.jiraInput ? 'input-error' : ''}`}
                  placeholder="Görev Kodunu Girin (Örn: PROJ-123)"
                  value={jiraInput}
                  onChange={e => setJiraInput(e.target.value)}
                  style={{ padding: '1rem', fontSize: '1.1rem', fontWeight: '600' }}
                  aria-label="Jira Görev Anahtarı"
                  aria-describedby="jira-helper"
                />
                {dashboardErrors.jiraInput && (
                  <p className="helper-text text-red" style={{ color: 'var(--error)' }}>
                    Geçerli Bir Jira Görev Anahtarı Gereklidir.
                  </p>
                )}
              </div>

              {/* AI ANALİZ BUTONU - Sadece AI aktifken göster */}
              {isAIEnabled && (
                <button
                  onClick={handleAnalyze}
                  disabled={analysisLoading}
                  className="btn btn-primary"
                  style={{ width: '180px', background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}
                  aria-label="AI Analizi Başlat"
                >
                  {analysisLoading ? (
                    <><Loader2 className="spinner" size={20} /> Analiz...</>
                  ) : (
                    <><Brain size={20} /> AI Analiz</>
                  )}
                </button>
              )}


              {/* SENKRONIZE ET BUTONU */}
              <button
                onClick={handleSync}
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '180px' }}
                aria-label="Senkronizasyonu Başlat"
              >
                {loading ? (
                  <><Loader2 className="spinner" size={20} /> İşleniyor...</>
                ) : (
                  <><Send size={20} /> Testmo'ya Gönder</>
                )}
              </button>
            </div>
            <p id="jira-helper" className="helper-text" style={{ marginTop: '1rem' }}>
              Önce AI Analiz ile önizleme yapın, ardından Testmo'ya gönderin.
            </p>
          </div>

          {/* AI ANALİZ SONUÇLARI PANELİ */}
          {showAnalysisPanel && analysisResult && (
            <div className="card" style={{ marginTop: '1rem', border: '2px solid var(--primary)', background: 'rgba(139, 92, 246, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Brain size={24} color="var(--primary)" />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>AI Analiz Sonuçları</h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>{analysisResult.task_key}: {analysisResult.summary}</p>
                  </div>
                </div>
                <button onClick={() => setShowAnalysisPanel(false)} className="btn btn-text" aria-label="Kapat">
                  <X size={20} />
                </button>
              </div>

              {analysisResult.ai_enabled && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', flexWrap: 'wrap' }}>
                  <div
                    title="Bu analiz AI tarafından yapılmıştır"
                    style={{ padding: '4px 10px', background: 'var(--primary)', color: 'white', borderRadius: '20px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'default' }}>
                    <Brain size={12} /> AI Destekli
                  </div>

                  {/* Sadece veri varsa badge'leri göster */}
                  {analysisResult.test_cases?.some(tc => tc.scenario?.includes('VİZYON') || tc.edge_cases?.length > 0) && (
                    <div
                      onClick={() => document.getElementById('ai-sections-container').scrollTo({ top: 0, behavior: 'smooth' })}
                      title="Görsel analiz sonuçlarını göster"
                      className="ai-feature-badge"
                      style={{ padding: '4px 10px', background: '#22c55e', color: 'white', borderRadius: '20px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <Eye size={12} /> Vision Analiz
                    </div>
                  )}

                  {analysisResult.automation_candidates?.length > 0 && (
                    <div
                      onClick={() => {
                        const el = document.getElementById('automation-recommendations');
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                      title="Otomasyona uygun senaryo önerilerini göster"
                      className="ai-feature-badge"
                      style={{ padding: '4px 10px', background: '#f59e0b', color: 'white', borderRadius: '20px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <Code size={12} /> Otomasyon Önerileri
                    </div>
                  )}

                  {analysisResult.test_cases?.some(tc => tc.mock_data) && (
                    <div
                      onClick={() => {
                        const el = document.querySelector('[data-section="mock"]');
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                      title="Test verilerini ve mock dataları göster"
                      className="ai-feature-badge"
                      style={{ padding: '4px 10px', background: '#06b6d4', color: 'white', borderRadius: '20px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <Database size={12} /> Mock Data
                    </div>
                  )}
                </div>
              )}

              <div id="ai-sections-container" style={{ maxHeight: '550px', overflowY: 'auto', paddingRight: '5px' }}>

                {/* Otomasyon Adayları Listesi - En Üstte */}
                {analysisResult.automation_candidates?.length > 0 && (
                  <div id="automation-recommendations" style={{ padding: '15px', marginBottom: '20px', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.05) 100%)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '12px' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#f59e0b', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Code size={18} /> Otomasyon Önerileri (Aday Listesi)
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', lineHeight: '1.6', opacity: 0.9 }}>
                      {analysisResult.automation_candidates.map((candidate, i) => (
                        <li key={i} style={{ marginBottom: '4px' }}>{candidate}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysisResult.test_cases && analysisResult.test_cases.map((tc, idx) => (
                  <div key={idx} style={{ padding: '15px', marginBottom: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>

                    <h4 style={{ margin: '0 0 12px 0', color: 'var(--primary)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        background: tc.name?.includes('TC01') ? '#3b82f6' : 'var(--primary)',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem'
                      }}>
                        {tc.name?.includes('TC01') ? 'ANA GÖREV' : `TC${String(idx + 1).padStart(2, '0')}`}
                      </span>
                      {tc.name?.replace(/^TC\d+:\s*/i, '')}
                    </h4>

                    <div style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
                      {/* Senaryo - TEST DATA ayrıştırılıyor */}
                      <div style={{ marginBottom: '12px' }}>
                        <strong style={{ color: '#22c55e' }}>📋 Senaryo:</strong>
                        <p style={{ margin: '4px 0', opacity: 0.9, whiteSpace: 'pre-wrap' }}>
                          {tc.scenario?.replace(/\*\*\[(TEST DATA|AUTOMATION CODE)\]\*\*[\s\S]*$/, '').trim()}
                        </p>
                      </div>

                      {/* Beklenen Sonuç */}
                      <div style={{ marginBottom: '12px' }}>
                        <strong style={{ color: '#3b82f6' }}>✅ Beklenen Sonuç:</strong>
                        <p style={{ margin: '4px 0', opacity: 0.9, whiteSpace: 'pre-wrap' }}>{tc.expected_result}</p>
                      </div>

                      {/* Mock Data - Tablo formatında */}
                      {tc.mock_data && (
                        <div
                          data-section="mock"
                          style={{ marginBottom: '12px', padding: '12px', background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(8, 145, 178, 0.1) 100%)', borderRadius: '10px', border: '1px solid rgba(6, 182, 212, 0.4)' }}>
                          <strong style={{ color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                            <Database size={14} /> 📊 Test Verileri:
                          </strong>
                          <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '6px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                              <tbody>
                                {typeof tc.mock_data === 'object' ? (
                                  Object.entries(tc.mock_data).map(([key, value], i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                      <td style={{ padding: '8px 12px', color: '#06b6d4', fontWeight: '600', width: '35%', verticalAlign: 'top' }}>{key}</td>
                                      <td style={{ padding: '8px 12px', opacity: 0.9 }}>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td style={{ padding: '8px 12px' }}>{tc.mock_data}</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}



                      {/* Edge Cases / Negatif Senaryolar */}
                      {tc.edge_cases && tc.edge_cases.length > 0 && (
                        <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                          <strong style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={14} /> Edge Cases:</strong>
                          <ul style={{ margin: '8px 0 0', paddingLeft: '20px', fontSize: '0.8rem', opacity: 0.9 }}>
                            {tc.edge_cases.map((ec, ecIdx) => <li key={ecIdx}>{ec}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>


              <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button onClick={() => setShowAnalysisPanel(false)} className="btn btn-text">
                  İptal
                </button>
                <button
                  onClick={handleSync}
                  disabled={loading || !selectedFolder}
                  className="btn btn-primary"
                  style={{ minWidth: '200px' }}
                >
                  {loading ? <Loader2 className="spinner" size={18} /> : <Send size={18} />}
                  <span style={{ marginLeft: '8px' }}>Onayla ve Testmo'ya Gönder</span>
                </button>
              </div>
            </div>
          )}


          {/* Sync Results Card */}
          {syncResults.length > 0 && (
            <div className="result-card">
              <div className="result-header">
                <div className="success-icon-box" style={{ background: '#f1f5f9', color: '#1e293b' }}><List size={24} strokeWidth={3} /></div>
                <div><h3 className="result-title">İşlem Özeti</h3><div className="result-meta"><span className="meta-tag">Toplam: {syncResults.length} Kayıt</span></div></div>
              </div>
              <div className="case-list">
                {syncResults.map((res, idx) => (
                  <div key={idx} className="case-item"
                    style={{ borderLeft: res.status === 'success' ? '4px solid #22c55e' : (res.status === 'duplicate' ? '4px solid #f59e0b' : '4px solid #ef4444') }}>
                    <div className="case-info">
                      {res.status === 'success' ? <Check className="text-green" size={20} /> :
                        res.status === 'duplicate' ? <AlertTriangle className="text-warning" size={20} color="#f59e0b" /> :
                          <XCircle className="text-red" size={20} />}
                      <div>
                        <span className="case-name" style={{ display: 'block' }}>{res.task}</span>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {res.status === 'success' ? (res.action === 'updated' ? 'Güncellendi' : res.case_name) : res.msg}
                        </span>
                      </div>
                    </div>
                    {res.status === 'success' && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span className="img-badge"><ImageIcon size={12} /> {res.images} Resim</span></div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default DashboardView;