import React, { useState, useEffect } from 'react';
import { Drawer } from '../common/Drawer';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Delivery, DeliveryBatch, Vehicle, Driver } from '../../types';
import { Layers, Truck, AlertTriangle } from 'lucide-react';
import { BatchesApi } from '../../api/client';
import { clsx } from 'clsx';

export interface BatchCreatedInfo {
  batch: DeliveryBatch;
  deliveryCount: number;
  totalWeightKg: number;
  vehicleLabel: string;
  driverLabel: string;
}

export interface BatchErrorInfo {
  title: string;
  message: string;
  code?: string;
  meta?: Array<{ label: string; value: string }>;
}

interface BatchComposerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDeliveries: Delivery[];
  vehicles: Vehicle[];
  drivers: Driver[];
  onBatchCreated: (info: BatchCreatedInfo) => void;
  onBatchError?: (info: BatchErrorInfo) => void;
}

const getPreferredVehicleId = (vehicles: Vehicle[]): string => {
  return (vehicles.find((v) => v.availability === 'AVAILABLE') || vehicles[0])?.id || '';
};

const getPreferredDriverId = (drivers: Driver[]): string => {
  return (
    drivers.find((d) => d.availability === 'AVAILABLE' || d.availability === 'ON_DUTY') ||
    drivers[0]
  )?.id || '';
};

const getDriverDisplayName = (driver?: Driver | null): string => {
  if (!driver) return 'Unassigned';
  if (typeof driver.userId === 'object' && driver.userId) {
    return (driver.userId as any).name || 'Driver';
  }
  return driver.licenseNumber || 'Driver';
};

