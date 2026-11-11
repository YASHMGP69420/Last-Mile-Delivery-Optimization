const request = require('supertest');
const axios = require('axios');
const app = require('../src/app');
const env = require('../src/config/env');
const {
  DEV_LOCALHOST_ORIGINS,
  normalizeOrigin,
  parseAllowedOrigins,
  isSameRequestHost,
  createCorsOptionsDelegate,
} = require('../src/config/cors');
const geoapifyService = require('../src/services/mapping/geoapify.service');
const { createTestUser } = require('./helpers/testUtils');

const VALID_PROD_RAW_ENV = {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb://mongo:27017/smartroute',
  JWT_SECRET: 'prod_jwt_secret_key_9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c',
  JWT_REFRESH_SECRET: 'prod_refresh_secret_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
  TRUST_PROXY: '1',
  SERVE_CLIENT: 'false',
  CLIENT_ORIGIN: 'https://app.example.com',
};

const DISALLOWED_DEFAULTS = [
  'smartroute_super_secret_jwt_key_2026_bhubaneswar',
  'smartroute_super_secret_refresh_key_2026_bhubaneswar',
  'test_jwt_secret_smartroute_bhubaneswar_2026',
  'test_jwt_refresh_secret_smartroute_bhubaneswar_2026',
  'your_secure_random_jwt_secret_minimum_32_chars_here',
  'your_secure_random_refresh_secret_minimum_32_chars_here',
  'ci_secret_random_key_string_32_characters_minimum',
  'ci_refresh_random_key_string_32_chars_min',
];

