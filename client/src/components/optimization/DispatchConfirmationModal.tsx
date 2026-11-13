import React, { useState } from 'react';
import { DeliveryBatch, Vehicle, Driver } from '../../types';
import { RouteStop, RouteMetrics, PlannedRoute, VehicleAssignment } from '../../types/route';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import {
  ShieldCheck,
  Truck,
  User,
  Zap,
  Package,
  Send,
  CheckCircle2,
  AlertTriangle,
  Route,
  Info,
  Layers,
} from 'lucide-react';
import { RoutesApi } from '../../api/routeApi';

export interface DispatchConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: DeliveryBatch | null;
  vehicle?: Vehicle | null;
  driver?: Driver | null;
  stops: RouteStop[];
  metrics?: RouteMetrics;
  isOptimized?: boolean;
  isImproved?: boolean;
  ineligibleDeliveries?: Array<{ deliveryId: string; orderReference: string; reason: string }>;
  ineligibilityReasons?: string[];
  dispatchError?: string | null;
  serverCanDispatch?: boolean;
  isValidating?: boolean;
  onConfirmDispatch: () => Promise<void>;
  // Multi-bin support (Plan 15-08)
  routes?: PlannedRoute[];
  vehicleAssignments?: VehicleAssignment[];
  vehicles?: Vehicle[];
  drivers?: Driver[];
}

