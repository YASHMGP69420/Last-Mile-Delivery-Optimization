/**
 * Challenger Empirical Stress Test Runner
 * SmartRoute Last-Mile Delivery Platform - Milestone 2 Iteration 2
 *
 * Target Components:
 * - googleMapsService.js
 * - simulatedTrafficService.js
 * - matrixCache.js
 */

const assert = require('assert');
const googleMapsService = require('../src/services/mapping/googleMapsService');
const simulatedTrafficService = require('../src/services/mapping/simulatedTrafficService');
const matrixCache = require('../src/services/mapping/matrixCache');
const { MatrixCache } = matrixCache;
const {
  TRAFFIC_SCENARIOS,
  TRAFFIC_MULTIPLIERS,
  MAPPING_CONSTANTS,
  CANONICAL_DEPOT,
} = require('../src/config/constants');

const testResults = [];

function recordTest(suite, testName, passed, details = '') {
  testResults.push({ suite, testName, passed, details });
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] [${suite}] ${testName}${details ? ' - ' + details : ''}`);
}

async function runAllChallengerTests() {
  console.log('================================================================');
  console.log('CHALLENGER EMPIRICAL VERIFICATION HARNESS');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. DEFENSIVE INPUT VALIDATION STRESS TESTS
  // ---------------------------------------------------------------------------
  console.log('--- 1. Defensive Input Validation ---');

  const validPoint = { lat: 20.2961, lng: 85.8645 };
  const validArray = [validPoint];

  // 1.1 Test origins = null, destinations = null
  try {
    await googleMapsService.getDistanceMatrix(null, validArray);
    recordTest('Defensive Validation', 'origins = null throws descriptive error', false, 'Did not throw');
  } catch (err) {
    const isDescriptive = err.message === 'Origins must be a non-empty array';
    const notTypeError = !(err instanceof TypeError);
    recordTest('Defensive Validation', 'origins = null throws descriptive error', isDescriptive && notTypeError, `Error: "${err.message}"`);
  }

  try {
    await googleMapsService.getDistanceMatrix(validArray, null);
    recordTest('Defensive Validation', 'destinations = null throws descriptive error', false, 'Did not throw');
  } catch (err) {
    const isDescriptive = err.message === 'Destinations must be a non-empty array';
    const notTypeError = !(err instanceof TypeError);
    recordTest('Defensive Validation', 'destinations = null throws descriptive error', isDescriptive && notTypeError, `Error: "${err.message}"`);
  }

  // 1.2 Test origins = [], destinations = []
  try {
    await googleMapsService.getDistanceMatrix([], validArray);
    recordTest('Defensive Validation', 'origins = [] throws descriptive error', false, 'Did not throw');
  } catch (err) {
    const isDescriptive = err.message === 'Origins must be a non-empty array';
    recordTest('Defensive Validation', 'origins = [] throws descriptive error', isDescriptive, `Error: "${err.message}"`);
  }

  try {
    await googleMapsService.getDistanceMatrix(validArray, []);
    recordTest('Defensive Validation', 'destinations = [] throws descriptive error', false, 'Did not throw');
  } catch (err) {
    const isDescriptive = err.message === 'Destinations must be a non-empty array';
    recordTest('Defensive Validation', 'destinations = [] throws descriptive error', isDescriptive, `Error: "${err.message}"`);
  }

  try {
    await googleMapsService.getDistanceMatrix([], []);
    recordTest('Defensive Validation', 'origins = [] & destinations = [] throws origins error first', false, 'Did not throw');
  } catch (err) {
    const isDescriptive = err.message === 'Origins must be a non-empty array';
    recordTest('Defensive Validation', 'origins = [] & destinations = [] throws origins error first', isDescriptive, `Error: "${err.message}"`);
  }

  // 1.3 Test non-array types: string, number, boolean, object, undefined
  const invalidInputs = [
    { label: 'string ("invalid")', val: 'invalid' },
    { label: 'number (12345)', val: 12345 },
    { label: 'boolean (true)', val: true },
    { label: 'boolean (false)', val: false },
    { label: 'plain object ({})', val: {} },
    { label: 'undefined', val: undefined },
  ];

  for (const { label, val } of invalidInputs) {
    try {
      await googleMapsService.getDistanceMatrix(val, validArray);
      recordTest('Defensive Validation', `origins = ${label} rejected`, false, 'Did not throw');
    } catch (err) {
      const ok = err.message === 'Origins must be a non-empty array' && !(err instanceof TypeError);
      recordTest('Defensive Validation', `origins = ${label} rejected`, ok, `Msg: "${err.message}"`);
    }

    try {
      await googleMapsService.getDistanceMatrix(validArray, val);
      recordTest('Defensive Validation', `destinations = ${label} rejected`, false, 'Did not throw');
    } catch (err) {
      const ok = err.message === 'Destinations must be a non-empty array' && !(err instanceof TypeError);
      recordTest('Defensive Validation', `destinations = ${label} rejected`, ok, `Msg: "${err.message}"`);
    }
  }

  // 1.4 Test options = null, undefined, {}
  try {
    const resNull = await googleMapsService.getDistanceMatrix(validArray, validArray, null);
    recordTest('Defensive Validation', 'options = null handled cleanly without TypeError', resNull && resNull.status === 'OK', `Source: ${resNull && resNull.source}`);
  } catch (err) {
    recordTest('Defensive Validation', 'options = null handled cleanly without TypeError', false, `Threw: ${err.message}`);
  }

  try {
    const resUndef = await googleMapsService.getDistanceMatrix(validArray, validArray, undefined);
    recordTest('Defensive Validation', 'options = undefined handled cleanly without TypeError', resUndef && resUndef.status === 'OK', `Source: ${resUndef && resUndef.source}`);
  } catch (err) {
    recordTest('Defensive Validation', 'options = undefined handled cleanly without TypeError', false, `Threw: ${err.message}`);
  }

  // 1.5 Cache bypass & false allCached: true prevention under active API key
  const prevEnvKey = process.env.GOOGLE_MAPS_API_KEY;
  try {
    process.env.GOOGLE_MAPS_API_KEY = 'AIzaFakeChallengerKeyEmpiricalCheck';
    let bypassedOrigins = false;
    try {
      const res = await googleMapsService.getDistanceMatrix([], validArray);
      bypassedOrigins = true;
    } catch (err) {
      recordTest('Defensive Validation', 'API Key present: empty origins cannot bypass cache', err.message === 'Origins must be a non-empty array', `Caught: "${err.message}"`);
    }
    if (bypassedOrigins) {
      recordTest('Defensive Validation', 'API Key present: empty origins cannot bypass cache', false, 'VULNERABILITY: Empty origins returned without error!');
    }

    let bypassedDest = false;
    try {
      const res = await googleMapsService.getDistanceMatrix(validArray, []);
      bypassedDest = true;
    } catch (err) {
      recordTest('Defensive Validation', 'API Key present: empty destinations cannot bypass cache', err.message === 'Destinations must be a non-empty array', `Caught: "${err.message}"`);
    }
    if (bypassedDest) {
      recordTest('Defensive Validation', 'API Key present: empty destinations cannot bypass cache', false, 'VULNERABILITY: Empty destinations returned without error!');
    }
  } finally {
    process.env.GOOGLE_MAPS_API_KEY = prevEnvKey;
  }

  // ---------------------------------------------------------------------------
  // 2. RESILIENCE, LRU CACHE EVICTION & CONCURRENCY
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. LRU Cache Eviction & Concurrency ---');

  // 2.1 Verify LRU eviction order strictly follows monotonic access sequence
  const lruCache = new MatrixCache({ maxSize: 4, ttlMs: 60000 });
  const pts = [
    { lat: 20.20, lng: 85.80 },
    { lat: 20.21, lng: 85.81 },
    { lat: 20.22, lng: 85.82 },
    { lat: 20.23, lng: 85.83 },
    { lat: 20.24, lng: 85.84 },
    { lat: 20.25, lng: 85.85 },
  ];

  // Insert items 0, 1, 2, 3
  lruCache.set(pts[0], pts[1], 'FREE_FLOW', { id: 'entry-0' });
  lruCache.set(pts[1], pts[2], 'FREE_FLOW', { id: 'entry-1' });
  lruCache.set(pts[2], pts[3], 'FREE_FLOW', { id: 'entry-2' });
  lruCache.set(pts[3], pts[4], 'FREE_FLOW', { id: 'entry-3' });

  // Touch entry-0 and entry-2 to make entry-1 the least recently accessed
  lruCache.get(pts[0], pts[1], 'FREE_FLOW'); // entry-0 touched
  lruCache.get(pts[2], pts[3], 'FREE_FLOW'); // entry-2 touched

  // Insert item 4 (pts[4]->pts[5]) -> should evict entry-1
  lruCache.set(pts[4], pts[5], 'FREE_FLOW', { id: 'entry-4' });

  const e1Evicted = lruCache.get(pts[1], pts[2], 'FREE_FLOW') === null;
  const e0Retained = lruCache.get(pts[0], pts[1], 'FREE_FLOW') !== null;
  const e2Retained = lruCache.get(pts[2], pts[3], 'FREE_FLOW') !== null;
  const e3Retained = lruCache.get(pts[3], pts[4], 'FREE_FLOW') !== null;
  const e4Retained = lruCache.get(pts[4], pts[5], 'FREE_FLOW') !== null;
  const cacheSize4 = lruCache.store.size === 4;

  const lruOrderPassed = e1Evicted && e0Retained && e2Retained && e3Retained && e4Retained && cacheSize4;
  recordTest('LRU Eviction', 'Evicts exact least recently accessed entry under capacity limit', lruOrderPassed,
    `Size: ${lruCache.store.size}/4, Evictions: ${lruCache.stats.evictions}`);

  // 2.2 High load capacity stress test (500 items into maxSize 25)
  const heavyCache = new MatrixCache({ maxSize: 25, ttlMs: 100000 });
  for (let i = 0; i < 500; i++) {
    const o = { lat: 20.0 + (i * 0.0005), lng: 85.0 };
    const d = { lat: 20.1 + (i * 0.0005), lng: 85.1 };
    heavyCache.set(o, d, 'FREE_FLOW', { idx: i });
  }

  const heavyStats = heavyCache.stats;
  const heavyCapOk = heavyCache.store.size === 25 && heavyStats.evictions === 475;
  recordTest('LRU Eviction', 'High-throughput load (500 items into cap 25) strictly enforces limit', heavyCapOk,
    `Final size: ${heavyCache.store.size}, Evictions: ${heavyStats.evictions}`);

  // 2.3 High Concurrency simulation: 60 concurrent matrix calculations
  const concOrigins = [
    { lat: 20.2961, lng: 85.8645 },
    { lat: 20.3588, lng: 85.8164 },
  ];
  const concDestinations = [
    { lat: 20.2974, lng: 85.8193 },
    { lat: 20.2644, lng: 85.8402 },
  ];

  matrixCache.clear();
  const promises = [];
  for (let i = 0; i < 60; i++) {
    promises.push(googleMapsService.getDistanceMatrix(concOrigins, concDestinations, { scenario: 'FREE_FLOW' }));
  }

  try {
    const concResults = await Promise.all(promises);
    let allValid = concResults.length === 60;
    const firstDistance = concResults[0].matrix[0][0].distanceKm;
    for (const r of concResults) {
      if (r.status !== 'OK' || r.matrix[0][0].distanceKm !== firstDistance) {
        allValid = false;
        break;
      }
    }
    const globalStats = matrixCache.getStats();
    recordTest('Concurrency', '60 concurrent getDistanceMatrix calls execute cleanly and share cache', allValid && globalStats.hits > 0,
      `Hits: ${globalStats.hits}, Misses: ${globalStats.misses}`);
  } catch (err) {
    recordTest('Concurrency', '60 concurrent getDistanceMatrix calls execute cleanly', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // 3. DETERMINISTIC TRAFFIC SCENARIOS & TRANSPARENT SIMULATION FALLBACK
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Traffic Scenarios & Fallbacks ---');

  // 3.1 Verify all 5 canonical scenarios
  const canonicalScenarios = [
    { name: 'FREE_FLOW', expectedMult: 1.0 },
    { name: 'MORNING_RUSH', expectedMult: 1.8 },
    { name: 'EVENING_PEAK', expectedMult: 2.2 },
    { name: 'MONSOON_RAIN', expectedMult: 1.5 },
    { name: 'WEEKEND', expectedMult: 1.1 },
  ];

  const testDist = 25.0; // 25 km at base speed 25 km/h = 1 hour = 3600 seconds base
  let canonicalOk = true;
  for (const sc of canonicalScenarios) {
    const { durationSeconds, durationMinutes } = simulatedTrafficService.calculateDuration(testDist, sc.name);
    const expectedSec = Math.round(3600 * sc.expectedMult);
    if (durationSeconds !== expectedSec) {
      canonicalOk = false;
      console.log(`Mismatch for ${sc.name}: got ${durationSeconds}, expected ${expectedSec}`);
    }
  }
  recordTest('Traffic Simulation', 'All 5 canonical scenarios apply exact mathematical multipliers', canonicalOk);

  // 3.2 Check prompt-referenced alternative scenarios:
  // MODERATE_CONGESTION, HEAVY_PEAK, MONSOON_FLOODING, ROAD_CONSTRUCTION
  const altScenarios = [
    'MODERATE_CONGESTION',
    'HEAVY_PEAK',
    'MONSOON_FLOODING',
    'ROAD_CONSTRUCTION',
  ];

  let altFallbackOk = true;
  for (const alt of altScenarios) {
    const res = simulatedTrafficService.calculateDuration(testDist, alt);
    // Since these are non-canonical, they must gracefully fallback to FREE_FLOW (1.0x -> 3600s)
    if (res.durationSeconds !== 3600 || res.durationMinutes !== 60.0) {
      altFallbackOk = false;
      console.log(`Alternative scenario ${alt} fallback unexpected:`, res);
    }
  }
  recordTest('Traffic Simulation', 'Alternative scenarios (MODERATE_CONGESTION, etc.) safely fallback to FREE_FLOW (1.0x)', altFallbackOk);

  // 3.3 Transparent simulation fallback when API key is missing / mock
  delete process.env.GOOGLE_MAPS_API_KEY;
  const simResult = await googleMapsService.getDistanceMatrix(validArray, validArray, { scenario: 'MORNING_RUSH' });
  const isSimFallback = simResult.source === 'SIMULATED_TRAFFIC' && simResult.scenario === 'MORNING_RUSH';
  recordTest('Traffic Simulation', 'Transparent fallback to SIMULATED_TRAFFIC when API key missing', isSimFallback, `Source: ${simResult.source}`);

  // ---------------------------------------------------------------------------
  // 4. HAVERSINE PHYSICAL ACCURACY FOR BHUBANESWAR
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Haversine Accuracy in Bhubaneswar ---');

  // Real landmark coordinates in Bhubaneswar
  const landmarks = {
    rasulgarhDepot: { lat: 20.2961, lng: 85.8645 },
    jaydevVihar: { lat: 20.2974, lng: 85.8193 },
    patiaHub: { lat: 20.3588, lng: 85.8164 },
    masterCanteen: { lat: 20.2644, lng: 85.8402 },
    khandagiri: { lat: 20.2592, lng: 85.7877 },
  };

  // Independent mathematical reference oracle for Haversine
  function referenceHaversine(c1, c2) {
    const R = 6371.0;
    const rad = Math.PI / 180;
    const dLat = (c2.lat - c1.lat) * rad;
    const dLng = (c2.lng - c1.lng) * rad;
    const lat1 = c1.lat * rad;
    const lat2 = c2.lat * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // 4.1 Compare simulatedTrafficService against reference oracle across all pairs
  const keys = Object.keys(landmarks);
  let maxAbsError = 0;
  let symmetryOk = true;
  let triangleIneqOk = true;

  for (let i = 0; i < keys.length; i++) {
    for (let j = 0; j < keys.length; j++) {
      const p1 = landmarks[keys[i]];
      const p2 = landmarks[keys[j]];

      const actual = simulatedTrafficService.haversineDistance(p1, p2);
      const expected = referenceHaversine(p1, p2);
      const diff = Math.abs(actual - expected);
      if (diff > maxAbsError) maxAbsError = diff;

      // Symmetry
      const reverse = simulatedTrafficService.haversineDistance(p2, p1);
      if (Math.abs(actual - reverse) > 1e-12) symmetryOk = false;

      // Triangle inequality
      for (let k = 0; k < keys.length; k++) {
        const p3 = landmarks[keys[k]];
        const d13 = simulatedTrafficService.haversineDistance(p1, p3);
        const d23 = simulatedTrafficService.haversineDistance(p2, p3);
        if (d13 > actual + d23 + 1e-9) triangleIneqOk = false;
      }
    }
  }

  recordTest('Haversine Accuracy', 'Haversine matches independent mathematical oracle (< 1e-9 error)', maxAbsError < 1e-9, `Max error: ${maxAbsError.toExponential(3)} km`);
  recordTest('Haversine Accuracy', 'Haversine distance is strictly symmetric across all Bhubaneswar landmark pairs', symmetryOk);
  recordTest('Haversine Accuracy', 'Triangle inequality strictly holds across all Bhubaneswar landmark triplets', triangleIneqOk);

  // 4.2 Verify Bhubaneswar distance magnitudes are realistic
  // Rasulgarh to Jaydev Vihar: ~4.7 km straight line, ~6.3 km road distance
  const dRasulJaydevStraight = simulatedTrafficService.haversineDistance(landmarks.rasulgarhDepot, landmarks.jaydevVihar);
  const dRasulJaydevRoad = simulatedTrafficService.roadDistance(landmarks.rasulgarhDepot, landmarks.jaydevVihar);

  const realisticMagnitude = dRasulJaydevStraight > 4.5 && dRasulJaydevStraight < 5.0 &&
                            dRasulJaydevRoad > 6.0 && dRasulJaydevRoad < 6.8;
  recordTest('Haversine Accuracy', 'Rasulgarh to Jaydev Vihar physical distance is realistic (~4.7km air, ~6.4km road)', realisticMagnitude,
    `Air: ${dRasulJaydevStraight.toFixed(3)} km, Road: ${dRasulJaydevRoad.toFixed(3)} km`);

  // 4.3 Curvature factor invariant: roadDistance === haversineDistance * 1.35
  const curvatureRatio = dRasulJaydevRoad / dRasulJaydevStraight;
  const curvatureInvariant = Math.abs(curvatureRatio - 1.35) < 1e-9;
  recordTest('Haversine Accuracy', 'Road distance strictly enforces 1.35x urban curvature factor', curvatureInvariant, `Ratio: ${curvatureRatio.toFixed(4)}`);

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('CHALLENGER VERIFICATION RESULTS SUMMARY');
  console.log('================================================================');
  const total = testResults.length;
  const passed = testResults.filter(t => t.passed).length;
  const failed = testResults.filter(t => !t.passed).length;

  console.log(`Total Checks:  ${total}`);
  console.log(`Passed:        ${passed}`);
  console.log(`Failed:        ${failed}`);

  if (failed === 0) {
    console.log('\nVERDICT: APPROVE');
  } else {
    console.log('\nVERDICT: REQUEST_CHANGES');
  }

  return { total, passed, failed, results: testResults };
}

runAllChallengerTests().then(summary => {
  process.exit(summary.failed === 0 ? 0 : 1);
}).catch(err => {
  console.error('Unhandled fatal error in challenger verification:', err);
  process.exit(1);
});
