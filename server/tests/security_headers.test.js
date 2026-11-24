const request = require('supertest');
const app = require('../src/app');

describe('Security Headers & Content Security Policy (D-04 / SEC-SUPPLY-04)', () => {
  let defaultApp;
  let httpsCspApp;

  beforeAll(() => {
    defaultApp = app.createApp({ nodeEnv: 'test', forceHttpsCsp: false });
    httpsCspApp = app.createApp({ nodeEnv: 'production', forceHttpsCsp: true });
  });

  test('enforces X-Content-Type-Options: nosniff across all routes', async () => {
    const res = await request(defaultApp).get('/healthz');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('enforces Cross-Origin-Opener-Policy: same-origin-allow-popups for OAuth popup security', async () => {
    const res = await request(defaultApp).get('/healthz');
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
  });

  test('enforces strict Content-Security-Policy directives', async () => {
    const res = await request(defaultApp).get('/healthz');
    const csp = res.headers['content-security-policy'];

    expect(csp).toBeDefined();

    // Directive checks
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");

    // Connect-src includes websockets and authorized maps
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain('ws:');
    expect(csp).toContain('wss:');
    expect(csp).toContain('https://maps.geoapify.com');
    expect(csp).toContain('https://api.geoapify.com');
    expect(csp).toContain('https://tile.openstreetmap.org');
  });

  test('applies upgrade-insecure-requests directive when forceHttpsCsp is true', async () => {
    const res = await request(httpsCspApp).get('/healthz');
    const csp = res.headers['content-security-policy'];

    expect(csp).toBeDefined();
    expect(csp).toContain('upgrade-insecure-requests');
  });
});
