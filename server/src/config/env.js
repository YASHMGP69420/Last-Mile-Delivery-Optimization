const dotenv = require('dotenv');
const path = require('path');

// Determine env file based on NODE_ENV
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
// Load configuration with a clear fallback order
// 1️⃣ Try the .env that sits next to this config folder (../)
const siblingEnvPath = path.resolve(__dirname, `../${envFile}`);
if (require('fs').existsSync(siblingEnvPath)) {
  dotenv.config({ path: siblingEnvPath });
} else {
  // 2️⃣ If not found, fall back to the project‑root .env (../../)
  const rootEnvPath = path.resolve(__dirname, `../../${envFile}`);
  dotenv.config({ path: rootEnvPath });
}

const env = {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartroute',
  JWT_SECRET: process.env.JWT_SECRET || 'smartroute_super_secret_jwt_key_2026_bhubaneswar',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'smartroute_super_secret_refresh_key_2026_bhubaneswar',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  GEOAPIFY_SERVER_API_KEY: process.env.GEOAPIFY_SERVER_API_KEY || 'YOUR_GEOAPIFY_SERVER_KEY',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};

module.exports = env;
