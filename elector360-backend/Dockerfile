FROM node:18-slim

LABEL maintainer="Arcenis Munoz <arramumo@gmail.com>"
LABEL description="Elector360 Backend API con Puppeteer RPA"

# Puppeteer: usar Chromium del sistema, no el bundled
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

# Instalar Chromium y dependencias necesarias
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar package files primero (cache de layers Docker)
COPY package.json package-lock.json ./

# Instalar solo dependencias de produccion
RUN npm ci --omit=dev

# Copiar codigo fuente
COPY . .

# Crear directorios necesarios
RUN mkdir -p /app/uploads /app/screenshots

# Usuario no-root por seguridad
RUN groupadd -r elector360 && useradd -r -g elector360 -d /app -s /sbin/nologin elector360
RUN chown -R elector360:elector360 /app
USER elector360

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["node", "server.js"]
