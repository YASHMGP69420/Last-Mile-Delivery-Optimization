import L from 'leaflet';
import { RouteStop } from '../../types/route';

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
  const speedText = isStale
    ? 'Stale (>5m)'
    : isMoving
    ? `${Math.round(driver.speedKmh)} km/h`
    : 'Halt';
  const safeName = escapeHtml(driver.name || 'Driver');

  const containerOpacity = isStale ? '0.65' : '1.0';
  const containerFilter = isStale ? 'grayscale(35%)' : 'none';
  const badgeBorder = isStale ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.18)';
  const arrowFill = isStale ? '#94a3b8' : '#3b82f6';

  const pulseHtml = isMoving && !isStale
    ? `<span data-testid="driver-pulse-ring" style="position:absolute; width:48px; height:48px; border-radius:50%; background:rgba(16,185,129,0.25); animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite; z-index:1;"></span>`
    : '';

  return L.divIcon({
    className: 'custom-driver-telemetry-marker',
    iconSize: [140, 70],
    iconAnchor: [70, 48],
    popupAnchor: [0, -48],
    html: `
      <div data-testid="driver-marker-container" style="position:relative; width:140px; height:70px; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:auto; opacity:${containerOpacity}; filter:${containerFilter};">
        <!-- Live Driver & Speed Pill Badge -->
        <div data-testid="driver-speed-pill" style="z-index:10; margin-bottom:4px; display:flex; align-items:center; gap:5px; padding:3px 9px; border-radius:9999px; background:rgba(15,23,42,0.92); border:1px solid ${badgeBorder}; box-shadow:0 4px 12px rgba(0,0,0,0.35); font-family:sans-serif; white-space:nowrap;">
          <span data-testid="driver-status-dot" style="width:7px; height:7px; border-radius:50%; background:${statusColor}; display:inline-block;"></span>
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
              <polygon points="16,2 28,26 16,20 4,26" fill="${arrowFill}" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    `,
  });
}

/**
 * Creates status-differentiated stop pins (D-07, D-08, D-09, T-22-03):
 * - Depot stops: amber diamond HUB icon
 * - Completed stops (COMPLETED): small flat dimmed grey dot (20x20px, opacity 0.75) with checkmark glyph
 * - Cancelled or Failed stops (CANCELLED, FAILED): bold red pin (34x44px) with diagonal slash-through banner
 * - Next Active stop (isNextActive): pulsing bright indigo pin (38x48px) with outer radar ring & sequence number
 * - Pending stops: vibrant emerald pin (34x44px) with priority accent ring & sequence number
 */
export function createStatusStopIcon(
  stop: RouteStop,
  index: number,
  isSelected: boolean = false,
  isNextActive: boolean = false
): L.DivIcon {
  const isDepot = Boolean(stop.isDepot || stop.orderReference === 'DEPOT' || stop.deliveryId === 'DEPOT');

  if (isDepot) {
    return L.divIcon({
      className: 'custom-depot-marker',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -22],
      html: `
        <div style="position:relative; width:40px; height:40px; display:flex; align-items:center; justify-content:center;">
          <div style="position:absolute; width:38px; height:38px; background:#d97706; border-radius:10px; transform:rotate(45deg); box-shadow:0 4px 10px rgba(217,119,6,0.4); border:2.5px solid #ffffff;"></div>
          <div style="position:relative; z-index:2; color:#ffffff; font-weight:800; font-size:10px; font-family:sans-serif; text-transform:uppercase; letter-spacing:0.5px;">HUB</div>
        </div>
      `,
    });
  }

  const rawStatus = String(stop.status || 'PENDING').toUpperCase();
  const sequenceNum = stop.sequenceOrder || stop.sequence || index + 1;
  const safeSequence = escapeHtml(String(sequenceNum));
  const priority = escapeHtml(String(stop.priority || '')).toLowerCase();
  const scale = isSelected ? 'transform: scale(1.15); z-index: 1000;' : '';

  // 1. Completed Stop (D-07): Small flat dimmed grey dot with checkmark
  if (rawStatus === 'COMPLETED') {
    return L.divIcon({
      className: 'custom-stop-completed',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -10],
      html: `
        <div style="position:relative; width:20px; height:20px; border-radius:50%; background:#64748b; opacity:0.75; border:2px solid #ffffff; box-shadow:0 2px 5px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; ${scale} transition:transform 0.15s ease;">
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      `,
    });
  }

  // 2. Cancelled or Failed Stop (D-08): Bold red pin with diagonal slash-through
  if (rawStatus === 'FAILED' || rawStatus === 'CANCELLED') {
    return L.divIcon({
      className: 'custom-stop-cancelled',
      iconSize: [34, 44],
      iconAnchor: [17, 42],
      popupAnchor: [0, -42],
      html: `
        <div style="position:relative; width:34px; height:44px; ${scale} transition:transform 0.15s ease;">
          <svg viewBox="0 0 34 44" width="34" height="44" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <path d="M17 0 C7.6 0 0 7.6 0 17 C0 29.8 17 44 17 44 C17 44 34 29.8 34 17 C34 7.6 26.4 0 17 0 Z" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
          </svg>
          <div style="position:absolute; top:4px; left:4px; width:26px; height:26px; background:#b91c1c; border-radius:50%; display:flex; align-items:center; justify-content:center; border:1.5px solid #ffffff;">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </div>
        </div>
      `,
    });
  }

  // 3. Next Active Stop (D-09): Pulsing bright indigo pin with outer radar circle
  if (isNextActive) {
    return L.divIcon({
      className: 'custom-stop-next-active',
      iconSize: [38, 48],
      iconAnchor: [19, 46],
      popupAnchor: [0, -46],
      html: `
        <div style="position:relative; width:38px; height:48px; ${scale} transition:transform 0.15s ease; display:flex; align-items:center; justify-content:center;">
          <!-- Radar Pulse Ring -->
          <span style="position:absolute; top:-6px; left:-6px; width:50px; height:50px; border-radius:50%; background:rgba(99,102,241,0.35); animation:ping 2s cubic-bezier(0,0,0.2,1) infinite; z-index:0;"></span>
          <svg viewBox="0 0 34 44" width="38" height="48" style="position:relative; z-index:1; filter: drop-shadow(0 3px 6px rgba(99,102,241,0.5));">
            <path d="M17 0 C7.6 0 0 7.6 0 17 C0 29.8 17 44 17 44 C17 44 34 29.8 34 17 C34 7.6 26.4 0 17 0 Z" fill="#6366f1" stroke="#ffffff" stroke-width="2"/>
          </svg>
          <div style="position:absolute; top:5px; left:6px; z-index:2; width:26px; height:26px; background:#4f46e5; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#ffffff; font-weight:700; font-size:12px; font-family:monospace; border:2px solid #ffffff;">
            ${safeSequence}
          </div>
        </div>
      `,
    });
  }

  // 4. Standard Pending Stop (D-09): Vibrant emerald pin with sequence number
  let priorityRing = '';
  if (priority.includes('cold') || priority.includes('chain')) {
    priorityRing = 'border: 2px solid #06b6d4;';
  } else if (priority.includes('urgent')) {
    priorityRing = 'border: 2px solid #f97316;';
  }

  return L.divIcon({
    className: 'custom-stop-pending',
    iconSize: [34, 44],
    iconAnchor: [17, 42],
    popupAnchor: [0, -42],
    html: `
      <div style="position:relative; width:34px; height:44px; ${scale} transition:transform 0.15s ease;">
        <svg viewBox="0 0 34 44" width="34" height="44" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));">
          <path d="M17 0 C7.6 0 0 7.6 0 17 C0 29.8 17 44 17 44 C17 44 34 29.8 34 17 C34 7.6 26.4 0 17 0 Z" fill="${isSelected ? '#312e81' : '#10b981'}" stroke="#ffffff" stroke-width="2"/>
        </svg>
        <div style="position:absolute; top:4px; left:4px; width:26px; height:26px; background:#059669; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#ffffff; font-weight:600; font-size:11px; font-family:monospace; ${priorityRing}">
          ${safeSequence}
        </div>
      </div>
    `,
  });
}

