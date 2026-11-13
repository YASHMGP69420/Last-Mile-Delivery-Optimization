import React, { useEffect, useState } from 'react';
import { FleetApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { FuelType, Vehicle, VehicleStatus, VehicleType } from '../../types';
import { AdminHeader } from '../../components/layout/AdminHeader';
import { Table } from '../../components/common/Table';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  Plus,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  FileText,
  RotateCw,
  Pencil,
  Wrench,
  Archive,
} from 'lucide-react';

interface CreateVehicleForm {
  vehicleId: string;
  makeModel: string;
  type: VehicleType;
  capacityKg: string;
  capacityM3: string;
  fuelType: FuelType;
  kmPerLitre: string;
  energyKWhPerKm: string;
  tankCapacityLitres: string;
  lastOdometerKm: string;
}

interface EditVehicleForm {
  makeModel: string;
  type: VehicleType;
  fuelType: FuelType;
  capacityKg: string;
  capacityM3: string;
  availability: VehicleStatus;
  kmPerLitre: string;
  energyKWhPerKm: string;
  tankCapacityLitres: string;
  batterySoC: string;
  lastOdometerKm: string;
}

interface MaintenanceForm {
  serviceDate: string;
  type: 'Routine' | 'Repair' | 'Inspection';
  cost: string;
  nextServiceDate: string;
  notes: string;
}

const INITIAL_CREATE_FORM: CreateVehicleForm = {
  vehicleId: '',
  makeModel: '',
  type: 'Van',
  capacityKg: '500',
  capacityM3: '',
  fuelType: 'Diesel',
  kmPerLitre: '12',
  energyKWhPerKm: '0.18',
  tankCapacityLitres: '',
  lastOdometerKm: '',
};

const getTodayIsoDate = () => new Date().toISOString().split('T')[0];

const getErrorMessage = (err: any, fallback: string) =>
  err?.friendlyMessage || err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || fallback;

