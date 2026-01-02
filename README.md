# 🚀 VeloxCase

**Jira ↔ Testmo Test Case Senkronizasyon Platformu**

VeloxCase, Jira task'larınızı otomatik olarak Testmo test senaryolarına dönüştüren güçlü bir entegrasyon aracıdır.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-green.svg)
![React](https://img.shields.io/badge/react-19.2-blue.svg)

---

## ✨ Özellikler

- 🔄 **Otomatik Senkronizasyon**: Jira task'larını tek tıkla Testmo'ya aktar
- 🤖 **Yapay Zeka Destekli (Gemini)**:
    - **Aggregate & Recommend**: Jira açıklaması ve yorumlarındaki (comments) tüm caseleri birleştirir, AI önerileri ekler.
    - **Smart Automation Candidates**: Tüm senaryolar içinden otomasyona en uygun olanları otomatik belirler.
    - **Vision Analysis**: Jira ekindeki görselleri analiz ederek test adımlarını zenginleştirir.
    - **Smart Data Factory**: Senaryolar için gerçekçi mock test verileri üretir (JSON).
    - **Edge-Case Predictor**: Negatif senaryoları ve uç durumları otomatik türetir.
- 📸 **Görsel Desteği**: Jira eklerini otomatik olarak Testmo'ya yükler
- 🔗 **Çift Yönlü Linkleme**: Jira'ya Testmo case linki ekler
- 👥 **Çoklu Kullanıcı**: Her kullanıcı kendi API ayarlarını yönetir
- 🔐 **Güvenli Saklama**: API anahtarları şifreli olarak saklanır
- 🌙 **Dark/Light Mode**: Göz yormayan arayüz
- 📊 **İstatistikler**: Senkronizasyon geçmişi ve raporlar

---

## 🚀 Hızlı Başlangıç

### Docker ile (Önerilen)

```bash
# Projeyi klonla
git clone https://github.com/selimerdinc/VeloxCase.git
cd VeloxCase

# Environment dosyalarını oluştur
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Docker ile başlat
docker-compose up -d

# Uygulamaya eriş
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000
# API Docs: http://localhost:5000/apidocs
```

### Manuel Kurulum

Detaylı kurulum için [docs/SETUP.md](docs/SETUP.md) dosyasına bakın.

---

## 📁 Proje Yapısı

```
VeloxCase/
├── backend/                 # Flask API
│   ├── app/
│   │   ├── api/            # REST Endpoints
│   │   ├── models/         # SQLAlchemy Models
│   │   ├── services/       # Business Logic
│   │   └── utils/          # Helpers
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/               # React App
│   ├── src/
│   │   ├── features/       # Feature-based modules
│   │   └── App.jsx
│   ├── Dockerfile
│   └── package.json
│
├── docs/                   # Documentation
├── docker-compose.yml      # Development
└── docker-compose.prod.yml # Production
```

---

## 🔧 Yapılandırma

### Backend Environment Variables

| Değişken | Açıklama | Varsayılan |
|----------|----------|------------|
| `JWT_SECRET_KEY` | JWT token şifreleme anahtarı | Rastgele üretilir |
| `ENCRYPTION_KEY` | API key şifreleme anahtarı | Rastgele üretilir |
| `DATABASE_URL` | PostgreSQL bağlantı URL'i | `sqlite:///veloxcase.db` |

### Frontend Environment Variables

| Değişken | Açıklama | Varsayılan |
|----------|----------|------------|
| `REACT_APP_API_URL` | Backend API URL | `http://localhost:5000/api` |

---

## 📖 API Dokümantasyonu

API dokümantasyonuna Swagger UI üzerinden erişebilirsiniz:

**Development**: `http://localhost:5000/apidocs`

Detaylı API referansı için [docs/API.md](docs/API.md) dosyasına bakın.

---

## 🛠️ Geliştirme

```bash
# Backend geliştirme
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python run.py

# Frontend geliştirme
cd frontend
npm install
npm start
```

---

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır - detaylar için [LICENSE](LICENSE) dosyasına bakın.

---

## 🤝 Katkıda Bulunma

1. Fork'layın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit'leyin (`git commit -m 'Add amazing feature'`)
4. Push'layın (`git push origin feature/amazing-feature`)
5. Pull Request açın

---

<p align="center">
  <strong>VeloxCase</strong> - Saniyeler İçinde Sync ⚡
</p>
