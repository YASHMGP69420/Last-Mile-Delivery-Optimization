import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apiClient,
  clearInFlightCache,
  inFlightRequests,
  cachedResponses,
  setUnderlyingAdapter,
} from '../client';
import { createRealtimeSocket } from '../../utils/socketClient';
import { io } from 'socket.io-client';

vi.mock('socket.io-client', () => {
  const mockIo = vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  }));
  return {
    io: mockIo,
    default: mockIo,
  };
});

describe('API In-Flight Query Deduplication & Caching (D-03)', () => {
  let mockAdapter: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearInFlightCache();
    mockAdapter = vi.fn(async (config) => {
      // Small simulated delay to simulate async network flight
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        data: { message: 'ok', url: config.url, params: config.params },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    });
    setUnderlyingAdapter(mockAdapter);
  });

  afterEach(() => {
    clearInFlightCache();
    setUnderlyingAdapter(null);
    vi.restoreAllMocks();
  });

  it('collapses concurrent identical GET requests into a single in-flight call', async () => {
    const req1 = apiClient.get('/test-endpoint', { params: { active: true } });
    const req2 = apiClient.get('/test-endpoint', { params: { active: true } });
    const req3 = apiClient.get('/test-endpoint', { params: { active: true } });

    // Allow Axios request interceptor microtasks to resolve to the adapter
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(inFlightRequests.size).toBe(1);

    const [res1, res2, res3] = await Promise.all([req1, req2, req3]);

    expect(mockAdapter).toHaveBeenCalledTimes(1);
    expect(res1.data).toEqual(res2.data);
    expect(res2.data).toEqual(res3.data);
    expect(inFlightRequests.size).toBe(0);
  });

  it('separates GET requests with different endpoints or parameters', async () => {
    const req1 = apiClient.get('/test-endpoint-a');
    const req2 = apiClient.get('/test-endpoint-b');
    const req3 = apiClient.get('/test-endpoint-a', { params: { page: 2 } });

    // Allow Axios request interceptor microtasks to resolve to the adapter
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(inFlightRequests.size).toBe(3);

    await Promise.all([req1, req2, req3]);

    expect(mockAdapter).toHaveBeenCalledTimes(3);
  });

  it('separates GET requests with different URLSearchParams without cache collision', async () => {
    const params1 = new URLSearchParams({ page: '1', status: 'PENDING' });
    const params2 = new URLSearchParams({ page: '2', status: 'COMPLETED' });

    const req1 = apiClient.get('/search-params-test', { params: params1 });
    const req2 = apiClient.get('/search-params-test', { params: params2 });

    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(inFlightRequests.size).toBe(2);

    const [res1, res2] = await Promise.all([req1, req2]);
    expect(mockAdapter).toHaveBeenCalledTimes(2);
    expect(res1.data.params.toString()).toBe(params1.toString());
    expect(res2.data.params.toString()).toBe(params2.toString());
  });

  it('serves responses from short-term TTL cache within 3000ms window', async () => {
    const res1 = await apiClient.get('/cached-resource');
    expect(mockAdapter).toHaveBeenCalledTimes(1);

    // Immediate second call should hit cachedResponses
    const res2 = await apiClient.get('/cached-resource');
    expect(mockAdapter).toHaveBeenCalledTimes(1);
    expect(res2.data).toEqual(res1.data);
  });

  it('bypasses short-term cache when Cache-Control: no-cache header is provided', async () => {
    await apiClient.get('/cached-resource-2');
    expect(mockAdapter).toHaveBeenCalledTimes(1);

    // Call with no-cache header should bypass cache
    await apiClient.get('/cached-resource-2', {
      headers: { 'Cache-Control': 'no-cache' },
    });
    expect(mockAdapter).toHaveBeenCalledTimes(2);
  });

  it('clears cached responses when state-mutating requests (POST, PUT, DELETE, PATCH) execute', async () => {
    // Populate cache with a GET
    await apiClient.get('/target-resource');
    expect(mockAdapter).toHaveBeenCalledTimes(1);
    expect(cachedResponses.size).toBeGreaterThan(0);

    // Execute state-mutating POST
    await apiClient.post('/target-resource', { name: 'new resource' });
    expect(cachedResponses.size).toBe(0);
    expect(inFlightRequests.size).toBe(0);

    // Next GET should call adapter again
    await apiClient.get('/target-resource');
    expect(mockAdapter).toHaveBeenCalledTimes(3); // 1st GET + 1 POST + 2nd GET
  });

  it('clears cached responses on PUT, DELETE, and PATCH mutations', async () => {
    // Populate cache
    await apiClient.get('/items');
    expect(cachedResponses.size).toBe(1);

    await apiClient.put('/items/1', { updated: true });
    expect(cachedResponses.size).toBe(0);

    await apiClient.get('/items');
    expect(cachedResponses.size).toBe(1);

    await apiClient.patch('/items/1', { patched: true });
    expect(cachedResponses.size).toBe(0);

    await apiClient.get('/items');
    expect(cachedResponses.size).toBe(1);

    await apiClient.delete('/items/1');
    expect(cachedResponses.size).toBe(0);
  });

  it('clearInFlightCache wipes both in-flight and cached registries', async () => {
    await apiClient.get('/test-cache');
    expect(cachedResponses.size).toBe(1);

    clearInFlightCache();

    expect(cachedResponses.size).toBe(0);
    expect(inFlightRequests.size).toBe(0);
  });
});

describe('Socket.IO Transport & Jitter Configuration (D-04)', () => {
  it('configures websocket-first transport priority and exponential backoff jitter', () => {
    vi.mocked(io).mockClear();
    createRealtimeSocket('mock-token');

    expect(io).toHaveBeenCalled();
    const options = vi.mocked(io).mock.calls[0][1];

    expect(options).toBeDefined();
    expect(options?.transports).toEqual(['websocket', 'polling']);
    expect(options?.randomizationFactor).toBe(0.5);
    expect(options?.reconnectionDelay).toBe(1200);
    expect(options?.reconnectionDelayMax).toBe(5000);
  });
});
