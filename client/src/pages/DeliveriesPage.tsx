import React, { useState, useEffect, useRef } from 'react';
import { AdminHeader } from '../components/layout/AdminHeader';
import { ManifestTable } from '../components/deliveries/ManifestTable';
import { BatchComposerPanel } from '../components/deliveries/BatchComposerPanel';
import { CsvImportModal } from '../components/deliveries/CsvImportModal';
import {
  ConsignmentDrawer,
  PRESET_DELIVERY_ZONES,
  validateConsignmentForm,
} from '../components/deliveries/ConsignmentDrawer';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { DeliveriesApi, FleetApi } from '../api/client';
import { Delivery, DeliveryPriority, Vehicle, Driver } from '../types';
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
  const [newPostalCode, setNewPostalCode] = useState('751024');
  const [newWeight, setNewWeight] = useState('5.0');
  const [newVolume, setNewVolume] = useState('0.01');
  const [newServiceDuration, setNewServiceDuration] = useState('10');
  const [newPriority, setNewPriority] = useState<DeliveryPriority>('Standard');
  const [newTimeWindowStart, setNewTimeWindowStart] = useState('09:00');
  const [newTimeWindowEnd, setNewTimeWindowEnd] = useState('17:00');
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
        const fetchedDeliveries = delivRes.data.deliveries || [];
        setDeliveries(fetchedDeliveries);
        setVehicles(vehRes.data.vehicles || []);
        setDrivers(drivRes.data.drivers || []);
        setInspectingDelivery((prev) =>
          prev ? fetchedDeliveries.find((d) => d.id === prev.id) || prev : null
        );
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
    const { error, payload } = validateConsignmentForm(
      {
        orderReference: newOrderRef,
        customerName: newCustName,
        customerPhone: newCustPhone,
        street: newStreet,
        zone: newZone,
        postalCode: newPostalCode,
        weightKg: newWeight,
        volumeM3: newVolume,
        serviceDurationMinutes: newServiceDuration,
        priority: newPriority,
        timeWindowStart: newTimeWindowStart,
        timeWindowEnd: newTimeWindowEnd,
      },
      { requireOrderReference: true }
    );

    if (error || !payload) {
      setCreateError(error || 'Please check all required fields.');
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      await DeliveriesApi.create({
        ...payload,
        status: 'READY',
      });
      setIsNewConsignmentModalOpen(false);
      setNewOrderRef(`DEL-${Math.floor(1000 + Math.random() * 9000)}`);
      setNewCustName('');
      setNewCustPhone('');
      setNewStreet('');
      setNewPostalCode('751024');
      setNewWeight('5.0');
      setNewVolume('0.01');
      setNewServiceDuration('10');
      setNewTimeWindowStart('09:00');
      setNewTimeWindowEnd('17:00');
      setCreateError(null);
      fetchData();
    } catch (e: any) {
      const msg = e.friendlyMessage || e.response?.data?.error?.message || e.message || 'Failed to create consignment';
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
              leftIcon={<UploadCloud className="w-4 h-4 text-primary" />}
              onClick={() => setIsCsvModalOpen(true)}
            >
              Import CSV Manifest
            </Button>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleOpenNewModal}
            >
              New Consignment
            </Button>
          </div>
        }
      />

      {/* Filter and Action Bar */}
      <div className="p-4 bg-surface-lowest rounded-xl border border-outline-variant/60 shadow-soft flex flex-col gap-3 shrink-0">
        {/* Top: Capsule Segmented Status Switcher (Pinterest inspired) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: 'ALL', label: 'All Consignments' },
            { id: 'READY', label: 'Ready' },
            { id: 'ASSIGNED', label: 'Assigned' },
            { id: 'OUT_FOR_DELIVERY', label: 'In Transit' },
            { id: 'COMPLETED', label: 'Completed' },
            { id: 'FAILED', label: 'Exceptions' },
          ].map((tab) => {
            const isActive = selectedStatus === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedStatus(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-primary text-white font-semibold'
                    : 'bg-surface-low dark:bg-obsidian-950 text-on-surface-variant dark:text-slate-400 hover:text-on-surface dark:hover:text-white border border-outline-variant/40 dark:border-obsidian-750'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Bottom: Search and Auxiliary Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-outline-variant/40 dark:border-obsidian-750">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[240px] max-w-sm">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order #, customer, address..."
              leftIcon={<Search className="w-4 h-4 text-on-surface-variant" />}
              className="w-full rounded-lg"
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
              className="text-xs rounded-lg border border-outline-variant/40 dark:border-obsidian-700 bg-surface-low dark:bg-obsidian-950 px-3 py-1.5 text-on-surface dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Zones</option>
              <option value="Patia (Z-1)">Patia (Z-1)</option>
              <option value="Jaydev Vihar (Z-2)">Jaydev Vihar (Z-2)</option>
              <option value="Saheed Nagar (Z-3)">Saheed Nagar (Z-3)</option>
              <option value="Khandagiri (Z-4)">Khandagiri (Z-4)</option>
              <option value="Chandrasekharpur">Chandrasekharpur</option>
            </select>

            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="text-xs rounded-lg border border-outline-variant/40 dark:border-obsidian-700 bg-surface-low dark:bg-obsidian-950 px-3 py-1.5 text-on-surface dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-primary"
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
      </div>

      {/* Manifest Table View */}
      <div className="flex-1 min-h-0">
        {isLoading && deliveries.length === 0 ? (
          <div className="h-64 flex items-center justify-center bg-surface-lowest dark:bg-obsidian-900 rounded-xl border border-outline-variant/60 dark:border-obsidian-750">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
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
            <Button variant="primary" onClick={handleCreateConsignment} isLoading={isCreating}>
              Create Consignment
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateConsignment} className="space-y-4">
          {createError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-700 dark:text-red-300 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Zone
              </label>
              <select
                value={newZone}
                onChange={(e) => setNewZone(e.target.value)}
                className="w-full h-9 text-xs rounded-xl border border-outline-variant/60 bg-surface-lowest px-3 text-on-surface"
              >
                {PRESET_DELIVERY_ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Postal Code (6 digits)"
              value={newPostalCode}
              onChange={(e) => setNewPostalCode(e.target.value)}
              pattern="\d{6}"
              maxLength={6}
              placeholder="751024"
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Weight (kg)"
              type="number"
              min={0.1}
              step="0.1"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              required
            />
            <Input
              label="Volume (m³)"
              type="number"
              min={0}
              step="0.001"
              value={newVolume}
              onChange={(e) => setNewVolume(e.target.value)}
              required
            />
            <Input
              label="Service (min)"
              type="number"
              min={1}
              step="1"
              value={newServiceDuration}
              onChange={(e) => setNewServiceDuration(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Priority
              </label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as DeliveryPriority)}
                className="w-full h-9 text-xs rounded-xl border border-outline-variant/60 bg-surface-lowest px-3 text-on-surface"
              >
                <option value="Standard">Standard</option>
                <option value="Urgent">Urgent</option>
                <option value="Cold Chain">Cold Chain</option>
              </select>
            </div>
            <Input
              label="Window Start"
              type="time"
              value={newTimeWindowStart}
              onChange={(e) => setNewTimeWindowStart(e.target.value)}
              required
            />
            <Input
              label="Window End"
              type="time"
              value={newTimeWindowEnd}
              onChange={(e) => setNewTimeWindowEnd(e.target.value)}
              required
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
