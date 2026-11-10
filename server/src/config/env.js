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
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'SmartRoute Operations <no-reply@smartroute.local>',
  SMS_WEBHOOK_URL: process.env.SMS_WEBHOOK_URL || '',
  OTP_TTL_MINUTES: parseInt(process.env.OTP_TTL_MINUTES, 10) || 10,
  OTP_MAX_ATTEMPTS: parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 5,
  OTP_DEV_PREVIEW:
    (process.env.NODE_ENV || 'development') !== 'production' &&
    process.env.OTP_DEV_PREVIEW !== 'false',
};

module.exports = env;
