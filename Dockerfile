FROM node:18-slim

RUN apt-get update && apt-get install -y \
    default-jdk \
    python3 \
    python3-pip \
    nginx \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

RUN mkdir -p /var/www/html/games && \
    echo 'server { listen 80; root /var/www/html; location /games/ { add_header Access-Control-Allow-Origin *; } }' > /etc/nginx/sites-available/default && \
    nginx

COPY . .

EXPOSE 3000 80

CMD service nginx start && ["node", "server.js"]
