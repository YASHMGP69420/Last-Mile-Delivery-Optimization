import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AdminHeader } from '../components/layout/AdminHeader';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { DeleteWithUndoButton } from '../components/common/DeleteWithUndoButton';
import { BatchesApi, DeliveriesApi, FleetApi, HubsApi } from '../api/client';
import { DeliveryBatch, Delivery, Vehicle, Driver, Hub } from '../types';
import { mountRealtimeSocket } from '../utils/socketClient';
import { useRealtimeCatchup } from '../hooks/useRealtimeCatchup';
import {
  Layers,
  MapPin,
  Clock,
  RefreshCw,
  Loader2,
  Calendar,
  CheckCircle2,
  Search,
  Plus,
  Copy,
  Edit,
  Trash2,
  Download,
  Package,
  X,
  AlertCircle,
  Truck,
  User,
  Warehouse,
} from 'lucide-react';

export const BatchesPage: React.FC = () => {
  const [batches, setBatches] = useState<DeliveryBatch[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [selectedHubFilter, setSelectedHubFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionError, setActionError] = useState<string | null>(null);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editBatch, setEditBatch] = useState<DeliveryBatch | null>(null);
  const [manageDeliveriesBatch, setManageDeliveriesBatch] = useState<DeliveryBatch | null>(null);
  const [batchDeliveries, setBatchDeliveries] = useState<Delivery[]>([]);
  const [availableDeliveries, setAvailableDeliveries] = useState<Delivery[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for Create/Edit
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    date: new Date().toISOString().split('T')[0],
    shift: 'Shift A (08:00 - 17:00)',
    depotName: 'Rasulgarh Central Hub',
    depotAddress: 'Plot 104/A, Rasulgarh Industrial Estate, Bhubaneswar',
    hubId: '',
    vehicleId: '',
    driverId: '',
  });

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    // Load fleet vehicles, drivers, and active hubs for allocation dropdowns
    const loadFleetResources = async () => {
      try {
        const [vRes, dRes, hRes] = await Promise.all([
          FleetApi.getVehicles(),
          FleetApi.getDrivers(),
          HubsApi.getHubs({ isActive: true }),
        ]);
        if (isMountedRef.current) {
          setVehicles(vRes.data?.vehicles || []);
          setDrivers(dRes.data?.drivers || []);
          setHubs((hRes.data as any)?.hubs || hRes.data || []);
        }
      } catch (e) {
        console.warn('Failed to load fleet resources in Batches:', e);
      }
    };
    loadFleetResources();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchBatches = async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const params: Record<string, any> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await BatchesApi.list(params);
      if (isMountedRef.current) {
        setBatches(res.data.batches || []);
      }
    } catch (e: any) {
      if (isMountedRef.current) {
        setActionError(e.friendlyMessage || e.response?.data?.error?.message || e.message || 'Failed to fetch batches');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [statusFilter]);

  // Multi-device catchup across mobile screen wake, tab switches, and network reconnects
  useRealtimeCatchup(() => {
    if (isMountedRef.current) {
      fetchBatches();
    }
  });

  // Real-time synchronization across devices and demo sessions
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    return mountRealtimeSocket(token, (socket) => {
      const onRefresh = () => {
        if (isMountedRef.current) {
          fetchBatches();
        }
      };

      socket.on('batch:created', onRefresh);
      socket.on('batch:updated', onRefresh);
      socket.on('batch:deleted', onRefresh);
      socket.on('delivery:created', onRefresh);
      socket.on('delivery:updated', onRefresh);
      socket.on('delivery:deleted', onRefresh);
      socket.on('deliveries:updated', onRefresh);
      socket.on('deliveries:reassigned', onRefresh);
      socket.on('demo:seeded', onRefresh);
      socket.on('demo:deleted', onRefresh);
      socket.on('route:dispatched', onRefresh);
      socket.on('route:cancelled', onRefresh);

      return () => {
        socket.off('batch:created', onRefresh);
        socket.off('batch:updated', onRefresh);
        socket.off('batch:deleted', onRefresh);
        socket.off('delivery:created', onRefresh);
        socket.off('delivery:updated', onRefresh);
        socket.off('delivery:deleted', onRefresh);
        socket.off('deliveries:updated', onRefresh);
        socket.off('deliveries:reassigned', onRefresh);
        socket.off('demo:seeded', onRefresh);
        socket.off('demo:deleted', onRefresh);
        socket.off('route:dispatched', onRefresh);
        socket.off('route:cancelled', onRefresh);
      };
    });
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBatches();
  };

  const handleDuplicate = async (batchId: string) => {
    setIsLoading(true);
    try {
      await BatchesApi.duplicate(batchId);
      await fetchBatches();
    } catch (e: any) {
      alert(e.friendlyMessage || e.response?.data?.error?.message || e.message || 'Failed to duplicate batch');
      setIsLoading(false);
    }
  };

  const handleDelete = async (batch: DeliveryBatch) => {
    setIsLoading(true);
    try {
      await BatchesApi.delete(batch.id);
      await fetchBatches();
    } catch (e: any) {
      alert(e.friendlyMessage || e.response?.data?.error?.message || e.message || 'Failed to delete batch');
      setIsLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const selectedHub = hubs.find((h) => h.id === formData.hubId);
      const depotGeo = selectedHub?.location || { lat: 20.2961, lng: 85.8645 };

      await BatchesApi.create({
        code: formData.code.trim().toUpperCase() || undefined,
        name: formData.name.trim(),
        date: formData.date,
        shift: formData.shift,
        vehicleIds: formData.vehicleId ? [formData.vehicleId] : [],
        driverIds: formData.driverId ? [formData.driverId] : [],
        hubId: formData.hubId || undefined,
        depot: {
          name: selectedHub?.name || formData.depotName,
          address: selectedHub?.address || formData.depotAddress,
          geo: depotGeo,
        },
      });
      setCreateModalOpen(false);
      await fetchBatches();
    } catch (err: any) {
      alert(err.friendlyMessage || err.response?.data?.error?.message || err.message || 'Failed to create batch');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBatch) return;
    setIsSubmitting(true);
    try {
      await BatchesApi.update(editBatch.id, {
        name: formData.name,
        date: formData.date,
        shift: formData.shift,
        vehicleIds: formData.vehicleId ? [formData.vehicleId] : [],
        driverIds: formData.driverId ? [formData.driverId] : [],
      });
      setEditBatch(null);
      await fetchBatches();
    } catch (err: any) {
      alert(err.friendlyMessage || err.response?.data?.error?.message || err.message || 'Failed to update batch');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openManageDeliveries = async (batch: DeliveryBatch) => {
    setManageDeliveriesBatch(batch);
    setSelectedToAdd([]);
    try {
      const [batchRes, unassignedRes] = await Promise.all([
        BatchesApi.getById(batch.id),
        DeliveriesApi.list({ status: 'READY', limit: 100 }),
      ]);
      const fullBatch = batchRes.data?.batch;
      setBatchDeliveries((fullBatch?.deliveryIds as any) || []);
      const unassigned = (unassignedRes.data?.deliveries || []).filter(
        (d: any) => !d.batchId || d.batchId !== batch.id
      );
      setAvailableDeliveries(unassigned);
    } catch (e) {
      console.error('Failed to load batch deliveries:', e);
    }
  };

  const handleRemoveDelivery = async (deliveryId: string) => {
    if (!manageDeliveriesBatch) return;
    try {
      await BatchesApi.removeDelivery(manageDeliveriesBatch.id, deliveryId);
      setBatchDeliveries((prev) => prev.filter((d) => d.id !== deliveryId));
      await fetchBatches();
    } catch (e: any) {
      alert(e.response?.data?.error?.message || 'Failed to remove delivery');
    }
  };

  const handleAddDeliveries = async () => {
    if (!manageDeliveriesBatch || selectedToAdd.length === 0) return;
    setIsSubmitting(true);
    try {
      await BatchesApi.addDeliveries(manageDeliveriesBatch.id, selectedToAdd);
      setSelectedToAdd([]);
      await openManageDeliveries(manageDeliveriesBatch);
      await fetchBatches();
    } catch (e: any) {
      alert(e.response?.data?.error?.message || 'Failed to add deliveries');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCsv = async (batchId: string) => {
    try {
      const blob = await BatchesApi.exportCsv(batchId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `batch_${batchId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.response?.data?.error?.message || e?.message || 'Failed to export batch CSV');
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <AdminHeader
        title="Operational Dispatch Batches"
        subtitle="Rasulgarh Hub Multi-Stop Route Clusters & Dispatch Ensembles"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={fetchBatches}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                const firstVeh = vehicles[0]?.id || (vehicles[0] as any)?._id || '';
                const firstDrv = drivers[0]?.id || (drivers[0] as any)?._id || '';
                const canonicalHub = hubs.find((h) => h.isCanonical) || hubs[0];
                setFormData({
                  code: `BATCH-${Date.now().toString().slice(-4)}`,
                  name: `Dispatch Run ${new Date().toLocaleDateString()}`,
                  date: new Date().toISOString().split('T')[0],
                  shift: 'Shift A (08:00 - 17:00)',
                  depotName: canonicalHub ? canonicalHub.name : 'Rasulgarh Central Hub',
                  depotAddress: canonicalHub ? canonicalHub.address : 'Plot 104/A, Rasulgarh Industrial Estate, Bhubaneswar',
                  hubId: canonicalHub ? canonicalHub.id : '',
                  vehicleId: firstVeh,
                  driverId: firstDrv,
                });
                setCreateModalOpen(true);
              }}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              New Batch
            </Button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-3.5 rounded-xl bg-surface-lowest dark:bg-obsidian-900 border border-outline-variant/60 dark:border-obsidian-750">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-on-surface-variant" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search batch code, name, or shift..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-outline-variant/40 dark:border-obsidian-700 text-xs bg-surface-low dark:bg-obsidian-950 text-on-surface dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </form>

        {/* Hub Filter Dropdown (D-04) */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <label htmlFor="hub-filter-select" className="text-xs font-semibold text-on-surface-variant flex items-center gap-1 whitespace-nowrap">
            <Warehouse className="w-3.5 h-3.5 text-primary" />
            <span>Hub:</span>
          </label>
          <select
            id="hub-filter-select"
            aria-label="Filter by Hub"
            value={selectedHubFilter}
            onChange={(e) => setSelectedHubFilter(e.target.value)}
            className="h-9 px-2.5 rounded-lg border border-outline-variant/60 dark:border-obsidian-700 text-xs bg-surface-low dark:bg-obsidian-950 text-on-surface dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Hubs</option>
            {hubs.map((hub) => (
              <option key={hub.id} value={hub.id}>
                {hub.name} ({hub.code}){hub.isCanonical ? ' — Primary' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto text-xs pb-0.5">
          {['ALL', 'READY', 'PLANNED', 'IN_PROGRESS', 'CLOSED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? 'bg-primary text-white font-semibold'
                  : 'bg-surface-low dark:bg-obsidian-950 text-on-surface-variant dark:text-slate-400 hover:text-on-surface dark:hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs rounded-lg flex items-center gap-2 px-4">
          <AlertCircle className="w-4 h-4" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Batches Grid */}
      {isLoading ? (
        <div className="h-64 flex items-center justify-center bg-surface-lowest dark:bg-obsidian-900 rounded-xl border border-outline-variant/60 dark:border-obsidian-750">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : (() => {
        const filteredBatches = batches.filter((batch) => {
          if (selectedHubFilter === 'ALL') return true;
          const batchHubId = typeof batch.hubId === 'string'
            ? batch.hubId
            : (batch.hubId as any)?._id || (batch.hubId as any)?.id || batch.hub?.id;
          if (batchHubId && batchHubId === selectedHubFilter) return true;
          const selectedHub = hubs.find((h) => h.id === selectedHubFilter);
          if (selectedHub && batch.depot?.name?.toLowerCase().includes(selectedHub.name.toLowerCase())) {
            return true;
          }
          return false;
        });

        if (filteredBatches.length === 0) {
          return (
            <div className="p-10 text-center bg-surface-lowest dark:bg-obsidian-900 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 space-y-2">
              <Layers className="w-10 h-10 text-on-surface-variant/40 mx-auto" />
              <h3 className="text-sm font-semibold text-on-surface dark:text-white">No Dispatch Batches Found</h3>
              <p className="text-xs text-on-surface-variant dark:text-slate-400 max-w-sm mx-auto">
                {selectedHubFilter !== 'ALL'
                  ? 'No batches found matching the selected logistics hub.'
                  : 'Create a new dispatch batch or compose one from the Deliveries Manifest.'}
              </p>
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBatches.map((batch) => {
              const assignedHub = batch.hub || hubs.find((h) => h.id === (typeof batch.hubId === 'string' ? batch.hubId : (batch.hubId as any)?._id || (batch.hubId as any)?.id));
              const assignedHubName = assignedHub ? assignedHub.name : batch.depot?.name;

              return (
                <div
                  key={batch.id}
                  className="p-5 rounded-xl bg-surface-lowest dark:bg-obsidian-900 border border-outline-variant/60 dark:border-obsidian-750 transition-colors flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-xs text-primary dark:text-emerald-400 bg-primary/10 px-2.5 py-0.5 rounded border border-primary/20">
                          {batch.code}
                        </span>
                        {assignedHubName && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                            <Warehouse className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[120px]">{assignedHubName}</span>
                          </span>
                        )}
                      </div>
                      <StatusBadge status={batch.status} size="sm" />
                    </div>

                <div>
                  <h3 className="font-semibold text-on-surface dark:text-white text-sm">{batch.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant dark:text-slate-400 mt-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{batch.date}</span>
                    <span>•</span>
                    <Clock className="w-3.5 h-3.5" />
                    <span>{batch.shift}</span>
                  </div>
                </div>

                {/* Central Depot */}
                <div className="p-2.5 rounded-lg bg-surface-low dark:bg-obsidian-950/60 border border-outline-variant/40 dark:border-obsidian-750 flex items-center gap-2 text-xs">
                  <MapPin className="w-4 h-4 text-primary dark:text-emerald-400 shrink-0" />
                  <div className="truncate">
                    <span className="font-medium text-on-surface dark:text-slate-200 block truncate">
                      {batch.depot?.name || 'Rasulgarh Logistics Hub'}
                    </span>
                    <span className="text-[10px] text-on-surface-variant dark:text-slate-400 block truncate">
                      {batch.depot?.address || 'Plot 104/A, Rasulgarh Industrial Estate'}
                    </span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-outline-variant/40 dark:border-obsidian-750">
                  <div className="p-2 rounded-lg bg-surface-low dark:bg-obsidian-950/60">
                    <span className="text-[10px] text-on-surface-variant dark:text-slate-400 font-medium block">Stops</span>
                    <span className="font-mono font-bold text-sm text-on-surface dark:text-white">
                      {batch.metrics?.totalDeliveries || batch.deliveryIds?.length || 0}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-low dark:bg-obsidian-950/60">
                    <span className="text-[10px] text-on-surface-variant dark:text-slate-400 font-medium block">Payload</span>
                    <span className="font-mono font-bold text-sm text-on-surface dark:text-white tabular-nums">
                      {batch.metrics?.totalWeightKg ? batch.metrics.totalWeightKg.toFixed(1) : '0.0'} kg
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-low dark:bg-obsidian-950/60">
                    <span className="text-[10px] text-on-surface-variant dark:text-slate-400 font-medium block">Vehicles</span>
                    <span className="font-mono font-bold text-sm text-on-surface dark:text-white">
                      {batch.vehicleIds?.length || 0}
                    </span>
                  </div>
                </div>

                {/* Allocated Fleet & Driver Summary */}
                <div className="p-2 rounded-lg bg-surface-low dark:bg-obsidian-950/60 border border-outline-variant/40 dark:border-obsidian-750 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 truncate max-w-[50%]">
                    <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate font-medium text-[11px] text-on-surface dark:text-slate-200">
                      {batch.vehicleIds && batch.vehicleIds.length > 0
                        ? (typeof batch.vehicleIds[0] === 'object'
                            ? (batch.vehicleIds[0] as any)?.vehicleId || (batch.vehicleIds[0] as any)?.makeModel
                            : 'Vehicle Allocated')
                        : 'No Vehicle'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate max-w-[50%]">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate font-medium text-[11px] text-on-surface dark:text-slate-200">
                      {batch.driverIds && batch.driverIds.length > 0
                        ? (typeof batch.driverIds[0] === 'object'
                            ? (batch.driverIds[0] as any)?.userId?.name || (batch.driverIds[0] as any)?.licenseNumber
                            : 'Driver Allocated')
                        : 'No Driver'}
                    </span>
                  </div>
                </div>

                {/* Batch Action Toolbar */}
                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/40 text-xs">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openManageDeliveries(batch)}
                      className="px-2.5 py-1.5 rounded-lg bg-surface-low hover:bg-surface-container text-on-surface flex items-center gap-1 text-[11px] font-semibold border border-outline-variant/40"
                      title="Manage Deliveries"
                    >
                      <Package className="w-3.5 h-3.5 text-primary" />
                      Deliveries
                    </button>
                    <button
                      onClick={() => handleDuplicate(batch.id)}
                      className="p-1.5 rounded-lg hover:bg-surface-low text-on-surface-variant"
                      title="Duplicate Batch"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        const firstVeh = batch.vehicleIds && batch.vehicleIds.length > 0 ? batch.vehicleIds[0] : '';
                        const vId = typeof firstVeh === 'string' ? firstVeh : (firstVeh as any)?.id || (firstVeh as any)?._id || '';
                        const firstDrv = batch.driverIds && batch.driverIds.length > 0 ? batch.driverIds[0] : '';
                        const dId = typeof firstDrv === 'string' ? firstDrv : (firstDrv as any)?.id || (firstDrv as any)?._id || '';

                        const bHubId = typeof batch.hubId === 'string'
                          ? batch.hubId
                          : (batch.hubId as any)?._id || (batch.hubId as any)?.id || batch.hub?.id || '';

                        setEditBatch(batch);
                        setFormData({
                          code: batch.code,
                          name: batch.name,
                          date: batch.date,
                          shift: batch.shift,
                          depotName: batch.depot?.name || '',
                          depotAddress: batch.depot?.address || '',
                          hubId: bHubId,
                          vehicleId: vId,
                          driverId: dId,
                        });
                      }}
                      className="p-1.5 rounded-lg hover:bg-surface-low text-on-surface-variant"
                      title="Edit Batch"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleExportCsv(batch.id)}
                      className="p-1.5 rounded-lg hover:bg-surface-low text-on-surface-variant"
                      title="Export Manifest CSV"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <DeleteWithUndoButton
                    variant="icon"
                    title="Delete Batch"
                    itemDescription={`Batch ${batch.code}`}
                    countdownSeconds={3}
                    onDelete={() => handleDelete(batch)}
                  />
                </div>
              </div>

              {/* Footer CTA */}
              <div className="pt-3 border-t border-outline-variant/60 flex items-center justify-between text-xs text-on-surface-variant font-mono">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                  <span>Depot Geo Anchored</span>
                </span>
                <Link
                  to={`/admin/optimizer?batchId=${batch.id}`}
                  className="text-primary hover:text-primary-hover font-bold inline-flex items-center gap-1 transition-colors"
                >
                  Plan Route &rarr;
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    );
  })()}

      {/* Create Batch Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Operational Batch"
        subtitle="Group unassigned consignments into a dispatch ensemble"
        maxWidth="md"
        footer={
          <>
            <Button variant="ghost" size="sm" type="button" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateSubmit} isLoading={isSubmitting}>
              Create Batch
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-3.5">
          <Input
            label="Batch Code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder="e.g. BATCH-001"
            className="font-mono"
            required
          />
          <Input
            label="Batch Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Morning Rasulgarh Cluster"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
            <div>
              <label className="text-xs font-semibold text-on-surface-variant block mb-1">Shift</label>
              <select
                value={formData.shift}
                onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-outline-variant/60 text-xs bg-surface-lowest text-on-surface font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="Shift A (08:00 - 17:00)">Shift A (08:00 - 17:00)</option>
                <option value="Shift B (14:00 - 22:00)">Shift B (14:00 - 22:00)</option>
                <option value="Night Run (22:00 - 06:00)">Night Run (22:00 - 06:00)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-on-surface-variant block mb-1">Preassigned Vehicle</label>
              <select
                value={formData.vehicleId}
                onChange={(e) => {
                  const vId = e.target.value;
                  const chosenVeh = vehicles.find((v) => (v.id || (v as any)._id) === vId);
                  const pairedDrvId = chosenVeh?.assignedDriverId
                    ? typeof chosenVeh.assignedDriverId === 'object'
                      ? (chosenVeh.assignedDriverId as any).id || (chosenVeh.assignedDriverId as any)._id
                      : chosenVeh.assignedDriverId
                    : '';
                  setFormData((prev) => ({
                    ...prev,
                    vehicleId: vId,
                    driverId: (!prev.driverId && pairedDrvId) ? pairedDrvId : prev.driverId,
                  }));
                }}
                className="w-full h-10 px-3 rounded-xl border border-outline-variant/60 text-xs bg-surface-lowest text-on-surface font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">— No Vehicle Allocated —</option>
                {vehicles.map((v) => (
                  <option key={v.id || (v as any)._id} value={v.id || (v as any)._id}>
                    {v.vehicleId} • {v.makeModel} ({v.capacityKg} kg)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant block mb-1">Preassigned Driver</label>
              <select
                value={formData.driverId}
                onChange={(e) => {
                  const dId = e.target.value;
                  const chosenDrv = drivers.find((d) => (d.id || (d as any)._id) === dId);
                  const pairedVehId = chosenDrv?.assignedVehicleId
                    ? typeof chosenDrv.assignedVehicleId === 'object'
                      ? (chosenDrv.assignedVehicleId as any).id || (chosenDrv.assignedVehicleId as any)._id
                      : chosenDrv.assignedVehicleId
                    : '';
                  setFormData((prev) => ({
                    ...prev,
                    driverId: dId,
                    vehicleId: (!prev.vehicleId && pairedVehId) ? pairedVehId : prev.vehicleId,
                  }));
                }}
                className="w-full h-10 px-3 rounded-xl border border-outline-variant/60 text-xs bg-surface-lowest text-on-surface font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">— No Driver Allocated —</option>
                {drivers.map((d) => {
                  const dId = d.id || (d as any)._id;
                  const dName = typeof d.userId === 'object' && (d.userId as any)?.name ? (d.userId as any).name : d.licenseNumber;
                  return (
                    <option key={dId} value={dId}>
                      {dName} ({d.licenseNumber})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="create-batch-hub" className="text-xs font-semibold text-on-surface-variant block mb-1">
              Dispatch Hub / Central Depot (D-02)
            </label>
            <select
              id="create-batch-hub"
              aria-label="Dispatch Hub"
              value={formData.hubId}
              onChange={(e) => {
                const selectedId = e.target.value;
                const hMatch = hubs.find((h) => h.id === selectedId);
                setFormData({
                  ...formData,
                  hubId: selectedId,
                  depotName: hMatch ? hMatch.name : formData.depotName,
                  depotAddress: hMatch ? hMatch.address : formData.depotAddress,
                });
              }}
              className="w-full h-10 px-3 rounded-xl border border-outline-variant/60 text-xs bg-surface-lowest text-on-surface font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">Select Dispatch Hub...</option>
              {hubs.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.code}){h.isCanonical ? ' — Primary' : ''}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      {/* Edit Batch Modal */}
      <Modal
        isOpen={Boolean(editBatch)}
        onClose={() => setEditBatch(null)}
        title={`Edit Batch: ${editBatch?.code || ''}`}
        subtitle="Modify dispatch run schedule and depot parameters"
        maxWidth="md"
        footer={
          <>
            <Button variant="ghost" size="sm" type="button" onClick={() => setEditBatch(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleEditSubmit} isLoading={isSubmitting}>
              Save Changes
            </Button>
          </>
        }
      >
        <form onSubmit={handleEditSubmit} className="space-y-3.5">
          <Input
            label="Batch Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
            <div>
              <label className="text-xs font-semibold text-on-surface-variant block mb-1">Shift</label>
              <select
                value={formData.shift}
                onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-outline-variant/60 text-xs bg-surface-lowest text-on-surface font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="Shift A (08:00 - 17:00)">Shift A (08:00 - 17:00)</option>
                <option value="Shift B (14:00 - 22:00)">Shift B (14:00 - 22:00)</option>
                <option value="Night Run (22:00 - 06:00)">Night Run (22:00 - 06:00)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-on-surface-variant block mb-1">Preassigned Vehicle</label>
              <select
                value={formData.vehicleId}
                onChange={(e) => {
                  const vId = e.target.value;
                  const chosenVeh = vehicles.find((v) => (v.id || (v as any)._id) === vId);
                  const pairedDrvId = chosenVeh?.assignedDriverId
                    ? typeof chosenVeh.assignedDriverId === 'object'
                      ? (chosenVeh.assignedDriverId as any).id || (chosenVeh.assignedDriverId as any)._id
                      : chosenVeh.assignedDriverId
                    : '';
                  setFormData((prev) => ({
                    ...prev,
                    vehicleId: vId,
                    driverId: (!prev.driverId && pairedDrvId) ? pairedDrvId : prev.driverId,
                  }));
                }}
                className="w-full h-10 px-3 rounded-xl border border-outline-variant/60 text-xs bg-surface-lowest text-on-surface font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">— No Vehicle Allocated —</option>
                {vehicles.map((v) => (
                  <option key={v.id || (v as any)._id} value={v.id || (v as any)._id}>
                    {v.vehicleId} • {v.makeModel} ({v.capacityKg} kg)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-on-surface-variant block mb-1">Preassigned Driver</label>
              <select
                value={formData.driverId}
                onChange={(e) => {
                  const dId = e.target.value;
                  const chosenDrv = drivers.find((d) => (d.id || (d as any)._id) === dId);
                  const pairedVehId = chosenDrv?.assignedVehicleId
                    ? typeof chosenDrv.assignedVehicleId === 'object'
                      ? (chosenDrv.assignedVehicleId as any).id || (chosenDrv.assignedVehicleId as any)._id
                      : chosenDrv.assignedVehicleId
                    : '';
                  setFormData((prev) => ({
                    ...prev,
                    driverId: dId,
                    vehicleId: (!prev.vehicleId && pairedVehId) ? pairedVehId : prev.vehicleId,
                  }));
                }}
                className="w-full h-10 px-3 rounded-xl border border-outline-variant/60 text-xs bg-surface-lowest text-on-surface font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">— No Driver Allocated —</option>
                {drivers.map((d) => {
                  const dId = d.id || (d as any)._id;
                  const dName = typeof d.userId === 'object' && (d.userId as any)?.name ? (d.userId as any).name : d.licenseNumber;
                  return (
                    <option key={dId} value={dId}>
                      {dName} ({d.licenseNumber})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* Manage Deliveries Modal */}
      <Modal
        isOpen={Boolean(manageDeliveriesBatch)}
        onClose={() => setManageDeliveriesBatch(null)}
        title={`Manage Consignments: ${manageDeliveriesBatch?.code || ''}`}
        subtitle={`${batchDeliveries.length} consignments linked • Total payload: ${batchDeliveries.reduce((acc, d) => acc + (d.weightKg || 0), 0).toFixed(1)} kg`}
        maxWidth="2xl"
        footer={
          <div className="flex justify-between items-center w-full">
            <span className="text-xs text-on-surface-variant font-mono">
              {selectedToAdd.length} consignment(s) selected
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setManageDeliveriesBatch(null)}
              >
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddDeliveries}
                disabled={selectedToAdd.length === 0 || isSubmitting}
                isLoading={isSubmitting}
              >
                Add Selected ({selectedToAdd.length})
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Currently Linked Deliveries */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">Assigned Consignments</h4>
            {batchDeliveries.length === 0 ? (
              <div className="p-4 text-center text-xs text-on-surface-variant bg-surface-low rounded-2xl border border-outline-variant/40">
                No consignments currently assigned to this batch.
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/60 border border-outline-variant/60 rounded-2xl overflow-hidden bg-surface-lowest">
                {batchDeliveries.map((del) => (
                  <div
                    key={del.id}
                    className="p-3 flex items-center justify-between hover:bg-surface-low transition-colors text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-primary">{del.orderReference}</span>
                      <span className="ml-2 font-medium text-on-surface">{del.customer?.name}</span>
                      <span className="ml-2 text-on-surface-variant">({del.address?.zone})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-on-surface-variant tabular-nums">{del.weightKg} kg</span>
                      <button
                        onClick={() => handleRemoveDelivery(del.id)}
                        className="text-red-600 dark:text-rose-400 hover:text-red-700 dark:hover:text-rose-300 font-semibold text-xs px-2 py-0.5 rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Eligible Unassigned Consignments */}
          <div className="pt-2 border-t border-outline-variant/40 space-y-2">
            <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
              Add From Unassigned Consignments ({availableDeliveries.length} available)
            </h4>
            {availableDeliveries.length === 0 ? (
              <div className="p-4 text-center text-xs text-on-surface-variant bg-surface-low rounded-2xl border border-outline-variant/40">
                No unassigned consignments available.
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto border border-outline-variant/60 rounded-2xl divide-y divide-outline-variant/60 bg-surface-lowest">
                {availableDeliveries.slice(0, 30).map((del) => {
                  const isChecked = selectedToAdd.includes(del.id);
                  return (
                    <div
                      key={del.id}
                      onClick={() => {
                        setSelectedToAdd((prev) =>
                          isChecked ? prev.filter((id) => id !== del.id) : [...prev, del.id]
                        );
                      }}
                      className={`p-3 flex items-center justify-between cursor-pointer text-xs transition-colors ${
                        isChecked ? 'bg-primary/10' : 'hover:bg-surface-low'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded border-outline-variant text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className="font-mono font-bold text-on-surface">{del.orderReference}</span>
                        <span className="text-on-surface-variant truncate max-w-[200px]">{del.address?.street}</span>
                      </div>
                      <span className="font-mono text-on-surface-variant tabular-nums">{del.weightKg} kg</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