export const BatchComposerPanel: React.FC<BatchComposerPanelProps> = ({
  isOpen,
  onClose,
  selectedDeliveries,
  vehicles,
  drivers,
  onBatchCreated,
  onBatchError,
}) => {
  const generateBatchCode = () => `BBSR-EXP-${Math.floor(1000 + Math.random() * 9000)}`;

  const [batchCode, setBatchCode] = useState(generateBatchCode);
  const [batchName, setBatchName] = useState('Bhubaneswar Dispatch Cluster');
  const [shift, setShift] = useState('Shift A (08:00 - 17:00)');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(() =>
    getPreferredVehicleId(vehicles)
  );
  const [selectedDriverId, setSelectedDriverId] = useState<string>(() =>
    getPreferredDriverId(drivers)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (isOpen) {
      setBatchCode(generateBatchCode());
      setError(null);
      setErrorCode(undefined);
      setSelectedVehicleId(getPreferredVehicleId(vehicles));
      setSelectedDriverId(getPreferredDriverId(drivers));
    }
  }, [isOpen]);

  useEffect(() => {
    if (!selectedVehicleId && vehicles.length > 0) {
      setSelectedVehicleId(getPreferredVehicleId(vehicles));
    }
  }, [vehicles, selectedVehicleId]);

  useEffect(() => {
    if (!selectedDriverId && drivers.length > 0) {
      setSelectedDriverId(getPreferredDriverId(drivers));
    }
  }, [drivers, selectedDriverId]);

  const totalWeightKg = selectedDeliveries.reduce((sum, d) => sum + (d.weightKg || 0), 0);
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];
  const selectedDriver = drivers.find((d) => d.id === selectedDriverId) || drivers[0];
  const maxCapacityKg = selectedVehicle ? selectedVehicle.capacityKg : 1000;
  const largestVehicleCapKg =
    vehicles.length > 0 ? Math.max(...vehicles.map((v) => v.capacityKg || 0)) : maxCapacityKg;
  const loadPercentage = Math.min(Math.round((totalWeightKg / maxCapacityKg) * 100), 150);
  const isOverloaded = totalWeightKg > maxCapacityKg;
  const exceedsLargestVehicle = totalWeightKg > largestVehicleCapKg;

  const handleSubmit = async () => {
    const normalizedCode = batchCode.trim().toUpperCase();
    const normalizedName = batchName.trim();
    if (!normalizedCode) {
      const msg = 'Batch Code is required.';
      setError(msg);
      setErrorCode('VALIDATION_ERROR');
      onBatchError?.({
        title: 'Cannot Create Operational Batch',
        message: msg,
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    if (!normalizedName) {
      const msg = 'Batch Descriptive Title is required.';
      setError(msg);
      setErrorCode('VALIDATION_ERROR');
      onBatchError?.({
        title: 'Cannot Create Operational Batch',
        message: msg,
        code: 'VALIDATION_ERROR',
      });
      return;
    }
    if (selectedDeliveries.length === 0) {
      const msg = 'Please select at least one delivery consignment.';
      setError(msg);
      setErrorCode('VALIDATION_ERROR');
      onBatchError?.({
        title: 'Cannot Create Operational Batch',
        message: msg,
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setErrorCode(undefined);
    try {
      const activeVehicleId = selectedVehicleId || getPreferredVehicleId(vehicles);
      const activeDriverId = selectedDriverId || getPreferredDriverId(drivers);

      const res = await BatchesApi.create({
        code: normalizedCode,
        name: normalizedName,
        shift,
        date: new Date().toISOString().split('T')[0],
        deliveryIds: selectedDeliveries.map((d) => d.id),
        vehicleIds: activeVehicleId ? [activeVehicleId] : [],
        driverIds: activeDriverId ? [activeDriverId] : [],
      });

      const createdBatch = res.data.batch;
      const populatedVehicle =
        Array.isArray(createdBatch.vehicleIds) && typeof createdBatch.vehicleIds[0] === 'object'
          ? (createdBatch.vehicleIds[0] as Vehicle)
          : null;
      const populatedDriver =
        Array.isArray(createdBatch.driverIds) && typeof createdBatch.driverIds[0] === 'object'
          ? (createdBatch.driverIds[0] as Driver)
          : null;

      const vehicleLabel = populatedVehicle?.vehicleId
        ? `${populatedVehicle.vehicleId}${populatedVehicle.makeModel ? ` (${populatedVehicle.makeModel})` : ''}`
        : selectedVehicle
        ? `${selectedVehicle.vehicleId} (${selectedVehicle.makeModel})`
        : 'Unassigned';

      const driverLabel = populatedDriver
        ? getDriverDisplayName(populatedDriver)
        : getDriverDisplayName(selectedDriver);

      onBatchCreated({
        batch: createdBatch,
        deliveryCount: selectedDeliveries.length,
        totalWeightKg: Math.round(totalWeightKg * 10) / 10,
        vehicleLabel,
        driverLabel,
      });
      onClose();
    } catch (err: any) {
      const code: string | undefined =
        err?.response?.data?.error?.code || err?.response?.data?.code;
      const message: string =
        err?.friendlyMessage ||
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to create operational batch';

      setError(message);
      setErrorCode(code);

      const title =
        code === 'DELIVERY_ALREADY_IN_BATCH' || code === 'DELIVERY_IN_ACTIVE_ROUTE'
          ? 'Already Assigned — Cannot Create Batch'
          : 'Cannot Create Operational Batch';

      onBatchError?.({
        title,
        message,
        code,
        meta: [
          { label: 'Batch Code', value: normalizedCode },
          { label: 'Selected Stops', value: `${selectedDeliveries.length} (${totalWeightKg.toFixed(1)} kg)` },
          ...(code ? [{ label: 'Conflict Code', value: code }] : []),
        ],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Compose Operational Batch"
      subtitle="Group parcels into a multi-stop vehicle dispatch run"
      width="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={selectedDeliveries.length === 0}
            leftIcon={<Layers className="w-4 h-4" />}
          >
            Create Batch ({selectedDeliveries.length} stops)
          </Button>
        </div>
      }
    >
      <div className="space-y-6 text-sm">
        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-lg bg-white dark:bg-[#121417] border border-slate-200 dark:border-[#262A32] border-l-4 border-l-rose-600 dark:border-l-rose-500 shadow-sm space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/25">
                  {errorCode || 'BATCH CONFLICT'}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-700 dark:text-zinc-200 font-medium leading-relaxed">
              {error}
            </p>
          </div>
        )}

        {/* Batch Meta Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Batch Code"
            value={batchCode}
            onChange={(e) => setBatchCode(e.target.value)}
            className="font-mono"
            required
          />
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              Operational Shift
            </label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="w-full text-sm rounded-md border border-outline-variant bg-surface-lowest px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
            >
              <option value="Shift A (08:00 - 17:00)">Shift A (08:00 - 17:00)</option>
              <option value="Shift B (12:00 - 20:00)">Shift B (12:00 - 20:00)</option>
              <option value="Express Night (20:00 - 04:00)">Express Night (20:00 - 04:00)</option>
            </select>
          </div>
        </div>

        <Input
          label="Batch Descriptive Title"
          value={batchName}
          onChange={(e) => setBatchName(e.target.value)}
          placeholder="e.g. Patia & Infocity Express Dispatch"
          required
        />

        {/* Payload Utilization Gauge */}
        <div className="p-4 rounded-lg bg-surface-low border border-outline-variant space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-secondary" />
              Chassis Payload Utilization
            </span>
            <span
              className={clsx(
                'text-xs font-mono font-bold px-2 py-0.5 rounded',
                isOverloaded || loadPercentage > 85
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              )}
            >
              {loadPercentage}% Capacity
            </span>
          </div>

          {/* Gauge Bar */}
          <div className="w-full bg-surface-high dark:bg-obsidian-800 h-2.5 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full transition-all duration-300 rounded-full',
                isOverloaded || loadPercentage > 85 ? 'bg-amber-500' : 'bg-secondary'
              )}
              style={{ width: `${Math.min(loadPercentage, 100)}%` }}
            />
          </div>

          <div className="flex justify-between text-xs font-mono text-on-surface-variant">
            <span>Cargo: {totalWeightKg.toFixed(1)} kg</span>
            <span>Chassis Limit: {maxCapacityKg} kg</span>
          </div>

          {isOverloaded && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Payload ({totalWeightKg.toFixed(1)} kg) exceeds{' '}
                {exceedsLargestVehicle
                  ? `the largest single fleet vehicle (${largestVehicleCapKg} kg)`
                  : `the selected vehicle cap (${maxCapacityKg} kg)`}{' '}
                — Route Optimizer will split stops across multiple fleet vehicles automatically.
              </span>
            </div>
          )}
        </div>

        {/* Chassis & Driver Assignment */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              Select Fleet Vehicle
            </label>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full text-sm rounded-md border border-outline-variant bg-surface-lowest px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary font-mono"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vehicleId} [{v.availability}] — {v.makeModel} ({v.capacityKg}kg, {v.fuelType})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              Assign Primary Driver
            </label>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="w-full text-sm rounded-md border border-outline-variant bg-surface-lowest px-3 py-2 text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {getDriverDisplayName(d)} [{d.availability}] — {d.licenseNumber} (Rating: {d.rating})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stops Preview List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span className="font-semibold text-on-surface">
              Included Consignments ({selectedDeliveries.length})
            </span>
            <span className="font-mono">Central Hub: Rasulgarh</span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1.5 border border-outline-variant rounded-md p-2 bg-surface-low/50">
            {selectedDeliveries.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between p-2 rounded bg-surface-lowest border border-outline-variant/60 text-xs"
              >
                <div className="truncate pr-2">
                  <span className="font-mono font-semibold text-secondary mr-2">
                    {d.orderReference}
                  </span>
                  <span className="text-on-surface">{d.customer?.name || 'Customer'}</span>
                  <span className="text-on-surface-variant text-[11px] block truncate">
                    {d.address?.street || 'No address'} ({d.address?.zone || 'Unassigned'})
                  </span>
                </div>
                <div className="text-right shrink-0 font-mono font-semibold tabular-nums">
                  {(d.weightKg ?? 0).toFixed(1)} kg
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
};