export const FleetsPage: React.FC = () => {
  const { isAdmin } = useAuth();

  // Vehicle state
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);

  // Action status message
  const [actionMsg, setActionMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Create vehicle modal
  const [showCreateVehicle, setShowCreateVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState<CreateVehicleForm>(INITIAL_CREATE_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Edit vehicle modal
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [editForm, setEditForm] = useState<EditVehicleForm>({
    makeModel: '',
    type: 'Van',
    fuelType: 'Diesel',
    capacityKg: '',
    capacityM3: '',
    availability: 'AVAILABLE',
    kmPerLitre: '',
    energyKWhPerKm: '',
    tankCapacityLitres: '',
    batterySoC: '',
    lastOdometerKm: '',
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Log Maintenance modal
  const [maintenanceVehicle, setMaintenanceVehicle] = useState<Vehicle | null>(null);
  const [maintenanceForm, setMaintenanceForm] = useState<MaintenanceForm>({
    serviceDate: getTodayIsoDate(),
    type: 'Routine',
    cost: '0',
    nextServiceDate: '',
    notes: '',
  });
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [loggingMaintenance, setLoggingMaintenance] = useState(false);

  // Retire vehicle confirmation modal
  const [retiringVehicle, setRetiringVehicle] = useState<Vehicle | null>(null);
  const [retiring, setRetiring] = useState(false);

  // CSV Import Modal for Vehicles
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [isDryRun, setIsDryRun] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const fetchVehicles = async () => {
    setVehiclesLoading(true);
    setVehiclesError(null);
    try {
      const res = await FleetApi.getVehicles();
      setVehicles(res.data.vehicles || []);
    } catch (e: any) {
      setVehiclesError(getErrorMessage(e, 'Failed to load vehicles'));
    } finally {
      setVehiclesLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const openCreateModal = () => {
    setNewVehicle(INITIAL_CREATE_FORM);
    setCreateError(null);
    setShowCreateVehicle(true);
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const normalizedVehicleId = newVehicle.vehicleId.trim().toUpperCase();
    const normalizedMakeModel = newVehicle.makeModel.trim();
    if (!normalizedVehicleId) {
      setCreateError('License Plate / Vehicle ID is required.');
      return;
    }
    if (!normalizedMakeModel) {
      setCreateError('Make & Model is required.');
      return;
    }

    const capacityKg = Number(newVehicle.capacityKg);
    if (!Number.isFinite(capacityKg) || capacityKg <= 0) {
      setCreateError('Payload capacity (kg) must be greater than 0.');
      return;
    }

    let capacityM3: number | undefined;
    if (newVehicle.capacityM3.trim() !== '') {
      capacityM3 = Number(newVehicle.capacityM3);
      if (!Number.isFinite(capacityM3) || capacityM3 <= 0) {
        setCreateError('Volumetric capacity (m³) must be greater than 0.');
        return;
      }
    }

    let lastOdometerKm: number | undefined;
    if (newVehicle.lastOdometerKm.trim() !== '') {
      lastOdometerKm = Number(newVehicle.lastOdometerKm);
      if (!Number.isFinite(lastOdometerKm) || lastOdometerKm < 0) {
        setCreateError('Baseline odometer reading cannot be negative.');
        return;
      }
    }

    const isElectric = newVehicle.fuelType === 'Electric';
    let kmPerLitre: number | undefined;
    let energyKWhPerKm: number | undefined;
    let tankCapacityLitres: number | undefined;

    if (isElectric) {
      energyKWhPerKm = Number(newVehicle.energyKWhPerKm);
      if (!Number.isFinite(energyKWhPerKm) || energyKWhPerKm <= 0) {
        setCreateError('Energy efficiency (kWh/km) must be greater than 0 for Electric vehicles.');
        return;
      }
    } else {
      kmPerLitre = Number(newVehicle.kmPerLitre);
      if (!Number.isFinite(kmPerLitre) || kmPerLitre <= 0) {
        setCreateError('Fuel efficiency (km/L) must be greater than 0 for Petrol/Diesel vehicles.');
        return;
      }
      if (newVehicle.tankCapacityLitres.trim() !== '') {
        tankCapacityLitres = Number(newVehicle.tankCapacityLitres);
        if (!Number.isFinite(tankCapacityLitres) || tankCapacityLitres < 1) {
          setCreateError('Tank capacity (L) must be at least 1 litre.');
          return;
        }
      }
    }

    setCreating(true);
    try {
      const payload: Partial<Vehicle> = {
        vehicleId: normalizedVehicleId,
        makeModel: normalizedMakeModel,
        type: newVehicle.type,
        capacityKg,
        fuelType: newVehicle.fuelType,
        ...(capacityM3 !== undefined ? { capacityM3 } : {}),
        ...(lastOdometerKm !== undefined ? { lastOdometerKm } : {}),
        ...(isElectric ? { energyKWhPerKm } : { kmPerLitre }),
        ...(!isElectric && tankCapacityLitres !== undefined ? { tankCapacityLitres } : {}),
      };

      const res = await FleetApi.createVehicle(payload);
      if (res.success) {
        setShowCreateVehicle(false);
        setNewVehicle(INITIAL_CREATE_FORM);
        setActionMsg({ text: `Vehicle ${normalizedVehicleId} registered successfully!`, type: 'success' });
        fetchVehicles();
      }
    } catch (err: any) {
      setCreateError(getErrorMessage(err, 'Failed to create vehicle'));
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setEditError(null);
    setEditForm({
      makeModel: vehicle.makeModel || '',
      type: vehicle.type || 'Van',
      fuelType: vehicle.fuelType || 'Diesel',
      capacityKg: vehicle.capacityKg != null ? String(vehicle.capacityKg) : '',
      capacityM3: vehicle.capacityM3 != null ? String(vehicle.capacityM3) : '',
      availability: vehicle.availability || 'AVAILABLE',
      kmPerLitre: vehicle.kmPerLitre != null ? String(vehicle.kmPerLitre) : '12',
      energyKWhPerKm: vehicle.energyKWhPerKm != null ? String(vehicle.energyKWhPerKm) : '0.18',
      tankCapacityLitres: vehicle.tankCapacityLitres != null ? String(vehicle.tankCapacityLitres) : '',
      batterySoC: vehicle.batterySoC != null ? String(vehicle.batterySoC) : '',
      lastOdometerKm: vehicle.lastOdometerKm != null ? String(vehicle.lastOdometerKm) : '',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle) return;
    setEditError(null);

    const trimmedMake = editForm.makeModel.trim();
    if (!trimmedMake) {
      setEditError('Make & Model is required.');
      return;
    }

    const capacityKg = Number(editForm.capacityKg);
    if (!Number.isFinite(capacityKg) || capacityKg <= 0) {
      setEditError('Capacity (kg) must be greater than 0.');
      return;
    }

    let capacityM3: number | null = null;
    if (editForm.capacityM3.trim() !== '') {
      capacityM3 = Number(editForm.capacityM3);
      if (!Number.isFinite(capacityM3) || capacityM3 <= 0) {
        setEditError('Capacity (m³) must be greater than 0.');
        return;
      }
    }

    let lastOdometerKm: number | null = null;
    if (editForm.lastOdometerKm.trim() !== '') {
      lastOdometerKm = Number(editForm.lastOdometerKm);
      if (!Number.isFinite(lastOdometerKm) || lastOdometerKm < 0) {
        setEditError('Last odometer reading cannot be negative.');
        return;
      }
    }

    const isElectric = editForm.fuelType === 'Electric';
    let kmPerLitre: number | null = null;
    let energyKWhPerKm: number | null = null;
    let tankCapacityLitres: number | null = null;
    let batterySoC: number | null = null;

    if (isElectric) {
      energyKWhPerKm = Number(editForm.energyKWhPerKm);
      if (!Number.isFinite(energyKWhPerKm) || energyKWhPerKm <= 0) {
        setEditError('Energy efficiency (kWh/km) must be greater than 0 for Electric vehicles.');
        return;
      }
      if (editForm.batterySoC.trim() !== '') {
        batterySoC = Number(editForm.batterySoC);
        if (!Number.isFinite(batterySoC) || batterySoC < 0 || batterySoC > 100) {
          setEditError('Battery SoC must be between 0% and 100%.');
          return;
        }
      }
    } else {
      kmPerLitre = Number(editForm.kmPerLitre);
      if (!Number.isFinite(kmPerLitre) || kmPerLitre <= 0) {
        setEditError('Fuel efficiency (km/L) must be greater than 0 for Petrol/Diesel vehicles.');
        return;
      }
      if (editForm.tankCapacityLitres.trim() !== '') {
        tankCapacityLitres = Number(editForm.tankCapacityLitres);
        if (!Number.isFinite(tankCapacityLitres) || tankCapacityLitres < 1) {
          setEditError('Tank capacity (L) must be at least 1 litre.');
          return;
        }
      }
    }

    setSavingEdit(true);
    try {
      const vehicleDbId = editingVehicle.id || (editingVehicle as any)._id;
      const payload: Partial<Vehicle> = {
        makeModel: trimmedMake,
        type: editForm.type,
        fuelType: editForm.fuelType,
        capacityKg,
        capacityM3,
        availability: editForm.availability,
        lastOdometerKm,
        kmPerLitre,
        energyKWhPerKm,
        tankCapacityLitres,
        batterySoC,
      };
      await FleetApi.updateVehicle(vehicleDbId, payload);
      setActionMsg({ text: `Vehicle ${editingVehicle.vehicleId} updated successfully.`, type: 'success' });
      setEditingVehicle(null);
      fetchVehicles();
    } catch (err: any) {
      setEditError(getErrorMessage(err, 'Failed to update vehicle'));
    } finally {
      setSavingEdit(false);
    }
  };

  const openMaintenanceModal = (vehicle: Vehicle) => {
    setMaintenanceVehicle(vehicle);
    setMaintenanceError(null);
    setMaintenanceForm({
      serviceDate: getTodayIsoDate(),
      type: 'Routine',
      cost: '0',
      nextServiceDate: '',
      notes: '',
    });
  };

  const handleLogMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintenanceVehicle) return;
    setMaintenanceError(null);

    if (!maintenanceForm.serviceDate) {
      setMaintenanceError('Service date is required.');
      return;
    }

    const parsedCost = Number(maintenanceForm.cost);
    if (maintenanceForm.cost.trim() === '' || !Number.isFinite(parsedCost) || parsedCost < 0) {
      setMaintenanceError('Maintenance cost must be 0 or greater.');
      return;
    }

    if (maintenanceForm.nextServiceDate && maintenanceForm.nextServiceDate < maintenanceForm.serviceDate) {
      setMaintenanceError('Next service date must be on or after the service date.');
      return;
    }

    setLoggingMaintenance(true);
    try {
      const vehicleDbId = maintenanceVehicle.id || (maintenanceVehicle as any)._id;
      await FleetApi.logMaintenance(vehicleDbId, {
        serviceDate: maintenanceForm.serviceDate,
        type: maintenanceForm.type,
        cost: parsedCost,
        ...(maintenanceForm.nextServiceDate ? { nextServiceDate: maintenanceForm.nextServiceDate } : {}),
        ...(maintenanceForm.notes.trim() ? { notes: maintenanceForm.notes.trim() } : {}),
      });
      setActionMsg({
        text: `Maintenance record logged for ${maintenanceVehicle.vehicleId}.`,
        type: 'success',
      });
      setMaintenanceVehicle(null);
    } catch (err: any) {
      setMaintenanceError(getErrorMessage(err, 'Failed to log maintenance record'));
    } finally {
      setLoggingMaintenance(false);
    }
  };

  const handleConfirmRetire = async () => {
    if (!retiringVehicle) return;
    setRetiring(true);
    try {
      const vehicleDbId = retiringVehicle.id || (retiringVehicle as any)._id;
      await FleetApi.deleteVehicle(vehicleDbId);
      setActionMsg({
        text: `Vehicle ${retiringVehicle.vehicleId} retired successfully.`,
        type: 'success',
      });
      setRetiringVehicle(null);
      fetchVehicles();
    } catch (err: any) {
      setActionMsg({
        text: getErrorMessage(err, `Failed to retire vehicle ${retiringVehicle.vehicleId}`),
        type: 'error',
      });
      setRetiringVehicle(null);
    } finally {
      setRetiring(false);
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent(String(event.target?.result || ''));
      setImportResult(null);
    };
    reader.readAsText(file);
  };

  const loadSampleCsv = () => {
    setCsvContent(
      `vehicleId,makeModel,type,capacityKg,fuelType,kmPerLitre,energyKWhPerKm\nOD-02-AX-9901,Tata Ace Gold,Van,750,Diesel,14,\nOD-02-BX-9902,Mahindra Treo Zor,Van,550,Electric,,0.18\nOD-02-CX-9903,Hero Electric Nyx,Bike,120,Electric,,0.08`
    );
    setImportResult(null);
  };

  const handleExecuteCsvImport = async () => {
    if (!csvContent.trim()) return;
    if (!isDryRun && importResult?.errors && importResult.errors.length > 0) {
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const res = await FleetApi.importVehicleCsv(csvContent, { dryRun: isDryRun });
      setImportResult(res.data);
      if (!isDryRun) {
        fetchVehicles();
        setActionMsg({ text: 'Vehicles imported successfully!', type: 'success' });
      }
    } catch (e: any) {
      const details = e?.response?.data?.error?.details;
      setImportResult({
        dryRun: isDryRun,
        errors: Array.isArray(details) && details.length > 0
          ? details
          : [{ message: getErrorMessage(e, 'Import failed') }],
      });
    } finally {
      setImporting(false);
    }
  };

  const hasCsvErrors = Boolean(importResult?.errors && importResult.errors.length > 0);
  const blockLiveCsvCommit = !isDryRun && hasCsvErrors;

  const vehicleColumns = [
    { header: 'License Plate', accessor: (v: Vehicle) => <span className="font-mono font-semibold">{v.vehicleId}</span> },
    { header: 'Make / Model', accessor: (v: Vehicle) => v.makeModel },
    { header: 'Type', accessor: (v: Vehicle) => v.type },
    { header: 'Capacity (kg)', accessor: (v: Vehicle) => v.capacityKg },
    { header: 'Fuel', accessor: (v: Vehicle) => v.fuelType },
    {
      header: 'Status',
      accessor: (v: Vehicle) => <StatusBadge status={v.availability} size="sm" />,
    },
    {
      header: 'Actions',
      accessor: (v: Vehicle) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => openEditModal(v)}
            leftIcon={<Pencil className="w-3 h-3" />}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openMaintenanceModal(v)}
            leftIcon={<Wrench className="w-3 h-3" />}
          >
            Maintenance
          </Button>
          {isAdmin && (
            <Button
              size="sm"
              variant="ghost"
              disabled={v.availability === 'RETIRED'}
              onClick={() => setRetiringVehicle(v)}
              className="text-error hover:bg-error/10"
              leftIcon={<Archive className="w-3 h-3" />}
              title={v.availability === 'RETIRED' ? 'Vehicle already retired' : 'Retire vehicle'}
            >
              Retire
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full space-y-4">
      <AdminHeader
        title="Fleet Vehicles"
        subtitle={`Manage ${vehicles.length} registered logistics vehicles, capacities & fuel specs`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowCsvModal(true);
                setCsvContent('');
                setImportResult(null);
                setIsDryRun(true);
              }}
              leftIcon={<UploadCloud className="w-3.5 h-3.5 text-primary" />}
            >
              Import Vehicles CSV
            </Button>
            <Button size="sm" variant="primary" onClick={openCreateModal} leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Add Vehicle
            </Button>
          </div>
        }
      />

      {actionMsg && (
        <div
          className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
            actionMsg.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
              : 'bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/30'
          }`}
        >
          <span>{actionMsg.text}</span>
          <button onClick={() => setActionMsg(null)} className="underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Vehicles Table */}
      <div>
        {vehiclesLoading && (
          <div className="flex flex-col items-center justify-center py-16 bg-surface-lowest rounded-xl border border-outline-variant/60 shadow-soft space-y-2">
            <RotateCw className="w-7 h-7 text-primary animate-spin" />
            <span className="text-xs font-semibold text-on-surface-variant">Loading registered vehicles...</span>
          </div>
        )}
        {vehiclesError && (
          <div className="text-red-700 dark:text-red-300 text-xs p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{vehiclesError}</span>
          </div>
        )}
        {!vehiclesLoading && !vehiclesError && (
          <Table data={vehicles} columns={vehicleColumns} emptyMessage="No vehicles registered yet" />
        )}
      </div>

      {/* Create Vehicle Modal */}
      {showCreateVehicle && (
        <Modal title="Register New Vehicle" isOpen={showCreateVehicle} onClose={() => setShowCreateVehicle(false)}>
          <form onSubmit={handleCreateVehicle} className="space-y-3">
            {createError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}
            <Input
              label="License Plate / Vehicle ID"
              value={newVehicle.vehicleId}
              onChange={(e) => setNewVehicle({ ...newVehicle, vehicleId: e.target.value })}
              placeholder="e.g., OD-02-AX-1234"
              required
            />
            <Input
              label="Make & Model"
              value={newVehicle.makeModel}
              onChange={(e) => setNewVehicle({ ...newVehicle, makeModel: e.target.value })}
              placeholder="e.g., Tata Ace EV"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Vehicle Type</label>
                <select
                  value={newVehicle.type}
                  onChange={(e) => setNewVehicle({ ...newVehicle, type: e.target.value as VehicleType })}
                  className="w-full h-9 px-3 rounded-lg border border-outline-variant text-sm bg-surface-lowest text-on-surface"
                >
                  <option value="Bike">Bike (2-Wheeler)</option>
                  <option value="Van">Van (Small Commercial)</option>
                  <option value="Truck">Truck (Medium/Heavy)</option>
                </select>
              </div>
              <Input
                label="Capacity (kg)"
                type="number"
                min={0.1}
                step="0.1"
                value={newVehicle.capacityKg}
                onChange={(e) => setNewVehicle({ ...newVehicle, capacityKg: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Volume Capacity (m³)"
                type="number"
                min={0.01}
                step="0.1"
                placeholder="Optional"
                value={newVehicle.capacityM3}
                onChange={(e) => setNewVehicle({ ...newVehicle, capacityM3: e.target.value })}
              />
              <Input
                label="Baseline Odometer (km)"
                type="number"
                min={0}
                step="0.1"
                placeholder="Optional"
                value={newVehicle.lastOdometerKm}
                onChange={(e) => setNewVehicle({ ...newVehicle, lastOdometerKm: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Fuel Type</label>
                <select
                  value={newVehicle.fuelType}
                  onChange={(e) => setNewVehicle({ ...newVehicle, fuelType: e.target.value as FuelType })}
                  className="w-full h-9 px-3 rounded-lg border border-outline-variant text-sm bg-surface-lowest text-on-surface"
                >
                  <option value="Petrol">Petrol</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Electric">Electric</option>
                </select>
              </div>
              {newVehicle.fuelType === 'Electric' ? (
                <Input
                  label="Energy Efficiency (kWh/km)"
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={newVehicle.energyKWhPerKm}
                  onChange={(e) => setNewVehicle({ ...newVehicle, energyKWhPerKm: e.target.value })}
                  required
                />
              ) : (
                <Input
                  label="Fuel Efficiency (km/L)"
                  type="number"
                  min={0.1}
                  step="0.1"
                  value={newVehicle.kmPerLitre}
                  onChange={(e) => setNewVehicle({ ...newVehicle, kmPerLitre: e.target.value })}
                  required
                />
              )}
            </div>
            {newVehicle.fuelType !== 'Electric' && (
              <Input
                label="Fuel Tank Capacity (Litres)"
                type="number"
                min={1}
                step="0.5"
                placeholder="Optional (defaults to 200L van/bike, 500L truck)"
                value={newVehicle.tankCapacityLitres}
                onChange={(e) => setNewVehicle({ ...newVehicle, tankCapacityLitres: e.target.value })}
              />
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateVehicle(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={creating}>
                Register Vehicle
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Vehicle Modal */}
      {editingVehicle && (
        <Modal
          title={`Edit Vehicle — ${editingVehicle.vehicleId}`}
          subtitle="Update vehicle specifications, status, or override odometer baseline"
          isOpen={Boolean(editingVehicle)}
          onClose={() => setEditingVehicle(null)}
        >
          <form onSubmit={handleSaveEdit} className="space-y-3">
            {editError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}
            <Input
              label="Make & Model"
              value={editForm.makeModel}
              onChange={(e) => setEditForm({ ...editForm, makeModel: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Vehicle Type</label>
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value as VehicleType })}
                  className="w-full h-9 px-3 rounded-lg border border-outline-variant text-sm bg-surface-lowest text-on-surface"
                >
                  <option value="Bike">Bike</option>
                  <option value="Van">Van</option>
                  <option value="Truck">Truck</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Availability</label>
                <select
                  value={editForm.availability}
                  onChange={(e) => setEditForm({ ...editForm, availability: e.target.value as VehicleStatus })}
                  className="w-full h-9 px-3 rounded-lg border border-outline-variant text-sm bg-surface-lowest text-on-surface"
                >
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="IN_TRANSIT">IN_TRANSIT</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="RETIRED">RETIRED</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Capacity (kg)"
                type="number"
                min={0.1}
                step="0.1"
                value={editForm.capacityKg}
                onChange={(e) => setEditForm({ ...editForm, capacityKg: e.target.value })}
                required
              />
              <Input
                label="Volume Capacity (m³)"
                type="number"
                min={0.01}
                step="0.1"
                placeholder="Optional"
                value={editForm.capacityM3}
                onChange={(e) => setEditForm({ ...editForm, capacityM3: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Fuel Type</label>
                <select
                  value={editForm.fuelType}
                  onChange={(e) => setEditForm({ ...editForm, fuelType: e.target.value as FuelType })}
                  className="w-full h-9 px-3 rounded-lg border border-outline-variant text-sm bg-surface-lowest text-on-surface"
                >
                  <option value="Petrol">Petrol</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Electric">Electric</option>
                </select>
              </div>
              {editForm.fuelType === 'Electric' ? (
                <Input
                  label="Energy Efficiency (kWh/km)"
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={editForm.energyKWhPerKm}
                  onChange={(e) => setEditForm({ ...editForm, energyKWhPerKm: e.target.value })}
                  required
                />
              ) : (
                <Input
                  label="Fuel Efficiency (km/L)"
                  type="number"
                  min={0.1}
                  step="0.1"
                  value={editForm.kmPerLitre}
                  onChange={(e) => setEditForm({ ...editForm, kmPerLitre: e.target.value })}
                  required
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {editForm.fuelType === 'Electric' ? (
                <Input
                  label="Battery SoC (%)"
                  type="number"
                  min={0}
                  max={100}
                  step="1"
                  placeholder="0 - 100"
                  value={editForm.batterySoC}
                  onChange={(e) => setEditForm({ ...editForm, batterySoC: e.target.value })}
                />
              ) : (
                <Input
                  label="Tank Capacity (Litres)"
                  type="number"
                  min={1}
                  step="0.5"
                  placeholder="Optional"
                  value={editForm.tankCapacityLitres}
                  onChange={(e) => setEditForm({ ...editForm, tankCapacityLitres: e.target.value })}
                />
              )}
              <Input
                label="Last Odometer (km)"
                type="number"
                min={0}
                step="0.1"
                placeholder="Unrecorded"
                helperText="Admin/Fleet override to correct an earlier driver odometer typo."
                value={editForm.lastOdometerKm}
                onChange={(e) => setEditForm({ ...editForm, lastOdometerKm: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingVehicle(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={savingEdit}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Log Maintenance Modal */}
      {maintenanceVehicle && (
        <Modal
          title={`Log Maintenance — ${maintenanceVehicle.vehicleId}`}
          subtitle={maintenanceVehicle.makeModel}
          isOpen={Boolean(maintenanceVehicle)}
          onClose={() => setMaintenanceVehicle(null)}
        >
          <form onSubmit={handleLogMaintenance} className="space-y-3">
            {maintenanceError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{maintenanceError}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Service Date"
                type="date"
                value={maintenanceForm.serviceDate}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, serviceDate: e.target.value })}
                required
              />
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Maintenance Type</label>
                <select
                  value={maintenanceForm.type}
                  onChange={(e) =>
                    setMaintenanceForm({
                      ...maintenanceForm,
                      type: e.target.value as MaintenanceForm['type'],
                    })
                  }
                  className="w-full h-9 px-3 rounded-lg border border-outline-variant text-sm bg-surface-lowest text-on-surface"
                >
                  <option value="Routine">Routine</option>
                  <option value="Repair">Repair</option>
                  <option value="Inspection">Inspection</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Service Cost (₹)"
                type="number"
                min={0}
                step="1"
                value={maintenanceForm.cost}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                required
              />
              <Input
                label="Next Service Date"
                type="date"
                min={maintenanceForm.serviceDate || undefined}
                value={maintenanceForm.nextServiceDate}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, nextServiceDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Service Notes</label>
              <textarea
                rows={3}
                value={maintenanceForm.notes}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, notes: e.target.value })}
                placeholder="Parts replaced, inspection findings..."
                className="w-full text-sm p-2.5 rounded-lg border border-outline-variant bg-surface-lowest text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setMaintenanceVehicle(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={loggingMaintenance}>
                Log Maintenance
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Retire Vehicle Confirmation Modal */}
      {retiringVehicle && (
        <Modal
          title={`Retire Vehicle — ${retiringVehicle.vehicleId}`}
          subtitle="Soft-retire fleet chassis"
          isOpen={Boolean(retiringVehicle)}
          onClose={() => setRetiringVehicle(null)}
        >
          <div className="space-y-4 text-sm">
            <p className="text-on-surface-variant">
              Are you sure you want to retire{' '}
              <span className="font-mono font-semibold text-on-surface">{retiringVehicle.vehicleId}</span> (
              {retiringVehicle.makeModel})? This sets its status to <span className="font-semibold">RETIRED</span>{' '}
              and unpairs any assigned driver. Active shifts or routes will block retirement.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setRetiringVehicle(null)}>
                Cancel
              </Button>
              <Button type="button" variant="danger" size="sm" isLoading={retiring} onClick={handleConfirmRetire}>
                Retire Vehicle
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk CSV Import Modal */}
      {showCsvModal && (
        <Modal
          title="Bulk Import Vehicles via CSV"
          subtitle="Upload or paste structured comma-separated data to register vehicles"
          isOpen={showCsvModal}
          onClose={() => setShowCsvModal(false)}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-on-surface-variant font-medium">CSV Data Format</span>
              <button onClick={loadSampleCsv} className="text-secondary hover:underline flex items-center gap-1 font-semibold">
                <FileText className="w-3.5 h-3.5" /> Load Template Sample
              </button>
            </div>

            <div>
              <label className="block w-full border-2 border-dashed border-outline-variant hover:border-secondary rounded-lg p-4 text-center cursor-pointer transition-colors bg-surface-low">
                <UploadCloud className="w-6 h-6 text-secondary mx-auto mb-1" />
                <span className="text-xs font-semibold text-on-surface block">Choose CSV File</span>
                <span className="text-[10px] text-on-surface-variant block mt-0.5">Click to browse or drop file here</span>
                <input type="file" accept=".csv,text/csv" onChange={handleCsvFileUpload} className="hidden" />
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">Or Paste CSV Plaintext</label>
              <textarea
                value={csvContent}
                onChange={(e) => {
                  setCsvContent(e.target.value);
                  setImportResult(null);
                }}
                placeholder="Paste your CSV content here..."
                rows={6}
                className="w-full font-mono text-xs p-3 rounded-lg border border-outline-variant bg-surface-lowest text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
              />
            </div>

            <div className="flex items-center justify-between bg-surface-low p-2.5 rounded-lg border border-outline-variant">
              <label className="flex items-center gap-2 text-xs font-medium text-on-surface cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDryRun}
                  onChange={(e) => setIsDryRun(e.target.checked)}
                  className="rounded border-outline-variant text-secondary focus:ring-secondary"
                />
                <span>Dry Run Only (Validate headers, schema & DB plate collisions without writing)</span>
              </label>
            </div>

            {/* Import Summary Results */}
            {importResult && (
              <div className="p-3 rounded-lg border border-outline-variant bg-surface-low text-xs space-y-1.5 font-mono">
                <div className="font-semibold text-on-surface flex items-center gap-1.5">
                  {hasCsvErrors ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  )}
                  Import Result: {importResult.dryRun ? 'Dry-Run Validation Check' : 'Committed'}
                </div>
                {importResult.created !== undefined && (
                  <div>
                    {importResult.dryRun ? 'Valid Rows Ready:' : 'Created:'}{' '}
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{importResult.created}</span>
                  </div>
                )}
                {importResult.totalRows !== undefined && <div>Total Rows: {importResult.totalRows}</div>}
                {hasCsvErrors && (
                  <div className="text-red-600 dark:text-red-300 pt-1">
                    <span className="font-bold">Validation Errors ({importResult.errors.length}):</span>
                    <ul className="list-disc list-inside mt-1 space-y-0.5 max-h-36 overflow-y-auto">
                      {importResult.errors.map((err: any, i: number) => (
                        <li key={i}>
                          {err.row ? `Row ${err.row}` : 'CSV'}
                          {err.field ? ` [${err.field}]` : ''}: {err.message}
                        </li>
                      ))}
                    </ul>
                    {!isDryRun && (
                      <p className="mt-1.5 text-[11px] font-sans text-amber-600 dark:text-amber-300">
                        Live commit is blocked until all CSV / DB collision errors are resolved.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant">
              <Button variant="outline" size="sm" onClick={() => setShowCsvModal(false)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!csvContent.trim() || blockLiveCsvCommit}
                isLoading={importing}
                onClick={handleExecuteCsvImport}
                leftIcon={<UploadCloud className="w-3.5 h-3.5" />}
              >
                {isDryRun ? 'Run Dry-Run Check' : 'Import CSV Data'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
