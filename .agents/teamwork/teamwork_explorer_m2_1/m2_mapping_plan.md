# Milestone 2 Technical Specification: Mapping & Distance Matrix Subsystem

**Document Version:** 1.0.0  
**Target Subsystem:** Mapping & Distance Matrix Services (`server/src/services/mapping/`)  
**Milestone:** M2 — Mapping, Matrix Services & Route Optimization Engine  
**Author:** `teamwork_explorer_m2_1`  
**Status:** DESIGN & IMPLEMENTATION BLUEPRINT  

---

## 1. Executive Summary & Architectural Overview

The SmartRoute platform requires an enterprise-grade, deterministic, and highly resilient **Distance and Duration Matrix Engine** to power subsequent route optimization algorithms (Nearest-Neighbor, Bounded 2-Opt, Multi-Vehicle Bin-Packing, and Fuel Scoring).

The mapping subsystem is designed around a **Dual-Mode Architecture**:
1. **Primary Provider (Production Online Mode)**: Google Maps Distance Matrix API client with configurable timeout (5000ms), automatic matrix chunking for queries exceeding 100 elements, exponential backoff for transient network errors, and in-memory TTL caching.
2. **Deterministic Fallback Provider (Offline & Simulation Mode)**: A high-precision mathematical model using the exact **Haversine formula** ($R = 6371$ km) adjusted by an **urban road curvature factor of 1.35x**, a **base urban speed of 25 km/h** for Bhubaneswar traffic conditions, and **5 realistic traffic scenarios** with exact time multipliers (`FREE_FLOW` 1.0x, `MORNING_RUSH` 1.8x, `EVENING_PEAK` 2.2x, `MONSOON_RAIN` 1.5x, `WEEKEND` 1.1x).
3. **In-Memory Matrix Cache (`matrixCache.js`)**: High-performance, memory-bounded (LRU eviction, max 10,000 entries) distance matrix cache with a 1-hour TTL (3,600,000 ms) and coordinate normalization (5 decimal places, ~1.1m precision) that prevents redundant network calls, accelerates repeated optimization sweeps, and operates uniformly across providers.

### Key Architectural Invariants
- **Zero Hard Failures**: If `GOOGLE_MAPS_API_KEY` is missing, invalid, rate-limited (`OVER_QUERY_LIMIT`), or the API request times out, the system **never throws an unhandled rejection** or crashes the optimizer. It transparently falls back to `simulatedTrafficService.js` and annotates the response metadata with `source: 'SIMULATED'`.
- **Contract Uniformity**: Both Google Maps and the Simulated Traffic service output the identical interface contract (`IMappingService.getDistanceMatrix`), returning both raw Google-compatible row/element envelopes and dense two-dimensional lookup matrices (`matrix[i][j]`).
- **Deterministic Testing**: Testing and benchmarking suites can enforce deterministic simulation by passing `{ forceSimulation: true }` or specifying discrete traffic scenarios, guaranteeing reproducible optimization benchmark runs.

---

## 2. Canonical Bhubaneswar Coordinates & Mathematical Ground Truth

### 2.1 Canonical Depot & Delivery Clusters
All distances and travel times are anchored to the canonical logistics depot and 5 operational delivery clusters defined in `server/src/config/constants.js` and `server/src/seed/seedBhubaneswar.js`:

| Node / Cluster | Role / Zone | Latitude (°N) | Longitude (°E) | Landmark Anchor |
|---|---|---|---|---|
| **Rasulgarh Logistics Hub** | Central Depot (`CANONICAL_DEPOT`) | `20.2961` | `85.8645` | Plot 104/A, Rasulgarh Industrial Estate |
| **Saheed Nagar** | Delivery Cluster (`Z-3`) | `20.2880` | `85.8520` | Bhawani Mall / Janpath Boulevard |
| **Jaydev Vihar / Nayapalli** | Delivery Cluster (`Z-2`) | `20.3010` | `85.8230` | Mayfair Lagoon / Fortune Tower / IRC Village |
| **Patia / KIIT** | Delivery Cluster (`Z-1`) | `20.3540` | `85.8170` | KIIT Square / Infocity Avenue |
| **Khandagiri** | Delivery Cluster (`Z-4`) | `20.2580` | `85.7870` | Khandagiri Foothill / Baramunda Bus Terminal |
| **Old Town (Lingaraj Area)** | Delivery Cluster (South Sector) | `20.2382` | `85.8338` | Lingaraj Temple Heritage Corridor |
| **Chandrasekharpur** | North Corridor | `20.3250` | `85.8180` | Damana Square / Sailashree Vihar |

### 2.2 Mathematical Formulas

#### A. Haversine Great-Circle Distance
Given two points $P_1(\text{lat}_1, \text{lng}_1)$ and $P_2(\text{lat}_2, \text{lng}_2)$:
$$\text{toRad}(\theta) = \frac{\theta \cdot \pi}{180}$$
$$\Delta\phi = \text{toRad}(\text{lat}_2 - \text{lat}_1),\quad \Delta\lambda = \text{toRad}(\text{lng}_2 - \text{lng}_1)$$
$$\phi_1 = \text{toRad}(\text{lat}_1),\quad \phi_2 = \text{toRad}(\text{lat}_2)$$
$$a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1) \cdot \cos(\phi_2) \cdot \sin^2\left(\frac{\Delta\lambda}{2}\right)$$
$$c = 2 \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1 - a}\right)$$
$$d_{\text{haversine}} = R \cdot c \quad (\text{where Earth Radius } R = 6371.0 \text{ km})$$

