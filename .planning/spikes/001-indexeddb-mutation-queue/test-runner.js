/**
 * Spike 001 Test Runner: IndexedDB Mutation Queue Contract & Latency Verification
 * 
 * Verifies:
 * 1. Transactional FIFO enqueue & schema validation.
 * 2. Idempotency key deduplication (duplicate submissions return existing entry without creating duplicates).
 * 3. Status progression (QUEUED -> SYNCING -> SYNCED).
 * 4. Write performance & latency benchmark (< 10ms target per record).
 * 5. Data integrity for complex payloads (e.g. coordinates, timestamps, nested objects).
 */

const { performance } = require('perf_hooks');

// In-memory IndexedDB Mock Harness for Headless Verification
function createMockIndexedDB() {
  const stores = new Map();

  return {
    open(dbName, version) {
      const req = {
        result: null,
        error: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };

      setTimeout(() => {
        const db = {
          objectStoreNames: {
            contains: (name) => stores.has(name)
          },
          createObjectStore(name, options) {
            const data = new Map();
            const indices = new Map();
            let autoId = 1;

            const storeObj = {
              name,
              data,
              indices,
              createIndex(indexName, keyPath, opts) {
                indices.set(indexName, { keyPath, unique: opts?.unique || false });
              }
            };
            stores.set(name, storeObj);
            return storeObj;
          },
          transaction(storeNames, mode) {
            const storeName = Array.isArray(storeNames) ? storeNames[0] : storeNames;
            const targetStore = stores.get(storeName);

            return {
              objectStore() {
                return {
                  add(record) {
                    const r = { onsuccess: null, onerror: null, result: null, error: null };
                    setTimeout(() => {
                      const id = record.id || targetStore.data.size + 1;
                      record.id = id;
                      targetStore.data.set(id, { ...record });
                      r.result = id;
                      if (r.onsuccess) r.onsuccess({ target: { result: id } });
                    }, 0);
                    return r;
                  },
                  get(id) {
                    const r = { onsuccess: null, onerror: null, result: null };
                    setTimeout(() => {
                      r.result = targetStore.data.get(id) ? { ...targetStore.data.get(id) } : undefined;
                      if (r.onsuccess) r.onsuccess({ target: { result: r.result } });
                    }, 0);
                    return r;
                  },
                  put(record) {
                    const r = { onsuccess: null, onerror: null };
                    setTimeout(() => {
                      targetStore.data.set(record.id, { ...record });
                      if (r.onsuccess) r.onsuccess();
                    }, 0);
                    return r;
                  },
                  getAll() {
                    const r = { onsuccess: null, onerror: null, result: [] };
                    setTimeout(() => {
                      r.result = Array.from(targetStore.data.values());
                      if (r.onsuccess) r.onsuccess();
                    }, 0);
                    return r;
                  },
                  delete(id) {
                    const r = { onsuccess: null, onerror: null };
                    setTimeout(() => {
                      targetStore.data.delete(id);
                      if (r.onsuccess) r.onsuccess();
                    }, 0);
                    return r;
                  },
                  clear() {
                    const r = { onsuccess: null, onerror: null };
                    setTimeout(() => {
                      targetStore.data.clear();
                      if (r.onsuccess) r.onsuccess();
                    }, 0);
                    return r;
                  },
                  index(indexName) {
                    return {
                      get(keyVal) {
                        const r = { onsuccess: null, onerror: null, result: undefined };
                        setTimeout(() => {
                          for (const item of targetStore.data.values()) {
                            if (item[indexName] === keyVal) {
                              r.result = { ...item };
                              break;
                            }
                          }
                          if (r.onsuccess) r.onsuccess({ target: { result: r.result } });
                        }, 0);
                        return r;
                      },
                      count() {
                        const r = { onsuccess: null, onerror: null, result: 0 };
                        setTimeout(() => {
                          let count = 0;
                          for (const item of targetStore.data.values()) {
                            if (item.status === 'QUEUED') count++;
                          }
                          r.result = count;
                          if (r.onsuccess) r.onsuccess();
                        }, 0);
                        return r;
                      }
                    };
                  }
                };
              }
            };
          }
        };

        if (req.onupgradeneeded) {
          req.onupgradeneeded({ target: { result: db } });
        }

        req.result = db;
        if (req.onsuccess) {
          req.onsuccess({ target: { result: db } });
        }
      }, 0);

      return req;
    }
  };
}

global.indexedDB = createMockIndexedDB();
global.IDBKeyRange = { only: (val) => val };

const { MutationQueue } = require('./queue');

