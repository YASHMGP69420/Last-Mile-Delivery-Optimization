import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import {
  ApiResponse,
  Delivery,
  DeliveryBatch,
  Vehicle,
  Driver,
  CsvValidationSummary,
} from '../types';

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

// Response interceptor handling session expiration
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const code = error.response.data?.error?.code;
      if (code === 'TOKEN_EXPIRED' || code === 'TOKEN_REVOKED') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
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
  updateStatus: async (id: string, status: string): Promise<ApiResponse<{ batch: DeliveryBatch }>> => {
    const res = await apiClient.patch(`/batches/${id}/status`, { status });
    return res.data;
  },
  delete: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const res = await apiClient.delete(`/batches/${id}`);
    return res.data;
  },
};

export const FleetApi = {
  getVehicles: async (params?: Record<string, any>): Promise<ApiResponse<{ vehicles: Vehicle[]; total: number }>> => {
    const res = await apiClient.get('/vehicles', { params });
    return res.data;
  },
  getDrivers: async (params?: Record<string, any>): Promise<ApiResponse<{ drivers: Driver[]; total: number }>> => {
    const res = await apiClient.get('/drivers', { params });
    return res.data;
  },
  assignVehicle: async (driverId: string, vehicleId: string): Promise<ApiResponse<{ driver: Driver; vehicle: Vehicle }>> => {
    const res = await apiClient.put(`/drivers/${driverId}/assign`, { vehicleId });
    return res.data;
  },
  unassignVehicle: async (driverId: string): Promise<ApiResponse<{ driver: Driver; vehicle: Vehicle }>> => {
    const res = await apiClient.put(`/drivers/${driverId}/unassign`);
    return res.data;
  },
};

export * from './routeApi';

