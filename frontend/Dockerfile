# Frontend Dockerfile - Multi-stage Build
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Bağımlılıkları kopyala ve yükle
COPY package*.json ./
# npm ci bazen lockfile versiyonu nedeniyle hata verebiliyor, npm install --production daha güvenli
RUN npm install --no-audit --no-fund

# Kaynak kodları kopyala
COPY . .

# Build argumentleri
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=${REACT_APP_API_URL}

# Low-RAM ve CI optimizasyonları
ENV GENERATE_SOURCEMAP=false
ENV CI=true
# RAM kullanımını agresif bir şekilde kısıtla (Oracle Free Tier için 512MB-1GB ideal)
ENV NODE_OPTIONS="--max-old-space-size=1024"
# Webpack/TSC'nin fazladan bellek harcamasını önlemek için
ENV DISABLE_ESLINT_PLUGIN=true

# Production build
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Nginx config kopyala
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Build çıktısını kopyala
COPY --from=builder /app/build /usr/share/nginx/html

# Port
EXPOSE 80

# Nginx'i başlat
CMD ["nginx", "-g", "daemon off;"]
