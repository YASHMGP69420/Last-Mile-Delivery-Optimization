const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const nodeEnv = process.env.NODE_ENV || 'development';

// Only load local .env / .env.test files outside production so local files
// never silently mask missing or invalid production environment variables.
if (nodeEnv !== 'production') {
  const envFile = nodeEnv === 'test' ? '.env.test' : '.env';
  // 1. Try the .env that sits next to this config folder (../)
  const siblingEnvPath = path.resolve(__dirname, `../${envFile}`);
  if (fs.existsSync(siblingEnvPath)) {
    dotenv.config({ path: siblingEnvPath });
  } else {
    // 2. Fall back to the server root .env (../../)
    const rootEnvPath = path.resolve(__dirname, `../../${envFile}`);
    if (fs.existsSync(rootEnvPath)) {
      dotenv.config({ path: rootEnvPath });
    }
  }
}

const DISALLOWED_JWT_SECRETS = new Set([
  'smartroute_super_secret_jwt_key_2026_bhubaneswar',
  'smartroute_super_secret_refresh_key_2026_bhubaneswar',
  'test_jwt_secret_smartroute_bhubaneswar_2026',
  'test_jwt_refresh_secret_smartroute_bhubaneswar_2026',
  'your_secure_random_jwt_secret_minimum_32_chars_here',
  'your_secure_random_refresh_secret_minimum_32_chars_here',
  'ci_secret_random_key_string_32_characters_minimum',
  'ci_refresh_random_key_string_32_chars_min',
]);

const GEOAPIFY_PLACEHOLDER_KEYS = new Set([
  'YOUR_GEOAPIFY_SERVER_KEY',
  'mock-geoapify-key',
  'your_geoapify_api_key_here',
  'ci_placeholder_key',
]);

function parseTrustProxy(rawTrustProxy, targetNodeEnv = nodeEnv) {
  if (rawTrustProxy === undefined || rawTrustProxy === null || String(rawTrustProxy).trim() === '') {
    return targetNodeEnv === 'production' ? 1 : false;
  }

  if (typeof rawTrustProxy === 'boolean') {
    if (rawTrustProxy === false) {
      return false;
    }
    throw new Error(
      'Invalid TRUST_PROXY value "true": boolean true is disallowed to prevent permissive trust proxy errors; specify an integer hop count (e.g. "1") or "false".'
    );
  }

  if (typeof rawTrustProxy === 'number') {
    if (Number.isInteger(rawTrustProxy) && rawTrustProxy >= 0) {
      return rawTrustProxy === 0 ? false : rawTrustProxy;
    }
    throw new Error(
      `Invalid TRUST_PROXY value "${rawTrustProxy}": expected a non-negative integer hop count or "false".`
    );
  }

  const normalized = String(rawTrustProxy).trim().toLowerCase();
  if (normalized === 'false' || normalized === '0') {
    return false;
  }
  if (normalized === 'true') {
    throw new Error(
      'Invalid TRUST_PROXY value "true": boolean true is disallowed to prevent permissive trust proxy errors; specify an integer hop count (e.g. "1") or "false".'
    );
  }
  if (/^\d+$/.test(normalized)) {
    return parseInt(normalized, 10);
  }

  throw new Error(
    `Invalid TRUST_PROXY value "${rawTrustProxy}": expected a non-negative integer hop count or "false".`
  );
}

function isGeoapifyConfigured(apiKey) {
  if (typeof apiKey !== 'string') {
    return false;
  }
  const trimmed = apiKey.trim();
  return Boolean(trimmed) && !GEOAPIFY_PLACEHOLDER_KEYS.has(trimmed);
}

let parsedTrustProxy = false;
try {
  parsedTrustProxy = parseTrustProxy(process.env.TRUST_PROXY, nodeEnv);
} catch {
  // Defer failing fast to validateProductionEnv() so all invalid env vars can be reported together.
  parsedTrustProxy = nodeEnv === 'production' ? 1 : false;
}

const resolvedGeoapifyKey =
  (process.env.GEOAPIFY_SERVER_API_KEY || '').trim() ||
  (process.env.GEOAPIFY_API_KEY || '').trim() ||
  'YOUR_GEOAPIFY_SERVER_KEY';

