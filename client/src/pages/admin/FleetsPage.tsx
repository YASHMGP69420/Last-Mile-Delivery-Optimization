import React, { useEffect, useState } from 'react';
import { FleetApi, HubsApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { FuelType, Vehicle, VehicleStatus, VehicleType, Hub, CreateHubPayload, UpdateHubPayload } from '../../types';
import { AdminHeader } from '../../components/layout/AdminHeader';
import { Table } from '../../components/common/Table';
import { Button } from '../../components/common/Button';
import { useRealtimeCatchup } from '../../hooks/useRealtimeCatchup';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { StatusBadge } from '../../components/common/StatusBadge';
import { toast } from 'sonner';
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
  Trash2,
  Download,
  Building2,
  Warehouse,
  Check,
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
  homeHubId: string;
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
  homeHubId: string;
}

interface CreateHubForm {
  name: string;
  code: string;
  address: string;
  lat: string;
  lng: string;
  contactPhone: string;
  openTime: string;
  closeTime: string;
}

interface EditHubForm {
  name: string;
  code: string;
  address: string;
  lat: string;
  lng: string;
  contactPhone: string;
  openTime: string;
  closeTime: string;
  isActive: boolean;
}

const INITIAL_CREATE_HUB_FORM: CreateHubForm = {
  name: '',
  code: '',
  address: '',
  lat: '20.2961',
  lng: '85.8245',
  contactPhone: '',
  openTime: '08:00',
  closeTime: '20:00',
};

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
  homeHubId: '',
};

const getTodayIsoDate = () => new Date().toISOString().split('T')[0];

const getErrorMessage = (err: any, fallback: string) =>
  err?.friendlyMessage || err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || fallback;