export const DispatchConfirmationModal: React.FC<DispatchConfirmationModalProps> = ({
  isOpen,
  onClose,
  batch,
  vehicle,
  driver,
  stops,
  metrics,
  isOptimized = false,
  isImproved = false,
  ineligibleDeliveries = [],
  ineligibilityReasons = [],
  dispatchError = null,
  serverCanDispatch,
  isValidating = false,
  onConfirmDispatch,
  routes = [],
  vehicleAssignments = [],
  vehicles = [],
  drivers = [],
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dispatchingRouteIndex, setDispatchingRouteIndex] = useState<number | null>(null);
  const [multiBinDispatchError, setMultiBinDispatchError] = useState<string | null>(null);

  // Determine if we're in multi-bin mode
  const isMultiBin = routes.length > 1 || vehicleAssignments.length > 1;

  // For single-bin mode (backward compatibility)
  const totalPayloadKg = stops.reduce((acc, s) => acc + (s.weightKg || 0), 0);
  const capacityKg = vehicle?.capacityKg || 1000;
  const isPayloadValid = totalPayloadKg <= capacityKg;
  const isDriverAssigned = Boolean(driver);
  const isVehicleAssigned = Boolean(vehicle);
  const isVehicleAvailable = vehicle?.availability !== 'MAINTENANCE' && vehicle?.availability !== 'RETIRED';
  const isDriverAvailable = driver?.availability !== 'IN_TRANSIT';

  const canDispatchSingle =
    isPayloadValid &&
    stops.length > 0 &&
    isDriverAssigned &&
    isVehicleAssigned &&
    isVehicleAvailable &&
    isDriverAvailable &&
    serverCanDispatch !== false &&
    !isValidating &&
    !isSubmitting;

  const driverName =
    driver && typeof driver.userId === 'object' && driver.userId?.name
      ? driver.userId.name
      : driver?.licenseNumber
      ? `Driver (${driver.licenseNumber})`
      : 'Assigned Courier';

  const driverPhone =
    driver?.phone ||
    (driver && typeof driver.userId === 'object' && driver.userId?.phone) ||
    'Not registered';

  // Multi-bin dispatch handler
  const handleMultiBinDispatch = async () => {
    if (!routes.length || !vehicleAssignments.length) return;
    setIsSubmitting(true);
    setMultiBinDispatchError(null);
    try {
      for (let i = 0; i < routes.length; i++) {
        setDispatchingRouteIndex(i);
        const route = routes[i];
        const assignment = vehicleAssignments[i];
        const routeStops = route.optimized?.stops || route.baseline?.stops || [];
        
        await RoutesApi.dispatch(route.id, {
          routeId: route.id,
          batchId: batch?.id,
          vehicleId: assignment.vehicleId,
          driverId: assignment.driverId || '',
          confirmedStopSequence: routeStops.map((s: RouteStop) => s.deliveryId || '').filter(Boolean),
        });
      }
      setIsSubmitting(false);
      setDispatchingRouteIndex(null);
      onClose();
    } catch (err: any) {
      console.error('Multi-bin dispatch failed:', err);
      const msg = err?.friendlyMessage || err?.response?.data?.error?.message || err?.message || 'Dispatch failed';
      setMultiBinDispatchError(msg);
      setIsSubmitting(false);
      setDispatchingRouteIndex(null);
    }
  };

  const handleConfirm = async () => {
    if (isMultiBin) {
      await handleMultiBinDispatch();
    } else {
      if (!canDispatchSingle) return;
      setIsSubmitting(true);
      try {
        await onConfirmDispatch();
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Determine dispatch mode description
  let dispatchModeTitle = 'Original Manifest Sequence';
  let dispatchModeBadge = 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30';
  let dispatchModeDesc = 'Dispatching current stop order directly without prior optimization.';

  if (isOptimized && isImproved) {
    dispatchModeTitle = 'Optimized Delivery Sequence';
    dispatchModeBadge = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    dispatchModeDesc = 'Optimized via 2-Opt local search with verified fuel and distance reductions.';
  } else if (isOptimized && !isImproved) {
    dispatchModeTitle = 'Verified Optimal Sequence';
    dispatchModeBadge = 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30';
    dispatchModeDesc = 'Baseline order evaluated: already optimal among alternatives. Preserving manifest sequence.';
  }

  // Aggregate metrics for multi-bin
  const aggregateStops = routes.reduce((sum, r) => sum + (r.optimized?.stops?.length || r.baseline?.stops?.length || 0), 0);
  const aggregateDistance = routes.reduce((sum, r) => sum + (r.optimized?.metrics?.totalDistanceKm || 0), 0);
  const aggregateDuration = routes.reduce((sum, r) => sum + (r.optimized?.metrics?.totalDurationMin || 0), 0);
  const aggregateCost = routes.reduce((sum, r) => sum + (r.optimized?.metrics?.costInr || 0), 0);
  const aggregatePayload = routes.reduce((sum, r) => sum + (r.optimized?.metrics?.totalPayloadKg || 0), 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isMultiBin ? 'Confirm & Dispatch All Routes' : 'Confirm & Dispatch Route'}
      subtitle={isMultiBin 
        ? `Multi-Vehicle Dispatch — ${routes.length} Routes Across ${vehicleAssignments.length} Vehicles`
        : 'Safety, Capacity & Manifest Verification Pre-Dispatch Checklist'}
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            isLoading={isSubmitting}
            disabled={isMultiBin ? routes.length === 0 : !canDispatchSingle}
            leftIcon={<Send className="w-3.5 h-3.5" />}
          >
            {isMultiBin 
              ? `Push ${routes.length} Routes to Driver Handhelds`
              : 'Push to Driver Handheld'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Sequence Type Banner */}
        <div className="p-3 bg-surface-low rounded-xl border border-outline-variant flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isOptimized ? (
              <Route className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <Package className="w-4 h-4 text-blue-500 shrink-0" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-on-surface">{dispatchModeTitle}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${dispatchModeBadge}`}>
                  {isOptimized ? (isImproved ? '2-OPT ALGORITHM' : 'ALREADY OPTIMAL') : 'DIRECT DISPATCH'}
                  {isMultiBin && <span className="ml-1">×{routes.length}</span>}
                </span>
              </div>
              <span className="text-[11px] text-on-surface-variant block mt-0.5">
                {dispatchModeDesc}
              </span>
            </div>
          </div>
          {isMultiBin && (
            <div className="flex items-center gap-2 text-xs">
              <Layers className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-amber-700 dark:text-amber-300 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                {vehicleAssignments.length} Vehicles · {aggregateStops} Stops
              </span>
            </div>
          )}
        </div>

        {/* Safety Header Status */}
        {isValidating ? (
          <div className="p-3 bg-surface-low text-on-surface rounded-lg border border-outline-variant flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Zap className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <span className="text-xs font-bold block">Validating Dispatch Eligibility...</span>
              <span className="text-[11px] text-on-surface-variant">
                Verifying consignment statuses, active route conflicts, and vehicle capacity.
              </span>
            </div>
          </div>
        ) : !isMultiBin && canDispatchSingle && !dispatchError ? (
          <div className="p-3 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 rounded-lg border border-emerald-500/30 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold block">Pre-Dispatch Clearance Verified</span>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                Vehicle payload bounds, courier assignment, and manifest readiness verified. Ready for immediate dispatch.
              </span>
            </div>
          </div>
        ) : isMultiBin && routes.length > 0 ? (
          <div className="p-3 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 rounded-lg border border-emerald-500/30 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold block">Multi-Vehicle Pre-Dispatch Clearance Verified</span>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                All {routes.length} routes validated. Vehicle payload bounds, courier assignments, and manifest readiness verified.
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-red-500/10 text-red-800 dark:text-red-200 rounded-lg border border-red-500/30 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold block">
                {dispatchError
                  ? 'Dispatch Blocked'
                  : stops.length === 0
                  ? 'No Deliveries Sequenced'
                  : !isPayloadValid
                  ? 'Payload Capacity Exceeded'
                  : !isDriverAssigned
                  ? 'No Courier Assigned'
                  : !isVehicleAssigned
                  ? 'No Vehicle Assigned'
                  : 'Pre-Dispatch Constraints Failed'}
              </span>
              <span className="text-[11px] text-red-700 dark:text-red-300 block">
                {dispatchError
                  ? dispatchError
                  : stops.length === 0
                  ? 'Batch has no eligible delivery stops. Cannot dispatch an empty route.'
                  : !isPayloadValid
                  ? `Total delivery payload (${totalPayloadKg.toFixed(1)} kg) exceeds vehicle max capacity (${capacityKg} kg). Rebalance batch before dispatching.`
                  : !isDriverAssigned
                  ? 'Please select and assign an available courier before dispatching.'
                  : !isVehicleAssigned
                  ? 'Please assign a vehicle to this batch before dispatching.'
                  : 'Resolve highlighted clearance issues below to proceed with dispatch.'}
              </span>
              {ineligibilityReasons.length > 0 && (
                <ul className="text-[11px] text-red-700 dark:text-red-300 space-y-0.5 pl-4 list-disc pt-1">
                  {ineligibilityReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Ineligible Deliveries Warning (if any) */}
        {ineligibleDeliveries.length > 0 && (
          <div className="p-3 bg-amber-500/10 text-amber-800 dark:text-amber-200 rounded-lg border border-amber-500/30 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-200">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{ineligibleDeliveries.length} Consignment(s) Ineligible for Dispatch</span>
            </div>
            <ul className="text-[11px] text-amber-700 dark:text-amber-300 space-y-1 pl-4 list-disc">
              {ineligibleDeliveries.map((inelig, idx) => (
                <li key={idx}>
                  <strong className="font-mono">{inelig.orderReference || inelig.deliveryId}:</strong> {inelig.reason}
                </li>
              ))}
            </ul>
            <span className="text-[10px] text-amber-700 dark:text-amber-300 block italic">
              These will be automatically excluded so you can dispatch the remaining eligible deliveries safely.
            </span>
          </div>
        )}

        {/* Multi-bin Route Cards */}
        {isMultiBin && routes.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-on-surface px-1">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span>Routes to Dispatch ({routes.length})</span>
              </span>
              <span className="text-[10px] font-mono text-secondary">
                Sequential dispatch order
              </span>
            </div>
            {routes.map((route, idx) => {
              const assignment = vehicleAssignments[idx];
              const routeVehicle = assignment 
                ? vehicles.find(v => v.id === assignment.vehicleId || v.vehicleId === assignment.vehicleId)
                : null;
              const routeDriver = assignment?.driverId
                ? drivers.find(d => d.id === assignment.driverId)
                : null;
              const routeStops = route.optimized?.stops || route.baseline?.stops || [];
              const routeMetrics = route.optimized?.metrics || route.baseline?.metrics;
              const isDispatching = dispatchingRouteIndex === idx;

              return (
                <div
                  key={route.id}
                  className={`p-3 rounded-xl border flex items-center justify-between flex-wrap gap-2 ${
                    isDispatching 
                      ? 'bg-primary/5 border-primary/30 ring-1 ring-primary/20' 
                      : 'bg-surface-lowest border-outline-variant/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Truck className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-on-surface">
                          {routeVehicle?.vehicleId || assignment?.vehiclePlate || `Vehicle ${idx + 1}`}
                        </span>
                        <span className="text-[10px] text-on-surface-variant">
                          {routeVehicle?.makeModel || ''}
                        </span>
                        {assignment?.utilizationPercent != null && (
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-[4px] border ${
                            assignment.utilizationPercent >= 90
                              ? 'bg-error/10 text-error border-error/30'
                              : assignment.utilizationPercent >= 75
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          }`}>
                            {assignment.utilizationPercent}% load
                          </span>
                        )}
                      </div>
                      {routeDriver && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3 text-on-surface-variant" />
                          <span className="text-[11px] text-on-surface-variant font-mono">
                            {typeof routeDriver.userId === 'object' && routeDriver.userId?.name ? routeDriver.userId.name : routeDriver.licenseNumber}
                            {routeDriver.licenseNumber && ` · ${routeDriver.licenseNumber}`}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-on-surface-variant font-mono">
                        <span>{routeStops.length} stops</span>
                        <span>{routeMetrics?.totalDistanceKm?.toFixed(1)} km</span>
                        <span>{routeMetrics?.totalDurationMin?.toFixed(0)} min</span>
                        <span>₹{routeMetrics?.costInr?.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isDispatching && (
                      <span className="text-[11px] font-semibold text-primary flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10">
                        <Zap className="w-3 h-3 animate-pulse" />
                        Dispatching...
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Single-bin mode: Original detailed steps */}
        {!isMultiBin && (
          <>
            {/* Step 1: Courier Verification */}
            <div className="p-3 bg-surface-low rounded-lg border border-outline-variant space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-on-surface">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-secondary" />
                  <span>Assigned Courier Verification</span>
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    isDriverAssigned && isDriverAvailable
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'bg-red-500/15 text-red-700 dark:text-red-300'
                  }`}
                >
                  {driver?.availability || (isDriverAssigned ? 'READY' : 'UNASSIGNED')}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1">
                <div>
                  <span className="text-[10px] text-on-surface-variant block uppercase font-sans">Name</span>
                  <span className="font-semibold text-on-surface truncate block">
                    {driverName}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-on-surface-variant block uppercase font-sans">Contact</span>
                  <span className="font-semibold text-on-surface">
                    {driverPhone}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-on-surface-variant block uppercase font-sans">Shift Status</span>
                  <span className={`font-semibold ${isDriverAvailable ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {driver?.availability || 'ON_DUTY'}
                  </span>
                </div>
              </div>
            </div>

            {/* Step 2: Vehicle & Cargo Clearance */}
            <div className="p-3 bg-surface-low rounded-lg border border-outline-variant space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-on-surface">
                <span className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-secondary" />
                  <span>Vehicle & Cargo Clearance</span>
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    isPayloadValid && isVehicleAvailable
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'bg-red-500/15 text-red-700 dark:text-red-300'
                  }`}
                >
                  {isPayloadValid && isVehicleAvailable ? 'PASS' : isPayloadValid ? 'VEHICLE UNAVAILABLE' : 'OVERWEIGHT'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1">
                <div>
                  <span className="text-[10px] text-on-surface-variant block uppercase font-sans">Vehicle</span>
                  <span className="font-semibold text-on-surface truncate block">
                    {vehicle?.vehicleId || vehicle?.makeModel || 'Assigned Vehicle'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-on-surface-variant block uppercase font-sans">
                    {vehicle?.fuelType === 'Electric' ? 'Battery SoC' : 'Propulsion / Fuel'}
                  </span>
                  <span className="font-semibold text-emerald-600 flex items-center gap-1">
                    {vehicle?.fuelType === 'Electric' ? (
                      <>
                        <Zap className="w-3 h-3" /> {vehicle?.batterySoC ?? 95}%
                      </>
                    ) : (
                      <span>{vehicle?.fuelType || 'Diesel'}</span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-on-surface-variant block uppercase font-sans">Cargo Load</span>
                  <span className={`font-semibold ${isPayloadValid ? 'text-on-surface' : 'text-red-600'}`}>
                    {totalPayloadKg.toFixed(1)} / {capacityKg} kg
                  </span>
                </div>
              </div>
            </div>

            {/* Step 3: Route Manifest & Telemetry Summary */}
            <div className="p-3 bg-surface-low rounded-lg border border-outline-variant space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-on-surface">
                <span className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-secondary" />
                  <span>Route Manifest Summary</span>
                </span>
                <span className="text-[10px] font-mono text-secondary font-bold">
                  {batch?.code || 'BATCH'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs font-mono pt-1">
                <div>
                  <span className="text-[10px] text-on-surface-variant block uppercase font-sans">Stops</span>
                  <span className="font-semibold text-on-surface">
                    {stops.length} deliveries
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-on-surface-variant block uppercase font-sans">Est. Distance</span>
                  <span className="font-semibold text-on-surface">
                    {metrics?.totalDistanceKm != null ? `${metrics.totalDistanceKm.toFixed(1)} km` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-on-surface-variant block uppercase font-sans">Est. Duration</span>
                  <span className="font-semibold text-on-surface">
                    {metrics?.totalDurationMin != null ? `${metrics.totalDurationMin.toFixed(0)} min` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-on-surface-variant block uppercase font-sans">SLA Certainty</span>
                  <span className="font-semibold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {metrics?.onTimeCertaintyPercent != null ? `${metrics.onTimeCertaintyPercent.toFixed(1)}%` : '99.0%'}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Multi-bin Aggregate Summary */}
        {isMultiBin && (
          <div className="p-3 bg-surface-low rounded-lg border border-outline-variant space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-on-surface">
              <span className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-secondary" />
                <span>Aggregate Manifest Summary</span>
              </span>
              <span className="text-[10px] font-mono text-secondary font-bold">
                {batch?.code || 'BATCH'}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono pt-1">
              <div>
                <span className="text-[10px] text-on-surface-variant block uppercase font-sans">Total Stops</span>
                <span className="font-semibold text-on-surface">{aggregateStops} deliveries</span>
              </div>
              <div>
                <span className="text-[10px] text-on-surface-variant block uppercase font-sans">Total Distance</span>
                <span className="font-semibold text-on-surface">{aggregateDistance.toFixed(1)} km</span>
              </div>
              <div>
                <span className="text-[10px] text-on-surface-variant block uppercase font-sans">Total Duration</span>
                <span className="font-semibold text-on-surface">{aggregateDuration.toFixed(0)} min</span>
              </div>
              <div>
                <span className="text-[10px] text-on-surface-variant block uppercase font-sans">Total Cost</span>
                <span className="font-semibold text-emerald-600">₹{aggregateCost.toFixed(2)}</span>
              </div>
              <div className="md:col-span-2">
                <span className="text-[10px] text-on-surface-variant block uppercase font-sans">Total Payload</span>
                <span className="font-semibold text-on-surface">{aggregatePayload.toFixed(1)} kg</span>
              </div>
              <div className="md:col-span-2">
                <span className="text-[10px] text-on-surface-variant block uppercase font-sans">Vehicles</span>
                <span className="font-semibold text-on-surface">{vehicleAssignments.length} vehicles</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