*Floating-point guard:* $a$ is clamped to $[0, 1]$ before evaluating `Math.atan2` to prevent `NaN` on antipodal points.

#### B. Urban Road Curvature Expansion
In Bhubaneswar's urban topography (ring roads, railway bifurcations, flyovers, drainage canal crossings), road networks follow tortuous trajectories rather than Euclidean great circles:
$$\text{CURVATURE\_FACTOR} = 1.35$$
$$d_{\text{road}} = d_{\text{haversine}} \times 1.35 \quad (\text{km})$$
$$d_{\text{meters}} = \text{round}(d_{\text{road}} \times 1000) \quad (\text{meters})$$

#### C. Travel Duration & Scenario Multipliers
- **Base Urban Speed**: $v_{\text{base}} = 25.0 \text{ km/h}$
- **Base Travel Duration**:
  $$t_{\text{base\_hours}} = \frac{d_{\text{road}}}{25.0}$$
  $$t_{\text{base\_seconds}} = \text{round}\left(t_{\text{base\_hours}} \times 3600\right) = \text{round}\left(d_{\text{road}} \times 144.0\right)$$
- **Scenario Multiplier Function**:
  $$t_{\text{scenario\_seconds}} = \text{round}(t_{\text{base\_seconds}} \times M_{\text{scenario}})$$
  $$t_{\text{scenario\_minutes}} = \frac{t_{\text{scenario\_seconds}}}{60.0}$$

| Scenario Key | Description & Operational Hours | Multiplier $M$ | Effective Speed ($v$) |
|---|---|---|---|
| `FREE_FLOW` | Off-peak night & early morning (22:00 - 06:00) | **1.0x** | $25.00$ km/h |
| `MORNING_RUSH` | Commuter & school peak (08:30 - 11:30) | **1.8x** | $13.89$ km/h |
| `EVENING_PEAK` | Congested market & arterial flow (17:00 - 20:30) | **2.2x** | $11.36$ km/h |
| `MONSOON_RAIN` | Waterlogging at Nayapalli/Bomikhal canals | **1.5x** | $16.67$ km/h |
| `WEEKEND` | Retail & commercial leisure traffic | **1.1x** | $22.73$ km/h |

### 2.3 Reference Distance Matrix & Ground Truth Calibration

The following table provides verified baseline calculations between the central **Rasulgarh Depot** and the cluster centroids:

| Destination Cluster | Haversine ($d_h$) | Road Dist ($1.35 \times d_h$) | Free Flow (1.0x) | Morning Rush (1.8x) | Evening Peak (2.2x) | Monsoon (1.5x) | Weekend (1.1x) |
|---|---|---|---|---|---|---|---|
| **Saheed Nagar** | $1.5845$ km ($1585$m) | $2.1391$ km ($2139$m) | $5.13$ min ($308$s) | $9.24$ min ($554$s) | $11.29$ min ($678$s) | $7.70$ min ($462$s) | $5.65$ min ($339$s) |
| **Jaydev Vihar** | $4.3622$ km ($4362$m) | $5.8889$ km ($5889$m) | $14.13$ min ($848$s) | $25.44$ min ($1526$s) | $31.09$ min ($1866$s) | $21.20$ min ($1272$s) | $15.55$ min ($933$s) |
| **Patia / KIIT** | $8.1229$ km ($8123$m) | $10.9659$ km ($10966$m) | $26.32$ min ($1579$s) | $47.37$ min ($2842$s) | $57.90$ min ($3474$s) | $39.48$ min ($2369$s) | $28.95$ min ($1737$s) |
| **Khandagiri** | $9.1264$ km ($9126$m) | $12.3207$ km ($12321$m) | $29.57$ min ($1774$s) | $53.23$ min ($3194$s) | $65.05$ min ($3903$s) | $44.35$ min ($2661$s) | $32.53$ min ($1952$s) |
| **Old Town** | $7.1906$ km ($7191$m) | $9.7074$ km ($9707$m) | $23.30$ min ($1398$s) | $41.94$ min ($2516$s) | $51.25$ min ($3075$s) | $34.95$ min ($2097$s) | $25.63$ min ($1538$s) |
| **Chandrasekharpur** | $5.8173$ km ($5817$m) | $7.8533$ km ($7853$m) | $18.85$ min ($1131$s) | $33.93$ min ($2036$s) | $41.47$ min ($2488$s) | $28.27$ min ($1696$s) | $20.73$ min ($1244$s) |

---

## 3. Subsystem Architecture & File Layout

```
server/src/
├── config/
│   ├── constants.js               # Enriched with TRAFFIC_SCENARIOS, TRAFFIC_MULTIPLIERS, MAPPING_CONSTANTS
│   └── env.js                     # Enriched with GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_TIMEOUT_MS
└── services/
    └── mapping/
        ├── index.js               # Unified IMappingService facade
        ├── matrixCache.js         # In-memory LRU matrix cache with 1h TTL and metric counters
        ├── simulatedTrafficService.js # Haversine + 1.35x curvature + 5 traffic scenarios engine
        └── googleMapsService.js   # Dual-mode Google Maps client with timeout, retry, backoff & fallback
```

