import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Agentic Standards & Machine-Readable Discovery (D-09, D-10, ARD Spec)', () => {
  const publicDir = path.resolve(__dirname, '../../public');
  const llmsPath = path.join(publicDir, 'llms.txt');
  const aiCatalogPath = path.join(publicDir, 'ai-catalog.json');
  const wellKnownCatalogPath = path.join(publicDir, '.well-known/ai-catalog.json');
  const wellKnownArdPath = path.join(publicDir, '.well-known/ard.json');
  const indexPath = path.resolve(__dirname, '../../index.html');
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

  it('provides a valid ai-catalog.json conforming to ARD (Agentic Resource Discovery) schema', () => {
    expect(fs.existsSync(aiCatalogPath)).toBe(true);
    const raw = fs.readFileSync(aiCatalogPath, 'utf-8');
    const catalog = JSON.parse(raw);

    // ARD spec properties
    expect(catalog.specVersion).toBe('1.0');
    expect(catalog.host).toBeDefined();
    expect(catalog.host.displayName).toContain('SmartRoute');
    expect(catalog.host.url).toContain('https://');

    expect(Array.isArray(catalog.entries)).toBe(true);
    expect(catalog.entries.length).toBeGreaterThan(0);
    catalog.entries.forEach((entry: any) => {
      expect(entry.identifier.startsWith('urn:air:')).toBe(true);
      expect(entry.displayName).toBeDefined();
      expect(entry.type).toBeDefined();
      expect(entry.url.startsWith('https://')).toBe(true);
    });

    // Backward-compatible operational endpoints & security
    expect(catalog.name).toBe('SmartRoute AI Catalog');
    expect(catalog.version).toBe('1.0.0');
    expect(catalog.securitySchemes?.bearerAuth).toBeDefined();
    expect(Array.isArray(catalog.endpoints)).toBe(true);
  });

  it('serves ai-catalog.json under both /.well-known/ai-catalog.json and /.well-known/ard.json', () => {
    expect(fs.existsSync(wellKnownCatalogPath)).toBe(true);
    expect(fs.existsSync(wellKnownArdPath)).toBe(true);

    const wellKnownContent = JSON.parse(fs.readFileSync(wellKnownCatalogPath, 'utf-8'));
    const ardContent = JSON.parse(fs.readFileSync(wellKnownArdPath, 'utf-8'));

    expect(wellKnownContent.specVersion).toBe('1.0');
    expect(ardContent.specVersion).toBe('1.0');
    expect(wellKnownContent.entries.length).toBeGreaterThan(0);
  });

  it('advertises ai-catalog and ard link relations in client/index.html head', () => {
    expect(fs.existsSync(indexPath)).toBe(true);
    const indexHtml = fs.readFileSync(indexPath, 'utf-8');

    expect(indexHtml).toContain('rel="ai-catalog"');
    expect(indexHtml).toContain('href="/.well-known/ai-catalog.json"');
    expect(indexHtml).toContain('rel="ard"');
  });

  it('exempts .well-known and agentic files in client/vercel.json and root vercel.json rewrite rules', () => {
    for (const configPath of [clientVercelPath, rootVercelPath]) {
      expect(fs.existsSync(configPath)).toBe(true);
      const vercelConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const rewriteSource = vercelConfig.rewrites?.[0]?.source;

      expect(rewriteSource).toBeDefined();
      expect(rewriteSource).toContain('\\.well-known/.*');
      expect(rewriteSource).toContain('ai-catalog\\.json');
      expect(rewriteSource).toContain('llms\\.txt');

      const headers = vercelConfig.headers || [];
      const wellKnownHeader = headers.find((h: any) => h.source?.includes('\\.well-known'));
      expect(wellKnownHeader).toBeDefined();
      expect(wellKnownHeader.headers.some((h: any) => h.key === 'Content-Type' && h.value.includes('application/json'))).toBe(true);
      expect(wellKnownHeader.headers.some((h: any) => h.key === 'Access-Control-Allow-Origin' && h.value === '*')).toBe(true);
    }
  });
});
