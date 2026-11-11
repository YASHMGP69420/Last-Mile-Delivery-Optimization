const fs = require('fs');
const path = require('path');

const env = require('../src/config/env');
const { WEAK_ADMIN_PASSWORDS } = require('../src/scripts/bootstrapAdmin');

const REPO_ROOT = path.resolve(__dirname, '../..');

const VITE_BUILTIN_ENV_KEYS = new Set(['BASE_URL', 'DEV', 'MODE', 'PROD', 'SSR']);

const OPERATIONAL_REPO_PATHS = [
  'render.yaml',
  'vercel.json',
  'client/vercel.json',
  'docker-compose.yml',
  'Dockerfile',
  'deploy/nginx/default.conf',
  'scripts/smoke-test.js',
  '.env.example',
  'server/.env.example',
  'client/.env.example',
  'server/src/scripts/bootstrapAdmin.js',
  'server/src/seed/seedBhubaneswar.js',
  'server/src/config/env.js',
  'server/src/config/db.js',
  'server/src/app.js',
  'server/src/index.js',
  'client/vite.config.ts',
  'docs/DEPLOYMENT_GUIDE.md',
  'README.md',
];

const STALE_DOC_PATTERNS = [
  /151\s+passed/i,
  /151%20passed/i,
  /151\s+unit/i,
  /node\s*>=\s*18/i,
  /node-%3E%3D18/i,
  /\badmin123\b/i,
  /\bmanager123\b/i,
  /\bdriver123\b/i,
  /55\s+consignments/i,
  /FROM\s+node:20-alpine/i,
];

function walkFiles(dirPath, extensions) {
  const results = [];
  if (!fs.existsSync(dirPath)) {
    return results;
  }

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, extensions));
    } else if (!extensions || extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const map = new Map();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) {
      throw new Error(`Invalid env line in ${filePath}: "${rawLine}"`);
    }

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }

    if (map.has(key)) {
      throw new Error(`Duplicate key "${key}" found in ${filePath}`);
    }
    map.set(key, value);
  }

  return map;
}

function collectProcessEnvKeys(dirPath) {
  const keys = new Set();
  for (const filePath of walkFiles(dirPath, ['.js', '.mjs', '.cjs', '.ts'])) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const match of content.matchAll(/(?:process\.env|envSource)\.([A-Z0-9_]+)/g)) {
      keys.add(match[1]);
    }
  }
  return keys;
}

function collectImportMetaEnvKeys(dirPath) {
  const keys = new Set();
  for (const filePath of walkFiles(dirPath, ['.ts', '.tsx', '.js', '.jsx'])) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const match of content.matchAll(/import\.meta\.env\.([A-Z0-9_]+)/g)) {
      if (!VITE_BUILTIN_ENV_KEYS.has(match[1])) {
        keys.add(match[1]);
      }
    }
    if (filePath.endsWith('vite-env.d.ts')) {
      for (const match of content.matchAll(/^\s*(?:readonly\s+)?(VITE_[A-Z0-9_]+)/gm)) {
        keys.add(match[1]);
      }
    }
  }
  return keys;
}

function collectComposeSubstitutionKeys(composePath) {
  const content = fs.readFileSync(composePath, 'utf8');
  const keys = new Set();
  for (const match of content.matchAll(/\$\{([A-Z0-9_]+)(?:[:?\-+][^}]*)?\}/g)) {
    keys.add(match[1]);
  }
  return keys;
}

function sortedKeys(iterable) {
  return [...iterable].sort();
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8'));
}

