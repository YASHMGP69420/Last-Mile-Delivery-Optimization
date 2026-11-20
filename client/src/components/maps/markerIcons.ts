import L from 'leaflet';

/**
 * Escapes HTML characters to prevent XSS injection in Leaflet divIcon markup (T-22-01).
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface DriverIconOptions {
  name: string;
  speedKmh: number;
  headingDegrees: number;
  isStale?: boolean;
}

/**
 * Generates an L.divIcon representing a live driver telemetry marker (D-01, D-02):
 * - Oriented minimalist pulsing navigation arrowhead matching headingDegrees
 * - Live driver badge pill displaying sanitized driver name and real-time speed
 * - Color-coded: green when moving, amber when stationary (Halt) or stale (Stale)
 */
export function createDriverIcon(driver: DriverIconOptions): L.DivIcon {
  const heading = driver.headingDegrees || 0;
  const isMoving = (driver.speedKmh || 0) > 0;
  const isStale = Boolean(driver.isStale);

  const statusColor = isStale ? '#f59e0b' : isMoving ? '#10b981' : '#f59e0b';
  const speedText = isStale ? 'Stale' : isMoving ? `${Math.round(driver.speedKmh)} km/h` : 'Halt';
  const safeName = escapeHtml(driver.name || 'Driver');

  const pulseHtml = isMoving && !isStale
    ? `<span data-testid="driver-pulse-ring" style="position:absolute; width:48px; height:48px; border-radius:50%; background:rgba(16,185,129,0.25); animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite; z-index:1;"></span>`
    : '';

  return L.divIcon({
    className: 'custom-driver-telemetry-marker',
    iconSize: [140, 70],
    iconAnchor: [70, 48],
    popupAnchor: [0, -48],
    html: `
      <div style="position:relative; width:140px; height:70px; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:auto;">
        <!-- Live Driver & Speed Pill Badge -->
        <div data-testid="driver-speed-pill" style="z-index:10; margin-bottom:4px; display:flex; align-items:center; gap:5px; padding:3px 9px; border-radius:9999px; background:rgba(15,23,42,0.92); border:1px solid rgba(255,255,255,0.18); box-shadow:0 4px 12px rgba(0,0,0,0.35); font-family:sans-serif; white-space:nowrap;">
          <span style="width:7px; height:7px; border-radius:50%; background:${statusColor}; display:inline-block;"></span>
          <span data-testid="driver-pill-name" style="color:#ffffff; font-size:11px; font-weight:700;">${safeName}</span>
          <span style="color:#94a3b8; font-size:10px; font-weight:500;">•</span>
          <span data-testid="driver-pill-speed" style="color:${statusColor}; font-size:10px; font-weight:700; font-family:monospace;">
            ${speedText}
          </span>
        </div>

        <!-- Navigation Arrowhead Container -->
        <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center;">
          ${pulseHtml}
          <div data-testid="driver-arrow-container" style="position:relative; z-index:2; transform:rotate(${heading}deg); transform-origin:center center; transition:transform 0.3s ease;">
            <svg viewBox="0 0 32 32" width="32" height="32" style="filter:drop-shadow(0 2px 5px rgba(0,0,0,0.4));">
              <polygon points="16,2 28,26 16,20 4,26" fill="#3b82f6" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    `,
  });
}