export const FleetsPage: React.FC = () => {
  const { isAdmin } = useAuth();

  // Tab state (D-04)
  const [activeTab, setActiveTab] = useState<'vehicles' | 'hubs'>('vehicles');

  // Vehicle state
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);

  // Hubs state (D-04)
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [hubsLoading, setHubsLoading] = useState(true);
  const [hubsError, setHubsError] = useState<string | null>(null);

  // Create Hub modal
  const [showCreateHub, setShowCreateHub] = useState(false);
  const [newHub, setNewHub] = useState<CreateHubForm>(INITIAL_CREATE_HUB_FORM);
  const [createHubError, setCreateHubError] = useState<string | null>(null);
  const [creatingHub, setCreatingHub] = useState(false);

  // Edit Hub modal
  const [editingHub, setEditingHub] = useState<Hub | null>(null);
  const [editHubForm, setEditHubForm] = useState<EditHubForm>({
    name: '',
    code: '',
    address: '',
    lat: '',
    lng: '',
    contactPhone: '',
    openTime: '08:00',
    closeTime: '20:00',
    isActive: true,
  });
  const [editHubError, setEditHubError] = useState<string | null>(null);
  const [savingEditHub, setSavingEditHub] = useState(false);

  // Delete Hub confirmation modal
  const [deletingHub, setDeletingHub] = useState<Hub | null>(null);
  const [deletingHubLoading, setDeletingHubLoading] = useState(false);
  const [deleteHubError, setDeleteHubError] = useState<string | null>(null);

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
    homeHubId: '',
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

  // Delete vehicle confirmation modal
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);
  const [isPermanentDelete, setIsPermanentDelete] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Bulk vehicle selection & delete state
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkPermanentDelete, setBulkPermanentDelete] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

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

  const fetchHubs = async () => {
    setHubsLoading(true);
    setHubsError(null);
    try {
      const res = await HubsApi.getHubs();
      setHubs((res.data as any)?.hubs || res.data || []);
    } catch (e: any) {
      setHubsError(getErrorMessage(e, 'Failed to load logistics hubs'));
    } finally {
      setHubsLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
    fetchHubs();
  }, []);

  // Multi-device catchup across mobile screen wake, tab switches, and network reconnects
  useRealtimeCatchup(() => {
    fetchVehicles();
    fetchHubs();
  });

  const openCreateHubModal = () => {
    setNewHub(INITIAL_CREATE_HUB_FORM);
    setCreateHubError(null);
    setShowCreateHub(true);
  };

  const handleCreateHub = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateHubError(null);

    const name = newHub.name.trim();
    const code = newHub.code.trim().toUpperCase();
    const address = newHub.address.trim();
    const lat = Number(newHub.lat);
    const lng = Number(newHub.lng);

    if (!name) {
      setCreateHubError('Hub name is required.');
      return;
    }
    if (!code) {
      setCreateHubError('Hub code is required.');
      return;
    }
    if (!address) {
      setCreateHubError('Hub address is required.');
      return;
    }
    if (isNaN(lat) || lat < -90 || lat > 90) {
      setCreateHubError('Latitude must be a valid number between -90 and 90.');
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      setCreateHubError('Longitude must be a valid number between -180 and 180.');
      return;
    }

    setCreatingHub(true);
    try {
      const payload: CreateHubPayload = {
        name,
        code,
        address,
        location: { lat, lng },
        contactPhone: newHub.contactPhone.trim() || undefined,
        operatingHours: {
          open: newHub.openTime || '08:00',
          close: newHub.closeTime || '20:00',
        },
      };
      await HubsApi.createHub(payload);
      toast.success(`Hub ${code} created successfully.`);
      setActionMsg({ text: `Hub ${code} created successfully.`, type: 'success' });
      setShowCreateHub(false);
      fetchHubs();
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Failed to create hub');
      setCreateHubError(msg);
      toast.error(msg);
    } finally {
      setCreatingHub(false);
    }
  };

  const openEditHubModal = (hub: Hub) => {
    setEditingHub(hub);
    setEditHubForm({
      name: hub.name,
      code: hub.code,
      address: hub.address,
      lat: String(hub.location.lat),
      lng: String(hub.location.lng),
      contactPhone: hub.contactPhone || '',
      openTime: hub.operatingHours?.open || '08:00',
      closeTime: hub.operatingHours?.close || '20:00',
      isActive: hub.isActive,
    });
    setEditHubError(null);
  };

  const handleSaveEditHub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHub) return;
    setEditHubError(null);

    const name = editHubForm.name.trim();
    const code = editHubForm.code.trim().toUpperCase();
    const address = editHubForm.address.trim();
    const lat = Number(editHubForm.lat);
    const lng = Number(editHubForm.lng);

    if (!name) {
      setEditHubError('Hub name cannot be empty.');
      return;
    }
    if (!code) {
      setEditHubError('Hub code cannot be empty.');
      return;
    }
    if (!address) {
      setEditHubError('Hub address cannot be empty.');
      return;
    }
    if (isNaN(lat) || lat < -90 || lat > 90) {
      setEditHubError('Latitude must be a valid number between -90 and 90.');
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      setEditHubError('Longitude must be a valid number between -180 and 180.');
      return;
    }

    setSavingEditHub(true);
    try {
      const payload: UpdateHubPayload = {
        name,
        code,
        address,
        location: { lat, lng },
        contactPhone: editHubForm.contactPhone.trim() || undefined,
        operatingHours: {
          open: editHubForm.openTime || '08:00',
          close: editHubForm.closeTime || '20:00',
        },
        isActive: editHubForm.isActive,
      };
      await HubsApi.updateHub(editingHub.id, payload);
      toast.success(`Hub ${code} updated successfully.`);
      setActionMsg({ text: `Hub ${code} updated successfully.`, type: 'success' });
      setEditingHub(null);
      fetchHubs();
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Failed to update hub');
      setEditHubError(msg);
      toast.error(msg);
    } finally {
      setSavingEditHub(false);
    }
  };

  const handleToggleHubActive = async (hub: Hub) => {
    try {
      await HubsApi.toggleHubActive(hub.id);
      const action = hub.isActive ? 'deactivated' : 'activated';
      toast.success(`Hub ${hub.code} ${action}.`);
      setActionMsg({ text: `Hub ${hub.code} ${action}.`, type: 'success' });
      fetchHubs();
    } catch (err: any) {
      const msg = getErrorMessage(err, `Failed to toggle hub status for ${hub.code}`);
      toast.error(msg);
      setActionMsg({ text: msg, type: 'error' });
    }
  };

  const handleConfirmDeleteHub = async () => {
    if (!deletingHub) return;
    setDeletingHubLoading(true);
    setDeleteHubError(null);
    try {
      await HubsApi.deleteHub(deletingHub.id);
      toast.success(`Hub ${deletingHub.code} deleted successfully.`);
      setActionMsg({ text: `Hub ${deletingHub.code} deleted successfully.`, type: 'success' });
      setDeletingHub(null);
      fetchHubs();
    } catch (err: any) {
      const msg = getErrorMessage(err, `Failed to delete hub ${deletingHub.code}`);
      setDeleteHubError(msg);
      toast.error(msg);
    } finally {
      setDeletingHubLoading(false);
    }
  };

  const openCreateModal = () => {
    const canonicalHub = hubs.find((h) => h.isCanonical && h.isActive) || hubs.find((h) => h.isActive);
    setNewVehicle({
      ...INITIAL_CREATE_FORM,
      homeHubId: canonicalHub ? canonicalHub.id : '',
    });
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
        homeHubId: newVehicle.homeHubId || undefined,
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
    const hubId = typeof vehicle.homeHubId === 'string'
      ? vehicle.homeHubId
      : (vehicle.homeHub as any)?.id || (vehicle.homeHub as any)?._id || '';

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
      homeHubId: hubId,
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
        homeHubId: editForm.homeHubId || undefined,
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

  const handleConfirmDeleteVehicle = async () => {
    if (!deletingVehicle) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const vehicleDbId = deletingVehicle.id || (deletingVehicle as any)._id;
      await FleetApi.deleteVehicle(vehicleDbId, { permanent: isPermanentDelete });
      const successText = isPermanentDelete
        ? `Vehicle ${deletingVehicle.vehicleId} permanently deleted.`
        : `Vehicle ${deletingVehicle.vehicleId} retired successfully.`;
      toast.success(successText);
      setActionMsg({
        text: successText,
        type: 'success',
      });
      setDeletingVehicle(null);
      fetchVehicles();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || `Failed to delete vehicle ${deletingVehicle.vehicleId}`;
      setDeleteError(msg);
      toast.error(msg);
      setActionMsg({
        text: msg,
        type: 'error',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleSelectVehicle = (id: string) => {
    setSelectedVehicleIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllVehicles = (ids: string[]) => {
    setSelectedVehicleIds(ids);
  };

  const handleConfirmBulkDeleteVehicles = async () => {
    if (selectedVehicleIds.length === 0) return;
    setIsBulkDeleting(true);
    setBulkDeleteError(null);
    let succeeded = 0;
    let failed = 0;

    for (const vehicleId of selectedVehicleIds) {
      try {
        await FleetApi.deleteVehicle(vehicleId, { permanent: bulkPermanentDelete });
        succeeded++;
      } catch (err: any) {
        failed++;
      }
    }

    const actionText = bulkPermanentDelete ? 'permanently deleted' : 'retired';
    if (succeeded > 0) {
      const msg = `Successfully ${actionText} ${succeeded} vehicle${succeeded === 1 ? '' : 's'}.`;
      toast.success(msg);
      setActionMsg({ text: msg, type: 'success' });
    }
    if (failed > 0) {
      const msg = `${failed} vehicle${failed === 1 ? '' : 's'} could not be ${actionText}.`;
      toast.error(msg);
    }

    setSelectedVehicleIds([]);
    setIsBulkDeleteModalOpen(false);
    fetchVehicles();
    setIsBulkDeleting(false);
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
      `vehicleId,makeModel,type,capacityKg,capacityM3,fuelType,kmPerLitre,energyKWhPerKm,tankCapacityLitres,lastOdometerKm,availability\nOD-02-TX-1001,Tata Ace Gold Diesel,Van,750,3.2,Diesel,14.5,,30,14520,AVAILABLE\nOD-02-TX-1002,Tata Ace EV Electric,Van,600,3.0,Electric,,0.28,,8450,AVAILABLE\nOD-02-TX-1003,Hero Electric Nyx Cargo,Bike,130,0.6,Electric,,0.08,,4120,AVAILABLE`
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
    {
      header: 'License Plate',
      accessor: (v: Vehicle) => {
        const hub = v.homeHub || hubs.find((h) => h.id === v.homeHubId);
        return (
          <div>
            <span className="font-mono font-semibold">{v.vehicleId}</span>
            {hub && (
              <div className="text-[11px] text-on-surface-muted flex items-center gap-1 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                <span>{hub.name}</span>
              </div>
            )}
          </div>
        );
      },
    },
    { header: 'Make / Model', accessor: (v: Vehicle) => v.makeModel },
    {
      header: 'Home Hub',
      accessor: (v: Vehicle) => {
        const hub = v.homeHub || hubs.find((h) => h.id === v.homeHubId);
        return hub ? (
          <span className="text-xs font-medium text-on-surface flex items-center gap-1.5">
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-low border border-outline-variant font-bold text-amber-600 dark:text-amber-400">
              {hub.code}
            </span>
            <span className="truncate max-w-[140px]">{hub.name}</span>
          </span>
        ) : (
          <span className="text-xs text-on-surface-muted italic">Unassigned</span>
        );
      },
    },
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
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => openEditModal(v)}
              leftIcon={<Pencil className="w-3 h-3" />}
            >
              Edit
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => openMaintenanceModal(v)}
            leftIcon={<Wrench className="w-3 h-3" />}
          >
            Maintenance
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={v.availability === 'RETIRED'}
            onClick={() => setRetiringVehicle(v)}
            className="text-amber-600 hover:bg-amber-500/10"
            leftIcon={<Archive className="w-3 h-3" />}
            title={v.availability === 'RETIRED' ? 'Vehicle already retired' : 'Retire vehicle'}
          >
            Retire
          </Button>
          {isAdmin && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDeletingVehicle(v);
                setIsPermanentDelete(true);
                setDeleteError(null);
              }}
              className="text-error hover:bg-error/10"
              leftIcon={<Trash2 className="w-3 h-3 text-error" />}
              title="Delete vehicle"
            >
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  const hubColumns = [
    {
      header: 'Hub Name',
      accessor: (h: Hub) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-on-surface">{h.name}</span>
          {h.isCanonical && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 uppercase tracking-wide">
              Primary
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Code',
      accessor: (h: Hub) => (
        <span className="font-mono font-semibold text-xs px-1.5 py-0.5 rounded bg-surface-low border border-outline-variant text-on-surface">
          {h.code}
        </span>
      ),
    },
    {
      header: 'Address',
      accessor: (h: Hub) => <span className="text-xs truncate max-w-[200px] block" title={h.address}>{h.address}</span>,
    },
    {
      header: 'Coordinates',
      accessor: (h: Hub) => (
        <span className="font-mono text-xs text-on-surface-muted">
          {h.location.lat.toFixed(4)}, {h.location.lng.toFixed(4)}
        </span>
      ),
    },
    {
      header: 'Contact Phone',
      accessor: (h: Hub) => <span className="text-xs">{h.contactPhone || '-'}</span>,
    },
    {
      header: 'Operating Hours',
      accessor: (h: Hub) => (
        <span className="font-mono text-xs">
          {h.operatingHours?.open || '08:00'} - {h.operatingHours?.close || '20:00'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (h: Hub) => <StatusBadge status={h.isActive ? 'ACTIVE' : 'INACTIVE'} size="sm" />,
    },
    {
      header: 'Actions',
      accessor: (h: Hub) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => openEditHubModal(h)}
            leftIcon={<Pencil className="w-3 h-3" />}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleToggleHubActive(h)}
            disabled={h.isCanonical && h.isActive}
            title={h.isCanonical && h.isActive ? 'Cannot deactivate canonical primary hub' : h.isActive ? 'Deactivate hub' : 'Activate hub'}
            className={h.isActive ? 'text-amber-600 hover:bg-amber-500/10' : 'text-emerald-600 hover:bg-emerald-500/10'}
          >
            {h.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={h.isCanonical}
            onClick={() => {
              setDeletingHub(h);
              setDeleteHubError(null);
            }}
            className="text-error hover:bg-error/10 disabled:opacity-40"
            leftIcon={<Trash2 className="w-3 h-3 text-error" />}
            title={h.isCanonical ? 'Cannot delete canonical primary hub' : 'Delete hub'}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full space-y-4">
      <AdminHeader
        title={activeTab === 'vehicles' ? 'Fleet Vehicles' : 'Hubs & Depots'}
        subtitle={
          activeTab === 'vehicles'
            ? `Manage ${vehicles.length} registered logistics vehicles, capacities & fuel specs`
            : `Manage ${hubs.length} regional warehouse hubs, locations & operating hours across Bhubaneswar`
        }
        actions={
          activeTab === 'vehicles' ? (
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
          ) : (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="primary" onClick={openCreateHubModal} leftIcon={<Plus className="w-3.5 h-3.5" />}>
                Register Hub
              </Button>
            </div>
          )
        }
      />

      {/* Tabs navigation: Vehicles vs Hubs & Depots (D-04) */}
      <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('vehicles')}
          className={`flex items-center gap-2 px-3.5 py-1.5 font-medium text-xs rounded-lg transition-colors ${
            activeTab === 'vehicles'
              ? 'bg-primary text-white shadow-soft font-semibold'
              : 'text-on-surface-variant hover:bg-surface-low hover:text-on-surface'
          }`}
          data-testid="tab-vehicles"
        >
          <span>Vehicles</span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              activeTab === 'vehicles' ? 'bg-white/20 text-white' : 'bg-surface-low border border-outline-variant text-on-surface'
            }`}
          >
            {vehicles.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('hubs')}
          className={`flex items-center gap-2 px-3.5 py-1.5 font-medium text-xs rounded-lg transition-colors ${
            activeTab === 'hubs'
              ? 'bg-primary text-white shadow-soft font-semibold'
              : 'text-on-surface-variant hover:bg-surface-low hover:text-on-surface'
          }`}
          data-testid="tab-hubs"
        >
          <span>Hubs & Depots</span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              activeTab === 'hubs' ? 'bg-white/20 text-white' : 'bg-surface-low border border-outline-variant text-on-surface'
            }`}
          >
            {hubs.length}
          </span>
        </button>
      </div>

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

      {/* Vehicles Tab Content */}
      {activeTab === 'vehicles' && (
        <>
          {/* Sticky Bulk Actions Bar */}
          {selectedVehicleIds.length > 0 && (
            <div className="bg-primary px-4 py-2.5 rounded-xl flex items-center justify-between text-white shadow-soft shrink-0">
              <div className="flex items-center gap-3 text-xs">
                <span className="font-semibold px-2.5 py-0.5 rounded-[4px] bg-white/15 text-white text-[11px] border border-white/20">
                  {selectedVehicleIds.length} Vehicles Selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  className="bg-red-600 hover:bg-red-700 text-white font-bold border-none shadow-sm"
                  leftIcon={<Trash2 className="w-3.5 h-3.5 text-white" />}
                  onClick={() => {
                    setBulkPermanentDelete(false);
                    setBulkDeleteError(null);
                    setIsBulkDeleteModalOpen(true);
                  }}
                >
                  Delete / Retire Selected ({selectedVehicleIds.length})
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                  onClick={() => setSelectedVehicleIds([])}
                >
                  Clear
                </Button>
              </div>
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
              <Table
                data={vehicles}
                columns={vehicleColumns}
                emptyMessage="No vehicles registered yet"
                selectable
                selectedIds={selectedVehicleIds}
                onToggleSelect={handleToggleSelectVehicle}
                onSelectAll={handleSelectAllVehicles}
                getRowId={(v) => v.id || (v as any)._id}
              />
            )}
          </div>
        </>
      )}

      {/* Hubs & Depots Tab Content (D-04) */}
      {activeTab === 'hubs' && (
        <div>
          {hubsLoading && (
            <div className="flex flex-col items-center justify-center py-16 bg-surface-lowest rounded-xl border border-outline-variant/60 shadow-soft space-y-2">
              <RotateCw className="w-7 h-7 text-primary animate-spin" />
              <span className="text-xs font-semibold text-on-surface-variant">Loading logistics hubs...</span>
            </div>
          )}
          {hubsError && (
            <div className="text-red-700 dark:text-red-300 text-xs p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{hubsError}</span>
            </div>
          )}
          {!hubsLoading && !hubsError && (
            <Table
              data={hubs}
              columns={hubColumns}
              emptyMessage="No logistics hubs registered yet"
              getRowId={(h) => h.id}
            />
          )}
        </div>
      )}

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
            <div>
              <label htmlFor="vehicle-home-hub" className="block text-xs font-medium text-on-surface-variant mb-1">
                Home Hub / Depot (D-02)
              </label>
              <select
                id="vehicle-home-hub"
                aria-label="Home Hub"
                value={newVehicle.homeHubId}
                onChange={(e) => setNewVehicle({ ...newVehicle, homeHubId: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-outline-variant text-sm bg-surface-lowest text-on-surface"
              >
                <option value="">Select Home Hub...</option>
                {hubs.filter((h) => h.isActive).map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.code}){h.isCanonical ? ' — Primary' : ''}
                  </option>
                ))}
              </select>
            </div>
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
            <div>
              <label htmlFor="edit-vehicle-home-hub" className="block text-xs font-medium text-on-surface-variant mb-1">
                Home Hub / Depot (D-02)
              </label>
              <select
                id="edit-vehicle-home-hub"
                aria-label="Home Hub"
                value={editForm.homeHubId}
                onChange={(e) => setEditForm({ ...editForm, homeHubId: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-outline-variant text-sm bg-surface-lowest text-on-surface"
              >
                <option value="">Select Home Hub...</option>
                {hubs.filter((h) => h.isActive).map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.code}){h.isCanonical ? ' — Primary' : ''}
                  </option>
                ))}
              </select>
            </div>
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

      {/* Create Hub Modal (D-04) */}
      {showCreateHub && (
        <Modal
          title="Register New Logistics Hub"
          subtitle="Add a regional warehouse facility, depot address, and loading bay coordinates (D-04)"
          isOpen={showCreateHub}
          onClose={() => setShowCreateHub(false)}
        >
          <form onSubmit={handleCreateHub} className="space-y-3">
            {createHubError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{createHubError}</span>
              </div>
            )}
            <Input
              label="Hub Name"
              value={newHub.name}
              onChange={(e) => setNewHub({ ...newHub, name: e.target.value })}
              placeholder="e.g., Rasulgarh Logistics Hub"
              required
            />
            <Input
              label="Hub Code"
              value={newHub.code}
              onChange={(e) => setNewHub({ ...newHub, code: e.target.value })}
              placeholder="e.g., HUB-RSL"
              required
            />
            <Input
              label="Address"
              value={newHub.address}
              onChange={(e) => setNewHub({ ...newHub, address: e.target.value })}
              placeholder="e.g., NH-16, Rasulgarh Industrial Estate, Bhubaneswar"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Latitude (-90 to 90)"
                type="number"
                step="any"
                value={newHub.lat}
                onChange={(e) => setNewHub({ ...newHub, lat: e.target.value })}
                placeholder="20.2961"
                required
              />
              <Input
                label="Longitude (-180 to 180)"
                type="number"
                step="any"
                value={newHub.lng}
                onChange={(e) => setNewHub({ ...newHub, lng: e.target.value })}
                placeholder="85.8245"
                required
              />
            </div>
            <Input
              label="Contact Phone"
              value={newHub.contactPhone}
              onChange={(e) => setNewHub({ ...newHub, contactPhone: e.target.value })}
              placeholder="e.g., +91 674 258 1001"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Opening Time"
                value={newHub.openTime}
                onChange={(e) => setNewHub({ ...newHub, openTime: e.target.value })}
                placeholder="08:00"
              />
              <Input
                label="Closing Time"
                value={newHub.closeTime}
                onChange={(e) => setNewHub({ ...newHub, closeTime: e.target.value })}
                placeholder="20:00"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateHub(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={creatingHub}>
                Register Hub
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Hub Modal (D-04) */}
      {editingHub && (
        <Modal
          title={`Edit Logistics Hub — ${editingHub.name}`}
          subtitle="Update depot location coordinates, contact phone, or operating hours (D-04)"
          isOpen={Boolean(editingHub)}
          onClose={() => setEditingHub(null)}
        >
          <form onSubmit={handleSaveEditHub} className="space-y-3">
            {editHubError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editHubError}</span>
              </div>
            )}
            <Input
              label="Hub Name"
              value={editHubForm.name}
              onChange={(e) => setEditHubForm({ ...editHubForm, name: e.target.value })}
              required
            />
            <Input
              label="Hub Code"
              value={editHubForm.code}
              onChange={(e) => setEditHubForm({ ...editHubForm, code: e.target.value })}
              required
            />
            <Input
              label="Address"
              value={editHubForm.address}
              onChange={(e) => setEditHubForm({ ...editHubForm, address: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Latitude (-90 to 90)"
                type="number"
                step="any"
                value={editHubForm.lat}
                onChange={(e) => setEditHubForm({ ...editHubForm, lat: e.target.value })}
                required
              />
              <Input
                label="Longitude (-180 to 180)"
                type="number"
                step="any"
                value={editHubForm.lng}
                onChange={(e) => setEditHubForm({ ...editHubForm, lng: e.target.value })}
                required
              />
            </div>
            <Input
              label="Contact Phone"
              value={editHubForm.contactPhone}
              onChange={(e) => setEditHubForm({ ...editHubForm, contactPhone: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Opening Time"
                value={editHubForm.openTime}
                onChange={(e) => setEditHubForm({ ...editHubForm, openTime: e.target.value })}
              />
              <Input
                label="Closing Time"
                value={editHubForm.closeTime}
                onChange={(e) => setEditHubForm({ ...editHubForm, closeTime: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-low border border-outline-variant">
              <label className="flex items-center gap-2 text-xs font-medium text-on-surface cursor-pointer">
                <input
                  type="checkbox"
                  checked={editHubForm.isActive}
                  disabled={editingHub.isCanonical}
                  onChange={(e) => setEditHubForm({ ...editHubForm, isActive: e.target.checked })}
                  className="rounded border-outline-variant text-primary focus:ring-primary"
                />
                <span>Active Operational Hub</span>
              </label>
              {editingHub.isCanonical && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                  Canonical primary hub is always active
                </span>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingHub(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={savingEditHub}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Hub Confirmation Modal with Cascade Guards (D-04, T-28-09) */}
      {deletingHub && (
        <Modal
          title={`Delete Hub — ${deletingHub.name}`}
          isOpen={Boolean(deletingHub)}
          onClose={() => setDeletingHub(null)}
        >
          <div className="space-y-4">
            {deleteHubError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{deleteHubError}</span>
              </div>
            )}
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs space-y-2">
              <div className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Cascade Protections</span>
              </div>
              <p className="text-on-surface-variant">
                Logistics hubs cannot be deleted if they are designated as the canonical primary hub or currently in active use by vehicles or batches. Deleting this hub will permanently remove it from routing and dispatch.
              </p>
            </div>

            {deletingHub.isCanonical ? (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-700 dark:text-red-300 font-medium">
                This is the canonical primary logistics hub and cannot be deleted.
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant">
                Are you sure you want to permanently delete hub <span className="font-semibold text-on-surface">{deletingHub.name} ({deletingHub.code})</span>?
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDeletingHub(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={deletingHub.isCanonical || deletingHubLoading}
                isLoading={deletingHubLoading}
                onClick={handleConfirmDeleteHub}
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                Delete Hub
              </Button>
            </div>
          </div>
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

      {/* Delete Vehicle Confirmation Modal */}
      {deletingVehicle && (
        <Modal
          title={`Delete Vehicle — ${deletingVehicle.vehicleId}`}
          subtitle="Remove or retire vehicle chassis"
          isOpen={Boolean(deletingVehicle)}
          onClose={() => setDeletingVehicle(null)}
        >
          <div className="space-y-4 text-sm">
            {deleteError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}
            <p className="text-on-surface-variant">
              Are you sure you want to delete vehicle{' '}
              <span className="font-mono font-semibold text-on-surface">{deletingVehicle.vehicleId}</span>{' '}
              ({deletingVehicle.makeModel} — {deletingVehicle.type})?
            </p>
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs rounded-lg space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Active Assignment & Operational Safety Notice</span>
              </div>
              <p>
                Any currently paired driver will be safely detached from this vehicle. Vehicles in active transit on running routes cannot be deleted until complete.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="permanentDeleteChassis"
                checked={isPermanentDelete}
                onChange={(e) => setIsPermanentDelete(e.target.checked)}
                className="rounded border-outline-variant text-error focus:ring-error"
              />
              <label htmlFor="permanentDeleteChassis" className="text-xs font-medium text-on-surface cursor-pointer">
                Permanently purge record from database (otherwise soft-retire to RETIRED status)
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={deleting}
                onClick={() => setDeletingVehicle(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={deleting}
                onClick={handleConfirmDeleteVehicle}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                {isPermanentDelete ? 'Delete Permanently' : 'Retire Vehicle'}
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
              <span className="text-on-surface-variant font-medium">CSV Format: vehicleId,makeModel,type,capacityKg,capacityM3,fuelType,kmPerLitre,energyKWhPerKm,tankCapacityLitres,lastOdometerKm,availability</span>
              <div className="flex items-center gap-3">
                <a
                  href="/sample_data/vehicles.csv"
                  download="vehicles.csv"
                  className="text-secondary hover:underline flex items-center gap-1 font-semibold text-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Download Sample CSV
                </a>
                <button onClick={loadSampleCsv} className="text-secondary hover:underline flex items-center gap-1 font-semibold">
                  <FileText className="w-3.5 h-3.5" /> Load Template Sample
                </button>
              </div>
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

      {/* Bulk Delete / Retire Vehicles Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <Modal
          title={`Delete or Retire ${selectedVehicleIds.length} Selected Vehicle${selectedVehicleIds.length === 1 ? '' : 's'}`}
          subtitle="Execute bulk fleet vehicle decommissioning or database removal"
          isOpen={isBulkDeleteModalOpen}
          onClose={() => !isBulkDeleting && setIsBulkDeleteModalOpen(false)}
        >
          <div className="space-y-4 text-sm">
            {bulkDeleteError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{bulkDeleteError}</span>
              </div>
            )}
            <p className="text-on-surface">
              You are about to decommission <strong className="text-red-600 font-semibold">{selectedVehicleIds.length}</strong> selected vehicle{selectedVehicleIds.length === 1 ? '' : 's'}.
            </p>
            <div className="p-3 bg-surface-low border border-outline-variant/60 rounded-xl space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={bulkPermanentDelete}
                  onChange={(e) => setBulkPermanentDelete(e.target.checked)}
                  className="rounded border-outline-variant text-red-600 focus:ring-red-500 mt-0.5"
                />
                <div className="text-xs">
                  <span className="font-semibold text-on-surface block">
                    Permanent Database Deletion
                  </span>
                  <span className="text-on-surface-variant block mt-0.5">
                    If checked, vehicles will be completely expunged from the database. When unchecked (default), vehicles will be soft-retired (availability set to RETIRED) to preserve historical route and telemetry audits.
                  </span>
                </div>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBulkDeleting}
                onClick={() => setIsBulkDeleteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={isBulkDeleting}
                onClick={handleConfirmBulkDeleteVehicles}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                {bulkPermanentDelete ? 'Permanently Delete' : 'Retire'} {selectedVehicleIds.length} Vehicle{selectedVehicleIds.length === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
