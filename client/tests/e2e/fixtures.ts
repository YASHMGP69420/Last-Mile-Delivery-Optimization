import { test as base, APIRequestContext, Page, expect } from '@playwright/test';
import { testUsers } from './auth.setup';

// Extend test with custom fixtures
type TestFixtures = {
  api: APIRequestContext;
  adminApi: AuthenticatedAPIRequest;
  managerApi: AuthenticatedAPIRequest;
  driverApi: AuthenticatedAPIRequest;
  createBatch: (deliveryIds: string[]) => Promise<any>;
  createDeliveries: (count: number, options?: any) => Promise<string[]>;
  optimizeBatch: (batchId: string) => Promise<any>;
  dispatchRoute: (routeId: string) => Promise<any>;
  loginAs: (role: 'admin' | 'manager' | 'driver') => Promise<Page>;
};

// Type for authenticated API request wrapper
type AuthenticatedAPIRequest = {
  post: (url: string, options?: any) => Promise<any>;
  get: (url: string, options?: any) => Promise<any>;
  patch: (url: string, options?: any) => Promise<any>;
  delete: (url: string, options?: any) => Promise<any>;
  put: (url: string, options?: any) => Promise<any>;
};

// Helper to create authenticated request wrapper
function createAuthRequest(request: APIRequestContext, token: string): AuthenticatedAPIRequest {
  return {
    async post(url: string, options: any = {}) {
      return request.post(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      });
    },
    async get(url: string, options: any = {}) {
      return request.get(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      });
    },
    async patch(url: string, options: any = {}) {
      return request.patch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      });
    },
    async delete(url: string, options: any = {}) {
      return request.delete(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      });
    },
    async put(url: string, options: any = {}) {
      return request.put(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      });
    },
  };
}

export const test = base.extend<TestFixtures>({
  // Base API request context (unauthenticated)
  api: async ({ request }, use) => {
    await use(request);
  },

  // Authenticated API contexts for each role
  adminApi: async ({ request }, use) => {
    const loginResponse = await request.post('/api/v1/auth/login', {
      data: {
        email: testUsers.admin.email,
        password: testUsers.admin.password,
      },
    });
    const loginData = await loginResponse.json();
    const token = loginData.data.token;

    const authRequest = createAuthRequest(request, token);
    await use(authRequest);
  },

  managerApi: async ({ request }, use) => {
    const loginResponse = await request.post('/api/v1/auth/login', {
      data: {
        email: testUsers.manager.email,
        password: testUsers.manager.password,
      },
    });
    const loginData = await loginResponse.json();
    const token = loginData.data.token;

    const authRequest = createAuthRequest(request, token);
    await use(authRequest);
  },

  driverApi: async ({ request }, use) => {
    const loginResponse = await request.post('/api/v1/auth/login', {
      data: {
        email: testUsers.driver.email,
        password: testUsers.driver.password,
      },
    });
    const loginData = await loginResponse.json();
    const token = loginData.data.token;

    const authRequest = createAuthRequest(request, token);
    await use(authRequest);
  },

  // Helper to create a batch with delivery IDs
  createBatch: async ({ managerApi }, use) => {
    const createdBatches: string[] = [];

    const create = async (deliveryIds: string[]) => {
      const response = await managerApi.post('/api/v1/batches', {
        data: {
          name: `E2E Test Batch ${Date.now()}`,
          deliveryIds,
          depot: {
            name: 'Rasulgarh Depot',
            address: 'Rasulgarh, Bhubaneswar, Odisha 751010',
            coordinates: { lat: 20.2961, lng: 85.8245 },
          },
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      createdBatches.push(data.data.batch.id);
      return data.data.batch;
    };

    await use(create);

    // Cleanup: delete created batches
    for (const batchId of createdBatches) {
      try {
        await managerApi.delete(`/api/v1/batches/${batchId}`);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  },

  // Helper to create test deliveries and return their IDs
  createDeliveries: async ({ managerApi }, use) => {
    const createdDeliveryIds: string[] = [];

    const create = async (count: number, options: any = {}) => {
      const deliveryIds: string[] = [];
      const baseLat = 20.2961;
      const baseLng = 85.8245;

      for (let i = 0; i < count; i++) {
        const lat = baseLat + (Math.random() - 0.5) * 0.1;
        const lng = baseLng + (Math.random() - 0.5) * 0.1;

        const deliveryResponse = await managerApi.post('/api/v1/deliveries', {
          data: {
            orderReference: `E2E-CONS-${Date.now()}-${i}`,
            customer: {
              name: `Test Customer ${i + 1}`,
              phone: `+9198765${String(43210 + i).padStart(5, '0')}`,
            },
            address: {
              street: `Test Street ${i + 1}`,
              city: 'Bhubaneswar',
              zone: 'Patia (Z-1)',
              postalCode: '751024',
            },
            location: {
              type: 'Point',
              coordinates: [lng, lat],
              geocoded: true,
              geocodingSource: 'SIMULATED',
            },
            weightKg: options.weightKg || Math.floor(Math.random() * 50) + 10,
            volumeM3: options.volumeM3 || 0.1,
            priority: options.priority || 'Standard',
            timeWindow: options.timeWindow || {
              start: '09:00',
              end: '18:00',
            },
            serviceDurationMinutes: options.serviceTimeMinutes || 5,
            status: 'DRAFT',
          },
        });

        expect(deliveryResponse.ok()).toBeTruthy();
        const deliveryData = await deliveryResponse.json();
        deliveryIds.push(deliveryData.data.id);
        createdDeliveryIds.push(deliveryData.data.id);
      }

      return deliveryIds;
    };

    await use(create);

    // Cleanup: delete created deliveries
    for (const deliveryId of createdDeliveryIds) {
      try {
        await managerApi.delete(`/api/v1/deliveries/${deliveryId}`);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  },

  // Helper to optimize a batch
  optimizeBatch: async ({ managerApi }, use) => {
    const optimize = async (batchId: string) => {
      const response = await managerApi.post(`/api/v1/routes/optimize`, {
        data: { batchId },
      });

      expect(response.ok()).toBeTruthy();
      return response.json();
    };

    await use(optimize);
  },

  // Helper to dispatch a route
  dispatchRoute: async ({ managerApi }, use) => {
    const dispatch = async (routeId: string) => {
      const response = await managerApi.post(`/api/v1/routes/${routeId}/dispatch`);
      expect(response.ok()).toBeTruthy();
      return response.json();
    };

    await use(dispatch);
  },

  // Helper to login as a specific role and return authenticated page
  loginAs: async ({ page, browser }, use) => {
    const login = async (role: 'admin' | 'manager' | 'driver') => {
      const user = testUsers[role];
      const storageState = user.storageState;

      // Create new context with storage state
      const context = await browser.newContext({ storageState });
      const newPage = await context.newPage();

      // Navigate to verify login works
      await newPage.goto('/');
      await newPage.waitForLoadState('networkidle');

      return newPage;
    };

    await use(login);
  },
});

export { expect } from '@playwright/test';