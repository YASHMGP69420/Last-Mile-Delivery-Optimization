import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AdminHeader } from '../components/layout/AdminHeader';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { BatchesApi, DeliveriesApi } from '../api/client';
import { DeliveryBatch, Delivery } from '../types';
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
} from 'lucide-react';

export const BatchesPage: React.FC = () => {
  const [batches, setBatches] = useState<DeliveryBatch[]>([]);
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
  });

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
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
        setActionError(e.response?.data?.error?.message || 'Failed to fetch batches');
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
      alert(e.response?.data?.error?.message || 'Failed to duplicate batch');
      setIsLoading(false);
    }
  };

  const handleDelete = async (batch: DeliveryBatch) => {
    if (!window.confirm(`Are you sure you want to delete batch ${batch.code}? Linked deliveries will be unbound.`)) {
      return;
    }
    setIsLoading(true);
    try {
      await BatchesApi.delete(batch.id);
      await fetchBatches();
    } catch (e: any) {
      alert(e.response?.data?.error?.message || 'Failed to delete batch');
      setIsLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await BatchesApi.create({
        code: formData.code.trim().toUpperCase() || undefined,
        name: formData.name.trim(),
        date: formData.date,
        shift: formData.shift,
        depot: {
          name: formData.depotName,
          address: formData.depotAddress,
          geo: { lat: 20.2961, lng: 85.8645 },
        },
      });
      setCreateModalOpen(false);
      await fetchBatches();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to create batch');
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
      });
      setEditBatch(null);
      await fetchBatches();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update batch');
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

  const handleExportCsv = (batchId: string) => {
    window.open(BatchesApi.exportCsvUrl(batchId), '_blank');
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
                setFormData({
                  code: `BATCH-${Date.now().toString().slice(-4)}`,
                  name: `Dispatch Run ${new Date().toLocaleDateString()}`,
                  date: new Date().toISOString().split('T')[0],
                  shift: 'Shift A (08:00 - 17:00)',
                  depotName: 'Rasulgarh Central Hub',
                  depotAddress: 'Plot 104/A, Rasulgarh Industrial Estate, Bhubaneswar',
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
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between p-4 rounded-[24px] bg-surface-lowest border border-outline-variant/60 shadow-soft">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-on-surface-variant" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search batch code, name, or shift..."
            className="w-full h-10 pl-10 pr-4 rounded-full border border-outline-variant/40 text-xs bg-surface-low text-on-surface focus:outline-none focus:ring-2 focus:ring-emerald shadow-inner"
          />
        </form>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-xs pb-0.5">
          {['ALL', 'DRAFT', 'READY', 'PLANNED', 'IN_PROGRESS', 'CLOSED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                statusFilter === st
                  ? 'bg-emerald text-white shadow-emerald'
                  : 'bg-surface-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs rounded-full flex items-center gap-2 px-5">
          <AlertCircle className="w-4 h-4" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Batches Grid */}
      {isLoading ? (
        <div className="h-64 flex items-center justify-center bg-surface-lowest rounded-[28px] border border-outline-variant/60 shadow-soft">
          <Loader2 className="w-6 h-6 text-emerald animate-spin" />
        </div>
      ) : batches.length === 0 ? (
        <div className="p-12 text-center bg-surface-lowest rounded-[28px] border border-outline-variant/60 shadow-soft space-y-3">
          <Layers className="w-12 h-12 text-on-surface-variant/40 mx-auto" />
          <h3 className="text-base font-semibold text-on-surface">No Dispatch Batches Found</h3>
          <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
            Create a new dispatch batch or compose one from the Deliveries Manifest.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {batches.map((batch) => (
            <div
              key={batch.id}
              className="p-6 rounded-[28px] bg-surface-lowest border border-outline-variant/60 shadow-soft hover:shadow-soft-hover transition-all duration-200 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                    {batch.code}
                  </span>
                  <StatusBadge status={batch.status} size="sm" />
                </div>

                <div>
                  <h3 className="font-semibold text-on-surface text-base">{batch.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{batch.date}</span>
                    <span>•</span>
                    <Clock className="w-3.5 h-3.5" />
                    <span>{batch.shift}</span>
                  </div>
                </div>

                {/* Central Depot */}
                <div className="p-3 rounded-2xl bg-surface-low border border-outline-variant/40 flex items-center gap-2.5 text-xs">
                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                  <div className="truncate">
                    <span className="font-semibold text-on-surface block truncate">
                      {batch.depot?.name || 'Rasulgarh Logistics Hub'}
                    </span>
                    <span className="text-[10px] text-on-surface-variant block truncate">
                      {batch.depot?.address || 'Plot 104/A, Rasulgarh Industrial Estate'}
                    </span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-outline-variant/60">
                  <div className="p-2.5 rounded-xl bg-surface-low">
                    <span className="text-[10px] text-on-surface-variant font-medium block">Stops</span>
                    <span className="font-mono font-bold text-sm text-on-surface">
                      {batch.metrics?.totalDeliveries || batch.deliveryIds?.length || 0}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-low">
                    <span className="text-[10px] text-on-surface-variant font-medium block">Payload</span>
                    <span className="font-mono font-bold text-sm text-on-surface tabular-nums">
                      {batch.metrics?.totalWeightKg ? batch.metrics.totalWeightKg.toFixed(1) : '0.0'} kg
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-low">
                    <span className="text-[10px] text-on-surface-variant font-medium block">Vehicles</span>
                    <span className="font-mono font-bold text-sm text-on-surface">
                      {batch.vehicleIds?.length || 0}
                    </span>
                  </div>
                </div>

                {/* Batch Action Toolbar */}
                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/40 text-xs">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openManageDeliveries(batch)}
                      className="px-2.5 py-1.5 rounded-full bg-surface-low hover:bg-surface-container text-on-surface flex items-center gap-1 text-[11px] font-semibold border border-outline-variant/40"
                      title="Manage Deliveries"
                    >
                      <Package className="w-3.5 h-3.5 text-primary" />
                      Deliveries
                    </button>
                    <button
                      onClick={() => handleDuplicate(batch.id)}
                      className="p-1.5 rounded-full hover:bg-surface-low text-on-surface-variant"
                      title="Duplicate Batch"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setEditBatch(batch);
                        setFormData({
                          code: batch.code,
                          name: batch.name,
                          date: batch.date,
                          shift: batch.shift,
                          depotName: batch.depot?.name || '',
                          depotAddress: batch.depot?.address || '',
                        });
                      }}
                      className="p-1.5 rounded-full hover:bg-surface-low text-on-surface-variant"
                      title="Edit Batch"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleExportCsv(batch.id)}
                      className="p-1.5 rounded-full hover:bg-surface-low text-on-surface-variant"
                      title="Export Manifest CSV"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleDelete(batch)}
                    className="p-1.5 rounded-full hover:bg-red-50 text-red-600"
                    title="Delete Batch"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
          ))}
        </div>
      )}

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
          <Input
            label="Central Depot"
            value={formData.depotName}
            disabled
            className="bg-surface-low text-on-surface-variant cursor-not-allowed font-medium"
          />
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
                        className="text-red-600 hover:text-red-700 font-semibold text-xs px-2 py-0.5 rounded-full hover:bg-red-50 transition-colors"
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
