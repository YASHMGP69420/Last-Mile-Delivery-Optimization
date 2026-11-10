import { apiClient } from './client';
import { ApiResponse } from '../types';
import {
  Route,
  OptimizationResult,
  OptimizeRoutePayload,
  DispatchRoutePayload,
  DispatchValidationResult,
  BaselineEvaluationResult,
} from '../types/route';

export const RoutesApi = {
  /**
   * Evaluate baseline metrics (road distance, duration, ETAs, fuel/cost) before optimization
   */
  evaluateBaseline: async (payload: {
    batchId?: string;
    deliveryIds?: string[];
    vehicleId?: string;
    depot?: any;
    departureTime?: string;
  }): Promise<ApiResponse<BaselineEvaluationResult>> => {
    const res = await apiClient.post<ApiResponse<BaselineEvaluationResult>>('/routes/evaluate-baseline', payload);
    return res.data;
  },

  /**
   * Validate dispatch eligibility before submitting
   */
  validateDispatch: async (payload: {
    routeId?: string;
    batchId?: string;
    vehicleId?: string;
    driverId?: string;
    stopSequence?: string[];
  }): Promise<ApiResponse<DispatchValidationResult>> => {
    const res = await apiClient.post<ApiResponse<DispatchValidationResult>>('/routes/validate-dispatch', payload);
    return res.data;
  },
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

  /**
   * Reorder stops on an active route and broadcast sequence update to driver
   */
  reorderStops: async (routeId: string, stopSequence: string[], reason?: string): Promise<ApiResponse<Route>> => {
    const res = await apiClient.post<ApiResponse<Route>>(`/routes/${routeId}/reorder`, { stopSequence, reason });
    return res.data;
  },

  /**
   * Send operational dispatch instruction directly to driver handheld
   */
  sendMessage: async (
    routeId: string,
    message: string,
    severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO',
    title?: string
  ): Promise<ApiResponse<any>> => {
    const res = await apiClient.post<ApiResponse<any>>(`/routes/${routeId}/message`, { message, severity, title });
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
   * Mid-shift re-optimization of an active route under a target traffic scenario
   */
  reoptimize: async (
    routeId: string,
    payload?: {
      trafficScenario?: string;
      anchorCoordinates?: { lat: number; lng: number };
      reason?: string;
    }
  ): Promise<ApiResponse<any>> => {
    const res = await apiClient.post<ApiResponse<any>>(`/routes/${routeId}/reoptimize`, payload || {});
    return res.data;
  },
};

// Export individual functions as well for flexibility
export const optimizeRoute = RoutesApi.optimize;
export const dispatchRoute = RoutesApi.dispatch;
export const getRoutes = RoutesApi.list;
export const getRouteById = RoutesApi.getById;
