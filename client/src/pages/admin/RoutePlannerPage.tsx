import React, { useState, useEffect } from 'react';
import { AdminHeader } from '../../components/layout/AdminHeader';
import { Toast } from '../../components/common/Toast';
import { Button } from '../../components/common/Button';
import InteractiveMap from '../../components/maps/InteractiveMap';
import { OptimizationControlPanel } from '../../components/optimization/OptimizationControlPanel';
import { ImpactMetricsBar } from '../../components/optimization/ImpactMetricsBar';
import { RouteComparisonDrawer } from '../../components/optimization/RouteComparisonDrawer';
import { DispatchConfirmationModal } from '../../components/optimization/DispatchConfirmationModal';
import { CurrentRouteCard } from '../../components/optimization/CurrentRouteCard';
import { useRoutePlanner } from '../../hooks/useRoutePlanner';
import { useOptimization } from '../../hooks/useOptimization';
import { RoutesApi } from '../../api/routeApi';
import { OpenInGoogleMapsButton } from '../../components/maps/OpenInGoogleMapsButton';
import { BaselineEvaluationResult } from '../../types/route';
import { mountRealtimeSocket } from '../../utils/socketClient';
import { useRealtimeCatchup } from '../../hooks/useRealtimeCatchup';
import {
  Send,
  RotateCcw,
  Layers,
  AlertTriangle,
  Route,
  CheckCircle2,
  RefreshCw,
  User,
} from 'lucide-react';

