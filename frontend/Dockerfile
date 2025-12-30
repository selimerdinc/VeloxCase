# Frontend Dockerfile - Multi-stage Build
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Bağımlılıkları kopyala ve yükle
COPY package*.json ./
RUN npm install

# Kaynak kodları kopyala
COPY . .

# Build argumentleri
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=${REACT_APP_API_URL}

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
