const env = require('../../config/env');
const geoapifyService = require('./geoapify.service');
const googleMapsService = require('./googleMapsService');
const simulatedTrafficService = require('./simulatedTrafficService');

const CIRCUIT_STATES = Object.freeze({
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
});

/**
 * MappingProviderFactory
 * In-memory 3-state circuit breaker (CLOSED, OPEN, HALF_OPEN) wrapping Geoapify,
 * Google Maps, and simulated local traffic matrix per D-03.
 */
class MappingProviderFactory {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.timeoutMs = options.timeoutMs || 3500; // SLA <= 3500ms per D-03
    this.cooldownMs = options.cooldownMs || 30000; // 30s cooldown per D-03

    this.state = CIRCUIT_STATES.CLOSED;
    this.failureCount = 0;
    this.nextAttempt = 0;
  }

  /**
   * Returns current state, auto-evaluating cooldown transition to HALF_OPEN.
   */
  getState() {
    if (this.state === CIRCUIT_STATES.OPEN && Date.now() >= this.nextAttempt) {
      this.state = CIRCUIT_STATES.HALF_OPEN;
    }
    return this.state;
  }

  /**
   * Circuit breaker open evaluation.
   * If OPEN and cooldown elapsed -> transitions to HALF_OPEN (returns false to allow probe).
   * Otherwise returns true if OPEN (diverts immediately).
   */
  isOpen() {
    if (this.state === CIRCUIT_STATES.OPEN) {
      if (Date.now() >= this.nextAttempt) {
        this.state = CIRCUIT_STATES.HALF_OPEN;
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Trips circuit to OPEN.
   * On quota error: immediately trips without consuming retries.
   */
  trip(isQuota = false) {
    this.state = CIRCUIT_STATES.OPEN;
    this.nextAttempt = Date.now() + this.cooldownMs;
    this.failureCount = isQuota ? 0 : this.failureThreshold;
  }

  tripCircuit(isQuota = false) {
    return this.trip(isQuota);
  }

  /**
   * Resets breaker to CLOSED state with cleared counters.
   */
  reset() {
    this.state = CIRCUIT_STATES.CLOSED;
    this.failureCount = 0;
    this.nextAttempt = 0;
  }

  recordSuccess() {
    this.failureCount = 0;
    this.state = CIRCUIT_STATES.CLOSED;
    this.nextAttempt = 0;
  }

  recordFailure(isQuota = false) {
    if (isQuota || this.state === CIRCUIT_STATES.HALF_OPEN) {
      this.trip(isQuota);
      return;
    }
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.trip(false);
    }
  }

  _isQuotaError(err) {
    if (!err) return false;
    if (err.isQuotaError) return true;
    if (err.response?.status === 429 || err.code === 429 || err.status === 429) return true;
    const msg = (err.message || '').toString();
    const dataMsg = typeof err.response?.data === 'string'
      ? err.response.data
      : JSON.stringify(err.response?.data || '');
    return msg.includes('429') ||
      msg.includes('OVER_QUERY_LIMIT') ||
      msg.includes('OVER_DAILY_LIMIT') ||
      msg.includes('REQUEST_DENIED') ||
      dataMsg.includes('429') ||
      dataMsg.includes('OVER_QUERY_LIMIT');
  }

  /**
   * Retrieves Distance Matrix with 3-tier failover: Geoapify -> Google Maps -> Simulated.
   *
   * @param {Array} origins
   * @param {Array} destinations
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async getDistanceMatrix(origins, destinations, options = {}) {
    if (!Array.isArray(origins) || origins.length === 0) {
      throw new Error('Origins must be a non-empty array');
    }
    if (!Array.isArray(destinations) || destinations.length === 0) {
      throw new Error('Destinations must be a non-empty array');
    }

    const opts = options || {};

    // 1. If circuit is open or forceSimulation requested -> local simulation fallback
    if (this.isOpen() || opts.forceSimulation) {
      return simulatedTrafficService.getDistanceMatrix(origins, destinations, opts);
    }

    // 2. Try Primary: Geoapify with 3500ms timeout race
    const geoapifyKey = typeof geoapifyService.resolveGeoapifyApiKey === 'function'
      ? geoapifyService.resolveGeoapifyApiKey()
      : (env.GEOAPIFY_SERVER_API_KEY || process.env.GEOAPIFY_SERVER_API_KEY || process.env.GEOAPIFY_API_KEY);
    const isGeoapifyConfigured = env.isGeoapifyConfigured(geoapifyKey);

    if (isGeoapifyConfigured) {
      let timer = null;
      try {
        const timeoutPromise = new Promise((_, reject) => {
          timer = setTimeout(() => {
            const timeoutErr = new Error(`Geoapify timeout exceeded (${this.timeoutMs}ms)`);
            timeoutErr.code = 'ECONNABORTED';
            timeoutErr.isTimeout = true;
            reject(timeoutErr);
          }, this.timeoutMs);
        });

        const matrix = await Promise.race([
          geoapifyService.getDistanceMatrix(origins, destinations, { ...opts, throwOnError: true }),
          timeoutPromise,
        ]);

        if (timer) clearTimeout(timer);

        if (matrix && matrix.status === 'OK' && matrix.source === 'GEOAPIFY') {
          this.recordSuccess();
          return matrix;
        }

        // Response status wasn't OK or source not GEOAPIFY -> record failure
        this.recordFailure(false);
      } catch (err) {
        if (timer) clearTimeout(timer);
        const isQuota = this._isQuotaError(err);
        this.recordFailure(isQuota);
      }
    }

    // 3. Try Secondary: Google Maps (if configured and circuit not opened by primary failure)
    const googleKey = (env && env.GOOGLE_MAPS_API_KEY) || process.env.GOOGLE_MAPS_API_KEY;
    const isGoogleConfigured = Boolean(
      googleKey && googleKey.trim() !== '' && googleKey !== 'mock_key' && googleKey !== '__DELETED__'
    );

    if (isGoogleConfigured && !this.isOpen()) {
      try {
        const matrix = await googleMapsService.getDistanceMatrix(origins, destinations, opts);
        if (matrix && matrix.status === 'OK' && matrix.source === 'GOOGLE_MAPS') {
          if (this.state === CIRCUIT_STATES.HALF_OPEN) {
            this.recordSuccess();
          }
          return matrix;
        }
      } catch (err) {
        if (this._isQuotaError(err)) {
          this.recordFailure(true);
        }
      }
    }

    // 4. Deterministic Simulated Traffic Fallback
    return simulatedTrafficService.getDistanceMatrix(origins, destinations, opts);
  }
}

const singleton = new MappingProviderFactory();
singleton.MappingProviderFactory = MappingProviderFactory;
singleton.CIRCUIT_STATES = CIRCUIT_STATES;

module.exports = singleton;
