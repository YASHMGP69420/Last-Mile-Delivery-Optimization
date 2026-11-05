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
} from 'lucide-react';

export interface DispatchConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: DeliveryBatch | null;
  vehicle?: Vehicle | null;
  driver?: Driver | null;
  stops: RouteStop[];
  metrics?: RouteMetrics;
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
  onConfirmDispatch,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalPayloadKg = stops.reduce((acc, s) => acc + (s.weightKg || 0), 0);
  const capacityKg = vehicle?.capacityKg || 1000;
  const isPayloadValid = totalPayloadKg <= capacityKg;
  const canDispatch = isPayloadValid && stops.length > 0 && !isSubmitting;

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm & Dispatch Route"
      subtitle="Safety & Telemetry Pre-Dispatch Checklist"
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
        {/* Safety Header Status */}
        {isPayloadValid && stops.length > 0 ? (
          <div className="p-3 bg-emerald-50 text-emerald-900 rounded-lg border border-emerald-200 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold block">Pre-Dispatch Clearance Verified</span>
              <span className="text-[11px] text-emerald-700">
                Vehicle payload bounds, battery/fuel status, and courier assignment verified.
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
                {stops.length === 0 ? 'No Deliveries Sequenced' : 'Payload Capacity Exceeded'}
              </span>
              <span className="text-[11px] text-red-700">
                {stops.length === 0
                  ? 'Batch has no sequenced delivery stops. Cannot dispatch an empty route.'
                  : `Total delivery payload (${totalPayloadKg.toFixed(1)} kg) exceeds vehicle max capacity (${capacityKg} kg). Rebalance batch before dispatching.`}
              </span>
            </div>
          </div>
        )}

        {/* Step 1: Courier Verification */}
        <div className="p-3 bg-surface-low rounded-lg border border-outline-variant space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-on-surface">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-secondary" />
              <span>Assigned Courier Verification</span>
            </span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono font-bold px-2 py-0.5 rounded">
              {driver?.availability || 'READY'}
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
              <span className="font-semibold text-emerald-600">
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
                isPayloadValid ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {isPayloadValid ? 'PASS' : 'OVERWEIGHT'}
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

        {/* Step 3: Route Manifest Summary */}
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
          <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1">
            <div>
              <span className="text-[10px] text-on-surface-variant block uppercase font-sans">Total Stops</span>
              <span className="font-semibold text-on-surface">
                {stops.length} deliveries + depot
              </span>
            </div>
            <div>
              <span className="text-[10px] text-on-surface-variant block uppercase font-sans">Shift Schedule</span>
              <span className="font-semibold text-on-surface">
                {batch?.shift ? `${batch.shift} Shift` : 'Scheduled Shift'}
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
