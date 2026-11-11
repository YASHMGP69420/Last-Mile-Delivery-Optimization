const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const yaml = require('js-yaml');

const app = require('../src/app');
const env = require('../src/config/env');
const User = require('../src/models/User');
const { ROLES } = require('../src/config/constants');
const {
  validateBootstrapConfig,
  bootstrapAdmin,
} = require('../src/scripts/bootstrapAdmin');
const {
  normalizeBaseUrl,
  parseSmokeArgs,
  runSmokeChecks,
} = require('../../scripts/smoke-test');

const REPO_ROOT = path.resolve(__dirname, '../..');

describe('Phase 13: PaaS Manifests, Admin Bootstrap & CI/Smoke Verification (OPS-01, OPS-02, OPS-03)', () => {
  describe('OPS-01: bootstrapAdmin credential validation, hashing, and idempotency', () => {
    test('validateBootstrapConfig rejects missing/invalid ADMIN_EMAIL and weak/short/placeholder ADMIN_PASSWORD', () => {
      expect(() =>
        validateBootstrapConfig({
          ADMIN_EMAIL: '',
          ADMIN_PASSWORD: 'StrongAdminPassword!2026',
        })
      ).toThrow(/ADMIN_EMAIL/i);

      expect(() =>
        validateBootstrapConfig({
          ADMIN_EMAIL: 'not-an-email',
          ADMIN_PASSWORD: 'StrongAdminPassword!2026',
        })
      ).toThrow(/ADMIN_EMAIL/i);

      expect(() =>
        validateBootstrapConfig({
          ADMIN_EMAIL: 'admin@smartroute.test',
        })
      ).toThrow(/ADMIN_PASSWORD/i);

      for (const badPassword of [
        'short123',
        '          ',
        'admin123',
        'password123',
        'changeme',
        'your_admin_password_here',
        'My_Changeme_Password_2026',
      ]) {
        expect(() =>
          validateBootstrapConfig({
            ADMIN_EMAIL: 'admin@smartroute.test',
            ADMIN_PASSWORD: badPassword,
          })
        ).toThrow(/ADMIN_PASSWORD/i);
      }
    });

    test('bootstrapAdmin creates a non-demo ADMIN with bcrypt password hash and defaults name to SmartRoute Admin', async () => {
      const password = 'StrongBootstrapPassword!2026';
      const result = await bootstrapAdmin({
        ADMIN_EMAIL: 'OPS-Admin@SmartRoute.Test ',
        ADMIN_PASSWORD: password,
      });

      expect(result.created).toBe(true);
      expect(result.skipped).toBe(false);
      expect(result.reason).toBe('created');

      const stored = await User.findById(result.user._id).select('+passwordHash');
      expect(stored).not.toBeNull();
      expect(stored.email).toBe('ops-admin@smartroute.test');
      expect(stored.name).toBe('SmartRoute Admin');
      expect(stored.role).toBe(ROLES.ADMIN);
      expect(stored.isDemoData).toBe(false);
      expect(stored.emailVerified).toBe(true);
      expect(stored.active).toBe(true);
      expect(stored.accountStatus).toBe('ACTIVE');
      expect(stored.passwordHash).not.toBe(password);
      expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(await stored.comparePassword(password)).toBe(true);

      const demoCount = await User.countDocuments({ isDemoData: true });
      expect(demoCount).toBe(0);
    });

    test('bootstrapAdmin is idempotent for same email or second email when active non-demo ADMIN exists and preserves password hash', async () => {
      const initialPassword = 'InitialStrongPassword!2026';
      const firstRun = await bootstrapAdmin({
        ADMIN_EMAIL: 'primary-admin@smartroute.test',
        ADMIN_PASSWORD: initialPassword,
        ADMIN_NAME: 'Primary Operator',
      });
      expect(firstRun.created).toBe(true);

      const beforeSecondRun = await User.findById(firstRun.user._id).select('+passwordHash');
      const originalHash = beforeSecondRun.passwordHash;

      const sameEmailRun = await bootstrapAdmin({
        ADMIN_EMAIL: 'primary-admin@smartroute.test',
        ADMIN_PASSWORD: 'DifferentOverwriteAttempt!2026',
        ADMIN_NAME: 'Should Not Overwrite',
      });
      expect(sameEmailRun.created).toBe(false);
      expect(sameEmailRun.skipped).toBe(true);
      expect(sameEmailRun.reason).toBe('matching_email');

      const secondEmailRun = await bootstrapAdmin({
        ADMIN_EMAIL: 'secondary-admin@smartroute.test',
        ADMIN_PASSWORD: 'AnotherStrongPassword!2026',
      });
      expect(secondEmailRun.created).toBe(false);
      expect(secondEmailRun.skipped).toBe(true);
      expect(secondEmailRun.reason).toBe('existing_non_demo_admin');

      const admins = await User.find({ role: ROLES.ADMIN }).select('+passwordHash');
      expect(admins).toHaveLength(1);
      expect(admins[0].email).toBe('primary-admin@smartroute.test');
      expect(admins[0].passwordHash).toBe(originalHash);
      expect(await admins[0].comparePassword(initialPassword)).toBe(true);
      expect(await User.countDocuments({ isDemoData: true })).toBe(0);
    });
  });

  describe('OPS-03: scripts/smoke-test.js in-process hardened server verification', () => {
    test('normalizeBaseUrl and parseSmokeArgs handle root, /api/v1, CLI flags, and env fallbacks', () => {
      expect(normalizeBaseUrl('https://api.example.com/api/v1/')).toBe('https://api.example.com');
      expect(normalizeBaseUrl('https://api.example.com///')).toBe('https://api.example.com');

      const parsed = parseSmokeArgs(
        [
          '--api-url=http://127.0.0.1:5004/api/v1/',
          '--origin',
          'https://app.smartroute.test/',
          '--expect-spa',
          '--retries',
          '4',
          '--delay-ms=100',
        ],
        {}
      );

      expect(parsed.apiUrl).toBe('http://127.0.0.1:5004');
      expect(parsed.origin).toBe('https://app.smartroute.test');
      expect(parsed.expectSpa).toBe(true);
      expect(parsed.retries).toBe(4);
      expect(parsed.delayMs).toBe(100);

      expect(() => parseSmokeArgs([], {})).toThrow(/Missing required --api-url/i);
    });

    test('runSmokeChecks verifies full production SERVE_CLIENT=true endpoints and fails cleanly when draining', async () => {
      const adminEmail = 'smoke-verify-admin@smartroute.test';
      const adminPassword = 'SmokeVerifyPassword!2026';
      await bootstrapAdmin({
        ADMIN_EMAIL: adminEmail,
        ADMIN_PASSWORD: adminPassword,
        ADMIN_NAME: 'Smoke Verifier',
      });

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartroute-smoke-'));
      fs.writeFileSync(
        path.join(tmpDir, 'index.html'),
        '<!doctype html><html><head><script src="/theme-init.js"></script></head><body><div id="root"></div></body></html>',
        'utf8'
      );

      const prodApp = app.createApp({
        nodeEnv: 'production',
        serveClient: true,
        clientDistDir: tmpDir,
        clientOrigin: 'https://app.smartroute.test',
      });

      const server = http.createServer(prodApp);
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

      try {
        const { port } = server.address();
        const apiUrl = `http://127.0.0.1:${port}`;

        const result = await runSmokeChecks({
          apiUrl,
          origin: 'https://app.smartroute.test',
          expectSpa: true,
          email: adminEmail,
          password: adminPassword,
          retries: 3,
          delayMs: 50,
        });

        expect(result.passed).toBe(true);
        expect(result.apiBase).toBe(apiUrl);
        expect(result.checks.map((c) => c.name)).toEqual([
          'GET /readyz (polling)',
          'GET /healthz',
          'GET /readyz',
          'GET /api/v1/health',
          'GET /api/v1/does-not-exist',
          'POST /api/v1/auth/login (invalid probe)',
          'POST /api/v1/auth/login (authenticated)',
          'OPTIONS /api/v1/health (CORS preflight)',
          'GET / (SPA HTML)',
        ]);

        prodApp.set('isDraining', true);
        await expect(
          runSmokeChecks({
            apiUrl,
            retries: 2,
            delayMs: 20,
          })
        ).rejects.toThrow(/Readiness probe GET .*\/readyz failed after 2 attempt/i);
      } finally {
        await new Promise((resolve) => server.close(resolve));
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('OPS-02 & OPS-03: PaaS manifests and CI workflow contracts', () => {
    test('render.yaml satisfies Single-Origin Render Blueprint contract', () => {
      const renderDoc = yaml.load(fs.readFileSync(path.join(REPO_ROOT, 'render.yaml'), 'utf8'));
      expect(Array.isArray(renderDoc?.services)).toBe(true);

      const svc = renderDoc.services.find((s) => s.name === 'smartroute');
      expect(svc).toBeDefined();
      expect(svc.type).toBe('web');
      expect(svc.runtime).toBe('node');
      expect(svc.numInstances).toBe(1);
      expect(svc.healthCheckPath).toBe('/readyz');
      expect(svc.buildCommand).toContain('npm --prefix client run build');
      expect(svc.startCommand).toBe('node server/src/index.js');

      const envMap = new Map((svc.envVars || []).map((entry) => [entry.key, entry]));
      expect(envMap.get('NODE_ENV')?.value).toBe('production');
      expect(envMap.get('SERVE_CLIENT')?.value).toBe('true');
      expect(envMap.get('TRUST_PROXY')?.value).toBe('1');
      expect(envMap.get('FORCE_HTTPS_CSP')?.value).toBe('true');
      expect(envMap.get('JWT_SECRET')?.generateValue).toBe(true);
      expect(envMap.get('JWT_REFRESH_SECRET')?.generateValue).toBe(true);
      expect(envMap.has('PORT')).toBe(false);

      for (const externalKey of [
        'MONGODB_URI',
        'GEOAPIFY_SERVER_API_KEY',
        'GOOGLE_CLIENT_ID',
        'VITE_GEOAPIFY_TILE_API_KEY',
        'VITE_GOOGLE_CLIENT_ID',
      ]) {
        expect(envMap.get(externalKey)?.sync).toBe(false);
      }
    });

    test('vercel.json and client/vercel.json satisfy SPA rewrite, cache, COOP, and Split-Origin CSP parity', () => {
      const rootVercel = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'vercel.json'), 'utf8'));
      const clientVercel = JSON.parse(
        fs.readFileSync(path.join(REPO_ROOT, 'client/vercel.json'), 'utf8')
      );

      expect(rootVercel.buildCommand).toBe('npm --prefix client run build');
      expect(rootVercel.outputDirectory).toBe('client/dist');

      expect(rootVercel.rewrites).toEqual(clientVercel.rewrites);
      expect(rootVercel.headers).toEqual(clientVercel.headers);

      const rewriteRule = rootVercel.rewrites[0];
      expect(rewriteRule.destination).toBe('/index.html');
      const rewriteRegex = new RegExp(`^${rewriteRule.source}$`);
      expect(rewriteRegex.test('/dashboard')).toBe(true);
      expect(rewriteRegex.test('/routes/optimize')).toBe(true);
      expect(rewriteRegex.test('/api/v1/health')).toBe(false);
      expect(rewriteRegex.test('/socket.io/')).toBe(false);
      expect(rewriteRegex.test('/assets/index-abc123.js')).toBe(false);
      expect(rewriteRegex.test('/theme-init.js')).toBe(false);

      const headerMap = new Map(rootVercel.headers.map((h) => [h.source, h.headers]));
      expect(headerMap.get('/assets/(.*)')).toContainEqual({
        key: 'Cache-Control',
        value: 'public, max-age=31536000, immutable',
      });
      expect(headerMap.get('/index.html')).toContainEqual({
        key: 'Cache-Control',
        value: 'no-cache',
      });
      expect(headerMap.get('/theme-init.js')).toContainEqual({
        key: 'Cache-Control',
        value: 'no-cache',
      });

      const globalHeaders = new Map(headerMap.get('/(.*)').map((h) => [h.key, h.value]));
      expect(globalHeaders.get('Cross-Origin-Opener-Policy')).toBe('same-origin-allow-popups');
      expect(globalHeaders.get('X-Content-Type-Options')).toBe('nosniff');
      expect(globalHeaders.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');

      const csp = globalHeaders.get('Content-Security-Policy');
      expect(csp).toContain("script-src 'self' https://accounts.google.com");
      const connectSrcMatch = csp.match(/connect-src ([^;]+)/);
      expect(connectSrcMatch).not.toBeNull();
      expect(connectSrcMatch[1]).toContain('https:');
      expect(connectSrcMatch[1]).toContain('wss:');
    });

    test('.github/workflows/ci.yml defines live SERVE_CLIENT=true + docker-and-compose smoke gates with non-blocklisted JWT secrets', () => {
      const ciDoc = yaml.load(
        fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/ci.yml'), 'utf8')
      );
      const validateJob = ciDoc?.jobs?.['validate-and-test'];
      const dockerJob = ciDoc?.jobs?.['docker-and-compose'];

      expect(validateJob).toBeDefined();
      expect(dockerJob).toBeDefined();
      expect(dockerJob.needs).toBe('validate-and-test');

      const validateText = JSON.stringify(validateJob);
      expect(validateText).toContain('npm --prefix client test');
      expect(validateText).toContain('npm --prefix client run build');
      expect(validateText).toContain('npm --prefix server test');
      expect(validateText).toContain('seed:admin');
      expect(validateText).toContain('SERVE_CLIENT');
      expect(validateText).toContain('scripts/smoke-test.js');

      const smokeStep = validateJob.steps.find((s) => String(s.name || '').includes('Smoke'));
      expect(smokeStep).toBeDefined();
      const sEnv = smokeStep.env || {};
      expect(sEnv.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
      expect(sEnv.JWT_REFRESH_SECRET.length).toBeGreaterThanOrEqual(32);
      expect(sEnv.JWT_SECRET).not.toBe(sEnv.JWT_REFRESH_SECRET);
      expect(env.DISALLOWED_JWT_SECRETS.has(sEnv.JWT_SECRET)).toBe(false);
      expect(env.DISALLOWED_JWT_SECRETS.has(sEnv.JWT_REFRESH_SECRET)).toBe(false);

      const dockerText = JSON.stringify(dockerJob);
      expect(dockerText).toContain('docker compose config -q');
      expect(dockerText).toContain('nginx -t');
      expect(dockerText).toContain('docker/build-push-action');
      expect(dockerText).toContain('docker compose up -d --build --wait');
      expect(dockerText).toContain('scripts/smoke-test.js');
      expect(dockerText).toContain('docker compose down -v');

      const teardownStep = dockerJob.steps.find((s) =>
        String(s.run || '').includes('docker compose down -v')
      );
      expect(teardownStep?.if).toBe('always()');

      const dEnv = dockerJob.env || {};
      expect(dEnv.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
      expect(dEnv.JWT_REFRESH_SECRET.length).toBeGreaterThanOrEqual(32);
      expect(dEnv.JWT_SECRET).not.toBe(dEnv.JWT_REFRESH_SECRET);
      expect(env.DISALLOWED_JWT_SECRETS.has(dEnv.JWT_SECRET)).toBe(false);
      expect(env.DISALLOWED_JWT_SECRETS.has(dEnv.JWT_REFRESH_SECRET)).toBe(false);
    });
  });
});