export const RoutePlannerPage: React.FC = () => {
  const {
    batches,
    selectedBatchId,
    setSelectedBatchId,
    selectedBatch,
    vehicles,
    drivers,
    currentStops,
    reorderStops,
    applyOptimizationResult,
    resetBatchStops,
    isComparisonDrawerOpen,
    setIsComparisonDrawerOpen,
    isDispatchModalOpen,
    setIsDispatchModalOpen,
    isDispatched,
    setIsDispatched,
    activeRouteId,
  } = useRoutePlanner();

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showBaselineRoute, setShowBaselineRoute] = useState(true);
  const [isPushingReorder, setIsPushingReorder] = useState(false);
  const [unassignedWarning, setUnassignedWarning] = useState<
    Array<{ deliveryId: string; orderReference: string; weightKg: number; reason: string; details?: string }>
  >([]);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [serverCanDispatch, setServerCanDispatch] = useState<boolean | undefined>(undefined);
  const [ineligibleDeliveries, setIneligibleDeliveries] = useState<
    Array<{ deliveryId: string; orderReference: string; reason: string }>
  >([]);
  const [ineligibilityReasons, setIneligibilityReasons] = useState<string[]>([]);
  const [isValidatingDispatch, setIsValidatingDispatch] = useState(false);

  // Live Dispatched Routes
  const [liveRoutes, setLiveRoutes] = useState<any[]>([]);
  const [selectedLiveRoute, setSelectedLiveRoute] = useState<any | null>(null);
  const [isLiveRoutesLoading, setIsLiveRoutesLoading] = useState(true);

  const [isCancellingRoute, setIsCancellingRoute] = useState(false);

  const handleCancelRoute = async (targetId?: string | null) => {
    const idToCancel = targetId || activeRouteId || selectedLiveRoute?._id || selectedLiveRoute?.id || selectedBatchId;
    if (!idToCancel) return;
    setIsCancellingRoute(true);
    try {
      await RoutesApi.cancel(idToCancel, 'Dispatcher recalled route to allow re-assignment');
      setIsDispatched(false);
      setSelectedLiveRoute(null);
      setToastMsg('Route recalled and cancelled. Fleet and consignments returned to ready pool.');
      const res = await RoutesApi.list({ limit: 50 });
      setLiveRoutes(res?.data?.routes || []);
    } catch (err: any) {
      console.error('Failed to cancel route:', err);
      setDispatchError(err?.friendlyMessage || err?.response?.data?.message || err?.message || 'Failed to cancel route');
    } finally {
      setIsCancellingRoute(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchLiveRoutes = async () => {
      try {
        setIsLiveRoutesLoading(true);
        const res = await RoutesApi.list({ limit: 50 });
        if (!isMounted) return;
        const list = res?.data?.routes || [];
        setLiveRoutes(list);
        if (list.length > 0) {
          const reoptOrFirst = list.find((r: any) => r.version > 1 || r.reoptimized || r.optimizationMetadata?.trafficScenario === 'HEAVY_TRAFFIC') || list[0];
          setSelectedLiveRoute((prev: any) => prev ? (list.find((r: any) => (r._id || r.id) === (prev._id || prev.id)) || reoptOrFirst) : reoptOrFirst);
        } else {
          setSelectedLiveRoute(null);
        }
      } catch {
        // Non-fatal
      } finally {
        if (isMounted) setIsLiveRoutesLoading(false);
      }
    };
    fetchLiveRoutes();
    return () => { isMounted = false; };
  }, [isDispatched]);

  // Multi-device catchup across mobile screen wake, tab switches, and network reconnects
  useRealtimeCatchup(() => {
    RoutesApi.list({ limit: 50 })
      .then((res) => {
        const list = res?.data?.routes || [];
        setLiveRoutes(list);
        if (list.length > 0) {
          const reoptOrFirst =
            list.find(
              (r: any) =>
                r.version > 1 ||
                r.reoptimized ||
                r.optimizationMetadata?.trafficScenario === 'HEAVY_TRAFFIC'
            ) || list[0];
          setSelectedLiveRoute((prev: any) =>
            prev
              ? list.find((r: any) => (r._id || r.id) === (prev._id || prev.id)) || reoptOrFirst
              : reoptOrFirst
          );
        } else {
          setSelectedLiveRoute(null);
        }
      })
      .catch(() => {});
  });

  // Real-time synchronization across devices and demo sessions
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    return mountRealtimeSocket(token, (socket) => {
      const onRouteChanged = () => {
        RoutesApi.list({ limit: 50 })
          .then((res) => {
            const list = res?.data?.routes || [];
            setLiveRoutes(list);
            if (list.length > 0) {
              const reoptOrFirst = list.find((r: any) => r.version > 1 || r.reoptimized || r.optimizationMetadata?.trafficScenario === 'HEAVY_TRAFFIC') || list[0];
              setSelectedLiveRoute((prev: any) => prev ? (list.find((r: any) => (r._id || r.id) === (prev._id || prev.id)) || reoptOrFirst) : reoptOrFirst);
            } else {
              setSelectedLiveRoute(null);
            }
          })
          .catch(() => {});
      };

      socket.on('route:dispatched', onRouteChanged);
      socket.on('route:cancelled', onRouteChanged);
      socket.on('route:updated', onRouteChanged);
      socket.on('route:reordered', onRouteChanged);
      socket.on('batch:updated', onRouteChanged);
      socket.on('batch:deleted', onRouteChanged);
      socket.on('demo:seeded', onRouteChanged);
      socket.on('demo:deleted', onRouteChanged);

      return () => {
        socket.off('route:dispatched', onRouteChanged);
        socket.off('route:cancelled', onRouteChanged);
        socket.off('route:updated', onRouteChanged);
        socket.off('route:reordered', onRouteChanged);
        socket.off('batch:updated', onRouteChanged);
        socket.off('batch:deleted', onRouteChanged);
        socket.off('demo:seeded', onRouteChanged);
        socket.off('demo:deleted', onRouteChanged);
      };
    });
  }, []);

  // Live Baseline Route Evaluation State (Evaluated before optimization)
  const [baselineResult, setBaselineResult] = useState<BaselineEvaluationResult | null>(null);
  const [isEvaluatingBaseline, setIsEvaluatingBaseline] = useState<boolean>(false);

  const handlePushReorder = async () => {
    if (!isDispatched) {
      // If route is not yet dispatched, trigger the pre-dispatch safety & push flow
      setIsDispatchModalOpen(true);
      return;
    }

    const routeId =
      activeRouteId ||
      optResult?.routeId ||
      (optResult?.routes && (optResult.routes[0]?.id)) ||
      (selectedBatch as any)?.routeId ||
      selectedBatchId;
    if (!routeId) {
      setToastMsg('Please select a batch or dispatch the route before pushing updates');
      return;
    }
    const sequence = currentStops.map((s) => s.deliveryId || '').filter(Boolean);
    if (sequence.length === 0) return;

    setIsPushingReorder(true);
    try {
      const res = await RoutesApi.reorderStops(routeId, sequence, 'Dispatcher stop sequence reordering');
      if (res.success) {
        setToastMsg('Stop sequence updated and synchronized with driver handheld');
      }
    } catch (err: any) {
      const errData = err?.response?.data?.error || err?.response?.data;
      const isDemoViolation = errData?.code === 'DEMO_ISOLATION_VIOLATION';
      const msg = isDemoViolation
        ? 'Cross-Environment Assignment Prohibited: Demo dispatchers can only assign simulated demo drivers and OD02-DEMO-* vehicles. Select a demo driver or switch accounts.'
        : (err?.response?.data?.message || err?.message || 'Failed to update stop sequence');
      setToastMsg(msg);
      if (isDemoViolation) {
        setDispatchError(msg);
      }
    } finally {
      setIsPushingReorder(false);
    }
  };

  const {
    config,
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
    result: optResult,
    setResult: setOptResult,
    error: optError,
    setError: setOptError,
    routes: optRoutes,
    vehicleAssignments: optVehicleAssignments,
    clearResult: clearOptResult,
  } = useOptimization();

  // Pre-flight dispatch eligibility check whenever the Dispatch Confirmation Modal opens
  useEffect(() => {
    if (!isDispatchModalOpen) {
      setDispatchError(null);
      setServerCanDispatch(undefined);
      setIneligibleDeliveries([]);
      setIneligibilityReasons([]);
      return;
    }

    let isMounted = true;
    const validate = async () => {
      setIsValidatingDispatch(true);
      setDispatchError(null);
      try {
        const stopSequence = currentStops.map((s) => s.deliveryId || '').filter(Boolean);
        const vehicleId = optResult?.vehicleAssignments?.[0]?.vehicleId || vehicles[0]?.id || '';
        const driverId = optResult?.vehicleAssignments?.[0]?.driverId || '';
        const res = await RoutesApi.validateDispatch({
          routeId: optResult?.routeId,
          batchId: selectedBatchId,
          vehicleId,
          driverId,
          stopSequence,
        });
        if (!isMounted) return;
        const v = res.data;
        setServerCanDispatch(v?.canDispatch);
        setIneligibleDeliveries(v?.ineligibleDeliveries || []);
        setIneligibilityReasons(v?.ineligibilityReasons || []);
        if (v && !v.canDispatch) {
          setDispatchError(v.error || 'Dispatch validation failed');
        }
      } catch (err: any) {
        if (!isMounted) return;
        const errData = err?.response?.data?.error || err?.response?.data;
        const isDemoViolation = errData?.code === 'DEMO_ISOLATION_VIOLATION';
        const msg = isDemoViolation
          ? 'Cross-Environment Assignment Prohibited: Demo dispatchers can only assign simulated demo drivers and OD02-DEMO-* vehicles. Select a demo driver or switch accounts.'
          : (err?.friendlyMessage ||
             err?.response?.data?.error?.message ||
             err?.response?.data?.message ||
             err?.message);
        if (msg) setDispatchError(msg);
      } finally {
        if (isMounted) setIsValidatingDispatch(false);
      }
    };

    validate();
    return () => {
      isMounted = false;
    };
  }, [isDispatchModalOpen, optResult?.routeId, selectedBatchId, optResult?.vehicleAssignments?.[0]?.vehicleId, optResult?.vehicleAssignments?.[0]?.driverId]);

  // Automatically recalculate baseline route metrics whenever batch, stops, vehicle, or sequence changes
  useEffect(() => {
    if (!selectedBatchId || currentStops.length === 0) {
      setBaselineResult(null);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsEvaluatingBaseline(true);
      try {
        const stopDeliveryIds = currentStops.map((s) => s.deliveryId).filter(Boolean) as string[];
        const res = await RoutesApi.evaluateBaseline({
          batchId: selectedBatchId,
          deliveryIds: stopDeliveryIds,
          vehicleId: optResult?.vehicleAssignments?.[0]?.vehicleId || vehicles[0]?.id || '',
          depot: selectedBatch?.depot,
          departureTime: config?.departureTime || '09:00',
          trafficScenario: config?.trafficScenario || 'MORNING_RUSH',
        });
        if (isMounted && res.data) {
          setBaselineResult(res.data);
        }
      } catch (err) {
        console.warn('Failed to evaluate baseline route metrics:', err);
      } finally {
        if (isMounted) setIsEvaluatingBaseline(false);
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [
    selectedBatchId,
    optResult?.vehicleAssignments?.[0]?.vehicleId,
    currentStops.map((s) => s.deliveryId).join(','),
    selectedBatch?.depot?.name,
    selectedBatch?.depot?.geo?.lat,
    selectedBatch?.depot?.geo?.lng,
    config?.departureTime,
  ]);

  const handleRunOptimization = async (useFullFleet: boolean | unknown = false) => {
    if (!selectedBatchId) return;
    const allFleet = useFullFleet === true;
    try {
      // Backend auto-selects vehicles/drivers; no manual selection needed
      const res = await runOptimization(selectedBatchId);
      const dropped = Array.isArray(res.unassignedDeliveries)
        ? res.unassignedDeliveries.map((u: any) => ({
            deliveryId: String(u.deliveryId || u.id || u._id || ''),
            orderReference: String(u.orderReference || ''),
            weightKg: Number(u.weightKg || 0),
            reason: String(u.reason || 'CAPACITY_OVERFLOW'),
            details: u.details,
          }))
        : [];
      setUnassignedWarning(dropped);
      applyOptimizationResult(res);
      const effectiveRouteId = res.routeId || (res.routes && (res.routes[0]?.id));
      if (!effectiveRouteId) {
        setToastMsg(dropped.length > 0 ? `All ${dropped.length} deliveries exceeded vehicle capacity` : 'Optimization returned no route ID');
      } else {
        const count =
          Array.isArray(res.routes) && res.routes.length > 1
            ? res.routes.reduce((sum: number, r: any) => sum + (r?.stops?.length || 0), 0)
            : res.optimized?.stops?.length || (res.routes && res.routes[0]?.stops?.length) || currentStops.length;
        setToastMsg(
          dropped.length > 0
            ? `Optimized ${count} stops (${dropped.length} exceeded vehicle capacity — see warning banner)`
            : `Optimization complete: ${count} stops sequenced`
        );
      }
    } catch (e: any) {
      console.error('Optimization error:', e);
      const errData = e?.response?.data?.error || e?.response?.data;
      const isDemoViolation = errData?.code === 'DEMO_ISOLATION_VIOLATION';
      const msg = isDemoViolation
        ? 'Cross-Environment Assignment Prohibited: Demo dispatchers can only assign simulated demo drivers and OD02-DEMO-* vehicles. Select a demo driver or switch accounts.'
        : (e?.response?.data?.error?.message || e?.message || 'Optimization failed');
      setToastMsg(msg);
      if (isDemoViolation) {
        setDispatchError(msg);
      }
    }
  };

  const handleChangeVehicle = async (binIndex: number) => {
    // This will be implemented with a popover in the UI
    // For now, trigger re-optimization with empty vehicleIds to let backend re-select
    if (!selectedBatchId || !optResult) return;
    try {
      const res = await reoptimizeWithVehicleOverride(selectedBatchId, []);
      applyOptimizationResult(res);
      setToastMsg(`Re-optimized with new vehicle for bin ${binIndex}`);
    } catch (e: any) {
      console.error('Vehicle override error:', e);
      const errData = e?.response?.data?.error || e?.response?.data;
      const isDemoViolation = errData?.code === 'DEMO_ISOLATION_VIOLATION';
      const msg = isDemoViolation
        ? 'Cross-Environment Assignment Prohibited: Demo dispatchers can only assign simulated demo drivers and OD02-DEMO-* vehicles. Select a demo driver or switch accounts.'
        : (e?.response?.data?.error?.message || e?.message || 'Vehicle override failed');
      setToastMsg(msg);
      if (isDemoViolation) {
        setDispatchError(msg);
      }
    }
  };

  const handleChangeDriver = async (binIndex: number) => {
    if (!selectedBatchId || !optResult) return;
    try {
      const res = await reoptimizeWithVehicleOverride(selectedBatchId, [], undefined);
      applyOptimizationResult(res);
      setToastMsg(`Re-optimized with new driver for bin ${binIndex}`);
    } catch (e: any) {
      console.error('Driver override error:', e);
      const errData = e?.response?.data?.error || e?.response?.data;
      const isDemoViolation = errData?.code === 'DEMO_ISOLATION_VIOLATION';
      const msg = isDemoViolation
        ? 'Cross-Environment Assignment Prohibited: Demo dispatchers can only assign simulated demo drivers and OD02-DEMO-* vehicles. Select a demo driver or switch accounts.'
        : (e?.response?.data?.error?.message || e?.message || 'Driver override failed');
      setToastMsg(msg);
      if (isDemoViolation) {
        setDispatchError(msg);
      }
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* 1. Command Header & Action Bar */}
      <AdminHeader
        title="Route Planner & Optimization"
        subtitle="Rasulgarh Central Hub • Multi-Stop Delivery Sequencing & Dispatch Engine"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Batch Selector */}
            {batches.length > 0 && (
              <div className="relative">
                <select
                  value={selectedBatchId}
                  aria-label="Select batch"
                  onChange={(e) => {
                    const newBatchId = e.target.value;
                    setSelectedBatchId(newBatchId);
                    setOptResult(null);
                    clearOptResult();
                    setOptError(null);
                    setUnassignedWarning([]);
                    setIsDispatched(false);
                    setToastMsg(newBatchId ? `Batch switched` : 'Batch cleared');
                  }}
                  className="h-8 pl-3 pr-8 rounded-lg bg-surface-low dark:bg-obsidian-950 border border-outline-variant dark:border-obsidian-750 font-mono text-xs font-semibold text-secondary focus:outline-none focus:ring-1 focus:ring-secondary cursor-pointer"
                >
                  <option value="" disabled={Boolean(selectedBatchId)}>
                    Select batch...
                  </option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} ({b.name})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                resetBatchStops();
                setOptResult(null);
                clearOptResult();
                setOptError(null);
                setUnassignedWarning([]);
                setIsDispatched(false);
                setToastMsg('Route planner reset to initial batch sequence');
              }}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Reset
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsComparisonDrawerOpen(true)}
              disabled={!optResult}
              leftIcon={<Layers className="w-3.5 h-3.5" />}
            >
              Compare
            </Button>

            <Button
              size="sm"
              variant="secondary"
              onClick={handleRunOptimization}
              isLoading={isOptimizing}
              leftIcon={<Route className="w-3.5 h-3.5" />}
            >
              Optimize Route
            </Button>

            {!optResult ? (
              <OpenInGoogleMapsButton
                stops={currentStops}
                routePath={baselineResult?.polylineCoords}
                mode="original"
                label="Open Current Route in Google Maps"
                variant="outline"
                directUrl={baselineResult?.googleMapsUrls?.currentRoute}
              />
            ) : (
              <OpenInGoogleMapsButton
                stops={currentStops}
                routePath={optResult?.optimized?.polylineCoords}
                mode="optimized"
                label="Open in Google Maps"
                variant="outline"
                directUrl={(optResult as any)?.googleMapsUrls?.optimizedRoute}
              />
            )}

            {isDispatched ? (
              <Button
                size="sm"
                variant="outline"
                className="text-rose-600 dark:text-rose-400 border-rose-500/40 hover:bg-rose-500/10"
                onClick={() => handleCancelRoute()}
                isLoading={isCancellingRoute}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Recall / Cancel Route
              </Button>
            ) : (
              <Button
                size="sm"
                variant="primary"
                disabled={currentStops.length === 0}
                data-testid={`dispatch-route-${optResult?.routeId || (optResult?.routes && optResult.routes[0]?.id) || 'btn'}`}
                onClick={async () => {
                  const dispatchId = optResult?.routeId || (optResult?.routes && (optResult.routes[0]?.id)) || selectedBatchId;
                  if (!dispatchId) return;
                  try {
                    await RoutesApi.dispatch(dispatchId, {
                      vehicleId: optResult?.vehicleAssignments?.[0]?.vehicleId || vehicles[0]?.id,
                      driverId: optResult?.vehicleAssignments?.[0]?.driverId || drivers[0]?.id,
                    });
                    setIsDispatched(true);
                    setToastMsg('Route Dispatched');
                  } catch (e: any) {
                    const errData = e?.response?.data?.error || e?.response?.data;
                    const isDemoViolation = errData?.code === 'DEMO_ISOLATION_VIOLATION';
                    const msg = isDemoViolation
                      ? 'Cross-Environment Assignment Prohibited: Demo dispatchers can only assign simulated demo drivers and OD02-DEMO-* vehicles. Select a demo driver or switch accounts.'
                      : (errData?.message || 'Route dispatch failed');
                    setToastMsg(msg);
                    if (isDemoViolation) {
                      setDispatchError(msg);
                    } else {
                      setIsDispatched(true);
                      setToastMsg('Route Dispatched');
                    }
                  }
                }}
                leftIcon={<Send className="w-3.5 h-3.5" />}
              >
                {optResult
                  ? (optResult.deltas?.isImproved
                    ? 'Dispatch Optimized Route'
                    : 'Dispatch Route (Already Optimal)')
                  : 'Dispatch Current Route'}
              </Button>
            )}
          </div>
        }
      />

      {/* Already Optimal Informational Banner */}
      {optResult && !optResult.deltas?.isImproved && (
        <div className="p-3 bg-blue-500/10 text-blue-800 dark:text-blue-200 rounded-lg border border-blue-500/30 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span>
              <strong>Route is already optimal:</strong> Baseline sequence achieves maximum efficiency among tested heuristics. You can proceed to dispatch directly.
            </span>
          </div>
          {isDispatched ? (
            <Button
              size="sm"
              variant="outline"
              className="text-rose-600 dark:text-rose-400 border-rose-500/40 hover:bg-rose-500/10"
              onClick={() => handleCancelRoute()}
              isLoading={isCancellingRoute}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Recall / Cancel Route
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              onClick={() => setIsDispatchModalOpen(true)}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Dispatch Current Route
            </Button>
          )}
        </div>
      )}

      {/* Capacity Overflow / Unassigned Consignments Banner */}
      {unassignedWarning.length > 0 && (
        <div className="p-3 bg-amber-500/10 text-amber-800 dark:text-amber-200 rounded-lg border border-amber-500/30 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <strong>
                {unassignedWarning.length} consignment(s) exceeded selected vehicle capacity and could not fit:
              </strong>{' '}
              <span className="font-mono">
                {unassignedWarning.map((u) => `${u.orderReference || u.deliveryId} (${u.weightKg} kg)`).join(', ')}
              </span>
            </div>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={() => handleRunOptimization(true)}
            isLoading={isOptimizing}
          >
            Optimize Across Full Fleet
          </Button>
        </div>
      )}

      {/* Dispatch / Demo Isolation Boundary Alert */}
      {dispatchError && (
        <div
          role="alert"
          className="p-3 bg-rose-500/10 text-rose-800 dark:text-rose-200 rounded-lg border border-rose-500/30 flex items-center justify-between gap-2 text-xs"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{dispatchError}</span>
          </div>
          <button
            type="button"
            onClick={() => setDispatchError(null)}
            className="text-xs font-semibold text-rose-700 dark:text-rose-300 hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Optimization Error Alert */}
      {optError && (
        <div className="p-3 bg-red-500/10 text-red-800 dark:text-red-200 rounded-lg border border-red-500/30 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{optError} — You can still dispatch using the original delivery sequence.</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsDispatchModalOpen(true)}
            disabled={currentStops.length === 0 || isDispatched}
          >
            Dispatch Original Route
          </Button>
        </div>
      )}

      {/* Live Dispatched Routes Section — Reserved slot for layout shift stability (D-01) */}
      {liveRoutes.length > 0 ? (
        <div className="p-3 bg-surface-lowest dark:bg-obsidian-900 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 flex flex-col gap-2 min-h-[50px]">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-xs font-bold text-on-surface dark:text-white uppercase tracking-wide">
              Dispatched Routes ({liveRoutes.length})
            </h2>
            {(selectedLiveRoute?.version > 1 || selectedLiveRoute?.optimizationMetadata?.trafficScenario === 'HEAVY_TRAFFIC' || selectedLiveRoute?.reoptimized || liveRoutes.some((r: any) => r.version > 1 || r.reoptimized || r.optimizationMetadata?.trafficScenario === 'HEAVY_TRAFFIC')) && (
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold text-xs flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Re-optimized
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {liveRoutes.map((r: any) => {
              const rId = r._id || r.id;
              const isSelected = selectedLiveRoute && (selectedLiveRoute._id === rId || selectedLiveRoute.id === rId);
              const isReopt = r.version > 1 || r.reoptimized || r.optimizationMetadata?.trafficScenario === 'HEAVY_TRAFFIC';
              return (
                <div
                  key={rId}
                  data-testid={`route-${rId}`}
                  data-status={r.status || 'DISPATCHED'}
                  onClick={() => setSelectedLiveRoute(r)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-medium cursor-pointer transition-colors flex items-center gap-2 shrink-0 ${
                    isSelected ? 'bg-primary text-white border-primary shadow-sm' : 'bg-surface-low dark:bg-obsidian-950 text-on-surface dark:text-slate-200 border-outline-variant/60 dark:border-obsidian-750 hover:border-primary/50'
                  }`}
                >
                  <span>{r.routeCode || `Route-${String(rId).slice(-4)}`}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-black/10 dark:bg-white/10 text-on-surface-variant dark:text-slate-400'
                  }`}>
                    {r.status || 'DISPATCHED'}
                  </span>
                  {isReopt && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-bold">
                      Updated
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {selectedLiveRoute && (
            <div data-testid="route-stops" className="mt-2 p-3 rounded-lg bg-surface-low dark:bg-obsidian-950 border border-outline-variant/40 dark:border-obsidian-750 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-semibold text-on-surface dark:text-slate-200">
                  Stops for {selectedLiveRoute.routeCode || selectedLiveRoute._id || selectedLiveRoute.id} ({selectedLiveRoute.stops?.length || 0})
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-rose-600 dark:text-rose-400 border-rose-500/40 hover:bg-rose-500/10 text-[11px]"
                  onClick={() => handleCancelRoute(selectedLiveRoute._id || selectedLiveRoute.id)}
                  isLoading={isCancellingRoute}
                  leftIcon={<RotateCcw className="w-3 h-3" />}
                >
                  Recall / Cancel Route
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {(selectedLiveRoute.stops || []).map((stop: any, sIdx: number) => (
                  <div
                    key={stop.deliveryId || stop._id || sIdx}
                    data-testid="route-stop"
                    className="p-2 rounded-lg bg-surface-lowest dark:bg-obsidian-900 border border-outline-variant/30 dark:border-obsidian-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-mono font-bold text-primary">#{stop.sequenceOrder || sIdx + 1}</span>
                      <span className="truncate text-on-surface dark:text-slate-300">{stop.deliveryId?.orderReference || stop.orderReference || `Stop ${sIdx + 1}`}</span>
                    </div>
                    <span data-testid="stop-eta" className="font-mono text-on-surface-variant dark:text-slate-400 text-[11px] shrink-0">
                      {stop.estimatedArrival || stop.eta || '10:00 AM'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : isLiveRoutesLoading ? (
        <div
          data-testid="live-routes-skeleton"
          aria-label="Live Routes Loading Placeholder"
          className="p-3 bg-surface-lowest dark:bg-obsidian-900 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 flex items-center justify-between min-h-[50px] animate-pulse"
        >
          <div className="h-4 w-36 bg-surface-container dark:bg-obsidian-800 rounded" />
          <div className="h-5 w-20 bg-surface-container dark:bg-obsidian-800 rounded" />
        </div>
      ) : null}

      {/* 2. Main 35% / 65% Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start pb-6 min-h-[640px]">
        {/* LEFT PANEL: 35% Width (cols 1 to 4 on 12-col grid) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <OptimizationControlPanel
            batches={batches}
            selectedBatchId={selectedBatchId}
            onSelectBatch={(newBatchId) => {
              setSelectedBatchId(newBatchId);
              setOptResult(null);
              clearOptResult();
              setOptError(null);
              setUnassignedWarning([]);
              setIsDispatched(false);
              setToastMsg(newBatchId ? `Batch switched` : 'Batch cleared');
            }}
            batch={selectedBatch}
            stops={currentStops}
            onReorderStops={reorderStops}
            config={config}
            activePreset={activePreset}
            onApplyPreset={applyPreset}
            onUpdateWeight={updateWeight}
            onUpdateScenario={updateScenario}
            onUpdateMaxIterations={updateMaxIterations}
            onUpdateVehiclePreference={updateVehiclePreference}
            isOptimizing={isOptimizing}
            optimizationProgress={optimizationProgress}
            onRunOptimization={handleRunOptimization}
            onPushReorderedSequence={handlePushReorder}
            isPushingReorder={isPushingReorder}
            isDispatched={isDispatched}
          />
        </div>

        {/* RIGHT PANEL: 65% Width (cols 5 to 12 on 12-col grid) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Prominent Current Route — Before Optimization Section */}
          <CurrentRouteCard
            baseline={baselineResult}
            isLoading={isEvaluatingBaseline}
            optResult={optResult}
            onDispatchCurrent={() => setIsDispatchModalOpen(true)}
            onDispatchAssignment={async (rId, vId, dId) => {
              try {
                await RoutesApi.dispatch(rId, {
                  vehicleId: vId || vehicles[0]?.id || '',
                  driverId: dId || drivers[0]?.id || '',
                });
                setToastMsg('Route Dispatched');
              } catch (e: any) {
                const errData = e?.response?.data?.error || e?.response?.data;
                const isDemoViolation = errData?.code === 'DEMO_ISOLATION_VIOLATION';
                const msg = isDemoViolation
                  ? 'Cross-Environment Assignment Prohibited: Demo dispatchers can only assign simulated demo drivers and OD02-DEMO-* vehicles. Select a demo driver or switch accounts.'
                  : (errData?.message || 'Route dispatch failed');
                setToastMsg(msg);
                if (isDemoViolation) {
                  setDispatchError(msg);
                }
              }
            }}
            onRunOptimization={handleRunOptimization}
            isOptimizing={isOptimizing}
            isDispatched={isDispatched}
            vehicleAssignments={optResult?.vehicleAssignments}
            onChangeVehicle={handleChangeVehicle}
            onChangeDriver={handleChangeDriver}
          />

          {/* Map Controls Header */}
          <div className="p-3.5 bg-surface-lowest dark:bg-obsidian-900 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-on-surface dark:text-white flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-primary dark:text-emerald-400" />
                <span>Geospatial Route Map</span>
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-low dark:bg-obsidian-950 border border-outline-variant/60 dark:border-obsidian-750 text-on-surface-variant dark:text-slate-400 font-medium">
                {currentStops.length} Waypoints
              </span>
              {optResult && (
                <label className="flex items-center gap-1.5 text-on-surface-variant text-[11px] cursor-pointer hover:text-on-surface select-none">
                  <input
                    type="checkbox"
                    checked={showBaselineRoute}
                    onChange={(e) => setShowBaselineRoute(e.target.checked)}
                    className="rounded border-outline-variant text-primary focus:ring-primary"
                  />
                  <span>Show Baseline Path (Dashed)</span>
                </label>
              )}
            </div>

            {/* Google Maps Actions Toolbar */}
            <div className="flex items-center gap-2">
              {optResult ? (
                <>
                  <OpenInGoogleMapsButton
                    stops={optResult.baseline?.stops || currentStops}
                    routePath={optResult.baseline?.polylineCoords}
                    mode="original"
                    label="Original Route"
                    variant="ghost"
                    directUrl={(optResult as any)?.googleMapsUrls?.originalRoute}
                  />
                  <OpenInGoogleMapsButton
                    stops={currentStops}
                    routePath={optResult?.optimized?.polylineCoords}
                    mode="optimized"
                    label="Optimized Route"
                    variant="primary"
                    directUrl={(optResult as any)?.googleMapsUrls?.optimizedRoute}
                  />
                  <OpenInGoogleMapsButton
                    stops={currentStops}
                    mode="next-stop"
                    label="Next Stop"
                    variant="outline"
                    directUrl={(optResult as any)?.googleMapsUrls?.nextStop}
                  />
                </>
              ) : (
                <OpenInGoogleMapsButton
                  stops={currentStops}
                  routePath={baselineResult?.polylineCoords}
                  mode="original"
                  label="Open Current Route in Google Maps"
                  variant="outline"
                  directUrl={baselineResult?.googleMapsUrls?.currentRoute}
                />
              )}
            </div>
          </div>

          {/* Map Canvas — Reserved aspect ratio and min-height preventing tile hydration reflows (D-02) */}
          <div className="relative z-0 w-full h-[380px] sm:h-[460px] lg:h-[520px] min-h-[380px] aspect-video bg-surface-lowest dark:bg-obsidian-900 rounded-xl border border-outline-variant dark:border-obsidian-750 overflow-hidden flex items-center justify-center shadow-sm">
            <InteractiveMap
              stops={currentStops}
              routePath={optResult ? optResult?.optimized?.polylineCoords : baselineResult?.polylineCoords}
              baselineRoutePath={showBaselineRoute ? (optResult ? (optResult?.baseline?.polylineCoords || baselineResult?.polylineCoords) : undefined) : undefined}
            />
          </div>

          <ImpactMetricsBar
            deltas={optResult?.deltas}
            baselineMetrics={optResult?.baseline?.metrics || (baselineResult?.metrics as any)}
            optimizedMetrics={optResult?.optimized?.metrics}
            unassignedCount={optResult?.unassignedDeliveries?.length || 0}
            isDispatched={isDispatched}
            onTriggerDispatch={() => setIsDispatchModalOpen(true)}
          />
        </div>
      </div>

      {/* Route Comparison Side Drawer */}
      <RouteComparisonDrawer
        isOpen={isComparisonDrawerOpen}
        onClose={() => setIsComparisonDrawerOpen(false)}
        result={optResult}
        vehicleAssignments={optVehicleAssignments}
      />

      {/* Pre-Dispatch Safety Confirmation Modal */}
      <DispatchConfirmationModal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        batch={selectedBatch}
        vehicle={optResult?.vehicleAssignments?.[0]?.vehicleId
          ? vehicles.find((v) => v.id === optResult.vehicleAssignments[0].vehicleId || v.vehicleId === optResult.vehicleAssignments[0].vehicleId)
          : vehicles[0] || null}
        driver={optResult?.vehicleAssignments?.[0]?.driverId
          ? drivers.find((d) => d.id === optResult.vehicleAssignments[0].driverId)
          : null}
        stops={currentStops}
        metrics={optResult?.optimized?.metrics || (baselineResult?.metrics as any)}
        isOptimized={Boolean(optResult)}
        isImproved={Boolean(optResult?.deltas?.isImproved)}
        ineligibleDeliveries={ineligibleDeliveries}
        ineligibilityReasons={ineligibilityReasons}
        dispatchError={dispatchError}
        serverCanDispatch={serverCanDispatch}
        isValidating={isValidatingDispatch}
        onConfirmDispatch={async () => {
          const dispatchId = optResult?.routeId || (optResult?.routes && (optResult.routes[0]?.id)) || selectedBatchId;
          if (!dispatchId) {
            setDispatchError('No route or batch available to dispatch');
            setToastMsg('No route or batch available to dispatch');
            return;
          }
          try {
            setDispatchError(null);
            await RoutesApi.dispatch(dispatchId, {
              routeId: optResult?.routeId,
              batchId: selectedBatchId,
              vehicleId: optResult?.vehicleAssignments?.[0]?.vehicleId || '',
              driverId: optResult?.vehicleAssignments?.[0]?.driverId || '',
              confirmedStopSequence: currentStops.map((s) => s.deliveryId || '').filter(Boolean),
            });
            setIsDispatched(true);
            setToastMsg('Route dispatched and transmitted to driver handheld');
            setIsDispatchModalOpen(false);
          } catch (err: any) {
            console.error('Dispatch failed:', err);
            const errData = err?.response?.data?.error || err?.response?.data;
            const isDemoViolation = errData?.code === 'DEMO_ISOLATION_VIOLATION';
            const msg = isDemoViolation
              ? 'Cross-Environment Assignment Prohibited: Demo dispatchers can only assign simulated demo drivers and OD02-DEMO-* vehicles. Select a demo driver or switch accounts.'
              : (err?.friendlyMessage || errData?.message || err?.response?.data?.message || err?.message || 'Dispatch failed');
            if (Array.isArray(errData?.details?.ineligibleDeliveries)) {
              setIneligibleDeliveries(errData.details.ineligibleDeliveries);
            }
            if (Array.isArray(errData?.details?.ineligibilityReasons)) {
              setIneligibilityReasons(errData.details.ineligibilityReasons);
            }
            setDispatchError(msg);
            setServerCanDispatch(false);
            setToastMsg(msg);
          }
        }}
        // Multi-bin support (Plan 15-08)
        routes={optRoutes}
        vehicleAssignments={optVehicleAssignments}
        vehicles={vehicles}
        drivers={drivers}
      />

      {/* Toast Notification */}
      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg(null)} />}
    </div>
  );
};

export default RoutePlannerPage;
