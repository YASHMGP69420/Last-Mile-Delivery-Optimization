import { describe, it, expect } from 'vitest';
import { createStatusStopIcon } from '../markerIcons';
import { RouteStop } from '../../../types/route';

describe('statusPinIcons - createStatusStopIcon', () => {
  const baseStop: RouteStop = {
    sequenceOrder: 3,
    deliveryId: 'del-101',
    orderReference: 'ORD-101',
    recipientName: 'Aarav Sharma',
    coordinates: [85.8245, 20.2961],
    weightKg: 2.5,
    distanceFromPreviousKm: 1.2,
    durationFromPreviousMin: 4.5,
    status: 'PENDING',
  };

  it('renders depot stop with amber diamond HUB icon', () => {
    const depotStop: RouteStop = {
      ...baseStop,
      isDepot: true,
      orderReference: 'DEPOT',
    };
    const icon = createStatusStopIcon(depotStop, 0, false);
    expect(icon).toBeDefined();
    expect(icon.options.className).toBe('custom-depot-marker');
    expect(icon.options.iconSize).toEqual([40, 40]);
    const html = (icon.options as any)?.html || '';
    expect(html).toContain('HUB');
    expect(html).toContain('#d97706');
  });

  it('renders COMPLETED stop as small flat dimmed grey dot with checkmark glyph (D-07)', () => {
    const completedStop: RouteStop = {
      ...baseStop,
      status: 'COMPLETED',
    };
    const icon = createStatusStopIcon(completedStop, 1, false);
    expect(icon).toBeDefined();
    expect(icon.options.className).toBe('custom-stop-completed');
    expect(icon.options.iconSize).toEqual([20, 20]);
    expect(icon.options.iconAnchor).toEqual([10, 10]);
    expect(icon.options.popupAnchor).toEqual([0, -10]);

    const html = (icon.options as any)?.html || '';
    expect(html).toContain('#64748b');
    expect(html).toContain('0.75'); // opacity 0.75
    // Checkmark svg
    expect(html).toContain('<polyline');
  });

  it('renders FAILED and CANCELLED stops with bold red pin and diagonal slash banner (D-08)', () => {
    const failedStop: RouteStop = {
      ...baseStop,
      status: 'FAILED',
    };
    const cancelledStop: RouteStop = {
      ...baseStop,
      status: 'CANCELLED',
    };

    const failedIcon = createStatusStopIcon(failedStop, 2, false);
    expect(failedIcon.options.className).toBe('custom-stop-cancelled');
    expect(failedIcon.options.iconSize).toEqual([34, 44]);
    expect(failedIcon.options.iconAnchor).toEqual([17, 42]);
    const failedHtml = (failedIcon.options as any)?.html || '';
    expect(failedHtml).toContain('#ef4444');
    expect(failedHtml).toContain('<line');

    const cancelledIcon = createStatusStopIcon(cancelledStop, 2, false);
    expect(cancelledIcon.options.className).toBe('custom-stop-cancelled');
    const cancelledHtml = (cancelledIcon.options as any)?.html || '';
    expect(cancelledHtml).toContain('#ef4444');
    expect(cancelledHtml).toContain('<line');
  });

  it('renders Next Active stop with pulsing bright indigo pin and sequence number (D-09)', () => {
    const nextStop: RouteStop = {
      ...baseStop,
      sequenceOrder: 1,
      status: 'PENDING',
    };
    const icon = createStatusStopIcon(nextStop, 0, false, true); // isNextActive = true
    expect(icon.options.className).toBe('custom-stop-next-active');
    expect(icon.options.iconSize).toEqual([38, 48]);
    expect(icon.options.iconAnchor).toEqual([19, 46]);
    expect(icon.options.popupAnchor).toEqual([0, -46]);

    const html = (icon.options as any)?.html || '';
    expect(html).toContain('#6366f1');
    expect(html).toContain('animation:ping');
    expect(html).toContain('1'); // sequence number
  });

  it('renders standard Pending stop with vibrant emerald pin and sequence number (D-09)', () => {
    const pendingStop: RouteStop = {
      ...baseStop,
      sequenceOrder: 4,
      status: 'PENDING',
      priority: 'Standard',
    };
    const icon = createStatusStopIcon(pendingStop, 3, false, false);
    expect(icon.options.className).toBe('custom-stop-pending');
    expect(icon.options.iconSize).toEqual([34, 44]);
    expect(icon.options.iconAnchor).toEqual([17, 42]);

    const html = (icon.options as any)?.html || '';
    expect(html).toContain('#10b981');
    expect(html).toContain('4'); // sequence number
  });

  it('applies priority accent rings for Cold Chain and Urgent stops', () => {
    const coldStop: RouteStop = {
      ...baseStop,
      priority: 'Cold Chain',
    };
    const urgentStop: RouteStop = {
      ...baseStop,
      priority: 'Urgent',
    };

    const coldIcon = createStatusStopIcon(coldStop, 2, false);
    const coldHtml = (coldIcon.options as any)?.html || '';
    expect(coldHtml).toContain('#06b6d4'); // cyan ring

    const urgentIcon = createStatusStopIcon(urgentStop, 2, false);
    const urgentHtml = (urgentIcon.options as any)?.html || '';
    expect(urgentHtml).toContain('#f97316'); // orange ring
  });

  it('sanitizes sequence and text to prevent HTML injection (T-22-03)', () => {
    const maliciousStop: RouteStop = {
      ...baseStop,
      sequenceOrder: '<script>alert(1)</script>' as any,
      orderReference: '<img src=x onerror=alert(1)>',
    };
    const icon = createStatusStopIcon(maliciousStop, 0, false);
    const html = (icon.options as any)?.html || '';
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
  });
});
