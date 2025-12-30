# 📚 VeloxCase API Referansı

Bu dokümanda VeloxCase API endpoint'leri detaylı olarak açıklanmaktadır.

**Base URL:** `http://localhost:5000/api`

**Swagger UI:** `http://localhost:5000/apidocs`

---

## 🔐 Authentication (Kimlik Doğrulama)

### POST /register
Yeni kullanıcı kaydı oluşturur.

**Rate Limit:** 10 istek/dakika

**Request Body:**
```json
{
  "username": "kullanici_adi",
  "password": "sifre123"
}
```

**Response (201):**
```json
{
  "msg": "Kullanıcı başarıyla oluşturuldu"
}
```

**Errors:**
- `400`: Şifre en az 8 karakter olmalıdır
- `400`: Bu kullanıcı adı zaten kullanımda

---

### POST /login
Sisteme giriş yapar ve JWT token döner.

**Rate Limit:** 20 istek/dakika

**Request Body:**
```json
{
  "username": "kullanici_adi",
  "password": "sifre123"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- `401`: Hatalı giriş

---

### POST /change-password
Kullanıcının şifresini değiştirir.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "old_password": "eski_sifre",
  "new_password": "yeni_sifre"
}
```

**Response (200):**
```json
{
  "msg": "Şifreniz başarıyla güncellendi"
}
```

**Errors:**
- `401`: Mevcut şifre hatalı
- `400`: Yeni şifre en az 8 karakter olmalıdır

---

## ⚙️ Configuration (Ayarlar)

### GET /settings
Kullanıcının API ayarlarını getirir.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "JIRA_BASE_URL": "https://your-company.atlassian.net",
  "JIRA_EMAIL": "user@company.com",
  "JIRA_API_TOKEN": "********",
  "TESTMO_API_URL": "https://your-company.testmo.net",
  "TESTMO_API_KEY": "********"
}
```

---

### POST /settings
Kullanıcının API ayarlarını günceller.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "JIRA_BASE_URL": "https://your-company.atlassian.net",
  "JIRA_EMAIL": "user@company.com",
  "JIRA_API_TOKEN": "your-jira-api-token",
  "TESTMO_BASE_URL": "https://your-company.testmo.net",
  "TESTMO_API_KEY": "your-testmo-api-key"
}
```

**Response (200):**
```json
{
  "msg": "Kaydedildi"
}
```

---

## 🔄 Sync Operations (Senkronizasyon)

### GET /folders/{project_id}
Testmo projesindeki klasörleri listeler.

**Headers:** `Authorization: Bearer <token>`

**URL Parameters:**
- `project_id`: Testmo Proje ID (integer)

**Response (200):**
```json
{
  "folders": [
    {"id": 1, "name": "Smoke Tests", "parent_id": null},
    {"id": 2, "name": "Regression", "parent_id": null}
  ]
}
```

---

### POST /folders/{project_id}
Testmo'da yeni klasör oluşturur.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Yeni Klasör",
  "parent_id": 1
}
```

**Response (200):**
```json
{
  "id": 15,
  "name": "Yeni Klasör"
}
```

---

### POST /preview
Jira task önizlemesi getirir.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "task_key": "PROJ-123"
}
```

**Response (200):**
```json
{
  "found": true,
  "key": "PROJ-123",
  "summary": "Login sayfası test senaryoları",
  "status": "In Progress"
}
```

**Response (404):**
```json
{
  "found": false
}
```

---

### POST /sync
Jira task'larını Testmo'ya senkronize eder.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "jira_input": "PROJ-123, PROJ-456",
  "project_id": 1,
  "folder_id": 15,
  "force_update": false
}
```

**Parameters:**
- `jira_input`: Virgülle ayrılmış Jira key'leri (max 3)
- `project_id`: Testmo Proje ID
- `folder_id`: Hedef klasör ID
- `force_update`: Aynı isimde case varsa güncelle (boolean)

**Response (200):**
```json
{
  "results": [
    {
      "task": "PROJ-123",
      "status": "success",
      "case_name": "Login Test Cases",
      "images": 3,
      "steps": 5,
      "action": "created"
    },
    {
      "task": "PROJ-456",
      "status": "duplicate",
      "case_name": "Existing Case",
      "msg": "Aynı isimde kayıt mevcut"
    }
  ]
}
```

**Status Values:**
- `success`: Başarıyla oluşturuldu/güncellendi
- `duplicate`: Aynı isimde kayıt mevcut
- `error`: Hata oluştu

---

## 📊 Dashboard & Stats

### GET /stats
Kullanıcının istatistiklerini getirir.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "total_cases": 150,
  "total_images": 523,
  "today_syncs": 12,
  "total_syncs": 450
}
```

---

### GET /history
Son 50 senkronizasyon işlemini listeler.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
[
  {
    "id": 125,
    "date": "2024-01-15 14:30",
    "task": "PROJ-123",
    "case": "Login Test Cases",
    "status": "SUCCESS"
  }
]
```

---

## 🔒 Error Responses

Tüm endpoint'ler aşağıdaki hata formatını kullanır:

```json
{
  "msg": "Hata mesajı"
}
```

**HTTP Status Codes:**
- `200`: Başarılı
- `201`: Kayıt oluşturuldu
- `400`: Geçersiz istek
- `401`: Yetkisiz erişim
- `404`: Kayıt bulunamadı
- `429`: Rate limit aşıldı
- `500`: Sunucu hatası
