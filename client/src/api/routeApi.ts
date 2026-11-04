import { apiClient } from './client';
import { ApiResponse } from '../types';
import {
  Route,
  OptimizationResult,
  OptimizeRoutePayload,
  DispatchRoutePayload,
} from '../types/route';

export const RoutesApi = {
  /**
   * Run 2-Opt route optimization against a batch
   */
  optimize: async (payload: OptimizeRoutePayload): Promise<ApiResponse<OptimizationResult>> => {
    const res = await apiClient.post<ApiResponse<OptimizationResult>>('/routes/optimize', payload);
    return res.data;
  },

  /**
   * Alias for optimize
   */
  optimizeRoute: async (payload: OptimizeRoutePayload): Promise<ApiResponse<OptimizationResult>> => {
    const res = await apiClient.post<ApiResponse<OptimizationResult>>('/routes/optimize', payload);
    return res.data;
  },

  /**
   * Push route to driver handheld device for execution
   */
  pushToHandheld: async (routeId: string): Promise<ApiResponse<{ success: boolean }>> => {
    const res = await apiClient.post<ApiResponse<{ success: boolean }>>(`/routes/${routeId}/push`, {});
    return res.data;
  },

  dispatch: async (routeId: string, payload: DispatchRoutePayload): Promise<ApiResponse<Route>> => {
    const res = await apiClient.post<ApiResponse<Route>>(`/routes/${routeId}/dispatch`, payload);
    return res.data;
  },

  /**
   * Alias for dispatch
   */
  dispatchRoute: async (routeId: string, payload: DispatchRoutePayload): Promise<ApiResponse<Route>> => {
    const res = await apiClient.post<ApiResponse<Route>>(`/routes/${routeId}/dispatch`, payload);
    return res.data;
  },

  /**
   * List routes with optional batch or status filter
   */
  list: async (params?: Record<string, any>): Promise<ApiResponse<{ routes: Route[]; total: number }>> => {
    const res = await apiClient.get<ApiResponse<{ routes: Route[]; total: number }>>('/routes', { params });
    return res.data;
  },

  /**
   * Alias for list
   */
  getRoutes: async (params?: Record<string, any>): Promise<ApiResponse<{ routes: Route[]; total: number }>> => {
    const res = await apiClient.get<ApiResponse<{ routes: Route[]; total: number }>>('/routes', { params });
    return res.data;
  },

  /**
   * Retrieve single route with version snapshots and audit timeline
   */
  getById: async (id: string): Promise<ApiResponse<{ route: Route; baseline?: Route }>> => {
    const res = await apiClient.get<ApiResponse<{ route: Route; baseline?: Route }>>(`/routes/${id}`);
    return res.data;
  },

  /**
   * Alias for getById
   */
  getRouteById: async (id: string): Promise<ApiResponse<{ route: Route; baseline?: Route }>> => {
    const res = await apiClient.get<ApiResponse<{ route: Route; baseline?: Route }>>(`/routes/${id}`);
    return res.data;
  },

  /**
   * Reset route custom sequence back to default manifest order
   */
  reset: async (batchId: string): Promise<ApiResponse<{ message: string }>> => {
    const res = await apiClient.post<ApiResponse<{ message: string }>>(`/routes/batch/${batchId}/reset`);
    return res.data;
  },
};

// Export individual functions as well for flexibility
export const optimizeRoute = RoutesApi.optimize;
export const dispatchRoute = RoutesApi.dispatch;
export const getRoutes = RoutesApi.list;
export const getRouteById = RoutesApi.getById;
