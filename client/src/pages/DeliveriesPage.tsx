import React, { useState, useEffect, useRef } from 'react';
import { AdminHeader } from '../components/layout/AdminHeader';
import { ManifestTable } from '../components/deliveries/ManifestTable';
import { BatchComposerPanel } from '../components/deliveries/BatchComposerPanel';
import { CsvImportModal } from '../components/deliveries/CsvImportModal';
import { ConsignmentDrawer } from '../components/deliveries/ConsignmentDrawer';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { DeliveriesApi, FleetApi } from '../api/client';
import { Delivery, Vehicle, Driver } from '../types';
import {
  UploadCloud,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

export const DeliveriesPage: React.FC = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedZone, setSelectedZone] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedPriority, setSelectedPriority] = useState('ALL');

  // Modals & Drawers state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isBatchComposerOpen, setIsBatchComposerOpen] = useState(false);
  const [isNewConsignmentModalOpen, setIsNewConsignmentModalOpen] = useState(false);
  const [inspectingDelivery, setInspectingDelivery] = useState<Delivery | null>(null);

  // New Consignment Form State
  const [newOrderRef, setNewOrderRef] = useState(`DEL-${Math.floor(1000 + Math.random() * 9000)}`);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newStreet, setNewStreet] = useState('');
  const [newZone, setNewZone] = useState('Patia (Z-1)');
  const [newWeight, setNewWeight] = useState('5.0');
  const [newPriority, setNewPriority] = useState('Standard');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleOpenNewModal = () => {
    setNewOrderRef(`DEL-${Math.floor(1000 + Math.random() * 9000)}`);
    setCreateError(null);
    setIsNewConsignmentModalOpen(true);
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = {};
      if (search) params.search = search;
      if (selectedZone !== 'ALL') params.zone = selectedZone;
      if (selectedStatus !== 'ALL') params.status = selectedStatus;
      if (selectedPriority !== 'ALL') params.priority = selectedPriority;

      const [delivRes, vehRes, drivRes] = await Promise.all([
        DeliveriesApi.list(params),
        FleetApi.getVehicles(),
        FleetApi.getDrivers(),
      ]);

      if (isMountedRef.current) {
        setDeliveries(delivRes.data.deliveries || []);
        setVehicles(vehRes.data.vehicles || []);
        setDrivers(drivRes.data.drivers || []);
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Failed to fetch manifest data:', err);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedZone, selectedStatus, selectedPriority]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (ids: string[]) => {
    setSelectedIds(ids);
  };

  const handleCreateConsignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderRef.trim() || !newCustName.trim() || !newCustPhone.trim() || !newStreet.trim()) {
      setCreateError('Please complete all required fields.');
      return;
    }
    const parsedWeight = parseFloat(newWeight);
    if (isNaN(parsedWeight) || parsedWeight <= 0) {
      setCreateError('Weight must be a valid positive number.');
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      await DeliveriesApi.create({
        orderReference: newOrderRef.trim(),
        customer: { name: newCustName.trim(), phone: newCustPhone.trim() },
        address: { street: newStreet.trim(), city: 'Bhubaneswar', zone: newZone, postalCode: '751024' },
        weightKg: parsedWeight,
        priority: newPriority as any,
        timeWindow: { start: '09:00', end: '17:00' },
        status: 'READY',
      });
      setIsNewConsignmentModalOpen(false);
      setNewOrderRef(`DEL-${Math.floor(1000 + Math.random() * 9000)}`);
      setNewCustName('');
      setNewCustPhone('');
      setNewStreet('');
      setCreateError(null);
      fetchData();
    } catch (e: any) {
      const msg = e.response?.data?.error?.message || e.message || 'Failed to create consignment';
      setCreateError(msg);
      console.error('Failed to create consignment:', e);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <AdminHeader
        title="Delivery Manifest Management"
        subtitle="Rasulgarh Hub Master Waybill & High-Density Parcel Inventory"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              leftIcon={<UploadCloud className="w-4 h-4 text-secondary" />}
              onClick={() => setIsCsvModalOpen(true)}
            >
              Import CSV Manifest
            </Button>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleOpenNewModal}
            >
              New Consignment
            </Button>
          </div>
        }
      />

      {/* Filter and Action Bar */}
      <div className="p-4 bg-surface-lowest rounded-lg border border-outline-variant shadow-sm flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[240px] max-w-sm">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order #, customer, address..."
            leftIcon={<Search className="w-4 h-4" />}
            className="w-full"
          />
          <Button type="submit" size="sm" variant="outline">
            Search
          </Button>
        </form>

        {/* Dropdown Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="text-xs rounded-md border border-outline-variant bg-surface-low px-2.5 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
          >
            <option value="ALL">All Zones</option>
            <option value="Patia (Z-1)">Patia (Z-1)</option>
            <option value="Jaydev Vihar (Z-2)">Jaydev Vihar (Z-2)</option>
            <option value="Saheed Nagar (Z-3)">Saheed Nagar (Z-3)</option>
            <option value="Khandagiri (Z-4)">Khandagiri (Z-4)</option>
            <option value="Chandrasekharpur">Chandrasekharpur</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs rounded-md border border-outline-variant bg-surface-low px-2.5 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">DRAFT</option>
            <option value="READY">READY</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="FAILED">FAILED</option>
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="text-xs rounded-md border border-outline-variant bg-surface-low px-2.5 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
          >
            <option value="ALL">All Priorities</option>
            <option value="Standard">Standard</option>
            <option value="Urgent">Urgent</option>
            <option value="Cold Chain">Cold Chain</option>
          </select>

          <Button
            size="sm"
            variant="ghost"
            onClick={fetchData}
            title="Reload manifest"
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Reload
          </Button>
        </div>
      </div>

      {/* Manifest Table View */}
      <div className="flex-1 min-h-0">
        {isLoading && deliveries.length === 0 ? (
          <div className="h-64 flex items-center justify-center bg-surface-lowest rounded-lg border border-outline-variant">
            <Loader2 className="w-6 h-6 text-secondary animate-spin" />
          </div>
        ) : (
          <ManifestTable
            deliveries={deliveries}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onViewConsignment={(d) => setInspectingDelivery(d)}
            onOpenBatchComposer={() => setIsBatchComposerOpen(true)}
          />
        )}
      </div>

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onImportSuccess={() => {
          fetchData();
        }}
      />

      {/* Batch Composer Panel */}
      <BatchComposerPanel
        isOpen={isBatchComposerOpen}
        onClose={() => setIsBatchComposerOpen(false)}
        selectedDeliveries={deliveries.filter((d) => selectedIds.includes(d.id))}
        vehicles={vehicles}
        drivers={drivers}
        onBatchCreated={() => {
          setSelectedIds([]);
          fetchData();
        }}
      />

      {/* Consignment Waybill Inspector Drawer */}
      <ConsignmentDrawer
        delivery={inspectingDelivery}
        isOpen={Boolean(inspectingDelivery)}
        onClose={() => setInspectingDelivery(null)}
        onStatusChanged={fetchData}
      />

      {/* New Consignment Modal */}
      <Modal
        isOpen={isNewConsignmentModalOpen}
        onClose={() => setIsNewConsignmentModalOpen(false)}
        title="Register New Delivery Consignment"
        subtitle="Individual parcel induction into Bhubaneswar logistics queue"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsNewConsignmentModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={handleCreateConsignment} isLoading={isCreating}>
              Create Consignment
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateConsignment} className="space-y-4">
          {createError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{createError}</span>
            </div>
          )}
          <Input
            label="Order Reference / Waybill #"
            value={newOrderRef}
            onChange={(e) => setNewOrderRef(e.target.value)}
            required
            className="font-mono"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Customer Name"
              value={newCustName}
              onChange={(e) => setNewCustName(e.target.value)}
              placeholder="e.g. Alok Mohapatra"
              required
            />
            <Input
              label="Customer Phone"
              value={newCustPhone}
              onChange={(e) => setNewCustPhone(e.target.value)}
              placeholder="+91 94370 12345"
              required
            />
          </div>
          <Input
            label="Street Address"
            value={newStreet}
            onChange={(e) => setNewStreet(e.target.value)}
            placeholder="Plot 104, Infocity Avenue"
            required
          />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Zone
              </label>
              <select
                value={newZone}
                onChange={(e) => setNewZone(e.target.value)}
                className="w-full text-xs rounded-md border border-outline-variant bg-surface-lowest px-2.5 py-2 text-on-surface"
              >
                <option value="Patia (Z-1)">Patia (Z-1)</option>
                <option value="Jaydev Vihar (Z-2)">Jaydev Vihar (Z-2)</option>
                <option value="Saheed Nagar (Z-3)">Saheed Nagar (Z-3)</option>
                <option value="Khandagiri (Z-4)">Khandagiri (Z-4)</option>
                <option value="Chandrasekharpur">Chandrasekharpur</option>
              </select>
            </div>
            <Input
              label="Weight (kg)"
              type="number"
              step="0.1"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              required
            />
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Priority
              </label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
                className="w-full text-xs rounded-md border border-outline-variant bg-surface-lowest px-2.5 py-2 text-on-surface"
              >
                <option value="Standard">Standard</option>
                <option value="Urgent">Urgent</option>
                <option value="Cold Chain">Cold Chain</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