describe('Phase 11 Plan 01: Env Validation, Geoapify Unification, CORS, and DB Hardening', () => {
  describe('HARD-01: validateProductionEnv()', () => {
    test('rejects missing or invalid MONGODB_URI in production (never silently uses dev fallback)', () => {
      const { MONGODB_URI: _omitted, ...missingMongo } = VALID_PROD_RAW_ENV;
      expect(() => env.validateProductionEnv(env, missingMongo)).toThrow(/MONGODB_URI/i);
      expect(() =>
        env.validateProductionEnv(env, { ...VALID_PROD_RAW_ENV, MONGODB_URI: '   ' })
      ).toThrow(/MONGODB_URI/i);
      expect(() =>
        env.validateProductionEnv(env, { ...VALID_PROD_RAW_ENV, MONGODB_URI: 'http://localhost:27017/db' })
      ).toThrow(/MONGODB_URI/i);
    });

    test('rejects missing, short (<32 chars), identical, or committed default JWT secrets in production', () => {
      const { JWT_SECRET: _s, ...missingSecret } = VALID_PROD_RAW_ENV;
      expect(() => env.validateProductionEnv(env, missingSecret)).toThrow(/JWT_SECRET/i);

      const { JWT_REFRESH_SECRET: _r, ...missingRefresh } = VALID_PROD_RAW_ENV;
      expect(() => env.validateProductionEnv(env, missingRefresh)).toThrow(/JWT_REFRESH_SECRET/i);

      expect(() =>
        env.validateProductionEnv(env, { ...VALID_PROD_RAW_ENV, JWT_SECRET: 'too_short_secret' })
      ).toThrow(/JWT_SECRET.*32/i);

      expect(() =>
        env.validateProductionEnv(env, { ...VALID_PROD_RAW_ENV, JWT_REFRESH_SECRET: 'too_short_refresh' })
      ).toThrow(/JWT_REFRESH_SECRET.*32/i);

      expect(() =>
        env.validateProductionEnv(env, {
          ...VALID_PROD_RAW_ENV,
          JWT_REFRESH_SECRET: VALID_PROD_RAW_ENV.JWT_SECRET,
        })
      ).toThrow(/JWT_REFRESH_SECRET/i);

      for (const badSecret of DISALLOWED_DEFAULTS) {
        expect(() =>
          env.validateProductionEnv(env, { ...VALID_PROD_RAW_ENV, JWT_SECRET: badSecret })
        ).toThrow(/JWT_SECRET/i);
        expect(() =>
          env.validateProductionEnv(env, { ...VALID_PROD_RAW_ENV, JWT_REFRESH_SECRET: badSecret })
        ).toThrow(/JWT_REFRESH_SECRET/i);
      }
    });

    test('rejects TRUST_PROXY="true" or non-numeric strings in production', () => {
      expect(() =>
        env.validateProductionEnv(env, { ...VALID_PROD_RAW_ENV, TRUST_PROXY: 'true' })
      ).toThrow(/TRUST_PROXY/i);
      expect(() =>
        env.validateProductionEnv(env, { ...VALID_PROD_RAW_ENV, TRUST_PROXY: 'invalid_hop' })
      ).toThrow(/TRUST_PROXY/i);
    });

    test('rejects missing or empty CLIENT_ORIGIN in production when SERVE_CLIENT !== "true"', () => {
      const { CLIENT_ORIGIN: _o, ...noOrigin } = VALID_PROD_RAW_ENV;
      expect(() => env.validateProductionEnv(env, noOrigin)).toThrow(/CLIENT_ORIGIN/i);
      expect(() =>
        env.validateProductionEnv(env, { ...VALID_PROD_RAW_ENV, CLIENT_ORIGIN: ' , / ' })
      ).toThrow(/CLIENT_ORIGIN/i);
    });

    test('passes with valid Docker Compose mongodb://mongo:27017 URI and SERVE_CLIENT="true" without CLIENT_ORIGIN', () => {
      const { CLIENT_ORIGIN: _o, ...serveClientEnv } = VALID_PROD_RAW_ENV;
      expect(() =>
        env.validateProductionEnv(env, { ...serveClientEnv, SERVE_CLIENT: 'true' })
      ).not.toThrow();
    });

    test('passes with SERVE_CLIENT="false" and valid CLIENT_ORIGIN or mongodb+srv URI', () => {
      expect(() => env.validateProductionEnv(env, VALID_PROD_RAW_ENV)).not.toThrow();
      expect(() =>
        env.validateProductionEnv(env, {
          ...VALID_PROD_RAW_ENV,
          MONGODB_URI: 'mongodb+srv://cluster.example.mongodb.net/smartroute',
        })
      ).not.toThrow();
    });
  });

  describe('HARD-02: parseTrustProxy()', () => {
    test('returns 1 by default in production and false in development/test', () => {
      expect(env.parseTrustProxy(undefined, 'production')).toBe(1);
      expect(env.parseTrustProxy('', 'production')).toBe(1);
      expect(env.parseTrustProxy(undefined, 'development')).toBe(false);
      expect(env.parseTrustProxy(undefined, 'test')).toBe(false);
    });

    test('returns false for "false" or "0", and numeric integer for "1"/"2"', () => {
      expect(env.parseTrustProxy('false', 'production')).toBe(false);
      expect(env.parseTrustProxy('0', 'production')).toBe(false);
      expect(env.parseTrustProxy('1', 'development')).toBe(1);
      expect(env.parseTrustProxy('2', 'production')).toBe(2);
    });

    test('throws on "true", boolean true, or non-integer strings', () => {
      expect(() => env.parseTrustProxy('true', 'production')).toThrow(/TRUST_PROXY/i);
      expect(() => env.parseTrustProxy(true, 'production')).toThrow(/TRUST_PROXY/i);
      expect(() => env.parseTrustProxy('-1', 'production')).toThrow(/TRUST_PROXY/i);
      expect(() => env.parseTrustProxy('1.5', 'production')).toThrow(/TRUST_PROXY/i);
      expect(() => env.parseTrustProxy('loopback', 'production')).toThrow(/TRUST_PROXY/i);
    });
  });

  describe('HARD-01: Env loading & Geoapify key unification', () => {
    test('isGeoapifyConfigured() rejects empty and known placeholder keys', () => {
      expect(env.isGeoapifyConfigured('')).toBe(false);
      expect(env.isGeoapifyConfigured(null)).toBe(false);
      expect(env.isGeoapifyConfigured(undefined)).toBe(false);
      expect(env.isGeoapifyConfigured('YOUR_GEOAPIFY_SERVER_KEY')).toBe(false);
      expect(env.isGeoapifyConfigured('mock-geoapify-key')).toBe(false);
      expect(env.isGeoapifyConfigured('your_geoapify_api_key_here')).toBe(false);
      expect(env.isGeoapifyConfigured('ci_placeholder_key')).toBe(false);
      expect(env.isGeoapifyConfigured('geoapify_live_abc123456789')).toBe(true);
    });

    test('env.js falls back to GEOAPIFY_API_KEY and skips dotenv + localhost fallback in production', () => {
      const savedEnv = { ...process.env };
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.GEOAPIFY_SERVER_API_KEY;
        process.env.GEOAPIFY_API_KEY = 'legacy_geoapify_key_998877';
        delete process.env.CLIENT_ORIGIN;
        delete process.env.TRUST_PROXY;

        let isolatedEnv;
        jest.isolateModules(() => {
          isolatedEnv = require('../src/config/env');
        });

        expect(isolatedEnv.GEOAPIFY_SERVER_API_KEY).toBe('legacy_geoapify_key_998877');
        expect(isolatedEnv.CLIENT_ORIGIN).toBe('');
        expect(isolatedEnv.TRUST_PROXY).toBe(1);
        expect(isolatedEnv.SERVE_CLIENT).toBe(false);
        expect(isolatedEnv.FORCE_HTTPS_CSP).toBe(false);
      } finally {
        process.env = savedEnv;
      }
    });

    test('geoapify.service.js uses env.GEOAPIFY_SERVER_API_KEY and env.isGeoapifyConfigured()', async () => {
      const originalKey = env.GEOAPIFY_SERVER_API_KEY;
      const getSpy = jest.spyOn(axios, 'get').mockResolvedValue({
        data: {
          sources_to_targets: [[{ distance: 1200, time: 180 }]],
        },
      });

      try {
        // Placeholder key like ci_placeholder_key must NOT call axios
        env.GEOAPIFY_SERVER_API_KEY = 'ci_placeholder_key';
        const simResult = await geoapifyService.getDistanceMatrix(
          [{ lat: 20.2961, lng: 85.8245 }],
          [{ lat: 20.301, lng: 85.83 }]
        );
        expect(simResult.source).not.toBe('GEOAPIFY');
        expect(getSpy).not.toHaveBeenCalled();

        // Real unified key must call Geoapify API with apiKey
        env.GEOAPIFY_SERVER_API_KEY = 'real_geoapify_key_1234567890';
        const liveResult = await geoapifyService.getDistanceMatrix(
          [{ lat: 20.2961, lng: 85.8245 }],
          [{ lat: 20.301, lng: 85.83 }]
        );
        expect(liveResult.source).toBe('GEOAPIFY');
        expect(getSpy).toHaveBeenCalledTimes(1);
        expect(getSpy.mock.calls[0][0]).toContain('apiKey=real_geoapify_key_1234567890');

        // getRouteGeometry also respects isGeoapifyConfigured()
        getSpy.mockClear();
        env.GEOAPIFY_SERVER_API_KEY = 'your_geoapify_api_key_here';
        const simRoute = await geoapifyService.getRouteGeometry([
          { lat: 20.2961, lng: 85.8245 },
          { lat: 20.301, lng: 85.83 },
        ]);
        expect(simRoute.source).toBe('SIMULATED');
        expect(getSpy).not.toHaveBeenCalled();

        getSpy.mockResolvedValueOnce({
          data: {
            features: [{ geometry: { coordinates: [[85.8245, 20.2961], [85.83, 20.301]] } }],
          },
        });
        env.GEOAPIFY_SERVER_API_KEY = 'real_geoapify_key_1234567890';
        const liveRoute = await geoapifyService.getRouteGeometry([
          { lat: 20.2961, lng: 85.8245 },
          { lat: 20.301, lng: 85.83 },
        ]);
        expect(liveRoute.source).toBe('GEOAPIFY');
        expect(getSpy).toHaveBeenCalledTimes(1);
        expect(getSpy.mock.calls[0][0]).toContain('apiKey=real_geoapify_key_1234567890');
      } finally {
        env.GEOAPIFY_SERVER_API_KEY = originalKey;
        getSpy.mockRestore();
      }
    });

    test('adminController endpoints resolve Geoapify status from env.GEOAPIFY_SERVER_API_KEY and isGeoapifyConfigured()', async () => {
      const { token: adminToken } = await createTestUser('ADMIN');
      const originalKey = env.GEOAPIFY_SERVER_API_KEY;
      const originalLegacy = process.env.GEOAPIFY_API_KEY;

      try {
        // Set conflicting process.env.GEOAPIFY_API_KEY vs env.GEOAPIFY_SERVER_API_KEY to prove env.js is authoritative
        process.env.GEOAPIFY_API_KEY = 'mock-geoapify-key';
        env.GEOAPIFY_SERVER_API_KEY = 'live_geoapify_key_abcd1234';

        const overviewRes = await request(app)
          .get('/api/v1/admin/overview')
          .set('Authorization', `Bearer ${adminToken}`);
        expect(overviewRes.status).toBe(200);
        expect(overviewRes.body.data.systemHealth.geoapify.status).toBe('HEALTHY');

        const intRes = await request(app)
          .get('/api/v1/admin/integrations')
          .set('Authorization', `Bearer ${adminToken}`);
        expect(intRes.status).toBe(200);
        expect(intRes.body.data.integrations.geoapify.hasKey).toBe(true);
        expect(intRes.body.data.integrations.geoapify.keyMasked).toBe('live...1234');

        const testRes = await request(app)
          .post('/api/v1/admin/integrations/test')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ service: 'GEOAPIFY' });
        expect(testRes.status).toBe(200);
        expect(testRes.body.data.status).toBe('CONNECTED');

        // Placeholder key should report unconfigured / simulation
        env.GEOAPIFY_SERVER_API_KEY = 'YOUR_GEOAPIFY_SERVER_KEY';
        const unconfiguredInt = await request(app)
          .get('/api/v1/admin/integrations')
          .set('Authorization', `Bearer ${adminToken}`);
        expect(unconfiguredInt.status).toBe(200);
        expect(unconfiguredInt.body.data.integrations.geoapify.hasKey).toBe(false);
        expect(unconfiguredInt.body.data.integrations.geoapify.keyMasked).toBe('Not set');
      } finally {
        env.GEOAPIFY_SERVER_API_KEY = originalKey;
        if (originalLegacy === undefined) {
          delete process.env.GEOAPIFY_API_KEY;
        } else {
          process.env.GEOAPIFY_API_KEY = originalLegacy;
        }
      }
    });
  });

  describe('HARD-03: Shared multi-origin CORS parser & delegate', () => {
    const invokeDelegate = (delegate, headers) =>
      new Promise((resolve) => {
        delegate({ headers }, (err, options) => {
          resolve({ err, options });
        });
      });

    test('parseAllowedOrigins() trims, strips trailing slashes, deduplicates, and omits localhost in production', () => {
      const result = parseAllowedOrigins(
        'https://app.example.com/, https://admin.example.com/ , https://app.example.com',
        'production'
      );
      expect(result).toEqual(['https://app.example.com', 'https://admin.example.com']);
      for (const devOrigin of DEV_LOCALHOST_ORIGINS) {
        expect(result).not.toContain(devOrigin);
      }
      expect(normalizeOrigin('  https://app.example.com///  ')).toBe('https://app.example.com');
    });

    test('parseAllowedOrigins() appends dev localhost defaults when nodeEnv !== production', () => {
      const result = parseAllowedOrigins('https://custom.local:3000/', 'development');
      expect(result).toContain('https://custom.local:3000');
      for (const devOrigin of DEV_LOCALHOST_ORIGINS) {
        expect(result).toContain(devOrigin);
      }
    });

    test('createCorsOptionsDelegate() allows no-origin and configured origins, rejects localhost and unknown origins with 403 CORS_BLOCKED', async () => {
      const delegate = createCorsOptionsDelegate({
        allowedOrigins: ['https://app.example.com'],
        nodeEnv: 'production',
        serveClient: false,
      });

      const noOriginRes = await invokeDelegate(delegate, {});
      expect(noOriginRes.err).toBeNull();
      expect(noOriginRes.options.origin).toBe(true);
      expect(noOriginRes.options.credentials).toBe(true);

      const allowedRes = await invokeDelegate(delegate, { origin: 'https://app.example.com/' });
      expect(allowedRes.err).toBeNull();
      expect(allowedRes.options.origin).toBe(true);

      const localhostRes = await invokeDelegate(delegate, { origin: 'http://localhost:5173' });
      expect(localhostRes.err).toBeInstanceOf(Error);
      expect(localhostRes.err.statusCode).toBe(403);
      expect(localhostRes.err.code).toBe('CORS_BLOCKED');

      const evilRes = await invokeDelegate(delegate, { origin: 'https://evil.example.com' });
      expect(evilRes.err).toBeInstanceOf(Error);
      expect(evilRes.err.statusCode).toBe(403);
      expect(evilRes.err.code).toBe('CORS_BLOCKED');
    });

    test('createCorsOptionsDelegate() allows same-host requests when serveClient=true and blocks mismatched hosts', async () => {
      const delegate = createCorsOptionsDelegate({
        allowedOrigins: [],
        nodeEnv: 'production',
        serveClient: true,
      });

      expect(
        isSameRequestHost('https://render-app.onrender.com', {
          headers: { host: 'render-app.onrender.com' },
        })
      ).toBe(true);

      const sameHostRes = await invokeDelegate(delegate, {
        origin: 'https://render-app.onrender.com',
        host: 'render-app.onrender.com',
      });
      expect(sameHostRes.err).toBeNull();
      expect(sameHostRes.options.origin).toBe(true);

      const forwardedHostRes = await invokeDelegate(delegate, {
        origin: 'https://render-app.onrender.com',
        host: '127.0.0.1:5000',
        'x-forwarded-host': 'render-app.onrender.com, proxy.internal',
      });
      expect(forwardedHostRes.err).toBeNull();
      expect(forwardedHostRes.options.origin).toBe(true);

      const evilRes = await invokeDelegate(delegate, {
        origin: 'https://evil.example.com',
        host: 'render-app.onrender.com',
      });
      expect(evilRes.err).toBeInstanceOf(Error);
      expect(evilRes.err.statusCode).toBe(403);
      expect(evilRes.err.code).toBe('CORS_BLOCKED');
    });
  });
});