---

## 4. Detailed Component Technical Specifications

### 4.1 Constants & Environment Updates

#### `server/src/config/constants.js` Additions:
```javascript
const TRAFFIC_SCENARIOS = {
  FREE_FLOW: 'FREE_FLOW',
  MORNING_RUSH: 'MORNING_RUSH',
  EVENING_PEAK: 'EVENING_PEAK',
  MONSOON_RAIN: 'MONSOON_RAIN',
  WEEKEND: 'WEEKEND',
};

const TRAFFIC_MULTIPLIERS = {
  FREE_FLOW: 1.0,
  MORNING_RUSH: 1.8,
  EVENING_PEAK: 2.2,
  MONSOON_RAIN: 1.5,
  WEEKEND: 1.1,
};

const MAPPING_CONSTANTS = {
  EARTH_RADIUS_KM: 6371.0,
  URBAN_ROAD_CURVATURE_FACTOR: 1.35,
  BHUBANESWAR_BASE_SPEED_KMH: 25.0,
  DEFAULT_CACHE_TTL_MS: 3600000, // 1 hour
  CACHE_MAX_ENTRIES: 10000,
  CACHE_SWEEP_INTERVAL_MS: 300000, // 5 minutes
  GOOGLE_MAPS_TIMEOUT_MS: 5000,
  GOOGLE_MAPS_MAX_ELEMENTS: 100, // Google Distance Matrix element limit per sub-request
  GOOGLE_MAPS_MAX_RETRIES: 2,
};
```

#### `server/src/config/env.js` Additions:
```javascript
// Add to env export:
GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || '',
GOOGLE_MAPS_TIMEOUT_MS: parseInt(process.env.GOOGLE_MAPS_TIMEOUT_MS, 10) || 5000,
```

---

### 4.2 In-Memory Matrix Cache (`server/src/services/mapping/matrixCache.js`)

#### Responsibilities:
1. Store pairwise distance and duration calculations with an expiration timestamp (`expiresAt = Date.now() + ttlMs`).
2. Coordinate normalization: Round latitude and longitude to 5 decimal places (`p.lat.toFixed(5)`), ensuring that GPS sensor micro-jitter or database float conversions map to the identical cache entry.
3. LRU Eviction & Memory Bounds: Maintain an entry limit (`maxSize = 10,000`). When capacity is reached, stale entries are purged first; if still at capacity, the entry with the oldest `lastAccessedAt` is evicted.
4. Sweeper: A background unreferenced interval sweeps expired keys every 5 minutes.
5. Cache Statistics: Tracks `hits`, `misses`, `evictions`, and `expirations`.

#### Key Specification:
```javascript
class MatrixCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 10000;
    this.defaultTtlMs = options.ttlMs || 3600000; // 1 hour
    this.store = new Map(); // key -> { value, expiresAt, lastAccessedAt }
    this.stats = { hits: 0, misses: 0, evictions: 0, expirations: 0 };

    // Sweep timer that doesn't block Node process exit
    this.sweepInterval = setInterval(() => this.sweep(), 300000).unref();
  }

  // Key format: lat1,lng1:lat2,lng2:scenario
  formatKey(origin, destination, scenario = 'FREE_FLOW') {
    const o = this.normalizeCoord(origin);
    const d = this.normalizeCoord(destination);
    return `${o.lat.toFixed(5)},${o.lng.toFixed(5)}:${d.lat.toFixed(5)},${d.lng.toFixed(5)}:${scenario}`;
  }

  normalizeCoord(pt) {
    if (Array.isArray(pt) && pt.length >= 2) return { lat: Number(pt[1]), lng: Number(pt[0]) };
    if (pt.latitude !== undefined && pt.longitude !== undefined) return { lat: Number(pt.latitude), lng: Number(pt.longitude) };
    return { lat: Number(pt.lat), lng: Number(pt.lng) };
  }

  get(origin, destination, scenario) {
    const key = this.formatKey(origin, destination, scenario);
    const entry = this.store.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.stats.expirations++;
      this.stats.misses++;
      return null;
    }
    entry.lastAccessedAt = Date.now();
    this.stats.hits++;
    return entry.value;
  }

  set(origin, destination, scenario, value, ttlMs = this.defaultTtlMs) {
    if (this.store.size >= this.maxSize) {
      this.evictOne();
    }
    const key = this.formatKey(origin, destination, scenario);
    const now = Date.now();
    this.store.set(key, {
      value,
      expiresAt: now + ttlMs,
      lastAccessedAt: now,
    });
  }

  evictOne() {
    this.sweep();
    if (this.store.size < this.maxSize) return;

    // Evict least recently accessed entry
    let oldestKey = null;
    let oldestAccess = Infinity;
    for (const [key, entry] of this.store.entries()) {
      if (entry.lastAccessedAt < oldestAccess) {
        oldestAccess = entry.lastAccessedAt;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      this.store.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  sweep() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        this.stats.expirations++;
      }
    }
  }

  clear() {
    this.store.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0, expirations: 0 };
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.store.size,
      hitRatio: total > 0 ? parseFloat((this.stats.hits / total).toFixed(4)) : 0.0,
    };
  }
}
```

---

