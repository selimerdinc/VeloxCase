#!/bin/bash

# VeloxCase - Oracle Cloud Deployment Script
# Kullanım: ./deploy.sh

set -e

echo "🚀 VeloxCase Production Deployment Başlatılıyor..."
echo ""

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Proje dizini
cd "$(dirname "$0")/.."

# .env kontrolü
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env dosyası bulunamadı, oluşturuluyor...${NC}"
    
    # Güvenli değerler üret
    DB_PASS=$(openssl rand -hex 16)
    JWT_KEY=$(openssl rand -hex 32)
    FERNET_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 2>/dev/null || echo "")
    
    cat > .env << EOF
DB_USER=veloxcase
DB_PASSWORD=${DB_PASS}
DB_NAME=veloxcase
JWT_SECRET_KEY=${JWT_KEY}
ENCRYPTION_KEY=${FERNET_KEY}
API_URL=https://veloxcase.selimerdinc.com/api
EOF
    
    echo -e "${GREEN}✅ .env dosyası oluşturuldu${NC}"
    echo ""
    echo "⚠️  Oluşturulan değerleri güvenli bir yere kaydedin!"
    cat .env
    echo ""
fi

# Docker kontrolü
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker bulunamadı!${NC}"
    exit 1
fi

echo ""
echo "🐳 Docker container'ları başlatılıyor..."

# Production compose ile başlat
docker-compose -f docker-compose.prod.yml up -d --build

echo ""
echo -e "${GREEN}✅ VeloxCase başarıyla deploy edildi!${NC}"
echo ""
echo "📍 Nginx config'i kopyalayın:"
echo "   sudo cp nginx-veloxcase.conf /etc/nginx/sites-available/veloxcase"
echo "   sudo ln -s /etc/nginx/sites-available/veloxcase /etc/nginx/sites-enabled/"
echo "   sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "🔐 SSL sertifikası alın:"
echo "   sudo certbot --nginx -d veloxcase.selimerdinc.com"
echo ""
echo "🔑 Admin şifresini almak için:"
echo "   docker-compose -f docker-compose.prod.yml logs backend | grep 'Şifre:'"
echo ""
