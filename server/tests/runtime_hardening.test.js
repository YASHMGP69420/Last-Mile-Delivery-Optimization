const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');
const request = require('supertest');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');

const app = require('../src/app');
const { createCorsOptionsDelegate, parseAllowedOrigins } = require('../src/config/cors');
const { socketAuthMiddleware } = require('../src/middleware/socketAuth');
const { ROLES } = require('../src/config/constants');
const { createTestUser } = require('./helpers/testUtils');

describe('Phase 11 Plan 03: Server & Client Runtime Hardening Integration Suite', () => {
  describe('HARD-01: Production boot fail-fast process validation', () => {
    const serverDir = path.resolve(__dirname, '..');

    test('spawning node src/index.js in production without MONGODB_URI/JWT_SECRET exits with code 1', () => {
      const childEnv = { ...process.env, NODE_ENV: 'production' };
      delete childEnv.MONGODB_URI;
      delete childEnv.JWT_SECRET;
      delete childEnv.JWT_REFRESH_SECRET;
      delete childEnv.CLIENT_ORIGIN;

      const result = spawnSync(process.execPath, ['src/index.js'], {
        cwd: serverDir,
        env: childEnv,
        encoding: 'utf8',
        timeout: 10000,
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/Fatal production configuration error/i);
      expect(result.stderr).toMatch(/MONGODB_URI/i);
      expect(result.stderr).toMatch(/JWT_SECRET/i);
    });

    test('spawning node src/index.js in production with weak JWT_SECRET exits with code 1', () => {
      const childEnv = {
        ...process.env,
        NODE_ENV: 'production',
        MONGODB_URI: 'mongodb://mongo:27017/smartroute',
        JWT_SECRET: 'too_short',
        JWT_REFRESH_SECRET: 'prod_refresh_secret_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
        CLIENT_ORIGIN: 'https://app.example.com',
      };

      const result = spawnSync(process.execPath, ['src/index.js'], {
        cwd: serverDir,
        env: childEnv,
        encoding: 'utf8',
        timeout: 10000,
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/JWT_SECRET/i);
    });
  });

  describe('HARD-02: Numeric trust proxy & single authRateLimiter IP isolation', () => {
    test('sets trust proxy to 1 in production and false in test/development (never boolean true)', () => {
      const prodApp = app.createApp({
        nodeEnv: 'production',
        clientOrigin: 'https://app.example.com',
      });
      const testApp = app.createApp({ nodeEnv: 'test' });
      const devApp = app.createApp({ nodeEnv: 'development' });

      expect(prodApp.get('trust proxy')).toBe(1);
      expect(testApp.get('trust proxy')).toBe(false);
      expect(devApp.get('trust proxy')).toBe(false);
    });

    test('buckets proxied X-Forwarded-For requests per true client IP with zero ERR_ERL_* warnings', async () => {
      const prodApp = app.createApp({
        nodeEnv: 'production',
        clientOrigin: 'https://app.example.com',
      });

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      try {
        for (let i = 0; i < 30; i += 1) {
          const res = await request(prodApp)
            .post('/api/v1/auth/login')
            .set('X-Forwarded-For', '203.0.113.10')
            .send({ email: 'missing@smartroute.test', password: 'WrongPassword123!' });
          expect(res.status).toBe(401);
        }

        const rateLimitedRes = await request(prodApp)
          .post('/api/v1/auth/login')
          .set('X-Forwarded-For', '203.0.113.10')
          .send({ email: 'missing@smartroute.test', password: 'WrongPassword123!' });

        expect(rateLimitedRes.status).toBe(429);
        expect(rateLimitedRes.body.success).toBe(false);
        expect(rateLimitedRes.body.error.code).toBe('RATE_LIMIT_EXCEEDED');

        // Different X-Forwarded-For client IP must remain unaffected
        const separateIpRes = await request(prodApp)
          .post('/api/v1/auth/login')
          .set('X-Forwarded-For', '203.0.113.11')
          .send({ email: 'missing@smartroute.test', password: 'WrongPassword123!' });

        expect(separateIpRes.status).toBe(401);

        const allLogs = [
          ...warnSpy.mock.calls.flat().map(String),
          ...errorSpy.mock.calls.flat().map(String),
        ].join('\n');
        expect(allLogs).not.toMatch(/ERR_ERL_/);
      } finally {
        warnSpy.mockRestore();
        errorSpy.mockRestore();
      }
    });
  });

  describe('HARD-03: Shared Express & Socket.IO multi-origin and SERVE_CLIENT same-host CORS', () => {
    const startEphemeralSocketServer = async ({ nodeEnv, clientOrigin, serveClient }) => {
      const allowedOrigins = parseAllowedOrigins(clientOrigin, nodeEnv);
      const expressApp = app.createApp({
        nodeEnv,
        clientOrigin,
        serveClient,
        allowedOrigins,
      });
      const httpServer = http.createServer(expressApp);
      const ioServer = new Server(httpServer, {
        cors: createCorsOptionsDelegate({
          allowedOrigins,
          nodeEnv,
          serveClient,
          methods: ['GET', 'POST'],
        }),
        path: '/socket.io',
      });
      ioServer.use(socketAuthMiddleware);

      await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
      const { port } = httpServer.address();
      const url = `http://127.0.0.1:${port}`;

      const close = async () => {
        await new Promise((resolve) => ioServer.close(() => resolve()));
        if (httpServer.listening) {
          await new Promise((resolve) => httpServer.close(() => resolve()));
        }
      };

      return { expressApp, url, close };
    };

    test('enforces multi-origin allowlist on Express and Socket.IO in production', async () => {
      const { token } = await createTestUser(ROLES.DRIVER);
      const srv = await startEphemeralSocketServer({
        nodeEnv: 'production',
        clientOrigin: 'https://app.example.com/, https://ops.example.com',
        serveClient: false,
      });

      try {
        // Express allows configured origin
        const allowedRes = await request(srv.expressApp)
          .get('/api/v1/health')
          .set('Origin', 'https://ops.example.com');
        expect(allowedRes.status).toBe(200);
        expect(allowedRes.headers['access-control-allow-origin']).toBe('https://ops.example.com');

        // Express blocks localhost and unknown origin in production
        const localhostRes = await request(srv.expressApp)
          .get('/api/v1/health')
          .set('Origin', 'http://localhost:5173');
        expect(localhostRes.status).toBe(403);
        expect(localhostRes.body.error.code).toBe('CORS_BLOCKED');

        const evilRes = await request(srv.expressApp)
          .get('/api/v1/health')
          .set('Origin', 'https://evil.example.com');
        expect(evilRes.status).toBe(403);
        expect(evilRes.body.error.code).toBe('CORS_BLOCKED');

        // Socket.IO allows https://ops.example.com
        await new Promise((resolve, reject) => {
          const client = ioClient(srv.url, {
            path: '/socket.io',
            transports: ['websocket'],
            forceNew: true,
            reconnection: false,
            auth: { token },
            extraHeaders: { Origin: 'https://ops.example.com' },
          });
          client.on('connect', () => {
            client.disconnect();
            resolve();
          });
          client.on('connect_error', (err) => {
            client.disconnect();
            reject(err);
          });
        });

        // Socket.IO rejects localhost and evil origins
        for (const blockedOrigin of ['http://localhost:5173', 'https://evil.example.com']) {
          await new Promise((resolve, reject) => {
            const client = ioClient(srv.url, {
              path: '/socket.io',
              transports: ['polling'],
              forceNew: true,
              reconnection: false,
              auth: { token },
              extraHeaders: { Origin: blockedOrigin },
            });
            client.on('connect', () => {
              client.disconnect();
              reject(new Error(`Expected Socket.IO to block origin ${blockedOrigin}`));
            });
            client.on('connect_error', (err) => {
              expect(err).toBeDefined();
              client.disconnect();
              resolve();
            });
          });
        }
      } finally {
        await srv.close();
      }
    });

    test('allows same-host Express POST and Socket.IO handshake when SERVE_CLIENT=true and CLIENT_ORIGIN is empty', async () => {
      const { token } = await createTestUser(ROLES.DRIVER);
      const srv = await startEphemeralSocketServer({
        nodeEnv: 'production',
        clientOrigin: '',
        serveClient: true,
      });

      try {
        // Same-host POST succeeds past CORS (returns 401 from auth controller, not 403 CORS_BLOCKED)
        const sameHostPost = await request(srv.expressApp)
          .post('/api/v1/auth/login')
          .set('Host', 'same.example.com')
          .set('Origin', 'https://same.example.com')
          .send({ email: 'nobody@smartroute.test', password: 'WrongPassword123!' });
        expect(sameHostPost.status).toBe(401);
        expect(sameHostPost.headers['access-control-allow-origin']).toBe('https://same.example.com');

        // Mismatched origin is blocked with 403 CORS_BLOCKED
        const mismatchPost = await request(srv.expressApp)
          .post('/api/v1/auth/login')
          .set('Host', 'same.example.com')
          .set('Origin', 'https://evil.example.com')
          .send({ email: 'nobody@smartroute.test', password: 'WrongPassword123!' });
        expect(mismatchPost.status).toBe(403);
        expect(mismatchPost.body.error.code).toBe('CORS_BLOCKED');

        // Socket.IO same-host handshake succeeds (both X-Forwarded-Host polling and Host websocket)
        await new Promise((resolve, reject) => {
          const client = ioClient(srv.url, {
            path: '/socket.io',
            transports: ['polling'],
            forceNew: true,
            reconnection: false,
            auth: { token },
            extraHeaders: {
              'X-Forwarded-Host': 'same.example.com',
              Origin: 'https://same.example.com',
            },
          });
          client.on('connect', () => {
            client.disconnect();
            resolve();
          });
          client.on('connect_error', (err) => {
            client.disconnect();
            reject(err);
          });
        });

        await new Promise((resolve, reject) => {
          const client = ioClient(srv.url, {
            path: '/socket.io',
            transports: ['websocket'],
            forceNew: true,
            reconnection: false,
            auth: { token },
            extraHeaders: {
              Host: 'same.example.com',
              Origin: 'https://same.example.com',
            },
          });
          client.on('connect', () => {
            client.disconnect();
            resolve();
          });
          client.on('connect_error', (err) => {
            client.disconnect();
            reject(err);
          });
        });

        // Socket.IO mismatched-host handshake is rejected
        await new Promise((resolve, reject) => {
          const client = ioClient(srv.url, {
            path: '/socket.io',
            transports: ['polling'],
            forceNew: true,
            reconnection: false,
            auth: { token },
            extraHeaders: {
              'X-Forwarded-Host': 'same.example.com',
              Origin: 'https://evil.example.com',
            },
          });
          client.on('connect', () => {
            client.disconnect();
            reject(new Error('Expected Socket.IO to block mismatched origin'));
          });
          client.on('connect_error', (err) => {
            expect(err).toBeDefined();
            client.disconnect();
            resolve();
          });
        });
      } finally {
        await srv.close();
      }
    });
  });

  describe('HARD-04: Helmet CSP & COOP headers', () => {
    test('emits strict CSP and COOP same-origin-allow-popups, toggling upgrade-insecure-requests via forceHttpsCsp', async () => {
      const defaultApp = app.createApp({ nodeEnv: 'production', clientOrigin: 'https://app.example.com' });
      const res = await request(defaultApp).get('/healthz');

      expect(res.status).toBe(200);
      expect(res.headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups');

      const csp = res.headers['content-security-policy'];
      expect(csp).toBeDefined();
      expect(csp).toContain("script-src 'self' https://accounts.google.com");
      expect(csp).toContain("script-src-attr 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain('https://maps.geoapify.com');
      expect(csp).toContain('https://api.geoapify.com');
      expect(csp).toContain('https://*.tile.openstreetmap.org');
      expect(csp).toContain('https://*.basemaps.cartocdn.com');
      expect(csp).toContain('https://fonts.googleapis.com');
      expect(csp).toContain('https://fonts.gstatic.com');
      expect(csp).toContain('https://lh3.googleusercontent.com');
      expect(csp).toContain('ws:');
      expect(csp).toContain('wss:');
      expect(csp).not.toContain('upgrade-insecure-requests');

      const httpsApp = app.createApp({
        nodeEnv: 'production',
        clientOrigin: 'https://app.example.com',
        forceHttpsCsp: true,
      });
      const httpsRes = await request(httpsApp).get('/healthz');
      expect(httpsRes.headers['content-security-policy']).toContain('upgrade-insecure-requests');
    });
  });

  describe('HARD-05: Probes (/healthz, /readyz, /api/v1/health*) & gracefulShutdown()', () => {
    test('/healthz, /readyz, and /api/v1/health/ready respond to draining and DB readiness', async () => {
      const probeApp = app.createApp({ nodeEnv: 'test' });

      const hOk = await request(probeApp).get('/healthz');
      expect(hOk.status).toBe(200);
      expect(hOk.body.status).toBe('OK');

      const rOk = await request(probeApp).get('/readyz');
      expect(rOk.status).toBe(200);
      expect(rOk.body.status).toBe('READY');
      expect(rOk.body.database).toBe('CONNECTED');

      const apiHealth = await request(probeApp).get('/api/v1/health');
      expect(apiHealth.status).toBe(200);
      expect(apiHealth.body.success).toBe(true);

      const apiReadyOk = await request(probeApp).get('/api/v1/health/ready');
      expect(apiReadyOk.status).toBe(200);
      expect(apiReadyOk.body.status).toBe('READY');

      // Draining state returns 503 across probes
      probeApp.set('isDraining', true);
      const hDrain = await request(probeApp).get('/healthz');
      expect(hDrain.status).toBe(503);
      expect(hDrain.body.status).toBe('DRAINING');

      const rDrain = await request(probeApp).get('/readyz');
      expect(rDrain.status).toBe(503);
      expect(rDrain.body.status).toBe('DRAINING');

      const apiReadyDrain = await request(probeApp).get('/api/v1/health/ready');
      expect(apiReadyDrain.status).toBe(503);
      expect(apiReadyDrain.body.status).toBe('DRAINING');

      // Non-draining disconnected DB returns 503 DEGRADED
      let isolatedDisconnectedApp;
      jest.isolateModules(() => {
        jest.doMock('mongoose', () => {
          const actualMongoose = jest.requireActual('mongoose');
          return {
            ...actualMongoose,
            Schema: actualMongoose.Schema,
            model: actualMongoose.model.bind(actualMongoose),
            connection: { readyState: 0 },
          };
        });
        isolatedDisconnectedApp = require('../src/app').createApp({ nodeEnv: 'test' });
      });

      const rDbDown = await request(isolatedDisconnectedApp).get('/readyz');
      expect(rDbDown.status).toBe(503);
      expect(rDbDown.body.status).toBe('DEGRADED');
      expect(rDbDown.body.database).toBe('DISCONNECTED');

      const apiReadyDown = await request(isolatedDisconnectedApp).get('/api/v1/health/ready');
      expect(apiReadyDown.status).toBe(503);
      expect(apiReadyDown.body.status).toBe('DEGRADED');
      expect(apiReadyDown.body.services.database).toBe('DISCONNECTED');
    });

    test('gracefulShutdown() is idempotent and drains isDraining -> io.close -> closeIdleConnections -> server.close -> disconnectDB -> exitFn(0)', async () => {
      const callOrder = [];
      let isolatedIndex;
      const disconnectMock = jest.fn(async () => {
        callOrder.push('disconnectDB');
      });

      jest.isolateModules(() => {
        jest.doMock('../src/config/db', () => ({
          connectDB: jest.fn(),
          disconnectDB: disconnectMock,
        }));
        isolatedIndex = require('../src/index');
      });

      // Listen on an ephemeral port so server.listening is true during drain
      await new Promise((resolve) => isolatedIndex.server.listen(0, '127.0.0.1', resolve));

      const originalIoClose = isolatedIndex.io.close.bind(isolatedIndex.io);
      jest.spyOn(isolatedIndex.io, 'close').mockImplementation((cb) => {
        callOrder.push('io.close');
        return originalIoClose(cb);
      });

      if (typeof isolatedIndex.server.closeIdleConnections === 'function') {
        const originalCloseIdle = isolatedIndex.server.closeIdleConnections.bind(isolatedIndex.server);
        jest.spyOn(isolatedIndex.server, 'closeIdleConnections').mockImplementation(() => {
          callOrder.push('closeIdleConnections');
          return originalCloseIdle();
        });
      }

      const exitFn = jest.fn((code) => {
        callOrder.push(`exit(${code})`);
      });

      await isolatedIndex.gracefulShutdown('SIGTERM', { exitFn, timeoutMs: 5000 });
      // Second call must be a no-op (idempotent)
      await isolatedIndex.gracefulShutdown('SIGINT', { exitFn, timeoutMs: 5000 });

      expect(isolatedIndex.app.get('isDraining')).toBe(true);
      expect(disconnectMock).toHaveBeenCalledTimes(1);
      expect(exitFn).toHaveBeenCalledTimes(1);
      expect(exitFn).toHaveBeenCalledWith(0);
      expect(callOrder[0]).toBe('io.close');
      if (typeof isolatedIndex.server.closeIdleConnections === 'function') {
        expect(callOrder).toContain('closeIdleConnections');
        expect(callOrder.indexOf('closeIdleConnections')).toBeLessThan(
          callOrder.indexOf('disconnectDB')
        );
      }
      expect(callOrder).toContain('disconnectDB');
      expect(callOrder[callOrder.length - 1]).toBe('exit(0)');
      expect(callOrder.indexOf('io.close')).toBeLessThan(callOrder.indexOf('disconnectDB'));
      expect(callOrder.indexOf('disconnectDB')).toBeLessThan(callOrder.indexOf('exit(0)'));
    });
  });

  describe('ORIG-01: SERVE_CLIENT=true static assets, caching, and SPA fallback isolation', () => {
    const clientDistDir = path.resolve(__dirname, '../../client/dist');

    test('throws a descriptive error when SERVE_CLIENT=true and client/dist/index.html is missing', () => {
      const missingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartroute-missing-dist-'));
      try {
        expect(() =>
          app.createApp({
            nodeEnv: 'production',
            serveClient: true,
            clientDistDir: missingDir,
          })
        ).toThrow(/npm --prefix client run build/i);
      } finally {
        fs.rmSync(missingDir, { recursive: true, force: true });
      }
    });

    test('serves immutable /assets/*, /theme-init.js, no-cache SPA routes, 404 missing dotted assets, and JSON 404 for unknown /api/*', async () => {
      const spaApp = app.createApp({
        nodeEnv: 'production',
        serveClient: true,
        clientDistDir,
      });

      const assetsDir = path.join(clientDistDir, 'assets');
      const assetFiles = fs.readdirSync(assetsDir);
      const jsAsset = assetFiles.find((file) => file.endsWith('.js'));
      expect(jsAsset).toBeDefined();

      const assetRes = await request(spaApp).get(`/assets/${jsAsset}`);
      expect(assetRes.status).toBe(200);
      expect(assetRes.headers['cache-control']).toBe('public, max-age=31536000, immutable');

      const themeInitRes = await request(spaApp).get('/theme-init.js');
      expect(themeInitRes.status).toBe(200);

      const spaRes = await request(spaApp).get('/admin/control-center');
      expect(spaRes.status).toBe(200);
      expect(spaRes.headers['content-type']).toMatch(/text\/html/);
      expect(spaRes.headers['cache-control']).toBe('no-cache');
      expect(spaRes.text).toContain('/theme-init.js');

      const missingAssetRes = await request(spaApp).get('/assets/nonexistent.js');
      expect(missingAssetRes.status).toBe(404);
      expect(missingAssetRes.headers['content-type']).not.toMatch(/text\/html/);

      const unknownApiV1Res = await request(spaApp).get('/api/v1/does-not-exist');
      expect(unknownApiV1Res.status).toBe(404);
      expect(unknownApiV1Res.body.success).toBe(false);
      expect(unknownApiV1Res.body.error.code).toBe('ENDPOINT_NOT_FOUND');

      const unknownApiRootRes = await request(spaApp).get('/api/does-not-exist');
      expect(unknownApiRootRes.status).toBe(404);
      expect(unknownApiRootRes.body.success).toBe(false);
      expect(unknownApiRootRes.body.error.code).toBe('ENDPOINT_NOT_FOUND');
    });
  });
});