### 4.3 Simulated Traffic Service (`server/src/services/mapping/simulatedTrafficService.js`)

#### Responsibilities:
1. Calculate exact Haversine great-circle distance between two geographic coordinates with $R = 6371.0$ km.
2. Apply the urban road curvature factor of 1.35x.
3. Compute travel durations according to 25 km/h base speed and 5 discrete traffic scenarios.
4. Build full $N \times M$ distance and duration matrix.
5. Provide both rich matrix representation (`matrix[i][j]`) and Google Distance Matrix API-compatible envelope (`{ rows: [...], status: 'OK' }`).

#### Complete Module Specification:
```javascript
const {
  TRAFFIC_SCENARIOS,
  TRAFFIC_MULTIPLIERS,
  MAPPING_CONSTANTS,
} = require('../../config/constants');
const matrixCache = require('./matrixCache');

/**
 * Normalizes input coordinates from various shapes:
 * - { lat, lng }
 * - { latitude, longitude }
 * - [lng, lat] (GeoJSON Point format)
 * @param {Object|Array} coord
 * @returns {{lat: number, lng: number}}
 */
function normalizeCoord(coord) {
  if (!coord) {
    throw new Error('Coordinate is null or undefined');
  }
  if (Array.isArray(coord) && coord.length >= 2) {
    const lng = Number(coord[0]);
    const lat = Number(coord[1]);
    if (isNaN(lat) || isNaN(lng)) throw new Error(`Invalid coordinate array: ${JSON.stringify(coord)}`);
    return { lat, lng };
  }
  const lat = coord.lat !== undefined ? Number(coord.lat) : Number(coord.latitude);
  const lng = coord.lng !== undefined ? Number(coord.lng) : Number(coord.longitude);
  if (isNaN(lat) || isNaN(lng)) {
    throw new Error(`Invalid coordinate object: ${JSON.stringify(coord)}`);
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error(`Coordinate values out of bounds: lat=${lat}, lng=${lng}`);
  }
  return { lat, lng };
}

/**
 * Exact Haversine formula calculation (Earth radius R = 6371 km).
 * @param {Object|Array} p1 - Origin
 * @param {Object|Array} p2 - Destination
 * @returns {number} Distance in kilometers
 */
function haversineDistance(p1, p2) {
  const c1 = normalizeCoord(p1);
  const c2 = normalizeCoord(p2);

  // Identical point fast-path
  if (c1.lat === c2.lat && c1.lng === c2.lng) {
    return 0.0;
  }

  const R = MAPPING_CONSTANTS.EARTH_RADIUS_KM;
  const toRad = Math.PI / 180;
  const dLat = (c2.lat - c1.lat) * toRad;
  const dLng = (c2.lng - c1.lng) * toRad;
  const lat1 = c1.lat * toRad;
  const lat2 = c2.lat * toRad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  // Clamp floating-point inaccuracies
  const clampedA = Math.min(1.0, Math.max(0.0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

  return R * c;
}

/**
 * Calculates road network distance by applying the urban road curvature factor (1.35x).
 * @param {Object|Array} p1
 * @param {Object|Array} p2
 * @returns {number} Road distance in kilometers
 */
function roadDistance(p1, p2) {
  const hDist = haversineDistance(p1, p2);
  if (hDist === 0) return 0.0;
  return hDist * MAPPING_CONSTANTS.URBAN_ROAD_CURVATURE_FACTOR;
}

/**
 * Calculates travel duration for a given road distance and traffic scenario.
 * @param {number} distanceKm - Road distance in km
 * @param {string} scenario - Traffic scenario key
 * @returns {{ durationSeconds: number, durationMinutes: number }}
 */
function calculateDuration(distanceKm, scenario = TRAFFIC_SCENARIOS.FREE_FLOW) {
  if (distanceKm <= 0) {
    return { durationSeconds: 0, durationMinutes: 0.0 };
  }
  const multiplier = TRAFFIC_MULTIPLIERS[scenario] !== undefined
    ? TRAFFIC_MULTIPLIERS[scenario]
    : TRAFFIC_MULTIPLIERS.FREE_FLOW;

  const baseSpeedKmh = MAPPING_CONSTANTS.BHUBANESWAR_BASE_SPEED_KMH;
  // duration in seconds = (distance / speed) * 3600 * multiplier
  const baseSeconds = (distanceKm / baseSpeedKmh) * 3600;
  const durationSeconds = Math.round(baseSeconds * multiplier);
  const durationMinutes = parseFloat((durationSeconds / 60).toFixed(2));

  return { durationSeconds, durationMinutes };
}

/**
 * Generates an N x M distance and duration matrix.
 * @param {Array<Object|Array>} origins
 * @param {Array<Object|Array>} destinations
 * @param {Object} options - { scenario, skipCache }
 * @returns {Promise<Object>} MatrixResult
 */
async function getDistanceMatrix(origins, destinations, options = {}) {
  if (!Array.isArray(origins) || origins.length === 0) {
    throw new Error('Origins must be a non-empty array');
  }
  if (!Array.isArray(destinations) || destinations.length === 0) {
    throw new Error('Destinations must be a non-empty array');
  }

  const scenario = options.scenario || TRAFFIC_SCENARIOS.FREE_FLOW;
  const skipCache = !!options.skipCache;

  const normOrigins = origins.map(normalizeCoord);
  const normDestinations = destinations.map(normalizeCoord);

  const matrix = [];
  const rows = [];

  for (let i = 0; i < normOrigins.length; i++) {
    const origin = normOrigins[i];
    const matrixRow = [];
    const elementRow = [];

    for (let j = 0; j < normDestinations.length; j++) {
      const destination = normDestinations[j];
      let cellData = null;

      if (!skipCache) {
        cellData = matrixCache.get(origin, destination, scenario);
      }

      if (!cellData) {
        const distKm = roadDistance(origin, destination);
        const distMeters = Math.round(distKm * 1000);
        const { durationSeconds, durationMinutes } = calculateDuration(distKm, scenario);

        cellData = {
          distanceMeters: distMeters,
          distanceKm: parseFloat(distKm.toFixed(3)),
          durationSeconds,
          durationMinutes,
          status: 'OK',
          source: 'SIMULATED',
        };

        if (!skipCache) {
          matrixCache.set(origin, destination, scenario, cellData);
        }
      }

      matrixRow.push(cellData);
      elementRow.push({
        distance: {
          text: `${cellData.distanceKm.toFixed(1)} km`,
          value: cellData.distanceMeters,
        },
        duration: {
          text: `${Math.ceil(cellData.durationMinutes)} mins`,
          value: cellData.durationSeconds,
        },
        status: cellData.status,
      });
    }

    matrix.push(matrixRow);
    rows.push({ elements: elementRow });
  }

  return {
    source: 'SIMULATED',
    scenario,
    origins: normOrigins,
    destinations: normDestinations,
    origin_addresses: normOrigins.map(o => `${o.lat},${o.lng}`),
    destination_addresses: normDestinations.map(d => `${d.lat},${d.lng}`),
    matrix,
    rows,
    status: 'OK',
  };
}

module.exports = {
  haversineDistance,
  roadDistance,
  calculateDuration,
  getDistanceMatrix,
  normalizeCoord,
};
```

