const { MAPPING_CONSTANTS, TRAFFIC_SCENARIOS } = require('../../config/constants');

class MatrixCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || MAPPING_CONSTANTS.CACHE_MAX_ENTRIES || 10000;
    this.defaultTtlMs = options.ttlMs || MAPPING_CONSTANTS.DEFAULT_CACHE_TTL_MS || 3600000; // 1 hour
    this.store = new Map(); // key -> { value, expiresAt, lastAccessedAt, lastAccessedSeq }
    this.stats = { hits: 0, misses: 0, evictions: 0, expirations: 0 };
    this.accessSeq = 0;

    const sweepIntervalMs = options.sweepIntervalMs || MAPPING_CONSTANTS.CACHE_SWEEP_INTERVAL_MS || 300000;
    // Sweep timer unref'd so it does not block Node process exit
    this.sweepInterval = setInterval(() => this.sweep(), sweepIntervalMs).unref();
  }

  normalizeCoord(pt) {
    if (!pt) {
      throw new Error('Coordinate is null or undefined');
    }
    if (Array.isArray(pt) && pt.length >= 2) {
      return { lat: Number(pt[1]), lng: Number(pt[0]) };
    }
    if (pt.latitude !== undefined && pt.longitude !== undefined) {
      return { lat: Number(pt.latitude), lng: Number(pt.longitude) };
    }
    return { lat: Number(pt.lat), lng: Number(pt.lng) };
  }

  // Key format: lat1,lng1:lat2,lng2:scenario (normalized to 5 decimal places)
  formatKey(origin, destination, scenario = TRAFFIC_SCENARIOS.FREE_FLOW) {
    const o = this.normalizeCoord(origin);
    const d = this.normalizeCoord(destination);
    return `${o.lat.toFixed(5)},${o.lng.toFixed(5)}:${d.lat.toFixed(5)},${d.lng.toFixed(5)}:${scenario}`;
  }

  get(origin, destination, scenario = TRAFFIC_SCENARIOS.FREE_FLOW) {
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
    // Refresh LRU order in Map (delete and re-insert)
    this.store.delete(key);
    this.store.set(key, entry);
    entry.lastAccessedAt = Date.now();
    entry.lastAccessedSeq = ++this.accessSeq;
    this.stats.hits++;
    return entry.value;
  }

  set(origin, destination, scenario, value, ttlMs = this.defaultTtlMs) {
    const key = this.formatKey(origin, destination, scenario);
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxSize) {
      this.evictOne();
    }
    const now = Date.now();
    this.store.set(key, {
      value,
      expiresAt: now + ttlMs,
      lastAccessedAt: now,
      lastAccessedSeq: ++this.accessSeq,
    });
  }

  evictOne() {
    this.sweep();
    if (this.store.size < this.maxSize) return;

    // O(1) LRU eviction: Map preserves insertion/refresh order, oldest is first
    const oldestKey = this.store.keys().next().value;
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

  destroy() {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
    }
    this.clear();
  }
}

const singleton = new MatrixCache();
singleton.MatrixCache = MatrixCache;

module.exports = singleton;
