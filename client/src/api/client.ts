import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { ApiResponse, Delivery, DeliveryBatch, Vehicle, Driver, CsvValidationSummary, Fleet } from '../types';
import { getFriendlyErrorMessage } from '../utils/errorUtils';

export const apiClient: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor attaching Bearer token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Single-flight refresh token promise to coalesce concurrent 401 TOKEN_EXPIRED retries
let refreshPromise: Promise<string | null> | null = null;

function clearAuthStorage() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.dispatchEvent(new Event('smartroute:session-expired'));
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const storedRefreshToken = localStorage.getItem('refreshToken');
    if (!storedRefreshToken) {
      return null;
    }

    try {
      const res = await axios.post('/api/v1/auth/refresh', {
        refreshToken: storedRefreshToken,
      });
      const { token: newToken, refreshToken: newRefreshToken } = res.data?.data || {};
      if (!newToken) {
        return null;
      }

      localStorage.setItem('token', newToken);
      if (newRefreshToken) {
        localStorage.setItem('refreshToken', newRefreshToken);
      }
      window.dispatchEvent(new CustomEvent('smartroute:token-refreshed', { detail: { token: newToken } }));
      return newToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Response interceptor handling session expiration, auto-refresh, and semantic error formatting
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (error.response && error.response.status === 401) {
      const code = error.response.data?.error?.code;
      const reqUrl = originalRequest?.url || '';
      const isAuthEndpoint =
        reqUrl.includes('/auth/refresh') ||
        reqUrl.includes('/auth/login') ||
        reqUrl.includes('/auth/register') ||
        reqUrl.includes('/auth/google');

      if (code === 'TOKEN_EXPIRED' && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
        originalRequest._retry = true;
        const newToken = await refreshAccessToken();
        if (newToken) {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return apiClient(originalRequest);
        }

        clearAuthStorage();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      } else if (code === 'TOKEN_REVOKED' || code === 'TOKEN_EXPIRED') {
        clearAuthStorage();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    // Attach human-friendly non-technical explanation to the error
    const friendly = getFriendlyErrorMessage(error);
    error.friendlyMessage = friendly;
    // Also rewrite error.message so standard catch blocks (err.message) display semantic text
    if (friendly) {
      error.message = friendly;
    }

    return Promise.reject(error);
  }
);

// API Service Endpoints
export const DeliveriesApi = {
  list: async (params?: Record<string, any>): Promise<ApiResponse<{ deliveries: Delivery[]; total: number; page: number; totalPages: number }>> => {
    const res = await apiClient.get('/deliveries', { params });
    return res.data;
  },
  getById: async (id: string): Promise<ApiResponse<{ delivery: Delivery; timeline: any[] }>> => {
    const res = await apiClient.get(`/deliveries/${id}`);
    return res.data;
  },
  create: async (data: Partial<Delivery>): Promise<ApiResponse<Delivery>> => {
    const res = await apiClient.post('/deliveries', data);
    return res.data;
  },
  update: async (id: string, data: Partial<Delivery>): Promise<ApiResponse<Delivery>> => {
    const res = await apiClient.put(`/deliveries/${id}`, data);
    return res.data;
  },
  updateStatus: async (id: string, data: { status: string; failureReason?: string; failureNotes?: string; pod?: any }): Promise<ApiResponse<Delivery>> => {
    const res = await apiClient.patch(`/deliveries/${id}/status`, data);
    return res.data;
  },
  assign: async (id: string, data: { vehicleId: string; driverId: string }): Promise<ApiResponse<Delivery>> => {
    const res = await apiClient.patch(`/deliveries/${id}/assign`, data);
    return res.data;
  },
  importCsv: async (csvContent: string, options: { dryRun: boolean; batchId?: string | null }): Promise<ApiResponse<CsvValidationSummary>> => {
    const res = await apiClient.post('/deliveries/import-csv', { csvContent, dryRun: options.dryRun, batchId: options.batchId });
    return res.data;
  },
  delete: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const res = await apiClient.delete(`/deliveries/${id}`);
    return res.data;
  },
};

