#!/bin/bash

# VeloxCase - Quick Setup Script
# Kullanım: ./scripts/setup.sh

set -e

echo "🚀 VeloxCase Kurulum Başlatılıyor..."
echo ""

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Root dizinine git
cd "$(dirname "$0")/.."

# Docker kontrolü
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker bulunamadı!${NC}"
    echo "Lütfen Docker Desktop'ı yükleyin: https://www.docker.com/products/docker-desktop"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose bulunamadı!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker tespit edildi${NC}"

# .env dosyası kontrolü
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env dosyası bulunamadı, örnek dosyadan oluşturuluyor...${NC}"
    cp .env.example .env
    
    # Rastgele JWT key üret
    JWT_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || openssl rand -hex 32)
    sed -i.bak "s/your-super-secret-jwt-key-change-this/$JWT_KEY/" .env
    
    # Rastgele DB password üret
    DB_PASS=$(python3 -c "import secrets; print(secrets.token_hex(16))" 2>/dev/null || openssl rand -hex 16)
    sed -i.bak "s/your-strong-database-password/$DB_PASS/" .env
    
    # Fernet key üret
    FERNET_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 2>/dev/null || echo "")
    if [ -n "$FERNET_KEY" ]; then
        sed -i.bak "s|your-fernet-encryption-key|$FERNET_KEY|" .env
    fi
    
    rm -f .env.bak
    echo -e "${GREEN}✅ .env dosyası oluşturuldu ve güvenlik anahtarları üretildi${NC}"
fi

echo ""
echo "🐳 Docker container'ları başlatılıyor..."
echo ""

# Docker compose ile başlat
docker-compose up -d --build

echo ""
echo -e "${GREEN}✅ VeloxCase başarıyla kuruldu!${NC}"
echo ""
echo "📍 Erişim Adresleri:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:5000"
echo "   API Docs:  http://localhost:5000/apidocs"
echo ""
echo "🔐 Admin şifresini almak için:"
echo "   docker-compose logs backend | grep 'Şifre:'"
echo ""
echo "📖 Daha fazla bilgi için: docs/SETUP.md"
echo ""
