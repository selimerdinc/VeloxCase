#!/bin/bash
set -e

echo "🚀 VeloxCase Sunucu Kurulumu Başlıyor..."

# 1. Firewall Ayarları (Oracle Cloud için Kritik)
echo "🛡️  Firewall ayarlanıyor..."
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3002 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 5000 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 5002 -j ACCEPT
sudo netfilter-persistent save || echo "⚠️ netfilter-persistent kaydı yapılamadı (henüz yüklü değil olabilir)"

# 2. Sistem Güncelleme
echo "📦 Sistem güncelleniyor..."
sudo apt update && sudo apt upgrade -y

# 3. Gerekli Paketler
echo "🛠️  Nginx ve Certbot kuruluyor..."
sudo apt install nginx certbot python3-certbot-nginx -y

# 4. Docker Kurulumu
if ! command -v docker &> /dev/null; then
    echo "🐳 Docker kuruluyor..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
    echo "✅ Docker kuruldu. Grup değişikliğinin aktif olması için çıkış yapıp girmeniz gerekebilir."
else
    echo "✅ Docker zaten yüklü."
fi

# 5. Docker Compose Kurulumu
echo "🐙 Docker Compose kuruluyor..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

echo "✅ Kurulum tamamlandı! Lütfen oturumu kapatıp tekrar açın ('exit' yazıp tekrar bağlanın)."
