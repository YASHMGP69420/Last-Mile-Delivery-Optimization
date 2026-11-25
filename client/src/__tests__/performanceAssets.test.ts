import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Performance Assets & Composited Transitions (PERF-COMPOSIT-03)', () => {
  const rootDir = path.resolve(__dirname, '../../..');
  const indexHtmlPath = path.resolve(rootDir, 'client/index.html');
  const indexCssPath = path.resolve(rootDir, 'client/src/index.css');

  describe('Non-Blocking Google Font Loading (D-05)', () => {
    it('verifies index.html uses preconnect hints for Google Fonts origins', () => {
      const html = fs.readFileSync(indexHtmlPath, 'utf-8');
      expect(html).toMatch(/<link\s+rel="preconnect"\s+href="https:\/\/fonts\.googleapis\.com"\s*\/?>/i);
      expect(html).toMatch(/<link\s+rel="preconnect"\s+href="https:\/\/fonts\.gstatic\.com"\s+crossorigin\s*\/?>/i);
    });

    it('verifies index.html preloads Google Fonts stylesheet asynchronously with display=swap', () => {
      const html = fs.readFileSync(indexHtmlPath, 'utf-8');
      expect(html).toContain('rel="preload"');
      expect(html).toContain('as="style"');
      expect(html).toContain('display=swap');
    });

    it('verifies index.html uses media=print non-blocking swap pattern with noscript fallback and theme-init activation', () => {
      const html = fs.readFileSync(indexHtmlPath, 'utf-8');
      expect(html).toContain('id="sr-webfonts"');
      expect(html).toContain('media="print"');
      expect(html).not.toContain('onload="this.media=\'all\'"');
      expect(html).toContain('<noscript>');
      expect(html).toMatch(/<noscript>[\s\S]*?<link[\s\S]*?rel="stylesheet"[\s\S]*?<\/noscript>/i);

      const themeInitPath = path.resolve(rootDir, 'client/public/theme-init.js');
      const themeInit = fs.readFileSync(themeInitPath, 'utf-8');
      expect(themeInit).toContain("document.getElementById('sr-webfonts')");
      expect(themeInit).toContain("fontLink.media = 'all'");
    });
  });

  describe('GPU-Composited CSS Rules (D-06)', () => {
    it('verifies .panel-card utilizes transform compositor promotion and pseudo-element opacity', () => {
      const css = fs.readFileSync(indexCssPath, 'utf-8');
      expect(css).toMatch(/\.panel-card[\s\S]*?transform:\s*translateZ\(0\)/);
      expect(css).toMatch(/\.panel-card[\s\S]*?will-change:\s*transform/);
      expect(css).toMatch(/\.panel-card::after[\s\S]*?transition:\s*opacity/);
      // Ensure .panel-card primary rule does NOT directly transition border-color or box-shadow
      const panelCardRule = css.match(/\.panel-card\s*\{([^}]+)\}/)?.[1] || '';
      expect(panelCardRule).not.toMatch(/transition:[^;]*border-color/);
      expect(panelCardRule).not.toMatch(/transition:[^;]*box-shadow/);
    });

    it('verifies .glass-surface and .card-hover-lift enforce compositor layer promotion', () => {
      const css = fs.readFileSync(indexCssPath, 'utf-8');
      expect(css).toMatch(/\.glass-surface[\s\S]*?transform:\s*translateZ\(0\)/);
      expect(css).toMatch(/\.glass-surface[\s\S]*?will-change:\s*transform/);

      const cardHoverLiftRule = css.match(/\.card-hover-lift\s*\{([^}]+)\}/)?.[1] || '';
      expect(cardHoverLiftRule).not.toMatch(/transition:[^;]*border-color/);
      expect(cardHoverLiftRule).not.toMatch(/transition:[^;]*box-shadow/);
    });
  });
});