const env = {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  NODE_ENV: nodeEnv,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartroute',
  JWT_SECRET: process.env.JWT_SECRET || 'smartroute_super_secret_jwt_key_2026_bhubaneswar',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'smartroute_super_secret_refresh_key_2026_bhubaneswar',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  GEOAPIFY_SERVER_API_KEY: resolvedGeoapifyKey,
  CLIENT_ORIGIN:
    process.env.CLIENT_ORIGIN !== undefined
      ? process.env.CLIENT_ORIGIN
      : nodeEnv === 'production'
        ? ''
        : 'http://localhost:5173',
  TRUST_PROXY: parsedTrustProxy,
  SERVE_CLIENT: process.env.SERVE_CLIENT === 'true',
  FORCE_HTTPS_CSP: process.env.FORCE_HTTPS_CSP === 'true',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '',
  SMTP_SERVICE: process.env.SMTP_SERVICE || '',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'SmartRoute Operations <no-reply@smartroute.local>',
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER || '',
  FAST2SMS_API_KEY: process.env.FAST2SMS_API_KEY || '',
  FAST2SMS_ROUTE: process.env.FAST2SMS_ROUTE || 'otp',
  SMS_WEBHOOK_URL: process.env.SMS_WEBHOOK_URL || '',
  SMS_WEBHOOK_SECRET: process.env.SMS_WEBHOOK_SECRET || '',
  OTP_TTL_MINUTES: parseInt(process.env.OTP_TTL_MINUTES, 10) || 10,
  OTP_MAX_ATTEMPTS: parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 5,
  OTP_RESEND_COOLDOWN_SECONDS:
    process.env.OTP_RESEND_COOLDOWN_SECONDS !== undefined
      ? parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 10)
      : 30,
};

function validateProductionEnv(targetEnv = env, rawEnv = process.env) {
  const effectiveNodeEnv = rawEnv?.NODE_ENV || targetEnv?.NODE_ENV || nodeEnv;
  if (effectiveNodeEnv !== 'production') {
    return { valid: true, errors: [] };
  }

  const errors = [];

  const rawMongoUri = typeof rawEnv?.MONGODB_URI === 'string' ? rawEnv.MONGODB_URI.trim() : '';
  if (!rawMongoUri) {
    errors.push('MONGODB_URI is required in production (missing or blank)');
  } else if (!/^mongodb(\+srv)?:\/\//i.test(rawMongoUri)) {
    errors.push('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  }

  const rawJwtSecret = typeof rawEnv?.JWT_SECRET === 'string' ? rawEnv.JWT_SECRET.trim() : '';
  if (!rawJwtSecret) {
    errors.push('JWT_SECRET is required in production');
  } else {
    if (rawJwtSecret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters in production');
    }
    if (DISALLOWED_JWT_SECRETS.has(rawJwtSecret)) {
      errors.push('JWT_SECRET must not match any committed dev, test, CI, or example default');
    }
  }

  const rawJwtRefreshSecret =
    typeof rawEnv?.JWT_REFRESH_SECRET === 'string' ? rawEnv.JWT_REFRESH_SECRET.trim() : '';
  if (!rawJwtRefreshSecret) {
    errors.push('JWT_REFRESH_SECRET is required in production');
  } else {
    if (rawJwtRefreshSecret.length < 32) {
      errors.push('JWT_REFRESH_SECRET must be at least 32 characters in production');
    }
    if (DISALLOWED_JWT_SECRETS.has(rawJwtRefreshSecret)) {
      errors.push('JWT_REFRESH_SECRET must not match any committed dev, test, CI, or example default');
    }
    if (rawJwtSecret && rawJwtRefreshSecret === rawJwtSecret) {
      errors.push('JWT_REFRESH_SECRET must differ from JWT_SECRET in production');
    }
  }

  const trustProxyRaw = rawEnv?.TRUST_PROXY !== undefined ? rawEnv.TRUST_PROXY : targetEnv?.TRUST_PROXY;
  try {
    parseTrustProxy(trustProxyRaw, 'production');
  } catch (err) {
    errors.push(err.message);
  }

  const isServeClient =
    rawEnv?.SERVE_CLIENT !== undefined
      ? String(rawEnv.SERVE_CLIENT).trim() === 'true'
      : Boolean(targetEnv?.SERVE_CLIENT);

  if (!isServeClient) {
    const origins = String(rawEnv?.CLIENT_ORIGIN || '')
      .split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter(Boolean);

    if (origins.length === 0) {
      errors.push(
        'CLIENT_ORIGIN must contain at least one valid origin in production when SERVE_CLIENT is not true'
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(`Production environment validation failed:\n- ${errors.join('\n- ')}`);
  }

  return { valid: true, errors: [] };
}

Object.defineProperties(env, {
  validateProductionEnv: { value: validateProductionEnv, enumerable: false },
  isGeoapifyConfigured: { value: isGeoapifyConfigured, enumerable: false },
  parseTrustProxy: { value: parseTrustProxy, enumerable: false },
  DISALLOWED_JWT_SECRETS: { value: DISALLOWED_JWT_SECRETS, enumerable: false },
  GEOAPIFY_PLACEHOLDER_KEYS: { value: GEOAPIFY_PLACEHOLDER_KEYS, enumerable: false },
});

module.exports = env;
