import React, { useState } from 'react';
import { AdminHeader } from '../../components/layout/AdminHeader';
import { Toast } from '../../components/common/Toast';
import { Button } from '../../components/common/Button';
import InteractiveMap from '../../components/maps/InteractiveMap';
import { OptimizationControlPanel } from '../../components/optimization/OptimizationControlPanel';
import { ImpactMetricsBar } from '../../components/optimization/ImpactMetricsBar';
import { RouteComparisonDrawer } from '../../components/optimization/RouteComparisonDrawer';
import { DispatchConfirmationModal } from '../../components/optimization/DispatchConfirmationModal';
import { useRoutePlanner } from '../../hooks/useRoutePlanner';
import { useOptimization } from '../../hooks/useOptimization';
import { RoutesApi } from '../../api/routeApi';
import { OpenInGoogleMapsButton } from '../../components/maps/OpenInGoogleMapsButton';
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
    assignedDriver,
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
        setToastMsg('⚠️ Optimization returned no route ID');
      } else {
        const count = res.optimized?.stops?.length || (res.routes && res.routes[0]?.stops?.length) || currentStops.length;
        setToastMsg(`✅ Optimization complete: ${count} stops sequenced`);
      }
    } catch (e: any) {
      console.error('Optimization error:', e);
      setToastMsg(`❌ ${e?.response?.data?.error?.message || e?.message || 'Optimization failed'}`);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* 1. Command Header & Action Bar */}
      <AdminHeader
        title="Route Planner & Optimizer"
        subtitle="Rasulgarh Central Hub • Algorithmic Local Search & Fleet Scheduling"
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
                  className="h-9 pl-3 pr-8 rounded-lg bg-surface-low border border-outline-variant font-mono text-xs font-semibold text-secondary focus:outline-none focus:ring-1 focus:ring-secondary cursor-pointer"
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
              Run AI Optimization
            </Button>

            {optResult && (
              <OpenInGoogleMapsButton
                stops={currentStops}
                routePath={optResult?.optimized?.polylineCoords}
              />
            )}

            <Button
              size="sm"
              variant="primary"
              disabled={!optResult || isDispatched}
              onClick={() => setIsDispatchModalOpen(true)}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              {isDispatched ? 'Dispatched' : 'Save & Dispatch'}
            </Button>
          </div>
        }
      />

      {/* Optimization Error Alert */}
      {optError && (
        <div className="p-3 bg-red-50 text-red-900 rounded-lg border border-red-200 flex items-center gap-2 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{optError}</span>
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
            assignedDriver={assignedDriver}
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
          />
        </div>

        {/* RIGHT PANEL: 65% Width (cols 5 to 12 on 12-col grid) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Map Canvas */}
          <div className="relative z-0 w-full h-[520px] bg-surface-lowest rounded-xl border border-outline-variant overflow-hidden flex items-center justify-center">
            <InteractiveMap stops={currentStops} routePath={optResult?.optimized?.polylineCoords} />
          </div>

          <ImpactMetricsBar
            deltas={optResult?.deltas}
            baselineMetrics={optResult?.baseline?.metrics}
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
        metrics={optResult?.optimized?.metrics}
        onConfirmDispatch={async () => {
          const dispatchId = optResult?.routeId || (optResult?.routes && (optResult.routes[0]?.id || optResult.routes[0]?._id)) || selectedBatchId;
          if (!dispatchId) {
            setToastMsg('❌ No route or batch ID to dispatch');
            return;
          }
          try {
            await RoutesApi.dispatch(dispatchId, {
              routeId: dispatchId,
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