async function runTests() {
  console.log('=== Spike 001: IndexedDB Mutation Queue Automated Verification ===\n');
  const queue = new MutationQueue();
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // Test 1: Initialization
    console.log('[Test 1] Database & ObjectStore Initialization');
    const db = await queue.init();
    assert(db !== null && queue.isInitialized, 'IndexedDB initialized successfully with target store');

    // Test 2: Enqueue Single Mutation
    console.log('\n[Test 2] Enqueue Action & Idempotency Key Generation');
    const res1 = await queue.enqueue({
      actionType: 'STOP_ARRIVED',
      entityId: 'DEL-201',
      payload: { lat: 20.2961, lng: 85.8245, odometer: 1042.8 }
    });
    assert(res1.id === 1, 'Assigned primary numeric key ID = 1');
    assert(res1.status === 'QUEUED', 'Initial status set to QUEUED');
    assert(res1.idempotencyKey.startsWith('STOP_ARRIVED_DEL-201_'), 'Generated structured idempotency key');
    assert(res1.duplicate === false, 'Marked as non-duplicate new record');

    // Test 3: Idempotency Deduplication Guard
    console.log('\n[Test 3] Idempotency Key Deduplication Guard');
    const duplicateSubmission = await queue.enqueue({
      actionType: 'STOP_ARRIVED',
      entityId: 'DEL-201',
      payload: { lat: 20.2961, lng: 85.8245 },
      idempotencyKey: res1.idempotencyKey // Re-submitting with identical key
    });
    assert(duplicateSubmission.id === res1.id, 'Duplicate submission identified existing record ID');
    assert(duplicateSubmission.duplicate === true, 'Returned duplicate: true flag without creating a duplicate record');

    const allAfterDupe = await queue.getAll();
    assert(allAfterDupe.length === 1, 'Store length remains exactly 1 item (no phantom inserts)');

    // Test 4: FIFO Sequence Preservation
    console.log('\n[Test 4] Sequential FIFO Enqueue (Multiple Actions)');
    const res2 = await queue.enqueue({
      actionType: 'COMPLETE_DELIVERY',
      entityId: 'DEL-201',
      payload: { otp: '4921', recipient: 'Rahul Patnaik' }
    });
    const res3 = await queue.enqueue({
      actionType: 'UPLOAD_POD',
      entityId: 'DEL-201',
      payload: { photoBytes: 45000, mime: 'image/webp' }
    });

    const items = await queue.getAll();
    assert(items.length === 3, 'Total 3 items stored in queue');
    assert(items[0].actionType === 'STOP_ARRIVED' && items[1].actionType === 'COMPLETE_DELIVERY' && items[2].actionType === 'UPLOAD_POD',
      'Strict FIFO order preserved: STOP_ARRIVED -> COMPLETE_DELIVERY -> UPLOAD_POD');

    // Test 5: Status Updates during Replay
    console.log('\n[Test 5] Status Transition & Error Tracking');
    const updated = await queue.updateStatus(res1.id, 'SYNCED');
    assert(updated.status === 'SYNCED', 'Status updated from QUEUED to SYNCED');

    const failedUpdate = await queue.updateStatus(res2.id, 'FAILED', 'HTTP 503 Central Gateway Timeout');
    assert(failedUpdate.status === 'FAILED', 'Failed status updated with retry count');
    assert(failedUpdate.retryCount === 1, 'Retry count incremented to 1');
    assert(failedUpdate.error === 'HTTP 503 Central Gateway Timeout', 'Error message recorded for diagnostics');

    // Test 6: Performance Benchmark (50 Writes)
    console.log('\n[Test 6] Performance & Latency Benchmark');
    const benchmarkStart = performance.now();
    const batchPromises = [];
    for (let i = 0; i < 50; i++) {
      batchPromises.push(queue.enqueue({
        actionType: 'TELEMETRY_PING',
        entityId: `VEH-${1000 + i}`,
        payload: { speed: 42.5, heading: 180, seq: i }
      }));
    }
    const batchResults = await Promise.all(batchPromises);
    const benchmarkTime = performance.now() - benchmarkStart;
    const avgLatency = benchmarkTime / 50;

    assert(batchResults.length === 50, 'Successfully processed 50 asynchronous concurrent writes');
    assert(avgLatency < 10, `Average write latency was ${avgLatency.toFixed(2)}ms (target: < 10ms)`);

    // Test 7: Hard Reset / Clear
    console.log('\n[Test 7] Store Purge & Reset');
    await queue.clearAll();
    const itemsAfterClear = await queue.getAll();
    assert(itemsAfterClear.length === 0, 'clearAll() emptied all records from the store');

    console.log(`\n========================================`);
    console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
    console.log(`Verdict: ${failed === 0 ? 'VALIDATED ✓' : 'FAILED ✗'}`);
    console.log(`========================================`);

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
