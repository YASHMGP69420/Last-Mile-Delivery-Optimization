import React, { useState, useEffect } from 'react';
import { Drawer } from '../common/Drawer';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Delivery, Vehicle, Driver } from '../../types';
import { Layers, Truck, UserCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { BatchesApi } from '../../api/client';
import { clsx } from 'clsx';

interface BatchComposerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDeliveries: Delivery[];
  vehicles: Vehicle[];
  drivers: Driver[];
  onBatchCreated: () => void;
}

export const BatchComposerPanel: React.FC<BatchComposerPanelProps> = ({
  isOpen,
  onClose,
  selectedDeliveries,
  vehicles,
  drivers,
  onBatchCreated,
}) => {
  const generateBatchCode = () => `BBSR-EXP-${Math.floor(1000 + Math.random() * 9000)}`;

  const [batchCode, setBatchCode] = useState(generateBatchCode);
  const [batchName, setBatchName] = useState('Bhubaneswar Dispatch Cluster');
  const [shift, setShift] = useState('Shift A (08:00 - 17:00)');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    vehicles[0]?.id || ''
  );
  const [selectedDriverId, setSelectedDriverId] = useState<string>(
    drivers[0]?.id || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setBatchCode(generateBatchCode());
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!selectedVehicleId && vehicles.length > 0) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [vehicles, selectedVehicleId]);

  useEffect(() => {
    if (!selectedDriverId && drivers.length > 0) {
      setSelectedDriverId(drivers[0].id);
    }
  }, [drivers, selectedDriverId]);

  const totalWeightKg = selectedDeliveries.reduce((sum, d) => sum + (d.weightKg || 0), 0);
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];
  const maxCapacityKg = selectedVehicle ? selectedVehicle.capacityKg : 1000;
  const loadPercentage = Math.min(Math.round((totalWeightKg / maxCapacityKg) * 100), 150);
  const isOverloaded = totalWeightKg > maxCapacityKg;

  const handleSubmit = async () => {
    if (!batchCode.trim()) {
      setError('Batch Code is required.');
      return;
    }
    if (!batchName.trim()) {
      setError('Batch Descriptive Title is required.');
      return;
    }
    if (selectedDeliveries.length === 0) {
      setError('Please select at least one delivery consignment.');
      return;
    }
    if (isOverloaded) {
      setError(`Batch payload (${totalWeightKg.toFixed(1)} kg) exceeds vehicle capacity (${maxCapacityKg} kg). Remove deliveries or assign a larger vehicle.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const activeVehicleId = selectedVehicleId || vehicles[0]?.id;
      const activeDriverId = selectedDriverId || drivers[0]?.id;

      await BatchesApi.create({
        code: batchCode.trim(),
        name: batchName.trim(),
        shift,
        date: new Date().toISOString().split('T')[0],
        deliveryIds: selectedDeliveries.map((d) => d.id),
        vehicleIds: activeVehicleId ? [activeVehicleId] : [],
        driverIds: activeDriverId ? [activeDriverId] : [],
      });
      onBatchCreated();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to create operational batch');
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
            disabled={selectedDeliveries.length === 0 || isOverloaded}
            leftIcon={<Layers className="w-4 h-4" />}
          >
            Create Batch ({selectedDeliveries.length} stops)
          </Button>
        </div>
      }
    >
      <div className="space-y-6 text-sm">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-xs font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
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
                isOverloaded
                  ? 'bg-red-100 text-red-700'
                  : loadPercentage > 85
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              )}
            >
              {loadPercentage}% Capacity
            </span>
          </div>

          {/* Gauge Bar */}
          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full transition-all duration-300 rounded-full',
                isOverloaded
                  ? 'bg-red-500'
                  : loadPercentage > 85
                  ? 'bg-amber-500'
                  : 'bg-secondary'
              )}
              style={{ width: `${Math.min(loadPercentage, 100)}%` }}
            />
          </div>

          <div className="flex justify-between text-xs font-mono text-on-surface-variant">
            <span>Cargo: {totalWeightKg.toFixed(1)} kg</span>
            <span>Chassis Limit: {maxCapacityKg} kg</span>
          </div>

          {isOverloaded && (
            <p className="text-xs text-red-600 font-medium flex items-center gap-1.5 pt-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Batch exceeds vehicle payload by {(totalWeightKg - maxCapacityKg).toFixed(1)} kg!
            </p>
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
                  {v.vehicleId} — {v.makeModel} ({v.capacityKg}kg, {v.fuelType})
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
                  {typeof d.userId === 'object' && d.userId ? (d.userId as any).name : 'Driver'} —{' '}
                  {d.licenseNumber} (Rating: {d.rating})
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
