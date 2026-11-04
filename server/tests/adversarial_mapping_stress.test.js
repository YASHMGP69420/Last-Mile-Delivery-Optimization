/**
 * SmartRoute Last-Mile Delivery Platform - Milestone 2
 * Mapping, Distance Matrix & Traffic Simulation Subsystem
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE
 * Test File: server/tests/adversarial_mapping_stress.test.js
 * Author: teamwork_challenger_m2_2
 *
 * Objectives:
 * 1. Traffic Scenario Multipliers & Fallback
 * 2. Matrix Cache Correctness, Eviction & Expiry
 * 3. Resilience, Error Handling & Facade Fallbacks
 * 4. Haversine Extremes & Boundary Stress
 */

const axios = require('axios');
const mapping = require('../src/services/mapping');
const matrixCache = require('../src/services/mapping/matrixCache');
const simulatedTrafficService = require('../src/services/mapping/simulatedTrafficService');
const googleMapsService = require('../src/services/mapping/googleMapsService');
const {
  TRAFFIC_SCENARIOS,
  TRAFFIC_MULTIPLIERS,
  MAPPING_CONSTANTS,
  CANONICAL_DEPOT,
} = require('../src/config/constants');

describe('Empirical Adversarial Stress Test Suite: Mapping & Distance Matrix Subsystem', () => {
  const originalEnvKey = process.env.GOOGLE_MAPS_API_KEY;

  beforeEach(() => {
    if (originalEnvKey) {
      process.env.GOOGLE_MAPS_API_KEY = originalEnvKey;
    } else {
      delete process.env.GOOGLE_MAPS_API_KEY;
    }
    mapping.clearCache();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalEnvKey) {
      process.env.GOOGLE_MAPS_API_KEY = originalEnvKey;
    } else {
      delete process.env.GOOGLE_MAPS_API_KEY;
    }
    mapping.clearCache();
  });

  // =========================================================================
  // 1. TRAFFIC SCENARIO MULTIPLIERS & UNKNOWN FALLBACK
  // =========================================================================
  describe('1. Traffic Scenario Multipliers & Fallbacks', () => {
    const testDistanceKm = 10.0;
    // Base speed = 25 km/h -> 10 km takes (10 / 25) * 3600 = 1440 seconds = 24.0 minutes
    const baseExpectedSeconds = 1440;

    test('TC-ADV-MAP-TRAF-1: All 5 canonical traffic scenarios scale base durations deterministically', () => {
      const scenarios = [
        { key: 'FREE_FLOW', multiplier: 1.0, expectedSec: 1440, expectedMin: 24.0 },
        { key: 'MORNING_RUSH', multiplier: 1.8, expectedSec: 2592, expectedMin: 43.2 },
        { key: 'EVENING_PEAK', multiplier: 2.2, expectedSec: 3168, expectedMin: 52.8 },
        { key: 'MONSOON_RAIN', multiplier: 1.5, expectedSec: 2160, expectedMin: 36.0 },
        { key: 'WEEKEND', multiplier: 1.1, expectedSec: 1584, expectedMin: 26.4 },
      ];

      for (const sc of scenarios) {
        expect(TRAFFIC_MULTIPLIERS[sc.key]).toBe(sc.multiplier);
        const { durationSeconds, durationMinutes } = mapping.calculateDuration(testDistanceKm, sc.key);
        expect(durationSeconds).toBe(sc.expectedSec);
        expect(durationMinutes).toBeCloseTo(sc.expectedMin, 2);
      }

      // 100-cycle repetition to prove deterministic zero-jitter property
      for (let i = 0; i < 100; i++) {
        const morning = mapping.calculateDuration(testDistanceKm, TRAFFIC_SCENARIOS.MORNING_RUSH);
        expect(morning.durationSeconds).toBe(2592);
        const evening = mapping.calculateDuration(testDistanceKm, TRAFFIC_SCENARIOS.EVENING_PEAK);
        expect(evening.durationSeconds).toBe(3168);
      }
    });

    test('TC-ADV-MAP-TRAF-2: Unknown, invalid, and malformed scenario names gracefully fallback to FREE_FLOW (1.0x)', () => {
      const malformedScenarios = [
        'INVALID_SCENARIO',
        'CYCLONE_FANI',
        'SNOW_BLIZZARD',
        '',
        null,
        undefined,
        12345,
        {},
        [],
        'free_flow', // case sensitivity test
        'MORNING-RUSH', // hyphenated variant
      ];

      for (const badScenario of malformedScenarios) {
        const result = mapping.calculateDuration(testDistanceKm, badScenario);
        expect(result.durationSeconds).toBe(baseExpectedSeconds);
        expect(result.durationMinutes).toBe(24.0);
      }
    });

    test('TC-ADV-MAP-TRAF-3: Zero or negative distances deterministically return 0 seconds duration for any scenario', () => {
      const allScenarios = [...Object.keys(TRAFFIC_SCENARIOS), 'UNKNOWN_SCENARIO'];
      for (const sc of allScenarios) {
        const zeroRes = mapping.calculateDuration(0, sc);
        expect(zeroRes.durationSeconds).toBe(0);
        expect(zeroRes.durationMinutes).toBe(0.0);

        const negRes = mapping.calculateDuration(-5.5, sc);
        expect(negRes.durationSeconds).toBe(0);
        expect(negRes.durationMinutes).toBe(0.0);
      }
    });

    test('TC-ADV-MAP-TRAF-4: getDistanceMatrix integrates scenario multipliers in matrix output and rows envelope', async () => {
      const origins = [CANONICAL_DEPOT.geo];
      const destinations = [{ lat: 20.3540, lng: 85.8170 }]; // Patia KIIT (~10.966 km road dist)

      const freeFlowRes = await mapping.getDistanceMatrix(origins, destinations, {
        scenario: TRAFFIC_SCENARIOS.FREE_FLOW,
        skipCache: true,
      });
      const eveningRes = await mapping.getDistanceMatrix(origins, destinations, {
        scenario: TRAFFIC_SCENARIOS.EVENING_PEAK,
        skipCache: true,
      });

      expect(freeFlowRes.status).toBe('OK');
      expect(eveningRes.status).toBe('OK');

      const ffSec = freeFlowRes.matrix[0][0].durationSeconds;
      const evSec = eveningRes.matrix[0][0].durationSeconds;

      // Ratio should be close to 2.2 / 1.0 = 2.2
      const ratio = evSec / ffSec;
      expect(ratio).toBeCloseTo(2.2, 1);
      expect(eveningRes.rows[0].elements[0].duration.value).toBe(evSec);
    });
  });

  // =========================================================================
  // 2. MATRIX CACHE CORRECTNESS, EVICTION & EXPIRY
  // =========================================================================
  describe('2. Matrix Cache Correctness, Eviction & Expiry', () => {
    test('TC-ADV-MAP-CACHE-1: Coordinate normalization within 10^-5 degrees maps to identical cache key', () => {
      // 85.86450 vs 85.864504 (difference = 0.000004 < 10^-5 deg, ~0.44m)
      const p1 = { lat: 20.29610, lng: 85.86450 };
      const p1Jitter = { lat: 20.296103, lng: 85.864504 };

      const p2 = { lat: 20.28800, lng: 85.85200 };
      const p2Jitter = { lat: 20.288002, lng: 85.852004 };

      const key1 = matrixCache.formatKey(p1, p2, 'FREE_FLOW');
      const key2 = matrixCache.formatKey(p1Jitter, p2Jitter, 'FREE_FLOW');

      expect(key1).toBe('20.29610,85.86450:20.28800,85.85200:FREE_FLOW');
      expect(key2).toBe(key1);

      // Verify Cache Hit via normalized jittered coordinates
      matrixCache.set(p1, p2, 'FREE_FLOW', { distanceKm: 2.139, durationMinutes: 5.13 });
      const cachedHit = matrixCache.get(p1Jitter, p2Jitter, 'FREE_FLOW');
      expect(cachedHit).not.toBeNull();
      expect(cachedHit.distanceKm).toBe(2.139);
      expect(matrixCache.getStats().hits).toBe(1);
    });

    test('TC-ADV-MAP-CACHE-2: Coordinate input shape normalization across {lat,lng}, {latitude,longitude}, and [lng,lat]', () => {
      const pA1 = { lat: 20.2961, lng: 85.8645 };
      const pA2 = { latitude: 20.2961, longitude: 85.8645 };
      const pA3 = [85.8645, 20.2961]; // GeoJSON [lng, lat]

      const dest = { lat: 20.3010, lng: 85.8230 };

      const key1 = matrixCache.formatKey(pA1, dest, 'FREE_FLOW');
      const key2 = matrixCache.formatKey(pA2, dest, 'FREE_FLOW');
      const key3 = matrixCache.formatKey(pA3, dest, 'FREE_FLOW');

      expect(key1).toBe(key2);
      expect(key2).toBe(key3);
    });

    test('TC-ADV-MAP-CACHE-3: Bounded LRU Eviction — Evicts least recently accessed entry and retains active ones', () => {
      const smallCache = new matrixCache.MatrixCache({ maxSize: 5, ttlMs: 100000 });

      // Generate 5 entries
      const points = Array.from({ length: 6 }, (_, i) => ({
        lat: 20.20 + i * 0.01,
        lng: 85.80 + i * 0.01,
      }));

      // Insert E0, E1, E2, E3, E4
      for (let i = 0; i < 5; i++) {
        smallCache.set(points[i], points[i + 1], 'FREE_FLOW', { id: `entry-${i}` });
      }
      expect(smallCache.store.size).toBe(5);
      expect(smallCache.getStats().evictions).toBe(0);

      // Access E0, E2, E4 to update their recency (E1 and E3 remain untouched)
      // E1 is now the oldest untouched entry
      smallCache.get(points[0], points[1], 'FREE_FLOW');
      smallCache.get(points[2], points[3], 'FREE_FLOW');
      smallCache.get(points[4], points[5], 'FREE_FLOW');

      // Insert 6th entry (E5) -> should trigger LRU eviction of E1
      smallCache.set(points[1], points[3], 'FREE_FLOW', { id: 'entry-5' });

      expect(smallCache.store.size).toBe(5);
      expect(smallCache.getStats().evictions).toBe(1);

      // E1 should have been evicted
      expect(smallCache.get(points[1], points[2], 'FREE_FLOW')).toBeNull();

      // Touched entries E0, E2, E4 and newly inserted E5 MUST still exist
      expect(smallCache.get(points[0], points[1], 'FREE_FLOW')).not.toBeNull();
      expect(smallCache.get(points[2], points[3], 'FREE_FLOW')).not.toBeNull();
      expect(smallCache.get(points[4], points[5], 'FREE_FLOW')).not.toBeNull();
      expect(smallCache.get(points[1], points[3], 'FREE_FLOW')).not.toBeNull();

      smallCache.destroy();
    });

    test('TC-ADV-MAP-CACHE-4: High-throughput eviction stress test never exceeds maxSize', () => {
      const maxSize = 20;
      const stressCache = new matrixCache.MatrixCache({ maxSize, ttlMs: 100000 });

      // Insert 200 distinct coordinate pairs
      for (let i = 0; i < 200; i++) {
        const o = { lat: 20.0 + (i * 0.001), lng: 85.0 };
        const d = { lat: 20.1 + (i * 0.001), lng: 85.1 };
        stressCache.set(o, d, 'FREE_FLOW', { index: i });
      }

      const stats = stressCache.getStats();
      expect(stats.size).toBe(maxSize);
      expect(stats.evictions).toBe(180); // 200 - 20 = 180

      // Only the last 20 entries (indices 180..199) should remain
      for (let i = 180; i < 200; i++) {
        const o = { lat: 20.0 + (i * 0.001), lng: 85.0 };
        const d = { lat: 20.1 + (i * 0.001), lng: 85.1 };
        expect(stressCache.get(o, d, 'FREE_FLOW')).not.toBeNull();
      }

      stressCache.destroy();
    });

    test('TC-ADV-MAP-CACHE-5: TTL Expiration triggers eviction and fresh computation on subsequent request', async () => {
      const shortTtlCache = new matrixCache.MatrixCache({ ttlMs: 30, maxSize: 50 });
      const p1 = { lat: 20.2961, lng: 85.8645 };
      const p2 = { lat: 20.2880, lng: 85.8520 };

      shortTtlCache.set(p1, p2, 'FREE_FLOW', { distanceKm: 2.14, durationMinutes: 5.13 }, 30);

      // Immediate read is a hit
      const hit = shortTtlCache.get(p1, p2, 'FREE_FLOW');
      expect(hit).not.toBeNull();
      expect(shortTtlCache.getStats().hits).toBe(1);

      // Wait 50ms for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 50));

      // Read after expiration returns null and increments stats.expirations
      const expiredVal = shortTtlCache.get(p1, p2, 'FREE_FLOW');
      expect(expiredVal).toBeNull();
      expect(shortTtlCache.getStats().expirations).toBe(1);
      expect(shortTtlCache.getStats().misses).toBe(1);

      shortTtlCache.destroy();
    });

    test('TC-ADV-MAP-CACHE-6: High-concurrency cache access stress test — 50 concurrent requests share cache without corruption', async () => {
      const origins = [CANONICAL_DEPOT.geo, { lat: 20.2880, lng: 85.8520 }];
      const destinations = [{ lat: 20.3010, lng: 85.8230 }, { lat: 20.3540, lng: 85.8170 }];

      // Dispatch 50 concurrent requests for the exact same matrix
      const promises = Array.from({ length: 50 }, () =>
        mapping.getDistanceMatrix(origins, destinations, { scenario: TRAFFIC_SCENARIOS.MORNING_RUSH })
      );

      const results = await Promise.all(promises);

      // Verify all 50 resolved to identical matrix payloads
      const referenceJson = JSON.stringify(results[0].matrix);
      for (let i = 1; i < results.length; i++) {
        expect(JSON.stringify(results[i].matrix)).toBe(referenceJson);
      }

      // Check cache stats: 2x2 = 4 pairs computed once on miss, subsequent calls hit cache
      const stats = mapping.getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBe(4); // Only the initial 4 cells miss!
    });
  });

  // =========================================================================
  // 3. RESILIENCE, ERROR HANDLING & FACADE FALLBACKS
  // =========================================================================
  describe('3. Resilience, Error Handling & Facade Fallbacks', () => {
    const origin = [CANONICAL_DEPOT.geo];
    const destination = [{ lat: 20.2880, lng: 85.8520 }]; // Saheed Nagar

    test('TC-ADV-MAP-RESIL-1: Missing, deleted, or blank Google Maps API key transparently falls back to simulation without throwing', async () => {
      const originalKey = process.env.GOOGLE_MAPS_API_KEY;
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const falsyKeys = ['', '   ', 'mock_key', '__DELETED__'];
      for (const k of falsyKeys) {
        if (k === '__DELETED__') {
          delete process.env.GOOGLE_MAPS_API_KEY;
        } else {
          process.env.GOOGLE_MAPS_API_KEY = k;
        }
        mapping.clearCache();

        const result = await mapping.getDistanceMatrix(origin, destination);
        expect(result).toBeDefined();
        expect(result.status).toBe('OK');
        expect(result.source).toBe('SIMULATED');
        expect(result.matrix.length).toBe(1);
        expect(result.matrix[0][0].distanceKm).toBeCloseTo(2.139, 2);
      }

      warnSpy.mockRestore();
      process.env.GOOGLE_MAPS_API_KEY = originalKey;
    });

    test('TC-ADV-MAP-RESIL-2: Google Maps network timeout (ECONNABORTED) retries with backoff and falls back cleanly', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'valid_dummy_key_for_testing';
      mapping.clearCache();

      let callCount = 0;
      jest.spyOn(axios, 'get').mockImplementation(async () => {
        callCount++;
        const timeoutError = new Error('timeout of 5000ms exceeded');
        timeoutError.code = 'ECONNABORTED';
        throw timeoutError;
      });

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await googleMapsService.getDistanceMatrix(origin, destination, { skipCache: true });

      // Max retries = 2, so 1 initial attempt + 2 retries = 3 calls
      expect(callCount).toBe(3);
      expect(warnSpy).toHaveBeenCalled();
      expect(result.status).toBe('OK');
      expect(result.source).toBe('SIMULATED');
      expect(result.matrix[0][0].distanceMeters).toBeGreaterThan(0);

      warnSpy.mockRestore();
    });

    test('TC-ADV-MAP-RESIL-3: Google Maps HTTP 500 error retries and gracefully degrades to simulated matrix', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'valid_dummy_key_for_testing';
      mapping.clearCache();

      let callCount = 0;
      jest.spyOn(axios, 'get').mockImplementation(async () => {
        callCount++;
        const serverError = new Error('Request failed with status code 500');
        serverError.response = { status: 500, data: 'Internal Server Error' };
        throw serverError;
      });

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await googleMapsService.getDistanceMatrix(origin, destination, { skipCache: true });

      expect(callCount).toBe(3);
      expect(result.status).toBe('OK');
      expect(result.source).toBe('SIMULATED');

      warnSpy.mockRestore();
    });

    test('TC-ADV-MAP-RESIL-4: Quota errors (OVER_QUERY_LIMIT, REQUEST_DENIED) immediately fallback WITHOUT burning retries', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'valid_dummy_key_for_testing';
      mapping.clearCache();

      let callCount = 0;
      jest.spyOn(axios, 'get').mockImplementation(async () => {
        callCount++;
        return {
          data: {
            status: 'OVER_QUERY_LIMIT',
            error_message: 'You have exceeded your daily request quota for this API.',
          },
        };
      });

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await googleMapsService.getDistanceMatrix(origin, destination, { skipCache: true });

      // Quota errors must NOT be retried -> exactly 1 attempt
      expect(callCount).toBe(1);
      expect(result.status).toBe('OK');
      expect(result.source).toBe('SIMULATED');

      warnSpy.mockRestore();
    });

    test('TC-ADV-MAP-RESIL-5: Matrix chunking for 15x15 request (>100 elements: 225 total) correctly partitions and merges', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'valid_dummy_key_for_chunking';
      mapping.clearCache();

      // Create 15 distinct origins and 15 distinct destinations
      const origins15 = Array.from({ length: 15 }, (_, i) => ({
        lat: 20.25 + i * 0.005,
        lng: 85.80 + i * 0.005,
      }));
      const destinations15 = Array.from({ length: 15 }, (_, j) => ({
        lat: 20.30 + j * 0.005,
        lng: 85.85 + j * 0.005,
      }));

      const interceptedChunks = [];

      // Mock axios.get to record chunks and return synthetic valid Google matrix response
      jest.spyOn(axios, 'get').mockImplementation(async (url) => {
        const parsedUrl = new URL(url);
        const oList = parsedUrl.searchParams.get('origins').split('|');
        const dList = parsedUrl.searchParams.get('destinations').split('|');

        interceptedChunks.push({
          originCount: oList.length,
          destCount: dList.length,
          elementsCount: oList.length * dList.length,
        });

        // Verify sub-100 element rule strictly
        expect(oList.length * dList.length).toBeLessThanOrEqual(100);

        // Generate synthetic Google rows
        const rows = oList.map((oStr, rIdx) => ({
          elements: dList.map((dStr, cIdx) => ({
            status: 'OK',
            distance: { text: '5.0 km', value: 5000 },
            duration: { text: '12 mins', value: 720 },
          })),
        }));

        return {
          data: {
            status: 'OK',
            origin_addresses: oList,
            destination_addresses: dList,
            rows,
          },
        };
      });

      const matrixResult = await googleMapsService.getDistanceMatrix(origins15, destinations15, { skipCache: true });

      // With 15x15 and 10x10 chunk limit:
      // Origins: 2 chunks (10, 5)
      // Destinations: 2 chunks (10, 5)
      // Total chunks = 2 x 2 = 4 chunks
      expect(interceptedChunks.length).toBe(4);
      expect(interceptedChunks[0]).toEqual({ originCount: 10, destCount: 10, elementsCount: 100 });
      expect(interceptedChunks[1]).toEqual({ originCount: 10, destCount: 5, elementsCount: 50 });
      expect(interceptedChunks[2]).toEqual({ originCount: 5, destCount: 10, elementsCount: 50 });
      expect(interceptedChunks[3]).toEqual({ originCount: 5, destCount: 5, elementsCount: 25 });

      // Verify reassembled dimensions
      expect(matrixResult.matrix.length).toBe(15);
      expect(matrixResult.rows.length).toBe(15);
      for (let i = 0; i < 15; i++) {
        expect(matrixResult.matrix[i].length).toBe(15);
        expect(matrixResult.rows[i].elements.length).toBe(15);
        for (let j = 0; j < 15; j++) {
          expect(matrixResult.matrix[i][j].distanceMeters).toBe(5000);
          expect(matrixResult.matrix[i][j].durationSeconds).toBe(720);
        }
      }
    });

    test('TC-ADV-MAP-RESIL-6: Element-level granular fallback for individual ZERO_RESULTS/NOT_FOUND elements', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'valid_dummy_key_for_testing';
      mapping.clearCache();

      jest.spyOn(axios, 'get').mockImplementation(async () => {
        return {
          data: {
            status: 'OK',
            origin_addresses: ['20.2961,85.8645'],
            destination_addresses: ['20.288,85.852', '20.354,85.817'],
            rows: [
              {
                elements: [
                  {
                    status: 'OK',
                    distance: { text: '2.1 km', value: 2139 },
                    duration: { text: '6 mins', value: 340 },
                  },
                  {
                    status: 'ZERO_RESULTS', // Google failed on route 2
                  },
                ],
              },
            ],
          },
        };
      });

      const o = [CANONICAL_DEPOT.geo];
      const d = [{ lat: 20.2880, lng: 85.8520 }, { lat: 20.3540, lng: 85.8170 }];

      const result = await googleMapsService.getDistanceMatrix(o, d, { skipCache: true });

      expect(result.status).toBe('OK');
      // Element 0: OK from Google
      expect(result.matrix[0][0].status).toBe('OK');
      expect(result.matrix[0][0].source).toBe('GOOGLE_MAPS');

      // Element 1: Granular fallback to simulation
      expect(result.matrix[0][1].status).toBe('FALLBACK_SIMULATED');
      expect(result.matrix[0][1].source).toBe('SIMULATED');
      expect(result.matrix[0][1].distanceMeters).toBeGreaterThan(0);
    });

    test('TC-ADV-MAP-RESIL-7: Asymmetric matrix chunking (15 origins x 7 destinations = 105 elements)', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'valid_dummy_key_for_asymmetric';
      mapping.clearCache();

      const origins15 = Array.from({ length: 15 }, (_, i) => ({
        lat: 20.25 + i * 0.005,
        lng: 85.80 + i * 0.005,
      }));
      const destinations7 = Array.from({ length: 7 }, (_, j) => ({
        lat: 20.30 + j * 0.005,
        lng: 85.85 + j * 0.005,
      }));

      const chunks = [];
      jest.spyOn(axios, 'get').mockImplementation(async (url) => {
        const parsedUrl = new URL(url);
        const oList = parsedUrl.searchParams.get('origins').split('|');
        const dList = parsedUrl.searchParams.get('destinations').split('|');

        chunks.push({ o: oList.length, d: dList.length });

        const rows = oList.map(() => ({
          elements: dList.map(() => ({
            status: 'OK',
            distance: { text: '3.5 km', value: 3500 },
            duration: { text: '8 mins', value: 480 },
          })),
        }));

        return {
          data: {
            status: 'OK',
            origin_addresses: oList,
            destination_addresses: dList,
            rows,
          },
        };
      });

      const res = await googleMapsService.getDistanceMatrix(origins15, destinations7, { skipCache: true });

      // Origins 15: chunks of 10 and 5. Destinations 7: 1 chunk of 7. Total chunks = 2.
      expect(chunks.length).toBe(2);
      expect(chunks[0]).toEqual({ o: 10, d: 7 }); // 70 elements <= 100
      expect(chunks[1]).toEqual({ o: 5, d: 7 });  // 35 elements <= 100

      expect(res.matrix.length).toBe(15);
      expect(res.matrix[0].length).toBe(7);
      expect(res.matrix[14][6].distanceMeters).toBe(3500);
    });

    test('TC-ADV-MAP-RESIL-8: Empty or invalid input arrays handling in simulatedTrafficService vs facade', async () => {
      // 1. simulatedTrafficService rejects empty/null arrays with descriptive errors
      await expect(simulatedTrafficService.getDistanceMatrix([], [{ lat: 20, lng: 85 }]))
        .rejects.toThrow('Origins must be a non-empty array');
      await expect(simulatedTrafficService.getDistanceMatrix([{ lat: 20, lng: 85 }], []))
        .rejects.toThrow('Destinations must be a non-empty array');
      await expect(simulatedTrafficService.getDistanceMatrix(null, [{ lat: 20, lng: 85 }]))
        .rejects.toThrow('Origins must be a non-empty array');
      await expect(simulatedTrafficService.getDistanceMatrix([{ lat: 20, lng: 85 }], undefined))
        .rejects.toThrow('Destinations must be a non-empty array');

      // 2. googleMapsService facade rejects empty/null/invalid arrays with exact matching descriptive errors
      await expect(googleMapsService.getDistanceMatrix([], [{ lat: 20, lng: 85 }]))
        .rejects.toThrow('Origins must be a non-empty array');
      await expect(googleMapsService.getDistanceMatrix([{ lat: 20, lng: 85 }], []))
        .rejects.toThrow('Destinations must be a non-empty array');
      await expect(googleMapsService.getDistanceMatrix(null, [{ lat: 20, lng: 85 }]))
        .rejects.toThrow('Origins must be a non-empty array');
      await expect(googleMapsService.getDistanceMatrix([{ lat: 20, lng: 85 }], undefined))
        .rejects.toThrow('Destinations must be a non-empty array');
      await expect(googleMapsService.getDistanceMatrix('not-an-array', [{ lat: 20, lng: 85 }]))
        .rejects.toThrow('Origins must be a non-empty array');
      await expect(googleMapsService.getDistanceMatrix([{ lat: 20, lng: 85 }], 12345))
        .rejects.toThrow('Destinations must be a non-empty array');

      // 3. Defensive check prevents silent empty return even when GOOGLE_MAPS_API_KEY is present
      const prevKey = process.env.GOOGLE_MAPS_API_KEY;
      try {
        process.env.GOOGLE_MAPS_API_KEY = 'AIzaSyMockKeyForDefensiveTesting';
        await expect(googleMapsService.getDistanceMatrix([], [{ lat: 20, lng: 85 }]))
          .rejects.toThrow('Origins must be a non-empty array');
        await expect(googleMapsService.getDistanceMatrix([{ lat: 20, lng: 85 }], []))
          .rejects.toThrow('Destinations must be a non-empty array');
      } finally {
        process.env.GOOGLE_MAPS_API_KEY = prevKey;
      }
    });
  });

  // =========================================================================
  // 4. HAVERSINE EXTREMES & BOUNDARY STRESS
  // =========================================================================
  describe('4. Haversine Extremes & Boundary Stress', () => {
    test('TC-ADV-MAP-HAV-1: Identical points fast-path strictly returns 0.0 distance and 0s duration', () => {
      const testCoordinates = [
        CANONICAL_DEPOT.geo,
        { lat: 0.0, lng: 0.0 }, // Null Island
        { lat: 90.0, lng: 0.0 }, // North Pole
        { lat: -90.0, lng: 0.0 }, // South Pole
        { lat: 0.0, lng: 180.0 }, // Antimeridian
        { lat: 0.0, lng: -180.0 },
        { lat: 20.29612345, lng: 85.86456789 },
      ];

      for (const pt of testCoordinates) {
        const hDist = mapping.haversineDistance(pt, pt);
        expect(hDist).toBe(0.0);

        const rDist = mapping.roadDistance(pt, pt);
        expect(rDist).toBe(0.0);

        const dur = mapping.calculateDuration(rDist, TRAFFIC_SCENARIOS.EVENING_PEAK);
        expect(dur.durationSeconds).toBe(0);
        expect(dur.durationMinutes).toBe(0.0);
      }
    });

    test('TC-ADV-MAP-HAV-2: Antipodal points evaluate to ~pi*R (~20015 km) without NaN or precision overflow', () => {
      const halfCircumferenceKm = Math.PI * MAPPING_CONSTANTS.EARTH_RADIUS_KM; // ~20015.087 km

      const antipodalPairs = [
        // Equator antipodes (0, 0) and (0, 180)
        { p1: { lat: 0, lng: 0 }, p2: { lat: 0, lng: 180 } },
        // Mid-latitude antipodes (45, 30) and (-45, -150)
        { p1: { lat: 45, lng: 30 }, p2: { lat: -45, lng: -150 } },
        // Canonical Bhubaneswar Depot antipode
        { p1: CANONICAL_DEPOT.geo, p2: { lat: -CANONICAL_DEPOT.geo.lat, lng: CANONICAL_DEPOT.geo.lng - 180 } },
        // North Pole to South Pole
        { p1: { lat: 90, lng: 0 }, p2: { lat: -90, lng: 0 } },
      ];

      for (const pair of antipodalPairs) {
        const dist = mapping.haversineDistance(pair.p1, pair.p2);
        expect(Number.isNaN(dist)).toBe(false);
        expect(Number.isFinite(dist)).toBe(true);
        expect(dist).toBeCloseTo(halfCircumferenceKm, 0);

        const roadDist = mapping.roadDistance(pair.p1, pair.p2);
        expect(roadDist).toBeCloseTo(halfCircumferenceKm * 1.35, 0);

        const duration = mapping.calculateDuration(roadDist, TRAFFIC_SCENARIOS.FREE_FLOW);
        expect(duration.durationSeconds).toBeGreaterThan(0);
      }
    });

    test('TC-ADV-MAP-HAV-3: Polar and equatorial boundary checks', () => {
      // Points at the same pole regardless of longitude have 0 distance
      const northPole1 = { lat: 90.0, lng: 0.0 };
      const northPole2 = { lat: 90.0, lng: 120.0 };
      const northPoleDist = mapping.haversineDistance(northPole1, northPole2);
      expect(northPoleDist).toBeCloseTo(0.0, 5);

      const southPole1 = { lat: -90.0, lng: -45.0 };
      const southPole2 = { lat: -90.0, lng: 90.0 };
      const southPoleDist = mapping.haversineDistance(southPole1, southPole2);
      expect(southPoleDist).toBeCloseTo(0.0, 5);

      // Equator 1-degree longitude distance = (pi/180) * 6371 ~ 111.195 km
      const eqStep = mapping.haversineDistance({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
      expect(eqStep).toBeCloseTo(111.195, 2);

      // Antimeridian wrap-around: (0, -180) vs (0, 180) are the exact same meridian
      const antimeridianDist = mapping.haversineDistance({ lat: 0, lng: -180 }, { lat: 0, lng: 180 });
      expect(antimeridianDist).toBeCloseTo(0.0, 5);
    });

    test('TC-ADV-MAP-HAV-4: Invalid coordinate values strictly throw descriptive errors', () => {
      const outOfBoundsCoords = [
        { lat: 90.0001, lng: 0 },
        { lat: -90.0001, lng: 0 },
        { lat: 0, lng: 180.0001 },
        { lat: 0, lng: -180.0001 },
        { lat: 'invalid', lng: 85.0 },
        { lat: 20.0, lng: NaN },
        null,
        undefined,
      ];

      for (const badCoord of outOfBoundsCoords) {
        expect(() => mapping.normalizeCoord(badCoord)).toThrow();
        expect(() => mapping.haversineDistance(CANONICAL_DEPOT.geo, badCoord)).toThrow();
      }
    });
  });
});
