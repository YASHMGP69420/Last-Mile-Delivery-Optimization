import { useState, useCallback } from 'react';
import {
  OptimizationConfig,
  OptimizationResult,
  OptimizeRoutePayload,
  StrategyPreset,
  TrafficScenario,
  VehiclePreference,
  PlannedRoute,
  VehicleAssignment,
} from '../types/route';
import { RoutesApi } from '../api/routeApi';

const DEFAULT_CONFIG: OptimizationConfig = {
  maxIterations: 1000,
  trafficScenario: 'MORNING_RUSH',
  vehiclePreference: 'EV_PREFERRED',
  weights: {
    distanceWeight: 70,
    timeWeight: 85,
    fuelCostWeight: 60,
    vipPriorityWeight: 95,
  },
};

export const useOptimization = () => {
  const [config, setConfig] = useState<OptimizationConfig>(DEFAULT_CONFIG);
  const [activePreset, setActivePreset] = useState<StrategyPreset>('BALANCED');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState(0);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [routes, setRoutes] = useState<PlannedRoute[]>([]);
  const [vehicleAssignments, setVehicleAssignments] = useState<VehicleAssignment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = useCallback((preset: StrategyPreset) => {
    setActivePreset(preset);
    switch (preset) {
      case 'BALANCED':
        setConfig((prev) => ({
          ...prev,
          weights: { distanceWeight: 70, timeWeight: 85, fuelCostWeight: 60, vipPriorityWeight: 95 },
        }));
        break;
      case 'FASTEST':
        setConfig((prev) => ({
          ...prev,
          weights: { distanceWeight: 30, timeWeight: 98, fuelCostWeight: 40, vipPriorityWeight: 90 },
        }));
        break;
      case 'ECONOMICAL':
        setConfig((prev) => ({
          ...prev,
          weights: { distanceWeight: 95, timeWeight: 45, fuelCostWeight: 95, vipPriorityWeight: 60 },
        }));
        break;
      case 'CUSTOM':
        break;
    }
  }, []);

  const updateWeight = useCallback((key: keyof OptimizationConfig['weights'], value: number) => {
    setActivePreset('CUSTOM');
    setConfig((prev) => ({
      ...prev,
      weights: { ...prev.weights, [key]: value },
    }));
  }, []);

  const updateScenario = useCallback((scenario: TrafficScenario) => {
    setConfig((prev) => ({ ...prev, trafficScenario: scenario }));
  }, []);

  const updateMaxIterations = useCallback((iterations: number) => {
    setConfig((prev) => ({ ...prev, maxIterations: iterations }));
  }, []);

  const updateVehiclePreference = useCallback((pref: VehiclePreference) => {
    setConfig((prev) => ({ ...prev, vehiclePreference: pref }));
  }, []);

  const runOptimization = useCallback(
    async (batchId: string) => {
      setIsOptimizing(true);
      setError(null);
      setOptimizationProgress(15);

      const progressTimer = setInterval(() => {
        setOptimizationProgress((p) => (p < 85 ? p + 15 : p));
      }, 150);

      try {
        const payload: OptimizeRoutePayload = {
          batchId,
          options: config,
        };
        const response = await RoutesApi.optimize(payload);
        setOptimizationProgress(100);
        setResult(response.data);
        // Store multi-bin data
        if (response.data.routes) {
          setRoutes(response.data.routes);
        }
        if (response.data.vehicleAssignments) {
          setVehicleAssignments(response.data.vehicleAssignments);
        }
        console.log('Optimization response:', response.data);
        return response.data;
      } catch (err: any) {
        const msg = err.friendlyMessage || err.response?.data?.error?.message || err.message || 'Optimization failed';
        setError(msg);
        throw err;
      } finally {
        clearInterval(progressTimer);
        setTimeout(() => setIsOptimizing(false), 300);
      }
    },
    [config]
  );

  const reoptimizeWithVehicleOverride = useCallback(
    async (batchId: string, vehicleIds: string[], driverId?: string) => {
      setIsOptimizing(true);
      setError(null);
      setOptimizationProgress(15);

      const progressTimer = setInterval(() => {
        setOptimizationProgress((p) => (p < 85 ? p + 15 : p));
      }, 150);

      try {
        const payload: OptimizeRoutePayload = {
          batchId,
          vehicleIds,
          driverId,
          options: config,
        };
        const response = await RoutesApi.optimize(payload);
        setOptimizationProgress(100);
        setResult(response.data);
        // Store multi-bin data
        if (response.data.routes) {
          setRoutes(response.data.routes);
        }
        if (response.data.vehicleAssignments) {
          setVehicleAssignments(response.data.vehicleAssignments);
        }
        console.log('Re-optimization with override response:', response.data);
        return response.data;
      } catch (err: any) {
        const msg = err.friendlyMessage || err.response?.data?.error?.message || err.message || 'Re-optimization failed';
        setError(msg);
        throw err;
      } finally {
        clearInterval(progressTimer);
        setTimeout(() => setIsOptimizing(false), 300);
      }
    },
    [config]
  );

  const clearResult = useCallback(() => {
    setResult(null);
    setRoutes([]);
    setVehicleAssignments([]);
    setError(null);
  }, []);

  return {
    config,
    setConfig,
    activePreset,
    applyPreset,
    updateWeight,
    updateScenario,
    updateMaxIterations,
    updateVehiclePreference,
    runOptimization,
    reoptimizeWithVehicleOverride,
    isOptimizing,
    optimizationProgress,
    result,
    setResult,
    routes,
    vehicleAssignments,
    clearResult,
    error,
    setError,
  };
};