---

### 4.4 Google Maps Service & Transparent Fallback Client (`server/src/services/mapping/googleMapsService.js`)

#### Responsibilities:
1. Check `matrixCache` prior to executing any network requests.
2. Verify presence of valid `GOOGLE_MAPS_API_KEY`. If unset, null, or empty string, immediately delegate to `simulatedTrafficService.js`.
3. Support query chunking: Google limits Distance Matrix calls to $\le 100$ elements per request. Matrices with $>100$ elements (e.g. 55 deliveries = 3,025 elements) are chunked into $10 \times 10$ batches, dispatched concurrently, and merged.
4. Transient failure retries: On timeouts (`ECONNABORTED`, 5000ms) or HTTP 5xx responses, execute up to 2 retries with exponential backoff (250ms, 750ms).
5. Quota / Permission graceful degradation: On `OVER_QUERY_LIMIT`, `OVER_DAILY_LIMIT`, or `REQUEST_DENIED`, log an operational warning and seamlessly fall back to `simulatedTrafficService.js`.
6. Element status reconciliation: If Google returns `NOT_FOUND` or `ZERO_RESULTS` for a specific coordinate pair, substitute that individual cell with the simulated traffic computation so route optimization remains unbroken.

#### Complete Module Specification:
```javascript
const axios = require('axios');
const matrixCache = require('./matrixCache');
const simulatedTrafficService = require('./simulatedTrafficService');
const { MAPPING_CONSTANTS, TRAFFIC_SCENARIOS } = require('../../config/constants');
const env = require('../../config/env');

const GOOGLE_API_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';

/**
 * Builds Google Distance Matrix request URL.
 */
function buildUrl(origins, destinations, key) {
  const format = pts => pts.map(p => `${p.lat},${p.lng}`).join('|');
  const params = new URLSearchParams({
    origins: format(origins),
    destinations: format(destinations),
    key,
    units: 'metric',
  });
  return `${GOOGLE_API_URL}?${params.toString()}`;
}

/**
 * Sleeps for ms (used in retry backoff).
 */
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Dispatches a single Google Distance Matrix API call with timeout and retries.
 */
async function fetchGoogleMatrixChunk(origins, destinations, apiKey, retries = MAPPING_CONSTANTS.GOOGLE_MAPS_MAX_RETRIES) {
  const url = buildUrl(origins, destinations, apiKey);
  let attempt = 0;
  let lastError = null;

  while (attempt <= retries) {
    try {
      const response = await axios.get(url, {
        timeout: env.GOOGLE_MAPS_TIMEOUT_MS || MAPPING_CONSTANTS.GOOGLE_MAPS_TIMEOUT_MS,
      });

      const data = response.data;
      if (data.status === 'OK') {
        return data;
      }

      // Check for unrecoverable quota / key errors -> immediately fail to fallback
      if (['OVER_QUERY_LIMIT', 'OVER_DAILY_LIMIT', 'REQUEST_DENIED'].includes(data.status)) {
        const err = new Error(`Google Maps API Quota/Auth Error: ${data.status}`);
        err.isQuotaError = true;
        err.code = data.status;
        throw err;
      }

      throw new Error(`Google Maps API error status: ${data.status}`);
    } catch (err) {
      lastError = err;
      if (err.isQuotaError) throw err; // Don't retry quota errors
      attempt++;
      if (attempt <= retries) {
        await sleep(attempt * 250);
      }
    }
  }

  throw lastError;
}

/**
 * Retrieves Distance Matrix with dual-mode fallback and caching.
 * @param {Array} origins
 * @param {Array} destinations
 * @param {Object} options - { scenario, forceSimulation, skipCache }
 * @returns {Promise<Object>}
 */
async function getDistanceMatrix(origins, destinations, options = {}) {
  const scenario = options.scenario || TRAFFIC_SCENARIOS.FREE_FLOW;
  const skipCache = !!options.skipCache;
  const forceSimulation = !!options.forceSimulation;

  const normOrigins = origins.map(simulatedTrafficService.normalizeCoord);
  const normDestinations = destinations.map(simulatedTrafficService.normalizeCoord);

  // 1. If forceSimulation or API key missing -> transparent simulation fallback
  const apiKey = env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (forceSimulation || !apiKey || apiKey.trim() === '' || apiKey === 'mock_key') {
    return simulatedTrafficService.getDistanceMatrix(normOrigins, normDestinations, options);
  }

  // 2. Cache evaluation: check if ALL pairs are already in cache
  if (!skipCache) {
    let allCached = true;
    const cachedMatrix = [];
    const cachedRows = [];

    for (let i = 0; i < normOrigins.length; i++) {
      const matrixRow = [];
      const elementRow = [];
      for (let j = 0; j < normDestinations.length; j++) {
        const hit = matrixCache.get(normOrigins[i], normDestinations[j], scenario);
        if (!hit) {
          allCached = false;
          break;
        }
        matrixRow.push(hit);
        elementRow.push({
          distance: { text: `${hit.distanceKm.toFixed(1)} km`, value: hit.distanceMeters },
          duration: { text: `${Math.ceil(hit.durationMinutes)} mins`, value: hit.durationSeconds },
          status: hit.status,
        });
      }
      if (!allCached) break;
      cachedMatrix.push(matrixRow);
      cachedRows.push({ elements: elementRow });
    }

    if (allCached) {
      return {
        source: 'CACHE',
        scenario,
        origins: normOrigins,
        destinations: normDestinations,
        origin_addresses: normOrigins.map(o => `${o.lat},${o.lng}`),
        destination_addresses: normDestinations.map(d => `${d.lat},${d.lng}`),
        matrix: cachedMatrix,
        rows: cachedRows,
        status: 'OK',
      };
    }
  }

  // 3. Query Google Distance Matrix with chunking if total elements > 100
  try {
    const originChunkSize = 10;
    const destChunkSize = 10;
    const fullMatrix = Array.from({ length: normOrigins.length }, () => new Array(normDestinations.length));
    const fullRows = Array.from({ length: normOrigins.length }, () => ({ elements: new Array(normDestinations.length) }));

    for (let i = 0; i < normOrigins.length; i += originChunkSize) {
      const originSub = normOrigins.slice(i, i + originChunkSize);
      for (let j = 0; j < normDestinations.length; j += destChunkSize) {
        const destSub = normDestinations.slice(j, j + destChunkSize);

        const chunkResult = await fetchGoogleMatrixChunk(originSub, destSub, apiKey);

        // Process chunk rows
        for (let rowIdx = 0; rowIdx < chunkResult.rows.length; rowIdx++) {
          const globalRow = i + rowIdx;
          const elements = chunkResult.rows[rowIdx].elements;

          for (let colIdx = 0; colIdx < elements.length; colIdx++) {
            const globalCol = j + colIdx;
            const el = elements[colIdx];
            const originCoord = normOrigins[globalRow];
            const destCoord = normDestinations[globalCol];

            let cellData;
            if (el.status === 'OK') {
              cellData = {
                distanceMeters: el.distance.value,
                distanceKm: parseFloat((el.distance.value / 1000).toFixed(3)),
                durationSeconds: el.duration.value,
                durationMinutes: parseFloat((el.duration.value / 60).toFixed(2)),
                status: 'OK',
                source: 'GOOGLE_MAPS',
              };
            } else {
              // Granular element fallback for ZERO_RESULTS or NOT_FOUND
              const simDistKm = simulatedTrafficService.roadDistance(originCoord, destCoord);
              const simDuration = simulatedTrafficService.calculateDuration(simDistKm, scenario);
              cellData = {
                distanceMeters: Math.round(simDistKm * 1000),
                distanceKm: parseFloat(simDistKm.toFixed(3)),
                durationSeconds: simDuration.durationSeconds,
                durationMinutes: simDuration.durationMinutes,
                status: 'FALLBACK_SIMULATED',
                source: 'SIMULATED',
              };
            }

            if (!skipCache) {
              matrixCache.set(originCoord, destCoord, scenario, cellData);
            }

            fullMatrix[globalRow][globalCol] = cellData;
            fullRows[globalRow].elements[globalCol] = {
              distance: { text: `${cellData.distanceKm.toFixed(1)} km`, value: cellData.distanceMeters },
              duration: { text: `${Math.ceil(cellData.durationMinutes)} mins`, value: cellData.durationSeconds },
              status: cellData.status,
            };
          }
        }
      }
    }

    return {
      source: 'GOOGLE_MAPS',
      scenario,
      origins: normOrigins,
      destinations: normDestinations,
      origin_addresses: normOrigins.map(o => `${o.lat},${o.lng}`),
      destination_addresses: normDestinations.map(d => `${d.lat},${d.lng}`),
      matrix: fullMatrix,
      rows: fullRows,
      status: 'OK',
    };
  } catch (err) {
    console.warn(`[GoogleMapsService] Network/Quota Error (${err.message}). Falling back to simulated traffic service.`);
    return simulatedTrafficService.getDistanceMatrix(normOrigins, normDestinations, options);
  }
}

module.exports = {
  getDistanceMatrix,
  buildUrl,
};
```