export const BatchesApi = {
  list: async (params?: Record<string, any>): Promise<ApiResponse<{ batches: DeliveryBatch[]; total: number; page: number; totalPages: number }>> => {
    const res = await apiClient.get('/batches', { params });
    return res.data;
  },
  getById: async (id: string): Promise<ApiResponse<{ batch: DeliveryBatch }>> => {
    const res = await apiClient.get(`/batches/${id}`);
    return res.data;
  },
  create: async (data: Partial<DeliveryBatch>): Promise<ApiResponse<{ batch: DeliveryBatch }>> => {
    const res = await apiClient.post('/batches', data);
    return res.data;
  },
  update: async (id: string, data: Partial<DeliveryBatch>): Promise<ApiResponse<{ batch: DeliveryBatch }>> => {
    const res = await apiClient.put(`/batches/${id}`, data);
    return res.data;
  },
  duplicate: async (id: string): Promise<ApiResponse<{ batch: DeliveryBatch }>> => {
    const res = await apiClient.post(`/batches/${id}/duplicate`);
    return res.data;
  },
  addDeliveries: async (id: string, deliveryIds: string[]): Promise<ApiResponse<{ batch: DeliveryBatch }>> => {
    const res = await apiClient.post(`/batches/${id}/deliveries`, { deliveryIds });
    return res.data;
  },
  removeDelivery: async (id: string, deliveryId: string): Promise<ApiResponse<{ batch: DeliveryBatch }>> => {
    const res = await apiClient.delete(`/batches/${id}/deliveries/${deliveryId}`);
    return res.data;
  },
  assignFleet: async (id: string, data: { vehicleIds?: string[]; driverIds?: string[] }): Promise<ApiResponse<{ batch: DeliveryBatch }>> => {
    const res = await apiClient.post(`/batches/${id}/assign`, data);
    return res.data;
  },
  exportCsvUrl: (id: string): string => {
    return `/api/v1/batches/${id}/export`;
  },
  updateStatus: async (id: string, status: string): Promise<ApiResponse<{ batch: DeliveryBatch }>> => {
    const res = await apiClient.patch(`/batches/${id}/status`, { status });
    return res.data;
  },
  delete: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const res = await apiClient.delete(`/batches/${id}`);
    return res.data;
  },
};

export const TelemetryApi = {
  ingest: async (data: Record<string, any>): Promise<ApiResponse<any>> => {
    const res = await apiClient.post('/telemetry', data);
    return res.data;
  },
  getLive: async (): Promise<ApiResponse<{ fleet: any[] }>> => {
    const res = await apiClient.get('/telemetry/live');
    return res.data;
  },
  getHistory: async (vehicleId: string, params?: Record<string, any>): Promise<ApiResponse<{ history: any[] }>> => {
    const res = await apiClient.get(`/telemetry/history/${vehicleId}`, { params });
    return res.data;
  },
  getAlerts: async (params?: Record<string, any>): Promise<ApiResponse<{ alerts: any[] }>> => {
    const res = await apiClient.get('/telemetry/alerts', { params });
    return res.data;
  },
  acknowledgeAlert: async (id: string): Promise<ApiResponse<{ alert: any }>> => {
    const res = await apiClient.post(`/telemetry/alerts/${id}/ack`);
    return res.data;
  },
};

export const FleetApi = {
  // Fleet management endpoints
  list: async (params?: Record<string, any>): Promise<ApiResponse<{ fleets: Fleet[]; total: number; page: number; totalPages: number }>> => {
    const res = await apiClient.get('/fleets', { params });
    return res.data;
  },
  create: async (data: Partial<Fleet>): Promise<ApiResponse<Fleet>> => {
    const res = await apiClient.post('/fleets', data);
    return res.data;
  },
  importCsv: async (csvContent: string, options: { dryRun: boolean; batchId?: string | null }): Promise<ApiResponse<any>> => {
    const res = await apiClient.post('/fleets/import-csv', { csvContent, dryRun: options.dryRun, batchId: options.batchId });
    return res.data;
  },
  // Vehicle management
  getVehicles: async (params?: Record<string, any>): Promise<ApiResponse<{ vehicles: Vehicle[]; total: number }>> => {
    const res = await apiClient.get('/vehicles', { params });
    return res.data;
  },
  createVehicle: async (data: Partial<Vehicle>): Promise<ApiResponse<{ vehicle: Vehicle }>> => {
    const res = await apiClient.post('/vehicles', data);
    return res.data;
  },
  importVehicleCsv: async (csvContent: string, options: { dryRun: boolean }): Promise<ApiResponse<any>> => {
    const res = await apiClient.post('/vehicles/import-csv', { csvContent, dryRun: options.dryRun });
    return res.data;
  },
  // Driver management
  getDrivers: async (params?: Record<string, any>): Promise<ApiResponse<{ drivers: Driver[]; total: number }>> => {
    const res = await apiClient.get('/drivers', { params });
    return res.data;
  },
  createDriver: async (data: { name: string; email: string; phone: string; licenseNumber: string; password?: string }): Promise<ApiResponse<{ driver: Driver }>> => {
    const res = await apiClient.post('/drivers', data);
    return res.data;
  },
  importDriverCsv: async (csvContent: string, options: { dryRun: boolean }): Promise<ApiResponse<any>> => {
    const res = await apiClient.post('/drivers/import-csv', { csvContent, dryRun: options.dryRun });
    return res.data;
  },
  // Assign / unassign vehicle to driver
  assignVehicle: async (driverId: string, vehicleId: string): Promise<ApiResponse<{ driver: Driver; vehicle: Vehicle }>> => {
    const res = await apiClient.put(`/drivers/${driverId}/assign`, { vehicleId });
    return res.data;
  },
  unassignVehicle: async (driverId: string): Promise<ApiResponse<{ driver: Driver; vehicle: Vehicle }>> => {
    const res = await apiClient.put(`/drivers/${driverId}/unassign`);
    return res.data;
  },
};

