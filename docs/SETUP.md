# 🛠️ VeloxCase Kurulum Rehberi

Bu dokümanda VeloxCase'in kurulum ve yapılandırma adımları detaylı olarak açıklanmaktadır.

---

## 📋 Ön Gereksinimler

### Docker ile Kurulum (Önerilen)
- Docker Desktop 4.0+
- Docker Compose 2.0+

### Manuel Kurulum
- Python 3.11+
- Node.js 18+ (veya 20 LTS)
- PostgreSQL 15+ (veya SQLite - sadece development)

---

## 🐳 Docker ile Kurulum

### 1. Projeyi Klonlayın

```bash
git clone https://github.com/your-username/VeloxCase.git
cd VeloxCase
```

### 2. Environment Dosyalarını Oluşturun

```bash
# Ana dizin için
cp .env.example .env

# Dosyayı düzenleyin ve güçlü şifreler belirleyin
nano .env
```

**Önemli:** Aşağıdaki değerleri mutlaka değiştirin:
- `DB_PASSWORD`: Güçlü bir veritabanı şifresi
- `JWT_SECRET_KEY`: Rastgele üretilmiş JWT anahtarı
- `ENCRYPTION_KEY`: Fernet şifreleme anahtarı

### 3. Docker ile Başlatın

```bash
# Development ortamı
docker-compose up -d

# Logları takip edin
docker-compose logs -f
```

### 4. Uygulamaya Erişin

| Servis | URL |
|--------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000 |
| API Docs | http://localhost:5000/apidocs |

### 5. Admin Şifresini Alın

İlk başlatmada admin şifresi konsolda görünür:

```bash
docker-compose logs backend | grep "Şifre:"
```

---

## 💻 Manuel Kurulum

### Backend Kurulumu

```bash
cd backend

# Virtual environment oluştur
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Bağımlılıkları yükle
pip install -r requirements.txt

# Environment dosyasını oluştur
cp .env.example .env
nano .env

# Veritabanını başlat ve uygulamayı çalıştır
python run.py
```

### Frontend Kurulumu

```bash
cd frontend

# Bağımlılıkları yükle
npm install

# Environment dosyasını oluştur
cp .env.example .env

# Development sunucusunu başlat
npm start
```

---

## ⚙️ Environment Değişkenleri

### Backend (.env)

| Değişken | Açıklama | Zorunlu |
|----------|----------|---------|
| `DATABASE_URL` | PostgreSQL bağlantı URL'i | ✅ |
| `JWT_SECRET_KEY` | JWT token şifreleme anahtarı | ✅ |
| `ENCRYPTION_KEY` | Fernet şifreleme anahtarı | ✅ |
| `FLASK_DEBUG` | Debug modu (true/false) | ❌ |

### Frontend (.env)

| Değişken | Açıklama | Zorunlu |
|----------|----------|---------|
| `REACT_APP_API_URL` | Backend API URL'i | ✅ |

---

## 🔐 Güvenlik Anahtarları Üretme

### JWT Secret Key
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### Fernet Encryption Key
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

---

## 🔄 Production Deployment

Production ortamı için `docker-compose.prod.yml` kullanın:

```bash
# Production build ve başlatma
docker-compose -f docker-compose.prod.yml up -d --build

# SSL sertifikası için Certbot kullanabilirsiniz
```

---

## 🐛 Sorun Giderme

### Veritabanı bağlantı hatası
```bash
# Veritabanı container'ını kontrol edin
docker-compose logs db

# Container'ı yeniden başlatın
docker-compose restart db backend
```

### Frontend build hatası
```bash
# Node modules temizleme
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Backend import hatası
```bash
# Virtual environment aktif mi kontrol edin
source venv/bin/activate
pip install -r requirements.txt
```

---

## 📞 Destek

Sorunlarınız için GitHub Issues kullanabilirsiniz.