---

### 4.5 Unified Mapping Service Interface (`server/src/services/mapping/index.js`)

```javascript
const googleMapsService = require('./googleMapsService');
const simulatedTrafficService = require('./simulatedTrafficService');
const matrixCache = require('./matrixCache');
const { TRAFFIC_SCENARIOS, TRAFFIC_MULTIPLIERS, MAPPING_CONSTANTS } = require('../../config/constants');

module.exports = {
  // Main Distance Matrix API
  getDistanceMatrix: googleMapsService.getDistanceMatrix,

  // Direct Simulated Distance & Duration Computations
  haversineDistance: simulatedTrafficService.haversineDistance,
  roadDistance: simulatedTrafficService.roadDistance,
  calculateDuration: simulatedTrafficService.calculateDuration,
  normalizeCoord: simulatedTrafficService.normalizeCoord,

  // Cache Operations
  clearCache: () => matrixCache.clear(),
  getCacheStats: () => matrixCache.getStats(),

  // Enums & Constants
  TRAFFIC_SCENARIOS,
  TRAFFIC_MULTIPLIERS,
  MAPPING_CONSTANTS,
};
```

---

## 5. Comprehensive Test Specification & Test Cases

The test suite must be co-located under `server/tests/` and cover all functional boundaries, mathematical tolerances, and fault scenarios.

