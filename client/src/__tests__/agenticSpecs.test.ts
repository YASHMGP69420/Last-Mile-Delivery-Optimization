import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Agentic Standards & Machine-Readable Discovery (D-09, D-10)', () => {
  const publicDir = path.resolve(__dirname, '../../public');
  const llmsPath = path.join(publicDir, 'llms.txt');
  const aiCatalogPath = path.join(publicDir, 'ai-catalog.json');
  const clientVercelPath = path.resolve(__dirname, '../../vercel.json');
  const rootVercelPath = path.resolve(__dirname, '../../../vercel.json');

  it('provides a standardized llms.txt starting with required H1 header', () => {
    expect(fs.existsSync(llmsPath)).toBe(true);
    const content = fs.readFileSync(llmsPath, 'utf-8').trim();

    expect(content.startsWith('# SmartRoute: Last-Mile Delivery Optimization Platform')).toBe(true);
    expect(content).toContain('## Core Capabilities');
    expect(content).toContain('## API Documentation');
    expect(content).toContain('## Agent Discovery');
    expect(content).toContain('/ai-catalog.json');
    expect(content).toContain('/api/v1/routes');
    expect(content).toContain('/api/v1/batches');
    expect(content).toContain('/api/v1/telemetry');
    expect(content).toContain('/api/v1/hubs');
  });

  it('provides a valid ai-catalog.json manifest with bearerAuth security and operational endpoints', () => {
    expect(fs.existsSync(aiCatalogPath)).toBe(true);
    const raw = fs.readFileSync(aiCatalogPath, 'utf-8');
    const catalog = JSON.parse(raw);

    expect(catalog.name).toBe('SmartRoute AI Catalog');
    expect(catalog.version).toBe('1.0.0');
    expect(catalog.description).toContain('SmartRoute');
    expect(catalog.securitySchemes?.bearerAuth).toBeDefined();
    expect(catalog.securitySchemes.bearerAuth.type).toBe('http');
    expect(catalog.securitySchemes.bearerAuth.scheme).toBe('bearer');

    expect(Array.isArray(catalog.endpoints)).toBe(true);
    const paths = catalog.endpoints.map((ep: any) => ep.path);
    expect(paths).toContain('/api/v1/routes');
    expect(paths).toContain('/api/v1/batches');
    expect(paths).toContain('/api/v1/telemetry');
    expect(paths).toContain('/api/v1/hubs');

    catalog.endpoints.forEach((ep: any) => {
      expect(ep.method).toBeDefined();
      expect(ep.security).toContain('bearerAuth');
    });
  });

  it('exempts llms.txt and ai-catalog.json in client/vercel.json SPA rewrite rules', () => {
    expect(fs.existsSync(clientVercelPath)).toBe(true);
    const vercelConfig = JSON.parse(fs.readFileSync(clientVercelPath, 'utf-8'));
    const rewriteSource = vercelConfig.rewrites?.[0]?.source;

    expect(rewriteSource).toBeDefined();
    expect(rewriteSource).toContain('llms\\.txt');
    expect(rewriteSource).toContain('ai-catalog\\.json');

    const headers = vercelConfig.headers || [];
    const aiCatalogHeader = headers.find((h: any) => h.source === '/ai-catalog.json');
    const llmsHeader = headers.find((h: any) => h.source === '/llms.txt');

    expect(aiCatalogHeader).toBeDefined();
    expect(aiCatalogHeader.headers.some((h: any) => h.key === 'Content-Type' && h.value === 'application/json')).toBe(true);

    expect(llmsHeader).toBeDefined();
    expect(llmsHeader.headers.some((h: any) => h.key === 'Content-Type' && h.value.includes('text/plain'))).toBe(true);
  });

  it('exempts llms.txt and ai-catalog.json in root vercel.json SPA rewrite rules', () => {
    expect(fs.existsSync(rootVercelPath)).toBe(true);
    const rootConfig = JSON.parse(fs.readFileSync(rootVercelPath, 'utf-8'));
    const rewriteSource = rootConfig.rewrites?.[0]?.source;

    expect(rewriteSource).toBeDefined();
    expect(rewriteSource).toContain('llms\\.txt');
    expect(rewriteSource).toContain('ai-catalog\\.json');

    const headers = rootConfig.headers || [];
    const aiCatalogHeader = headers.find((h: any) => h.source === '/ai-catalog.json');
    const llmsHeader = headers.find((h: any) => h.source === '/llms.txt');

    expect(aiCatalogHeader).toBeDefined();
    expect(aiCatalogHeader.headers.some((h: any) => h.key === 'Content-Type' && h.value === 'application/json')).toBe(true);

    expect(llmsHeader).toBeDefined();
    expect(llmsHeader.headers.some((h: any) => h.key === 'Content-Type' && h.value.includes('text/plain'))).toBe(true);
  });
});
