# SmartRoute – Environment Configuration Reference

This document provides descriptions for all environment variables supported across the SmartRoute application.

---

## 1. Backend Server Environment Variables

| Variable Name | Required | Default / Example | Purpose & Notes |
|---|---|---|---|
| `PORT` | Yes | `5004` | Port on which the Express.js HTTP and WebSocket server listens. |
| `NODE_ENV` | Yes | `development` | Set to `production` in live deployments to disable debug logs and enable optimization. |
| `MONGODB_URI` | Yes | `mongodb://127.0.0.1:27017/smartroute` | Connection string for MongoDB database. Supports replica sets and Atlas URIs. |
| `JWT_SECRET` | Yes | `<random-32-chars>` | Secret key used to sign and verify HMAC-SHA256 access tokens. |
| `JWT_REFRESH_SECRET` | Yes | `<random-32-chars>` | Secret key used to sign refresh tokens. |
| `JWT_EXPIRES_IN` | No | `15m` | Lifetime of short-lived access tokens. |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Lifetime of long-lived refresh tokens. |
| `CLIENT_ORIGIN` | Yes | `http://localhost:5174` | Allowed origin for Cross-Origin Resource Sharing (CORS). |
| `MAP_PROVIDER` | No | `geoapify` | Primary distance matrix provider (`geoapify` or fallback `simulated`). |
| `GEOAPIFY_API_KEY` | No | `<api-key>` | Server-side Geoapify API key for routing matrix calculations. |

---

## 2. Frontend Client Environment Variables

All frontend variables must be prefixed with `VITE_` to be bundled by Vite:

| Variable Name | Required | Default / Example | Purpose & Notes |
|---|---|---|---|
| `VITE_API_URL` | Yes | `http://localhost:5004/api/v1` | Base REST API URL used by Axios client. |
| `VITE_MAP_PROVIDER` | No | `geoapify` | Client-side map provider setting. |
| `VITE_GEOAPIFY_TILE_API_KEY` | No | `<tile-key>` | Client-side API key for Geoapify raster/vector map tiles. |