### 5.1 Test Suite 1: Simulated Traffic & Mathematical Invariants (`server/tests/unit/simulatedTrafficService.test.js`)

| Test ID | Test Category | Invariant / Precondition | Expected Output / Assertion |
|---|---|---|---|
| `TC-SIM-HAV-1` | Haversine Zero Distance | Origin and destination at identical coordinate (e.g. `20.2961, 85.8645`) | Returns exactly `0.0` km |
| `TC-SIM-HAV-2` | Equator 1-Degree Arc | Coordinates `(0.0, 0.0)` to `(0.0, 1.0)` on equator | Haversine distance $= 111.195 \pm 0.05$ km ($R \times \frac{\pi}{180}$) |
| `TC-SIM-HAV-3` | Cross-Hemisphere Arc | Pole to pole `(90, 0)` to `(-90, 0)` | Haversine distance $= 20015.08 \pm 1.0$ km ($\pi \times R$) |
| `TC-SIM-HAV-4` | Canonical Rasulgarh $\to$ Saheed Nagar | `(20.2961, 85.8645)` to `(20.2880, 85.8520)` | Haversine distance $= 1.5845 \pm 0.005$ km ($1585$ m) |
| `TC-SIM-HAV-5` | Canonical Rasulgarh $\to$ Patia KIIT | `(20.2961, 85.8645)` to `(20.3540, 85.8170)` | Haversine distance $= 8.1229 \pm 0.005$ km ($8123$ m) |
| `TC-SIM-HAV-6` | Canonical Rasulgarh $\to$ Khandagiri | `(20.2961, 85.8645)` to `(20.2580, 85.7870)` | Haversine distance $= 9.1264 \pm 0.005$ km ($9126$ m) |
| `TC-SIM-CURV-1` | Curvature Multiplier Check | Compare `roadDistance` to `haversineDistance` | `roadDistance` is strictly `1.35 * haversineDistance` |
| `TC-SIM-CURV-2` | Canonical Road Distances | Check road distances for Saheed Nagar, Patia, Khandagiri | Saheed Nagar $\approx 2.139$ km; Patia $\approx 10.966$ km; Khandagiri $\approx 12.321$ km |
| `TC-SIM-BASE-1` | Base Velocity Check | Urban speed $= 25.0$ km/h | Base travel time $= (\text{roadDistance} / 25.0) \times 3600$ seconds |
| `TC-SIM-SCEN-1` | `FREE_FLOW` Scenario | Multiplier = 1.0 | Duration matches baseDuration * 1.0 ($308$s for Saheed Nagar) |
| `TC-SIM-SCEN-2` | `MORNING_RUSH` Scenario | Multiplier = 1.8 | Duration is baseDuration * 1.8 ($554$s for Saheed Nagar, $2842$s for Patia) |
| `TC-SIM-SCEN-3` | `EVENING_PEAK` Scenario | Multiplier = 2.2 | Duration is baseDuration * 2.2 ($678$s for Saheed Nagar, $3474$s for Patia) |
| `TC-SIM-SCEN-4` | `MONSOON_RAIN` Scenario | Multiplier = 1.5 | Duration is baseDuration * 1.5 ($462$s for Saheed Nagar, $2369$s for Patia) |
| `TC-SIM-SCEN-5` | `WEEKEND` Scenario | Multiplier = 1.1 | Duration is baseDuration * 1.1 ($339$s for Saheed Nagar, $1737$s for Patia) |
| `TC-SIM-INPUT-1` | Coordinate Normalization | Pass `{lat, lng}`, `{latitude, longitude}`, and `[lng, lat]` | All return identical distance and duration values |
| `TC-SIM-INPUT-2` | Boundary Validation | Pass invalid coordinates (e.g. `lat: 95`) | Throws descriptive error `Coordinate values out of bounds` |
| `TC-SIM-MAT-1` | $N \times M$ Matrix Structure | 1 depot + 5 cluster centers ($6 \times 6$) | Matrix size $6 \times 6$; diagonal values all 0; symmetry holds ($d_{ij} = d_{ji}$) |

