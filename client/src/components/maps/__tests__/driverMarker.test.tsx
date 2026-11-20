import { describe, it, expect } from 'vitest';
import { createDriverIcon, escapeHtml } from '../markerIcons';

describe('driverMarker - createDriverIcon', () => {
  it('escapes HTML strings properly to prevent XSS injection (T-22-01)', () => {
    const malicious = '<script>alert("xss")</script>&"\'';
    const escaped = escapeHtml(malicious);
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
    expect(escaped).toContain('&amp;');
    expect(escaped).toContain('&quot;');
    expect(escaped).toContain('&#39;');
  });

  it('produces rotated SVG arrowhead with rotate(90deg) when heading is 90', () => {
    const icon = createDriverIcon({
      name: 'Rajesh',
      speedKmh: 34,
      headingDegrees: 90,
      isStale: false,
    });

    expect(icon).toBeDefined();
    const html = (icon.options as any)?.html || '';
    expect(html).toContain('rotate(90deg)');
    expect(icon.options.className).toBe('custom-driver-telemetry-marker');
    expect(icon.options.iconSize).toEqual([140, 70]);
    expect(icon.options.iconAnchor).toEqual([70, 48]);
  });

  it('displays driver name Rajesh, 34 km/h, and pulse ring when moving', () => {
    const icon = createDriverIcon({
      name: 'Rajesh',
      speedKmh: 34,
      headingDegrees: 180,
      isStale: false,
    });

    const html = (icon.options as any)?.html || '';
    expect(html).toContain('Rajesh');
    expect(html).toContain('34 km/h');
    expect(html).toContain('driver-pulse-ring');
    expect(html).toContain('rotate(180deg)');
  });

  it('displays Halt when speed is 0 and no pulse ring', () => {
    const icon = createDriverIcon({
      name: 'Suresh',
      speedKmh: 0,
      headingDegrees: 45,
      isStale: false,
    });

    const html = (icon.options as any)?.html || '';
    expect(html).toContain('Suresh');
    expect(html).toContain('Halt');
    expect(html).not.toContain('driver-pulse-ring');
  });

  it('displays Stale when isStale is true even if speed was reported', () => {
    const icon = createDriverIcon({
      name: 'Priya',
      speedKmh: 25,
      headingDegrees: 0,
      isStale: true,
    });

    const html = (icon.options as any)?.html || '';
    expect(html).toContain('Priya');
    expect(html).toContain('Stale');
    expect(html).not.toContain('driver-pulse-ring');
  });

  it('sanitizes driver name when creating divIcon HTML', () => {
    const icon = createDriverIcon({
      name: 'Driver <img src=x onerror=alert(1)>',
      speedKmh: 10,
      headingDegrees: 0,
    });

    const html = (icon.options as any)?.html || '';
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});
