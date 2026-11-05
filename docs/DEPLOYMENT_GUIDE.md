# SmartRoute – Production Deployment Guide

This guide details instructions for deploying SmartRoute to production cloud infrastructure.

---

## 1. Production Architecture Overview

In production, SmartRoute is deployed as:
1. **Frontend Static Bundle**: Pre-compiled React SPA assets served through a CDN or reverse proxy (Nginx / CloudFront).
2. **Backend API Service**: Node.js Express process clustered or managed by PM2/Docker container.
3. **Database Cluster**: Managed MongoDB Atlas Replica Set (M10 or higher).

---

## 2. Step 1: Database Setup (MongoDB Atlas)

1. Create a MongoDB Atlas Project & Cluster (AWS `ap-south-1` Mumbai recommended for Indian latency).
2. Configure Database Users: Create a dedicated application user with read/write access to the `smartroute` database.
3. Configure Network Access: Whitelist the static IP addresses of your backend servers or configure VPC Peering.
4. Obtain the connection string:
   ```text
   mongodb+srv://smartroute_user:<PASSWORD>@cluster0.mongodb.net/smartroute?retryWrites=true&w=majority
   ```

---

## 3. Step 2: Backend API Deployment

### Docker Deployment
Create a `Dockerfile` in `server/`:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5004
CMD ["node", "src/index.js"]
```

Build and run:
```bash
docker build -t smartroute-api:latest ./server
docker run -d -p 5004:5004 --env-file server/.env.production smartroute-api:latest
```

### Environment Configuration:
* `NODE_ENV=production`
* `PORT=5004`
* `MONGODB_URI=<your-atlas-uri>`
* `JWT_SECRET=<secure-random-32-chars>`
* `CLIENT_ORIGIN=https://smartroute.yourdomain.com`

---

## 4. Step 3: Frontend Deployment

### Build Command
Compile the optimized production bundle:
```bash
npm --prefix client run build
```
Output directory: `client/dist`

### Serving via Nginx
```nginx
server {
    listen 80;
    server_name smartroute.yourdomain.com;

    root /var/www/smartroute/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:5004/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 5. Health Checks & Verification

After deployment, verify system status:
* Liveness: `GET https://api.yourdomain.com/api/v1/health` $\to$ `200 OK`
* Readiness: `GET https://api.yourdomain.com/api/v1/health/ready` $\to$ `200 OK` (`database: CONNECTED`)