---

### 5.2 Test Suite 2: In-Memory Matrix Cache & Bounding (`server/tests/unit/matrixCache.test.js`)

| Test ID | Test Category | Precondition | Expected Output / Assertion |
|---|---|---|---|
| `TC-CAC-1` | Basic Put & Get | Set pair with value; call `get` | Returns exact value; `stats.hits` increments to 1 |
| `TC-CAC-2` | Coordinate Precision Rounding | Set with `20.296101, 85.864502`; get with `20.296104, 85.864501` | Returns cached value (5 decimal place normalization) |
| `TC-CAC-3` | Scenario Separation | Store pair under `FREE_FLOW`; get under `EVENING_PEAK` | Returns `null` (cache miss); `stats.misses` increments |
| `TC-CAC-4` | TTL Expiration | Set entry with `ttlMs: 50`; wait 60ms | Entry expires and returns `null`; `stats.expirations` increments |
| `TC-CAC-5` | LRU Eviction Under Max Bound | Initialize cache with `maxSize: 3`; insert 4 distinct pairs | Cache size remains $\le 3$; least recently accessed entry is evicted |
| `TC-CAC-6` | Cache Sweep | Manually invoke `cache.sweep()` on expired entries | Expired entries deleted; size reduced |
| `TC-CAC-7` | Cache Stats Accuracy | Perform 3 hits and 1 miss | `hitRatio` returns `0.75`; `size` and counters match |
| `TC-CAC-8` | Cache Reset | Invoke `cache.clear()` | `store` is empty; all stats reset to zero |

---

### 5.3 Test Suite 3: Google Maps Service & Fallback Resiliency (`server/tests/integration/googleMapsService.test.js`)

| Test ID | Test Category | Condition / Mock | Expected Behavior |
|---|---|---|---|
| `TC-GMS-FALL-1` | Unset API Key Fallback | `GOOGLE_MAPS_API_KEY` is undefined or empty string | Transparently returns simulated matrix with `source: 'SIMULATED'` |
| `TC-GMS-FALL-2` | Network Timeout Fallback | Axios mock rejects with `ECONNABORTED` (timeout) after retries | Logs warning, transparently returns simulated matrix (`source: 'SIMULATED'`) |
| `TC-GMS-FALL-3` | Quota Limit Fallback | Axios mock returns Google status `OVER_QUERY_LIMIT` | Transparently falls back to simulation without crashing |
| `TC-GMS-FALL-4` | Request Denied Fallback | Axios mock returns Google status `REQUEST_DENIED` | Transparently falls back to simulation |
| `TC-GMS-SUCC-1` | Normal Online Execution | Axios mock returns valid Google response with status `OK` | Returns `source: 'GOOGLE_MAPS'`, parses rows and elements correctly |
| `TC-GMS-CAC-1` | Cache Short-Circuit | Second identical call to `googleMapsService.getDistanceMatrix` | Returns `source: 'CACHE'`, Axios is NOT called on second invocation |
| `TC-GMS-CHUNK-1` | Large Matrix Chunking | Request matrix with $15 \times 10 = 150$ elements ($> 100$) | Chunks into $10 \times 10$ and $5 \times 10$ batches; accurately merges full $15 \times 10$ matrix |

---

## 6. Implementation Sequence & Next Steps for Implementation Worker

The implementation worker (`teamwork_worker_m2_1`) should proceed according to the following phased sequence:

1. **Phase 1: Configuration & Enums**
   - Update `server/src/config/constants.js` with `TRAFFIC_SCENARIOS`, `TRAFFIC_MULTIPLIERS`, `MAPPING_CONSTANTS`.
   - Update `server/src/config/env.js` with `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_TIMEOUT_MS`.
2. **Phase 2: In-Memory Matrix Cache**
   - Implement `server/src/services/mapping/matrixCache.js` with LRU eviction and 1h TTL.
   - Implement `server/tests/unit/matrixCache.test.js`.
3. **Phase 3: Simulated Traffic Service**
   - Implement `server/src/services/mapping/simulatedTrafficService.js` with Haversine, 1.35x curvature, and 5 traffic scenarios.
   - Implement `server/tests/unit/simulatedTrafficService.test.js`.
4. **Phase 4: Google Maps Dual-Mode Client & Fallback Engine**
   - Enhance `server/src/services/mapping/googleMapsService.js` with timeout, retries, chunking, and fallback.
   - Implement `server/src/services/mapping/index.js` facade.
   - Implement `server/tests/integration/googleMapsService.test.js`.
5. **Phase 5: Verification & Test Execution**
   - Run `npm test --workspace=server` to verify all new mapping tests pass and all 63 existing tests continue to pass without regressions.