export interface WarehouseHubIconOptions {
  name: string;
  code?: string;
  isCanonical?: boolean;
}

/**
 * Generates an L.divIcon representing a warehouse / logistics hub marker (D-04, T-28-11):
 * - Stylized warehouse facility box with roof and bay doors SVG glyph
 * - Canonical primary hub badge indicator in gold
 * - High contrast styling with escapeHtml sanitization
 */
export function createWarehouseHubIcon(
  hub: WarehouseHubIconOptions,
  isSelected: boolean = false
): L.DivIcon {
  const safeName = escapeHtml(hub.name || 'Warehouse Hub');
  const safeCode = escapeHtml(hub.code || 'HUB');
  const isCanonical = Boolean(hub.isCanonical);
  const scale = isSelected ? 'transform: scale(1.15);' : '';
  const ringColor = isCanonical ? '#f59e0b' : '#3b82f6';
  const bgColor = isCanonical ? '#78350f' : '#1e3a8a';

  const canonicalBadge = isCanonical
    ? `<div data-testid="canonical-gold-badge" class="canonical-gold-badge" style="position:absolute; top:-5px; right:-5px; width:18px; height:18px; border-radius:50%; background:#f59e0b; border:2px solid #ffffff; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.4); z-index:10;" title="Primary Canonical Hub">
        <svg viewBox="0 0 24 24" width="10" height="10" stroke="#ffffff" stroke-width="2.5" fill="#f59e0b" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      </div>`
    : '';

  return L.divIcon({
    className: 'custom-warehouse-hub-marker',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
    html: `
      <div data-testid="warehouse-hub-container" class="warehouse-hub-container ${isCanonical ? 'canonical-hub' : ''} dark:shadow-obsidian-900" style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center; ${scale} transition:transform 0.2s ease;">
        ${canonicalBadge}
        <!-- Stylized Warehouse / Facility Building Pin -->
        <div data-testid="warehouse-facility-box" class="warehouse-facility-box" style="position:relative; width:40px; height:40px; border-radius:10px; background:${bgColor}; border:2.5px solid ${ringColor}; box-shadow:0 4px 12px rgba(0,0,0,0.35); display:flex; flex-direction:column; align-items:center; justify-content:center; overflow:hidden;" title="${safeName}">
          <!-- Warehouse SVG Glyph -->
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));">
            <!-- Roof & Building structure -->
            <path d="M3 9l9-6 9 6v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"></path>
            <!-- Warehouse bay doors -->
            <polyline points="9 21 9 12 15 12 15 21"></polyline>
          </svg>
          <span data-testid="warehouse-code-label" style="font-size:7.5px; font-weight:800; color:#ffffff; font-family:monospace; letter-spacing:0.3px; line-height:1; margin-top:1px; max-width:34px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${safeCode}
          </span>
        </div>
      </div>
    `,
  });
}


