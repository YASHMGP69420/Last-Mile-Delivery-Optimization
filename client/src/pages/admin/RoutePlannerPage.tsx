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
      const msg = err?.response?.data?.message || err?.message || 'Failed to update stop sequence';
      setToastMsg(msg);
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
        const msg =
          err?.friendlyMessage ||
          err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message;
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
      setToastMsg(e?.response?.data?.error?.message || e?.message || 'Optimization failed');
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
      setToastMsg(e?.response?.data?.error?.message || e?.message || 'Vehicle override failed');
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
      setToastMsg(e?.response?.data?.error?.message || e?.message || 'Driver override failed');
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
                  onChange={(e) => {
                    const newBatchId = e.target.value;
                    setSelectedBatchId(newBatchId);
                    setOptResult(null);
                    clearOptResult();
                    setOptError(null);
                    setUnassignedWarning([]);
                    setIsDispatched(false);
                    setToastMsg(`Batch switched`);
                  }}
                  className="h-8 pl-3 pr-8 rounded-lg bg-surface-low border border-outline-variant font-mono text-xs font-semibold text-secondary focus:outline-none focus:ring-1 focus:ring-secondary cursor-pointer"
                >
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

            <Button
              size="sm"
              variant="primary"
              disabled={currentStops.length === 0 || isDispatched}
              onClick={() => setIsDispatchModalOpen(true)}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              {isDispatched
                ? 'Dispatched'
                : optResult
                ? (optResult.deltas?.isImproved
                  ? 'Dispatch Optimized Route'
                  : 'Dispatch Route (Already Optimal)')
                : 'Dispatch Current Route'}
            </Button>
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
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsDispatchModalOpen(true)}
            disabled={isDispatched}
            leftIcon={<Send className="w-3.5 h-3.5" />}
          >
            Dispatch Current Route
          </Button>
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

      {/* 2. Main 35% / 65% Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start pb-6">
        {/* LEFT PANEL: 35% Width (cols 1 to 4 on 12-col grid) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <OptimizationControlPanel
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
              <span className="font-semibold text-on-surface dark:text-white flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-primary dark:text-emerald-400" />
                <span>Geospatial Route Map</span>
              </span>
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

          {/* Map Canvas */}
          <div className="relative z-0 w-full h-[520px] bg-surface-lowest rounded-xl border border-outline-variant overflow-hidden flex items-center justify-center shadow-sm">
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
            const errData = err?.response?.data?.error;
            const msg = err?.friendlyMessage || errData?.message || err?.response?.data?.message || err?.message || 'Dispatch failed';
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