// ==========================================
// ADMIN CONTROL CENTER API
// ==========================================
export const AdminApi = {
  getOverview: async (): Promise<ApiResponse<any>> => {
    const res = await apiClient.get('/admin/overview');
    return res.data;
  },
  // Users
  getUsers: async (params?: Record<string, any>): Promise<ApiResponse<any>> => {
    const res = await apiClient.get('/admin/users', { params });
    return res.data;
  },
  createUser: async (data: Record<string, any>): Promise<ApiResponse<any>> => {
    const res = await apiClient.post('/admin/users', data);
    return res.data;
  },
  updateUser: async (id: string, data: Record<string, any>): Promise<ApiResponse<any>> => {
    const res = await apiClient.put(`/admin/users/${id}`, data);
    return res.data;
  },
  updateUserStatus: async (id: string, data: { status: string; reason?: string }): Promise<ApiResponse<any>> => {
    const res = await apiClient.patch(`/admin/users/${id}/status`, data);
    return res.data;
  },
  resetUserPassword: async (id: string, data?: { newPassword?: string }): Promise<ApiResponse<any>> => {
    const res = await apiClient.post(`/admin/users/${id}/reset-password`, data || {});
    return res.data;
  },
  // Permissions
  getPermissions: async (): Promise<ApiResponse<any>> => {
    const res = await apiClient.get('/admin/permissions');
    return res.data;
  },
  updatePermissions: async (data: { permissions: any; reason?: string }): Promise<ApiResponse<any>> => {
    const res = await apiClient.put('/admin/permissions', data);
    return res.data;
  },
  // Organization & Depots
  getOrganization: async (): Promise<ApiResponse<any>> => {
    const res = await apiClient.get('/admin/organization');
    return res.data;
  },
  updateOrganization: async (data: Record<string, any>): Promise<ApiResponse<any>> => {
    const res = await apiClient.put('/admin/organization', data);
    return res.data;
  },
  addDepot: async (data: Record<string, any>): Promise<ApiResponse<any>> => {
    const res = await apiClient.post('/admin/depots', data);
    return res.data;
  },
  updateDepot: async (id: string, data: Record<string, any>): Promise<ApiResponse<any>> => {
    const res = await apiClient.put(`/admin/depots/${id}`, data);
    return res.data;
  },
  // Fleet Control
  getFleetControl: async (): Promise<ApiResponse<any>> => {
    const res = await apiClient.get('/admin/fleet-control');
    return res.data;
  },
  overrideFleetResource: async (data: { resourceType: string; resourceId: string; action: string; reason: string }): Promise<ApiResponse<any>> => {
    const res = await apiClient.post('/admin/fleet-control/override', data);
    return res.data;
  },
  // Operations Control
  getOperationsOversight: async (): Promise<ApiResponse<any>> => {
    const res = await apiClient.get('/admin/operations');
    return res.data;
  },
  overrideOperation: async (data: { targetType: string; targetId: string; action: string; reason: string; newPriority?: string }): Promise<ApiResponse<any>> => {
    const res = await apiClient.post('/admin/operations/override', data);
    return res.data;
  },
  // Optimization Settings
  getOptimizationSettings: async (): Promise<ApiResponse<any>> => {
    const res = await apiClient.get('/admin/optimization-settings');
    return res.data;
  },
  updateOptimizationSettings: async (data: Record<string, any>): Promise<ApiResponse<any>> => {
    const res = await apiClient.put('/admin/optimization-settings', data);
    return res.data;
  },
  // Fuel Settings
  getFuelSettings: async (): Promise<ApiResponse<any>> => {
    const res = await apiClient.get('/admin/fuel-settings');
    return res.data;
  },
  updateFuelSettings: async (data: Record<string, any>): Promise<ApiResponse<any>> => {
    const res = await apiClient.put('/admin/fuel-settings', data);
    return res.data;
  },
  // Integrations
  getIntegrations: async (): Promise<ApiResponse<any>> => {
    const res = await apiClient.get('/admin/integrations');
    return res.data;
  },
  testIntegration: async (service: string): Promise<ApiResponse<any>> => {
    const res = await apiClient.post('/admin/integrations/test', { service });
    return res.data;
  },
  // Audit Logs
  getAuditLogs: async (params?: Record<string, any>): Promise<ApiResponse<any>> => {
    const res = await apiClient.get('/admin/audit-logs', { params });
    return res.data;
  },
  // Notifications
  getNotifications: async (params?: Record<string, any>): Promise<ApiResponse<any>> => {
    const res = await apiClient.get('/admin/notifications', { params });
    return res.data;
  },
  createNotification: async (data: Record<string, any>): Promise<ApiResponse<any>> => {
    const res = await apiClient.post('/admin/notifications', data);
    return res.data;
  },
  markNotificationRead: async (id: string): Promise<ApiResponse<any>> => {
    const res = await apiClient.patch(`/admin/notifications/${id}/read`);
    return res.data;
  },
  // Data Export
  exportData: async (dataset: string): Promise<ApiResponse<any>> => {
    const res = await apiClient.get(`/admin/data-export?dataset=${dataset}`);
    return res.data;
  },
};

