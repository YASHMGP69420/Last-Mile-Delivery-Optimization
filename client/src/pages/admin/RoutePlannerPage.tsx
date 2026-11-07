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
  Sparkles,
  Send,
  RotateCcw,
  Layers,
  AlertTriangle,
} from 'lucide-react';

export const RoutePlannerPage: React.FC = () => {
  const {
    batches,
    selectedBatchId,
    setSelectedBatchId,
    selectedBatch,
    vehicles,
    selectedVehicleId,
    setSelectedVehicleId,
    drivers,
    assignedDriver,
    setAssignedDriver,
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
  } = useRoutePlanner();

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showBaselineRoute, setShowBaselineRoute] = useState(true);
  const [isPushingReorder, setIsPushingReorder] = useState(false);

  // Live Baseline Route Evaluation State (Evaluated before optimization)
  const [baselineResult, setBaselineResult] = useState<BaselineEvaluationResult | null>(null);
  const [isEvaluatingBaseline, setIsEvaluatingBaseline] = useState<boolean>(false);

  const handlePushReorder = async () => {
    const routeId =
      optResult?.routeId ||
      (optResult?.routes && (optResult.routes[0]?.id || optResult.routes[0]?._id));
    if (!routeId) {
      setToastMsg('⚠️ Please dispatch the route before pushing sequence updates');
      return;
    }
    const sequence = currentStops.map((s) => s.deliveryId || '').filter(Boolean);
    if (sequence.length === 0) return;

    setIsPushingReorder(true);
    try {
      const res = await RoutesApi.reorderStops(routeId, sequence, 'Dispatcher stop sequence reordering');
      if (res.success) {
        setToastMsg('✅ Stop sequence reordered & transmitted to driver handheld');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to push reordered stops';
      setToastMsg(`❌ ${msg}`);
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
    isOptimizing,
    optimizationProgress,
    result: optResult,
    setResult: setOptResult,
    error: optError,
    setError: setOptError,
  } = useOptimization();

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
          vehicleId: selectedVehicleId,
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
    selectedVehicleId,
    currentStops.map((s) => s.deliveryId).join(','),
    selectedBatch?.depot?.name,
    selectedBatch?.depot?.geo?.lat,
    selectedBatch?.depot?.geo?.lng,
    config?.departureTime,
  ]);

  const handleRunOptimization = async () => {
    if (!selectedBatchId) return;
    try {
      const res = await runOptimization(
        selectedBatchId,
        selectedVehicleId ? [selectedVehicleId] : [],
        assignedDriver?.id
      );
      applyOptimizationResult(res);
      const effectiveRouteId = res.routeId || (res.routes && (res.routes[0]?.id || res.routes[0]?._id));
      if (!effectiveRouteId) {
        setToastMsg('Optimization returned no route ID');
      } else {
        const count = res.optimized?.stops?.length || (res.routes && res.routes[0]?.stops?.length) || currentStops.length;
        setToastMsg(`Optimization complete: ${count} stops sequenced`);
      }
    } catch (e: any) {
      console.error('Optimization error:', e);
      setToastMsg(e?.response?.data?.error?.message || e?.message || 'Optimization failed');
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
                    setOptError(null);
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
                setOptError(null);
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
              leftIcon={<Sparkles className="w-3.5 h-3.5 text-blue-200" />}
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
        <div className="p-3 bg-blue-50 text-blue-900 rounded-lg border border-blue-200 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-blue-600" />
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

      {/* Optimization Error Alert */}
      {optError && (
        <div className="p-3 bg-red-50 text-red-900 rounded-lg border border-red-200 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
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
            vehicles={vehicles}
            selectedVehicleId={selectedVehicleId}
            onSelectVehicle={setSelectedVehicleId}
            drivers={drivers}
            assignedDriver={assignedDriver}
            onSelectDriver={(driverId) => {
              const d = drivers.find((x) => x.id === driverId);
              if (d) setAssignedDriver(d);
            }}
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
          />

          {/* Map Controls Header */}
          <div className="p-4 bg-surface-lowest rounded-[24px] border border-outline-variant/60 shadow-soft flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-bold text-on-surface flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-primary" />
                <span>Geospatial Route Map</span>
              </span>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-surface-low border border-outline-variant/60 text-on-surface-variant font-semibold">
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
      />

      {/* Pre-Dispatch Safety Confirmation Modal */}
      <DispatchConfirmationModal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        batch={selectedBatch}
        vehicle={vehicles.find(
          (v) => v.id === selectedVehicleId || v.vehicleId === selectedVehicleId
        )}
        driver={assignedDriver}
        stops={currentStops}
        metrics={optResult?.optimized?.metrics || (baselineResult?.metrics as any)}
        isOptimized={Boolean(optResult)}
        isImproved={Boolean(optResult?.deltas?.isImproved)}
        onConfirmDispatch={async () => {
          const dispatchId = optResult?.routeId || (optResult?.routes && (optResult.routes[0]?.id || optResult.routes[0]?._id)) || selectedBatchId;
          if (!dispatchId) {
            setToastMsg('❌ No route or batch ID to dispatch');
            return;
          }
          try {
            await RoutesApi.dispatch(dispatchId, {
              routeId: optResult?.routeId,
              batchId: selectedBatchId,
              vehicleId: selectedVehicleId,
              driverId: assignedDriver?.id || '',
              confirmedStopSequence: currentStops.map((s) => s.deliveryId || '').filter(Boolean),
            });
            setIsDispatched(true);
            // Push to driver handheld after successful dispatch
            try {
              const pushRes = await RoutesApi.pushToHandheld(dispatchId);
              if (pushRes.success) {
                setToastMsg('✅ Route dispatched and pushed to driver handheld');
              } else {
                setToastMsg('✅ Route dispatched (handheld push pending)');
              }
            } catch (pushErr) {
              console.error('Push to handheld error:', pushErr);
              setToastMsg('✅ Route dispatched (handheld push pending)');
            }
            setIsDispatchModalOpen(false);
          } catch (err: any) {
            console.error('Dispatch failed:', err);
            const msg = err?.response?.data?.message || err?.message || 'Dispatch failed';
            setToastMsg(`❌ ${msg}`);
          }
        }}
      />

      {/* Toast Notification */}
      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg(null)} />}
    </div>
  );
};

export default RoutePlannerPage;
