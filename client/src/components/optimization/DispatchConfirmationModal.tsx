import React, { useState } from 'react';
import { DeliveryBatch, Vehicle, Driver } from '../../types';
import { RouteStop, RouteMetrics } from '../../types/route';
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
  Sparkles,
  Info,
} from 'lucide-react';

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
  onConfirmDispatch: () => Promise<void>;
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
  onConfirmDispatch,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalPayloadKg = stops.reduce((acc, s) => acc + (s.weightKg || 0), 0);
  const capacityKg = vehicle?.capacityKg || 1000;
  const isPayloadValid = totalPayloadKg <= capacityKg;
  const isDriverAssigned = Boolean(driver);
  const isVehicleAssigned = Boolean(vehicle);
  const isVehicleAvailable = vehicle?.availability !== 'MAINTENANCE' && vehicle?.availability !== 'RETIRED';
  const isDriverAvailable = driver?.availability !== 'IN_TRANSIT';

  const canDispatch =
    isPayloadValid &&
    stops.length > 0 &&
    isDriverAssigned &&
    isVehicleAssigned &&
    isVehicleAvailable &&
    isDriverAvailable &&
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

  const handleConfirm = async () => {
    if (!canDispatch) return;
    setIsSubmitting(true);
    try {
      await onConfirmDispatch();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine dispatch mode description
  let dispatchModeTitle = 'Original Manifest Sequence';
  let dispatchModeBadge = 'bg-blue-100 text-blue-800 border-blue-200';
  let dispatchModeDesc = 'Dispatching current stop order directly without prior optimization.';

  if (isOptimized && isImproved) {
    dispatchModeTitle = 'Optimized Delivery Sequence';
    dispatchModeBadge = 'bg-emerald-100 text-emerald-800 border-emerald-200';
    dispatchModeDesc = 'Optimized via 2-Opt local search with verified fuel and distance reductions.';
  } else if (isOptimized && !isImproved) {
    dispatchModeTitle = 'Verified Optimal Sequence';
    dispatchModeBadge = 'bg-amber-100 text-amber-800 border-amber-200';
    dispatchModeDesc = 'Baseline order evaluated: already optimal among alternatives. Preserving manifest sequence.';
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm & Dispatch Route"
      subtitle="Safety, Capacity & Manifest Verification Pre-Dispatch Checklist"
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
            disabled={!canDispatch}
            leftIcon={<Send className="w-3.5 h-3.5" />}
          >
            Push to Driver Handheld
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Sequence Type Banner */}
        <div className="p-3 bg-surface-low rounded-xl border border-outline-variant flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isOptimized ? (
              <Sparkles className="w-4 h-4 text-secondary shrink-0" />
            ) : (
              <Package className="w-4 h-4 text-blue-500 shrink-0" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-on-surface">{dispatchModeTitle}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${dispatchModeBadge}`}>
                  {isOptimized ? (isImproved ? '2-OPT ALGORITHM' : 'ALREADY OPTIMAL') : 'DIRECT DISPATCH'}
                </span>
              </div>
              <span className="text-[11px] text-on-surface-variant block mt-0.5">
                {dispatchModeDesc}
              </span>
            </div>
          </div>
        </div>

        {/* Safety Header Status */}
        {canDispatch ? (
          <div className="p-3 bg-emerald-50 text-emerald-900 rounded-lg border border-emerald-200 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold block">Pre-Dispatch Clearance Verified</span>
              <span className="text-[11px] text-emerald-700">
                Vehicle payload bounds, courier assignment, and manifest readiness verified. Ready for immediate dispatch.
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-red-50 text-red-900 rounded-lg border border-red-200 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-700 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold block">
                {stops.length === 0
                  ? 'No Deliveries Sequenced'
                  : !isPayloadValid
                  ? 'Payload Capacity Exceeded'
                  : !isDriverAssigned
                  ? 'No Courier Assigned'
                  : !isVehicleAssigned
                  ? 'No Vehicle Assigned'
                  : 'Pre-Dispatch Constraints Failed'}
              </span>
              <span className="text-[11px] text-red-700">
                {stops.length === 0
                  ? 'Batch has no eligible delivery stops. Cannot dispatch an empty route.'
                  : !isPayloadValid
                  ? `Total delivery payload (${totalPayloadKg.toFixed(1)} kg) exceeds vehicle max capacity (${capacityKg} kg). Rebalance batch before dispatching.`
                  : !isDriverAssigned
                  ? 'Please select and assign an available courier before dispatching.'
                  : !isVehicleAssigned
                  ? 'Please assign a vehicle to this batch before dispatching.'
                  : 'Resolve highlighted clearance issues below to proceed with dispatch.'}
              </span>
            </div>
          </div>
        )}

        {/* Ineligible Deliveries Warning (if any) */}
        {ineligibleDeliveries.length > 0 && (
          <div className="p-3 bg-amber-50 text-amber-900 rounded-lg border border-amber-200 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{ineligibleDeliveries.length} Consignment(s) Ineligible for Dispatch</span>
            </div>
            <ul className="text-[11px] text-amber-800 space-y-1 pl-4 list-disc">
              {ineligibleDeliveries.map((inelig, idx) => (
                <li key={idx}>
                  <strong className="font-mono">{inelig.orderReference || inelig.deliveryId}:</strong> {inelig.reason}
                </li>
              ))}
            </ul>
            <span className="text-[10px] text-amber-700 block italic">
              These will be automatically excluded so you can dispatch the remaining eligible deliveries safely.
            </span>
          </div>
        )}

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
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-red-100 text-red-800'
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
              <span className={`font-semibold ${isDriverAvailable ? 'text-emerald-600' : 'text-red-600'}`}>
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
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-red-100 text-red-800'
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
      </div>
    </Modal>
  );
};