// ==========================================
// DRIVER HUD / COCKPIT API
// ==========================================
export const DriverHudApi = {
  getDashboard: async (params?: Record<string, any>): Promise<ApiResponse<any>> => {
    const res = await apiClient.get('/driver-hud/dashboard', { params });
    return res.data;
  },
  startShift: async (data?: Record<string, any>): Promise<ApiResponse<any>> => {
    const res = await apiClient.post('/driver-hud/shifts/start', data || {});
    return res.data;
  },
  endShift: async (data: { handoverNotes?: string }): Promise<ApiResponse<any>> => {
    const res = await apiClient.post('/driver-hud/shifts/end', data);
    return res.data;
  },
  submitVehicleCheck: async (data: Record<string, any>): Promise<ApiResponse<any>> => {
    const res = await apiClient.post('/driver-hud/vehicle-check', data);
    return res.data;
  },
  getActiveRoute: async (): Promise<ApiResponse<any>> => {
    const res = await apiClient.get('/driver-hud/route');
    return res.data;
  },
  claimRoute: async (routeId?: string): Promise<ApiResponse<any>> => {
    const res = await apiClient.post('/driver-hud/route/claim', { routeId });
    return res.data;
  },
  updateLocation: async (data: {
    coordinates: [number, number];
    accuracyMeters?: number;
    speedKmh?: number;
    headingDegrees?: number;
    altitudeMeters?: number;
    batteryPercent?: number;
  }): Promise<ApiResponse<any>> => {
    const res = await apiClient.post('/driver-hud/location', data);
    return res.data;
  },
  getDeliveries: async (params?: { status?: string }): Promise<ApiResponse<any>> => {
    const res = await apiClient.get('/driver-hud/deliveries', { params });
    return res.data;
  },
  getDeliveryById: async (id: string): Promise<ApiResponse<any>> => {
    const res = await apiClient.get(`/driver-hud/deliveries/${id}`);
    return res.data;
  },
  markDeliveryArrived: async (id: string): Promise<ApiResponse<any>> => {
    const res = await apiClient.post(`/driver-hud/deliveries/${id}/arrived`);
    return res.data;
  },
  completeDelivery: async (id: string, data: Record<string, any>): Promise<ApiResponse<any>> => {
    const res = await apiClient.post(`/driver-hud/deliveries/${id}/complete`, data);
    return res.data;
  },
  failDelivery: async (id: string, data: { failureReason: string; failureNotes?: string }): Promise<ApiResponse<any>> => {
    const res = await apiClient.post(`/driver-hud/deliveries/${id}/fail`, data);
    return res.data;
  },
  reportIncident: async (data: Record<string, any>): Promise<ApiResponse<any>> => {
    const res = await apiClient.post('/driver-hud/incidents', data);
    return res.data;
  },
  getIncidents: async (): Promise<ApiResponse<any>> => {
    const res = await apiClient.get('/driver-hud/incidents');
    return res.data;
  },
  getProfile: async (): Promise<ApiResponse<any>> => {
    const res = await apiClient.get('/driver-hud/profile');
    return res.data;
  },
  getNotifications: async (): Promise<ApiResponse<any>> => {
    const res = await apiClient.get('/driver-hud/notifications');
    return res.data;
  },
};

export * from './routeApi';