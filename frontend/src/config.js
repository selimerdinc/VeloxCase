// src/config.js
// Merkezi yapılandırma dosyası

const config = {
    // API Base URL - Environment variable veya varsayılan
    API_BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
    
    // Uygulama bilgileri
    APP_NAME: 'VeloxCase',
    APP_VERSION: '1.0.0',
    
    // Token ayarları
    TOKEN_KEY: 'qc_token',
    THEME_KEY: 'theme',
    
    // API Timeout (ms)
    API_TIMEOUT: 30000,
};

export default config;
