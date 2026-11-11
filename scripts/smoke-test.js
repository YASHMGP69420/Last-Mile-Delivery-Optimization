#!/usr/bin/env node
'use strict';

const DEFAULT_RETRIES = 10;
const DEFAULT_DELAY_MS = 1000;
const DEFAULT_TIMEOUT_MS = 8000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalize an API or client base URL by trimming whitespace, trailing slashes,
 * and a trailing `/api/v1` segment so callers can pass either root or `/api/v1` URLs.
 * @param {string} rawUrl
 * @returns {string}
 */
function normalizeBaseUrl(rawUrl) {
  if (typeof rawUrl !== 'string') {
    return '';
  }
  let normalized = rawUrl.trim().replace(/\/+$/, '');
  if (!normalized) {
    return '';
  }
  if (/\/api\/v1$/i.test(normalized)) {
    normalized = normalized.slice(0, -'/api/v1'.length).replace(/\/+$/, '');
  }
  return normalized;
}

function normalizeOrigin(rawOrigin) {
  if (typeof rawOrigin !== 'string') {
    return '';
  }
  return rawOrigin.trim().replace(/\/+$/, '');
}

function parsePositiveInt(value, flagName, min = 1) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new Error(`${flagName} must be an integer >= ${min} (received "${value}")`);
  }
  return parsed;
}

function printUsage() {
  console.log(
    [
      'Usage: node scripts/smoke-test.js --api-url <url> [options]',
      '',
      'Options:',
      '  --api-url <url>      Base API or single-origin URL (or SMOKE_API_URL)',
      '  --client-url <url>   Optional split-origin SPA URL (or SMOKE_CLIENT_URL)',
      '  --origin <origin>    Optional Origin header for CORS preflight check (or SMOKE_ORIGIN)',
      '  --expect-spa         Verify SPA HTML delivery at / (auto-enabled with --client-url)',
      '  --retries <n>        Max /readyz polling attempts before failing (default: 10, or SMOKE_RETRIES)',
      '  --delay-ms <ms>      Delay between /readyz polling attempts in ms (default: 1000, or SMOKE_DELAY_MS)',
      '  --email <email>      Optional login check email (or SMOKE_EMAIL)',
      '  --password <pass>    Optional login check password (or SMOKE_PASSWORD)',
      '  --help               Show this help message',
    ].join('\n')
  );
}

/**
 * Parse CLI arguments with environment variable fallbacks.
 * @param {string[]} [argv=process.argv.slice(2)]
 * @param {Record<string, string | undefined>} [sourceEnv=process.env]
 */
function parseSmokeArgs(argv = process.argv.slice(2), sourceEnv = process.env) {
  const envSource = sourceEnv || {};
  const args = Array.isArray(argv) ? argv : [];

  const result = {
    help: false,
    apiUrl: envSource.SMOKE_API_URL || '',
    clientUrl: envSource.SMOKE_CLIENT_URL || '',
    origin: envSource.SMOKE_ORIGIN || '',
    expectSpa: false,
    retries:
      envSource.SMOKE_RETRIES !== undefined && envSource.SMOKE_RETRIES !== ''
        ? parsePositiveInt(envSource.SMOKE_RETRIES, 'SMOKE_RETRIES', 1)
        : DEFAULT_RETRIES,
    delayMs:
      envSource.SMOKE_DELAY_MS !== undefined && envSource.SMOKE_DELAY_MS !== ''
        ? parsePositiveInt(envSource.SMOKE_DELAY_MS, 'SMOKE_DELAY_MS', 0)
        : DEFAULT_DELAY_MS,
    email: envSource.SMOKE_EMAIL || '',
    password: envSource.SMOKE_PASSWORD || '',
  };

  for (let i = 0; i < args.length; i += 1) {
    const token = String(args[i]);
    if (token === '--') {
      continue;
    }
    if (token === '--help' || token === '-h') {
      result.help = true;
      continue;
    }
    if (token === '--expect-spa') {
      result.expectSpa = true;
      continue;
    }

    const eqIndex = token.indexOf('=');
    const flag = eqIndex !== -1 ? token.slice(0, eqIndex) : token;
    const hasInlineValue = eqIndex !== -1;

    const readValue = () => {
      if (hasInlineValue) {
        return token.slice(eqIndex + 1);
      }
      if (i + 1 >= args.length) {
        throw new Error(`Missing value for ${flag}`);
      }
      i += 1;
      return String(args[i]);
    };

    switch (flag) {
      case '--api-url':
        result.apiUrl = readValue();
        break;
      case '--client-url':
        result.clientUrl = readValue();
        break;
      case '--origin':
        result.origin = readValue();
        break;
      case '--expect-spa': {
        const raw = readValue().trim().toLowerCase();
        result.expectSpa = raw === 'true' || raw === '1' || raw === 'yes';
        break;
      }
      case '--retries':
        result.retries = parsePositiveInt(readValue(), '--retries', 1);
        break;
      case '--delay-ms':
        result.delayMs = parsePositiveInt(readValue(), '--delay-ms', 0);
        break;
      case '--email':
        result.email = readValue();
        break;
      case '--password':
        result.password = readValue();
        break;
      default:
        throw new Error(`Unknown option: ${flag}`);
    }
  }

  result.apiUrl = normalizeBaseUrl(result.apiUrl);
  result.clientUrl = normalizeBaseUrl(result.clientUrl);
  result.origin = normalizeOrigin(result.origin);
  result.email = String(result.email || '').trim();
  result.password = String(result.password || '');

  if (!result.help && !result.apiUrl) {
    throw new Error('Missing required --api-url (or SMOKE_API_URL environment variable)');
  }

  if (result.apiUrl) {
    let parsedUrl;
    try {
      parsedUrl = new URL(result.apiUrl);
    } catch {
      throw new Error(`Invalid --api-url "${result.apiUrl}"`);
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`Unsupported protocol for --api-url: ${parsedUrl.protocol}`);
    }
  }

  if (result.clientUrl) {
    let parsedClientUrl;
    try {
      parsedClientUrl = new URL(result.clientUrl);
    } catch {
      throw new Error(`Invalid --client-url "${result.clientUrl}"`);
    }
    if (!['http:', 'https:'].includes(parsedClientUrl.protocol)) {
      throw new Error(`Unsupported protocol for --client-url: ${parsedClientUrl.protocol}`);
    }
  }

  return result;
}

