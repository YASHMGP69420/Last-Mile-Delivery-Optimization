import { describe, it, expect } from 'vitest';
import { createDriverIcon } from '../markerIcons';

describe('driverMarkerStale - Dimmed Markers and Stale Badges (D-10)', () => {
  it('renders active moving driver marker with full opacity, blue arrow, and pulse ring', () => {
    const icon = createDriverIcon({
      name: 'Manoj Kumar',
      speedKmh: 42,
      headingDegrees: 90,
      isStale: false,
    });

    const html = (icon.options as any)?.html || '';

    // Opacity and filter
    expect(html).toContain('opacity:1.0');
    expect(html).toContain('filter:none');

    // Arrowhead fill
    expect(html).toContain('fill="#3b82f6"');

    // Pulse ring
    expect(html).toContain('driver-pulse-ring');

    // Speed pill text and status
    expect(html).toContain('42 km/h');
    expect(html).toContain('background:#10b981'); // Moving green dot
    expect(html).toContain('border:1px solid rgba(255,255,255,0.18)');
  });

  it('renders stale driver marker (>5m) with dimmed opacity 0.65, grayscale filter, slate arrow, amber Stale badge, and no pulse ring', () => {
    const icon = createDriverIcon({
      name: 'Sunil Rout',
      speedKmh: 35,
      headingDegrees: 180,
      isStale: true,
    });

    const html = (icon.options as any)?.html || '';

    // Dimmed container styles (D-10)
    expect(html).toContain('opacity:0.65');
    expect(html).toContain('filter:grayscale(35%)');

    // Dimmed slate arrow polygon fill (#94a3b8) instead of bright blue (#3b82f6)
    expect(html).toContain('fill="#94a3b8"');
    expect(html).not.toContain('fill="#3b82f6"');

    // Pulse ring must NOT render when stale even if speed > 0
    expect(html).not.toContain('driver-pulse-ring');

    // Speed pill badge must display amber status dot, Stale (>5m) text, and amber border
    expect(html).toContain('Stale (>5m)');
    expect(html).toContain('background:#f59e0b'); // Amber status dot
    expect(html).toContain('border:1px solid rgba(245,158,11,0.5)');
    expect(html).toContain('Sunil Rout');
  });

  it('renders stationary driver (Halt) with full opacity when not stale', () => {
    const icon = createDriverIcon({
      name: 'Ranjan Panda',
      speedKmh: 0,
      headingDegrees: 0,
      isStale: false,
    });

    const html = (icon.options as any)?.html || '';

    expect(html).toContain('opacity:1.0');
    expect(html).toContain('fill="#3b82f6"');
    expect(html).toContain('Halt');
    expect(html).not.toContain('driver-pulse-ring');
  });
});