describe('Phase 14: Audited Env Templates & Production Runbook Contract (OPS-04)', () => {
  const rootEnvPath = path.join(REPO_ROOT, '.env.example');
  const serverEnvPath = path.join(REPO_ROOT, 'server/.env.example');
  const clientEnvPath = path.join(REPO_ROOT, 'client/.env.example');
  const composePath = path.join(REPO_ROOT, 'docker-compose.yml');

  const rootEnvMap = parseEnvFile(rootEnvPath);
  const serverEnvMap = parseEnvFile(serverEnvPath);
  const clientEnvMap = parseEnvFile(clientEnvPath);

  const serverCodeKeys = collectProcessEnvKeys(path.join(REPO_ROOT, 'server/src'));
  const scriptCodeKeys = collectProcessEnvKeys(path.join(REPO_ROOT, 'scripts'));
  const clientCodeKeys = collectImportMetaEnvKeys(path.join(REPO_ROOT, 'client/src'));
  const composeKeys = collectComposeSubstitutionKeys(composePath);

  test('root .env.example has 1:1 bidirectional parity with server/src, scripts, client/src, and docker-compose.yml env keys', () => {
    const expectedRootKeys = new Set([
      ...serverCodeKeys,
      ...scriptCodeKeys,
      ...clientCodeKeys,
      ...composeKeys,
    ]);

    expect(sortedKeys(rootEnvMap.keys())).toEqual(sortedKeys(expectedRootKeys));
    expect(rootEnvMap.get('PORT')).toBe('5004');
    expect(rootEnvMap.get('CLIENT_ORIGIN')).toBe('http://localhost:5173');
    expect(rootEnvMap.get('VITE_API_URL')).toBe('/api/v1');
    expect(rootEnvMap.get('VITE_SOCKET_URL')).toBe('');
  });

  test('server/.env.example has 1:1 bidirectional parity with server/bootstrap keys (excluding VITE_* fallback, including MAP_PROVIDER) and zero client/smoke/compose-only keys', () => {
    const expectedServerKeys = new Set(
      [...serverCodeKeys].filter((key) => !key.startsWith('VITE_'))
    );
    expectedServerKeys.add('MAP_PROVIDER');

    expect(sortedKeys(serverEnvMap.keys())).toEqual(sortedKeys(expectedServerKeys));
    expect(serverEnvMap.get('PORT')).toBe('5004');
    expect(serverEnvMap.get('CLIENT_ORIGIN')).toBe('http://localhost:5173');

    for (const key of serverEnvMap.keys()) {
      expect(key.startsWith('VITE_')).toBe(false);
      expect(key.startsWith('SMOKE_')).toBe(false);
    }
    expect(serverEnvMap.has('HTTP_PORT')).toBe(false);
  });

  test('client/.env.example has 1:1 bidirectional parity with client/src, vite-env.d.ts, and docker-compose.yml VITE_* keys', () => {
    const composeViteKeys = [...composeKeys].filter((key) => key.startsWith('VITE_'));
    const expectedClientKeys = new Set([...clientCodeKeys, ...composeViteKeys]);

    expect(sortedKeys(clientEnvMap.keys())).toEqual(sortedKeys(expectedClientKeys));
    expect(clientEnvMap.get('VITE_API_URL')).toBe('/api/v1');
    expect(clientEnvMap.get('VITE_SOCKET_URL')).toBe('');

    for (const key of clientEnvMap.keys()) {
      expect(key.startsWith('VITE_')).toBe(true);
    }
  });

  test('all .env.example templates exclude DISALLOWED_JWT_SECRETS and WEAK_ADMIN_PASSWORDS and use distinct >=32-char JWT placeholders', () => {
    const templates = [
      { label: '.env.example', path: rootEnvPath, map: rootEnvMap },
      { label: 'server/.env.example', path: serverEnvPath, map: serverEnvMap },
      { label: 'client/.env.example', path: clientEnvPath, map: clientEnvMap },
    ];

    const specificWeakLiterals = [...WEAK_ADMIN_PASSWORDS].filter(
      (pw) => pw !== 'admin' && pw !== 'password'
    );

    for (const template of templates) {
      const rawContent = fs.readFileSync(template.path, 'utf8');

      for (const disallowedSecret of env.DISALLOWED_JWT_SECRETS) {
        expect(rawContent).not.toContain(disallowedSecret);
      }

      for (const weakLiteral of specificWeakLiterals) {
        expect(rawContent.toLowerCase()).not.toContain(weakLiteral.toLowerCase());
      }

      for (const [key, value] of template.map.entries()) {
        expect(env.DISALLOWED_JWT_SECRETS.has(value)).toBe(false);
        if (value.trim() !== '') {
          expect(WEAK_ADMIN_PASSWORDS.has(value.trim().toLowerCase())).toBe(false);
        }
        if (key === 'ADMIN_PASSWORD' && value.trim() !== '') {
          expect(value.trim().length).toBeGreaterThanOrEqual(10);
          expect(value.toLowerCase()).not.toContain('your_admin_password');
          expect(value.toLowerCase()).not.toContain('changeme');
        }
      }
    }

    for (const serverScopedMap of [rootEnvMap, serverEnvMap]) {
      const jwtSecret = serverScopedMap.get('JWT_SECRET');
      const jwtRefreshSecret = serverScopedMap.get('JWT_REFRESH_SECRET');

      expect(typeof jwtSecret).toBe('string');
      expect(typeof jwtRefreshSecret).toBe('string');
      expect(jwtSecret.length).toBeGreaterThanOrEqual(32);
      expect(jwtRefreshSecret.length).toBeGreaterThanOrEqual(32);
      expect(jwtSecret).not.toBe(jwtRefreshSecret);
      expect(env.DISALLOWED_JWT_SECRETS.has(jwtSecret)).toBe(false);
      expect(env.DISALLOWED_JWT_SECRETS.has(jwtRefreshSecret)).toBe(false);
    }
  });

  test('README.md and docs/DEPLOYMENT_GUIDE.md are free of stale claims, contain required v6 runbook anchors, and reference only valid repo paths and npm scripts', () => {
    const readmePath = path.join(REPO_ROOT, 'README.md');
    const guidePath = path.join(REPO_ROOT, 'docs/DEPLOYMENT_GUIDE.md');

    const readme = fs.readFileSync(readmePath, 'utf8');
    const guide = fs.readFileSync(guidePath, 'utf8');

    for (const [docName, content] of [
      ['README.md', readme],
      ['docs/DEPLOYMENT_GUIDE.md', guide],
    ]) {
      for (const stalePattern of STALE_DOC_PATTERNS) {
        expect({ docName, stalePattern: stalePattern.toString(), matched: stalePattern.test(content) }).toEqual({
          docName,
          stalePattern: stalePattern.toString(),
          matched: false,
        });
      }
    }

    const sharedRequiredTokens = [
      'seed:admin',
      'scripts/smoke-test.js',
      'docker-compose.yml',
      'render.yaml',
      'vercel.json',
      'client/vercel.json',
      '/healthz',
      '/readyz',
      'SERVE_CLIENT',
      'TRUST_PROXY',
      'FORCE_HTTPS_CSP',
      'CLIENT_ORIGIN',
      'PORT=5004',
      'VITE_API_URL',
      'VITE_SOCKET_URL',
      'Dockerfile',
      'deploy/nginx/default.conf',
      'server/src/scripts/bootstrapAdmin.js',
    ];

    for (const token of sharedRequiredTokens) {
      expect(readme).toContain(token);
      expect(guide).toContain(token);
    }

    const readmeOnlyTokens = [
      'node-%3E%3D20.0.0',
      '20.0.0',
      'server/src/seed/seedBhubaneswar.js',
      'GOOGLE_CLIENT_ID',
      'VITE_GOOGLE_CLIENT_ID',
      'GEOAPIFY_SERVER_API_KEY',
      'VITE_GEOAPIFY_TILE_API_KEY',
      'SMOKE_API_URL',
      'npm --prefix server test',
      'npm --prefix client test',
      'npm --prefix client run build',
    ];

    for (const token of readmeOnlyTokens) {
      expect(readme).toContain(token);
    }

    for (const relPath of OPERATIONAL_REPO_PATHS) {
      expect({ relPath, exists: fs.existsSync(path.join(REPO_ROOT, relPath)) }).toEqual({
        relPath,
        exists: true,
      });
    }

    for (const docRelPath of ['README.md', 'docs/DEPLOYMENT_GUIDE.md']) {
      const fullDocPath = path.join(REPO_ROOT, docRelPath);
      const docDir = path.dirname(fullDocPath);
      const docContent = fs.readFileSync(fullDocPath, 'utf8');

      for (const match of docContent.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        const rawTarget = match[1].split('#')[0].trim();
        if (!rawTarget || /^https?:\/\//i.test(rawTarget) || rawTarget.startsWith('mailto:') || rawTarget === 'LICENSE') {
          continue;
        }
        const resolved = path.resolve(docDir, rawTarget);
        expect({ docRelPath, linkTarget: rawTarget, exists: fs.existsSync(resolved) }).toEqual({
          docRelPath,
          linkTarget: rawTarget,
          exists: true,
        });
      }
    }

    const manifests = {
      root: readJson('package.json').scripts || {},
      server: readJson('server/package.json').scripts || {},
      client: readJson('client/package.json').scripts || {},
    };

    expect(manifests.server['seed:admin']).toBeTruthy();
    expect(manifests.server.seed).toBeTruthy();
    expect(manifests.server.test).toBeTruthy();
    expect(manifests.client.test).toBeTruthy();
    expect(manifests.client.build).toBeTruthy();
    expect(manifests.root.dev).toBeTruthy();
    expect(manifests.root.smoke).toBeTruthy();
    expect(manifests.root['seed:admin']).toBeTruthy();

    for (const [docName, content] of [
      ['README.md', readme],
      ['docs/DEPLOYMENT_GUIDE.md', guide],
    ]) {
      for (const match of content.matchAll(/npm(?:\s+--prefix\s+(server|client))?\s+run\s+([a-zA-Z0-9:_-]+)/g)) {
        const scope = match[1] || 'root';
        const scriptName = match[2];
        expect({ docName, scope, scriptName, defined: Boolean(manifests[scope][scriptName]) }).toEqual({
          docName,
          scope,
          scriptName,
          defined: true,
        });
      }
    }
  });
});