async function fetchWithTimeout(url, init = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function parseJsonResponse(res) {
  const text = await res.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Expected JSON response (HTTP ${res.status}), parse error: ${err.message}`);
  }
}

/**
 * Poll GET /readyz until it returns HTTP 200 and { success: true }, or exhaust retries.
 */
async function waitForReadiness(apiBase, retries, delayMs, timeoutMs) {
  let lastReason = 'no attempts executed';

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetchWithTimeout(`${apiBase}/readyz`, { method: 'GET' }, timeoutMs);
      const body = await parseJsonResponse(res).catch((err) => ({ _parseError: err.message }));
      if (res.status === 200 && body && body.success === true) {
        return { attempt, status: res.status, body };
      }
      lastReason = `HTTP ${res.status} (${body?.status || body?._parseError || 'not ready'})`;
    } catch (err) {
      lastReason = err.message || String(err);
    }

    if (attempt < retries && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  throw new Error(
    `Readiness probe GET ${apiBase}/readyz failed after ${retries} attempt(s): ${lastReason}`
  );
}

/**
 * Execute all post-deploy HTTP smoke checks against a live SmartRoute deployment.
 * @param {object} options
 * @returns {Promise<{ passed: boolean, checks: Array<{ name: string, passed: boolean, status: number, detail: string }>, apiBase: string, clientBase: string | null }>}
 */
async function runSmokeChecks(options = {}) {
  const apiBase = normalizeBaseUrl(options.apiUrl);
  if (!apiBase) {
    throw new Error('runSmokeChecks requires a valid apiUrl');
  }
  const clientBase = options.clientUrl ? normalizeBaseUrl(options.clientUrl) : null;
  const origin = normalizeOrigin(options.origin || '');
  const expectSpa = Boolean(options.expectSpa || clientBase);
  const retries =
    Number.isInteger(options.retries) && options.retries >= 1 ? options.retries : DEFAULT_RETRIES;
  const delayMs =
    Number.isInteger(options.delayMs) && options.delayMs >= 0 ? options.delayMs : DEFAULT_DELAY_MS;
  const timeoutMs =
    Number.isInteger(options.timeoutMs) && options.timeoutMs >= 100
      ? options.timeoutMs
      : DEFAULT_TIMEOUT_MS;
  const email = String(options.email || '').trim();
  const password = String(options.password || '');

  const checks = [];

  // 1. Bounded readiness polling runs BEFORE any auth checks to avoid tripping auth rate limiters
  const readiness = await waitForReadiness(apiBase, retries, delayMs, timeoutMs);
  checks.push({
    name: 'GET /readyz (polling)',
    passed: true,
    status: readiness.status,
    detail: `ready on attempt ${readiness.attempt}/${retries}`,
  });

  // 2. GET /healthz -> 200 & success: true
  {
    const res = await fetchWithTimeout(`${apiBase}/healthz`, { method: 'GET' }, timeoutMs);
    const body = await parseJsonResponse(res);
    if (res.status !== 200 || body?.success !== true) {
      throw new Error(`GET ${apiBase}/healthz failed: HTTP ${res.status}`);
    }
    checks.push({
      name: 'GET /healthz',
      passed: true,
      status: res.status,
      detail: `status=${body.status || 'OK'}`,
    });
  }

  // 3. GET /readyz -> 200, success: true, database === 'CONNECTED'
  {
    const res = await fetchWithTimeout(`${apiBase}/readyz`, { method: 'GET' }, timeoutMs);
    const body = await parseJsonResponse(res);
    if (res.status !== 200 || body?.success !== true || body?.database !== 'CONNECTED') {
      throw new Error(
        `GET ${apiBase}/readyz failed: HTTP ${res.status}, database=${body?.database || 'unknown'}`
      );
    }
    checks.push({
      name: 'GET /readyz',
      passed: true,
      status: res.status,
      detail: `database=${body.database}`,
    });
  }

  // 4. GET /api/v1/health -> 200 & success: true
  {
    const res = await fetchWithTimeout(`${apiBase}/api/v1/health`, { method: 'GET' }, timeoutMs);
    const body = await parseJsonResponse(res);
    if (res.status !== 200 || body?.success !== true) {
      throw new Error(`GET ${apiBase}/api/v1/health failed: HTTP ${res.status}`);
    }
    checks.push({
      name: 'GET /api/v1/health',
      passed: true,
      status: res.status,
      detail: 'API v1 operational',
    });
  }

  // 5. GET /api/v1/does-not-exist -> 404 & error.code === 'ENDPOINT_NOT_FOUND'
  {
    const res = await fetchWithTimeout(
      `${apiBase}/api/v1/does-not-exist`,
      { method: 'GET' },
      timeoutMs
    );
    const body = await parseJsonResponse(res);
    if (res.status !== 404 || body?.error?.code !== 'ENDPOINT_NOT_FOUND') {
      throw new Error(
        `GET ${apiBase}/api/v1/does-not-exist expected 404 ENDPOINT_NOT_FOUND, got HTTP ${res.status} (${body?.error?.code || 'no code'})`
      );
    }
    checks.push({
      name: 'GET /api/v1/does-not-exist',
      passed: true,
      status: res.status,
      detail: `error.code=${body.error.code}`,
    });
  }

  // 6. One-shot invalid login probe -> 400 or 401 (never 5xx or 200)
  {
    const res = await fetchWithTimeout(
      `${apiBase}/api/v1/auth/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'smoke-probe@smartroute.invalid',
          password: 'InvalidProbePassword123!',
        }),
      },
      timeoutMs
    );
    if (res.status >= 500 || (res.status !== 400 && res.status !== 401)) {
      throw new Error(
        `POST ${apiBase}/api/v1/auth/login invalid-probe expected 400 or 401, got HTTP ${res.status}`
      );
    }
    checks.push({
      name: 'POST /api/v1/auth/login (invalid probe)',
      passed: true,
      status: res.status,
      detail: `non-5xx rejection HTTP ${res.status}`,
    });
  }

  // 7. Optional authenticated login verification (never log password or token)
  if (email && password) {
    const res = await fetchWithTimeout(
      `${apiBase}/api/v1/auth/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      },
      timeoutMs
    );
    const body = await parseJsonResponse(res);
    const hasToken = typeof body?.data?.token === 'string' && body.data.token.length > 0;
    if (res.status !== 200 || body?.success !== true || !hasToken) {
      throw new Error(
        `POST ${apiBase}/api/v1/auth/login authenticated check failed: HTTP ${res.status}`
      );
    }
    checks.push({
      name: 'POST /api/v1/auth/login (authenticated)',
      passed: true,
      status: res.status,
      detail: `authenticated as ${email}`,
    });
  }

  // 8. Optional CORS preflight check
  if (origin) {
    const res = await fetchWithTimeout(
      `${apiBase}/api/v1/health`,
      {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'GET',
        },
      },
      timeoutMs
    );
    const allowOrigin = res.headers.get('access-control-allow-origin') || '';
    const originMatched = allowOrigin === origin || allowOrigin === '*';
    if ((res.status !== 200 && res.status !== 204) || !originMatched) {
      throw new Error(
        `OPTIONS ${apiBase}/api/v1/health CORS check failed for origin "${origin}": HTTP ${res.status}, allow-origin="${allowOrigin}"`
      );
    }
    checks.push({
      name: 'OPTIONS /api/v1/health (CORS preflight)',
      passed: true,
      status: res.status,
      detail: `allow-origin=${allowOrigin}`,
    });
  }

  // 9. Optional SPA HTML delivery check
  if (expectSpa) {
    const spaBase = clientBase || apiBase;
    const res = await fetchWithTimeout(`${spaBase}/`, { method: 'GET' }, timeoutMs);
    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    const html = await res.text();
    if (res.status !== 200 || !contentType.includes('text/html') || !html.includes('/theme-init.js')) {
      throw new Error(
        `GET ${spaBase}/ SPA check failed: HTTP ${res.status}, content-type="${contentType}", hasThemeInit=${html.includes('/theme-init.js')}`
      );
    }
    checks.push({
      name: 'GET / (SPA HTML)',
      passed: true,
      status: res.status,
      detail: 'text/html with /theme-init.js',
    });
  }

  return {
    passed: true,
    checks,
    apiBase,
    clientBase,
  };
}

async function main() {
  const opts = parseSmokeArgs(process.argv.slice(2), process.env);
  if (opts.help) {
    printUsage();
    process.exit(0);
  }

  const result = await runSmokeChecks(opts);
  for (const check of result.checks) {
    console.log(`[PASS] ${check.name} (${check.status}) - ${check.detail}`);
  }
  console.log(`Smoke suite passed (${result.checks.length} checks) against ${result.apiBase}`);
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[FAIL] ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  normalizeBaseUrl,
  parseSmokeArgs,
  runSmokeChecks,
};
