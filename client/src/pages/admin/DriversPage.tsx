import React, { useEffect, useState, useCallback } from 'react';
import { FleetApi } from '../../api/client';
import { Driver, Vehicle } from '../../types';
import { AdminHeader } from '../../components/layout/AdminHeader';
import { Table } from '../../components/common/Table';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { useRealtimeCatchup } from '../../hooks/useRealtimeCatchup';
import { Input } from '../../components/common/Input';
import {
  ActiveOperationConflictModal,
  ActiveOperationConflictDetails,
} from '../../components/admin/ActiveOperationConflictModal';
import { toast } from 'sonner';
import { RefreshCw, UserPlus, UploadCloud, CheckCircle2, AlertTriangle, AlertCircle, FileText, Star, X, Pencil, Trash2, Download } from 'lucide-react';

export const DriversPage: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Bulk selection and deletion state
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Onboard driver modal
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [newDriver, setNewDriver] = useState({
    name: '',
    email: '',
    phone: '',
    licenseNumber: '',
    password: '',
  });
  const [onboarding, setOnboarding] = useState(false);

  // Driver CSV Import modal
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [isDryRun, setIsDryRun] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Edit Driver modal state
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [editDriverForm, setEditDriverForm] = useState({
    name: '',
    email: '',
    phone: '',
    licenseNumber: '',
    availability: 'AVAILABLE',
    rating: 5.0,
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Driver modal state
  const [deletingDriver, setDeletingDriver] = useState<Driver | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Active operation conflict modal state
  const [activeConflict, setActiveConflict] = useState<{
    driver: Driver;
    details: ActiveOperationConflictDetails;
  } | null>(null);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [isRescuing, setIsRescuing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [driversRes, vehiclesRes] = await Promise.all([
        FleetApi.getDrivers(),
        FleetApi.getVehicles(),
      ]);
      setDrivers(driversRes.data.drivers || []);
      setVehicles(vehiclesRes.data.vehicles || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Multi-device catchup across mobile screen wake, tab switches, and network reconnects
  useRealtimeCatchup(fetchData);

  const getDriverName = (d: Driver): string => {
    if (!d.userId) return 'Unknown';
    if (typeof d.userId === 'string') return d.userId;
    return (d.userId as any)?.name || (d.userId as any)?.email || 'Unknown';
  };

  const getDriverPhone = (d: Driver): string => {
    return d.phone || '';
  };

  const getAssignedVehicle = (d: Driver): string => {
    if (!d.assignedVehicleId) return '—';
    if (typeof d.assignedVehicleId === 'string') return d.assignedVehicleId;
    return (d.assignedVehicleId as any)?.vehicleId || (d.assignedVehicleId as any)?.makeModel || 'Assigned';
  };

  const getDriverId = (d: Driver): string => {
    return (d as any)._id || d.id;
  };

  const handleOnboardDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriver.name || !newDriver.email || !newDriver.phone || !newDriver.licenseNumber) {
      setActionMsg({ type: 'error', text: 'All fields are required for driver onboarding' });
      return;
    }
    setOnboarding(true);
    try {
      const res = await FleetApi.createDriver({
        name: newDriver.name,
        email: newDriver.email,
        phone: newDriver.phone,
        licenseNumber: newDriver.licenseNumber,
        password: newDriver.password,
      });
      setActionMsg({ type: 'success', text: `Driver ${newDriver.name} onboarded successfully.` });
      setShowOnboardModal(false);
      setNewDriver({ name: '', email: '', phone: '', licenseNumber: '', password: '' });
      fetchData();
    } catch (e: any) {
      setActionMsg({
        type: 'error',
        text: e?.response?.data?.error?.message || e?.response?.data?.message || 'Driver onboarding failed',
      });
    } finally {
      setOnboarding(false);
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
      `name,email,phone,licenseNumber,password,availability\nRamesh Chandra Swain,driver.test01@smartroute.internal,+91 91111 00001,OD-02-DL-2024-101,driver123,AVAILABLE\nBikash Mohanty,driver.test02@smartroute.internal,+91 91111 00002,OD-02-DL-2024-102,driver123,AVAILABLE\nSunil Kumar Panda,driver.test03@smartroute.internal,+91 91111 00003,OD-02-DL-2024-103,driver123,AVAILABLE`
    );
    setImportResult(null);
  };

  const handleExecuteCsvImport = async () => {
    if (!csvContent.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await FleetApi.importDriverCsv(csvContent, { dryRun: isDryRun });
      setImportResult(res.data);
      if (!isDryRun) {
        fetchData();
        setActionMsg({ type: 'success', text: `Successfully imported ${res.data.created} drivers.` });
      }
    } catch (e: any) {
      setImportResult({
        errors: [{ message: e?.response?.data?.error?.message || e?.response?.data?.message || 'Import failed' }],
      });
    } finally {
      setImporting(false);
    }
  };

  const handleOpenEdit = (d: Driver) => {
    setEditingDriver(d);
    setEditDriverForm({
      name: getDriverName(d),
      email: typeof d.userId === 'object' ? (d.userId as any)?.email || '' : '',
      phone: d.phone || '',
      licenseNumber: d.licenseNumber || '',
      availability: d.availability || 'AVAILABLE',
      rating: d.rating ? Number(d.rating) : 5.0,
    });
    setEditError(null);
  };

  const handleSaveDriverEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver) return;
    if (!editDriverForm.name.trim() || !editDriverForm.phone.trim() || !editDriverForm.licenseNumber.trim()) {
      setEditError('Name, phone, and license number are required');
      return;
    }
    setEditLoading(true);
    setEditError(null);
    try {
      const driverId = getDriverId(editingDriver);
      const res = await FleetApi.updateDriver(driverId, {
        name: editDriverForm.name.trim(),
        email: editDriverForm.email.trim() || undefined,
        phone: editDriverForm.phone.trim(),
        licenseNumber: editDriverForm.licenseNumber.trim(),
        availability: editDriverForm.availability,
        rating: Number(editDriverForm.rating),
      });
      if (res.success) {
        toast.success(`Driver ${editDriverForm.name} updated successfully.`);
        setActionMsg({ type: 'success', text: `Driver ${editDriverForm.name} updated successfully.` });
        setEditingDriver(null);
        fetchData();
      }
    } catch (err: any) {
      const msg = err.friendlyMessage || err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Failed to update driver';
      setEditError(msg);
    } finally {
      setEditLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingDriver) return;
    const driverId = getDriverId(deletingDriver);
    setDeleteLoading(true);
    try {
      const res = await FleetApi.deleteDriver(driverId);
      if (res.success) {
        toast.success(`Driver ${getDriverName(deletingDriver)} deleted successfully.`);
        setActionMsg({ type: 'success', text: `Driver ${getDriverName(deletingDriver)} deleted successfully.` });
        setDeletingDriver(null);
        fetchData();
      }
    } catch (err: any) {
      const code = err.response?.data?.error?.code || err.code;
      if (code === 'ACTIVE_OPERATION_CONFLICT') {
        const details = err.response?.data?.error?.details || err.details;
        setActiveConflict({
          driver: deletingDriver,
          details: {
            routeId: details?.routeId,
            routeCode: details?.routeCode,
            activeDeliveryCount: details?.activeDeliveryCount ?? 0,
            driverName: getDriverName(deletingDriver),
          },
        });
        setDeletingDriver(null);
        setConflictModalOpen(true);
      } else {
        const msg = err.friendlyMessage || err.response?.data?.error?.message || err.message || 'Failed to delete driver';
        toast.error(msg);
        setActionMsg({ type: 'error', text: msg });
        setDeletingDriver(null);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleReassignAndDelete = async () => {
    if (!activeConflict?.driver) return;
    const driverId = getDriverId(activeConflict.driver);
    setIsRescuing(true);
    try {
      const res = await FleetApi.deleteDriver(driverId, { forceReassign: true });
      if (res.success) {
        toast.success(`Rescued active orders and deleted driver ${getDriverName(activeConflict.driver)}.`);
        setActionMsg({
          type: 'success',
          text: `Rescued active orders and deleted driver ${getDriverName(activeConflict.driver)}.`,
        });
        setConflictModalOpen(false);
        setActiveConflict(null);
        fetchData();
      }
    } catch (err: any) {
      const msg = err.friendlyMessage || err.response?.data?.error?.message || err.message || 'Failed to rescue orders and delete driver';
      toast.error(msg);
      setActionMsg({ type: 'error', text: msg });
    } finally {
      setIsRescuing(false);
    }
  };

  const handleToggleSelectDriver = (id: string) => {
    setSelectedDriverIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllDrivers = (ids: string[]) => {
    setSelectedDriverIds(ids);
  };

  const handleConfirmBulkDeleteDrivers = async () => {
    if (selectedDriverIds.length === 0) return;
    setIsBulkDeleting(true);
    let succeeded = 0;
    let conflicts = 0;
    let otherErrors = 0;

    for (const driverId of selectedDriverIds) {
      try {
        const res = await FleetApi.deleteDriver(driverId);
        if (res.success) {
          succeeded++;
        }
      } catch (err: any) {
        const code = err.response?.data?.error?.code || err.code;
        if (code === 'ACTIVE_OPERATION_CONFLICT') {
          conflicts++;
        } else {
          otherErrors++;
        }
      }
    }

    if (succeeded > 0) {
      toast.success(`Successfully deleted ${succeeded} driver${succeeded === 1 ? '' : 's'}.`);
      setActionMsg({
        type: 'success',
        text: `Successfully deleted ${succeeded} driver${succeeded === 1 ? '' : 's'}.`,
      });
    }
    if (conflicts > 0) {
      toast.error(`${conflicts} driver${conflicts === 1 ? '' : 's'} could not be deleted due to active route or shift operations.`);
    }
    if (otherErrors > 0) {
      toast.error(`${otherErrors} driver${otherErrors === 1 ? '' : 's'} failed to delete.`);
    }

    setSelectedDriverIds([]);
    setIsBulkDeleteModalOpen(false);
    fetchData();
    setIsBulkDeleting(false);
  };

  const availableVehicles = vehicles.filter(
    (v) => v.availability === 'AVAILABLE' || v.availability === 'ASSIGNED'
  );

  const columns = [
    { header: 'Name', accessor: (d: Driver) => getDriverName(d) },
    { header: 'License', accessor: (d: Driver) => d.licenseNumber },
    { header: 'Phone', accessor: (d: Driver) => getDriverPhone(d) },
    {
      header: 'Availability',
      accessor: (d: Driver) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-[4px] font-mono uppercase tracking-wider text-[10px] font-semibold border border-outline-variant/80 dark:border-obsidian-750 bg-surface-low dark:bg-obsidian-850 border-l-[3px] ${
            d.availability === 'AVAILABLE'
              ? 'border-l-primary text-on-surface dark:text-zinc-100'
              : d.availability === 'ON_DUTY'
              ? 'border-l-blue-400 text-on-surface dark:text-zinc-100'
              : d.availability === 'IN_TRANSIT'
              ? 'border-l-amber-500 text-on-surface dark:text-amber-200'
              : 'border-l-zinc-400 dark:border-l-zinc-500 text-on-surface-variant dark:text-zinc-300'
          }`}
        >
          {d.availability}
        </span>
      ),
    },
    {
      header: 'Rating',
      accessor: (d: Driver) => (
        <div className="flex items-center gap-1 font-mono text-xs">
          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
          <span>{d.rating ? Number(d.rating).toFixed(1) : '—'}</span>
        </div>
      ),
    },
    { header: 'Assigned Vehicle', accessor: (d: Driver) => getAssignedVehicle(d) },
    {
      header: 'Workload & Dispatches',
      accessor: (d: Driver) => {
        const hasRoute = Boolean((d as any).currentRouteId || (d as any).activeRouteId);
        return (
          <div className="flex flex-col text-xs font-mono">
            {hasRoute ? (
              <span className="text-primary font-bold">1 Active Dispatch</span>
            ) : (
              <span className="text-on-surface-variant font-medium">Ready (0 Active)</span>
            )}
            {d.onTimeRuns ? (
              <span className="text-[10px] text-on-surface-variant/80 font-normal">
                {d.onTimeRuns} runs on-time
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      header: 'Deliveries, Savings & Usage',
      accessor: (d: Driver) => {
        const st = (d as any).stats || {};
        const delivDone = st.deliveriesCompleted ?? 0;
        const kmSaved = st.kmSaved ?? 0;
        const fuelSavedL = st.fuelSavedLitres ?? 0;
        const energySavedKwh = st.energySavedKwh ?? 0;
        const actualKm = st.actualDistanceKm ?? 0;
        const actualL = st.actualFuelUsedLitres ?? 0;
        const actualPct = st.actualChargeUsedPct ?? 0;
        return (
          <div className="flex flex-col text-xs font-mono space-y-0.5">
            <span className="font-semibold text-on-surface">
              {delivDone} deliveries made
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              Saved {kmSaved} km • {fuelSavedL} L{energySavedKwh > 0 ? ` + ${energySavedKwh} kWh` : ''}
            </span>
            {(actualKm > 0 || actualL > 0 || actualPct > 0) && (
              <span className="text-[10px] text-on-surface-variant">
                Used {actualKm} km • {actualL > 0 ? `${actualL} L` : `${actualPct}% charge`}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Actions',
      accessor: (d: Driver) => {
        return (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenEdit(d)}
              leftIcon={<Pencil className="w-3.5 h-3.5" />}
              title="Edit driver"
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDeletingDriver(d)}
              className="text-error hover:bg-error/10"
              leftIcon={<Trash2 className="w-3.5 h-3.5 text-error" />}
              title="Delete driver"
            >
              Delete
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col h-full space-y-4">
      <AdminHeader
        title="Driver Management"
        subtitle="Onboard drivers, manage availability, and view optimizer-assigned vehicles"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={fetchData}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setImportResult(null);
                setShowCsvModal(true);
              }}
              leftIcon={<UploadCloud className="w-3.5 h-3.5" />}
            >
              Import CSV
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setShowOnboardModal(true)}
              leftIcon={<UserPlus className="w-3.5 h-3.5" />}
            >
              Onboard Driver
            </Button>
          </div>
        }
      />

      {actionMsg && (
        <div
          className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between border ${
            actionMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50'
              : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/50'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span>{actionMsg.text}</span>
          </div>
          <button
            onClick={() => setActionMsg(null)}
            className="ml-3 text-xs opacity-70 hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sticky Bulk Actions Bar */}
      {selectedDriverIds.length > 0 && (
        <div className="bg-primary px-4 py-2.5 rounded-xl flex items-center justify-between text-white shadow-soft shrink-0">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-semibold px-2.5 py-0.5 rounded-[4px] bg-white/15 text-white text-[11px] border border-white/20">
              {selectedDriverIds.length} Drivers Selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="danger"
              className="bg-red-600 hover:bg-red-700 text-white font-bold border-none shadow-sm"
              leftIcon={<Trash2 className="w-3.5 h-3.5 text-white" />}
              onClick={() => setIsBulkDeleteModalOpen(true)}
            >
              Delete Selected ({selectedDriverIds.length})
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={() => setSelectedDriverIds([])}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {loading && <div className="text-center py-8 text-sm text-gray-500">Loading drivers...</div>}
      {error && <div className="text-red-700 dark:text-red-300 text-sm p-3 bg-red-500/10 border border-red-500/30 rounded-lg">{error}</div>}
      {!loading && !error && (
        <Table
          data={drivers}
          columns={columns}
          emptyMessage="No drivers registered yet"
          selectable
          selectedIds={selectedDriverIds}
          onToggleSelect={handleToggleSelectDriver}
          onSelectAll={handleSelectAllDrivers}
          getRowId={(d) => getDriverId(d)}
        />
      )}

      {/* Onboard Driver Modal */}
      {showOnboardModal && (
        <Modal
          title="Onboard New Fleet Driver"
          subtitle="Create driver user profile and operational credentials"
          isOpen={showOnboardModal}
          onClose={() => setShowOnboardModal(false)}
        >
          <form onSubmit={handleOnboardDriver} className="space-y-3">
            <Input
              label="Full Name"
              value={newDriver.name}
              onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })}
              placeholder="e.g. Ramesh Chandra Sethi"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Email Address"
                type="email"
                value={newDriver.email}
                onChange={(e) => setNewDriver({ ...newDriver, email: e.target.value })}
                placeholder="ramesh@smartroute.internal"
                required
              />
              <Input
                label="Phone Number"
                value={newDriver.phone}
                onChange={(e) => setNewDriver({ ...newDriver, phone: e.target.value })}
                placeholder="+91 94370 12345"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Commercial Driving License #"
                value={newDriver.licenseNumber}
                onChange={(e) => setNewDriver({ ...newDriver, licenseNumber: e.target.value })}
                placeholder="OD-02-2023-0091823"
                required
              />
              <Input
                label="Initial Password"
                type="password"
                value={newDriver.password}
                onChange={(e) => setNewDriver({ ...newDriver, password: e.target.value })}
                placeholder="Default: driver123"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant">
              <Button variant="outline" size="sm" type="button" onClick={() => setShowOnboardModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" isLoading={onboarding} leftIcon={<UserPlus className="w-3.5 h-3.5" />}>
                Complete Onboarding
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Bulk Import Drivers CSV Modal */}
      {showCsvModal && (
        <Modal
          title="Bulk Import Drivers via CSV"
          subtitle="Upload or paste structured comma-separated data to register multiple drivers"
          isOpen={showCsvModal}
          onClose={() => setShowCsvModal(false)}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-on-surface-variant font-medium">CSV Format: name,email,phone,licenseNumber,password,availability</span>
              <div className="flex items-center gap-3">
                <a
                  href="/sample_data/drivers.csv"
                  download="drivers.csv"
                  className="text-secondary hover:underline flex items-center gap-1 font-semibold text-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Download Sample CSV
                </a>
                <button
                  type="button"
                  onClick={loadSampleCsv}
                  className="text-secondary hover:underline flex items-center gap-1 font-semibold"
                >
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
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder="name,email,phone,licenseNumber,password&#10;Ramesh Chandra,ramesh@smartroute.internal,+91 94370 12345,OD-02-DL-2024-001,driver123"
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
                <span>Dry Run Only (Validate headers & schema without writing)</span>
              </label>
            </div>

            {/* Import Summary Results */}
            {importResult && (
              <div className="p-3 rounded-lg border bg-surface-low text-xs space-y-1.5 font-mono">
                <div className="font-semibold text-on-surface flex items-center gap-1.5">
                  {importResult.errors && importResult.errors.length > 0 ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  )}
                  Import Result: {importResult.dryRun ? 'Validation Check' : 'Committed'}
                </div>
                {importResult.created !== undefined && (
                  <div>
                    {importResult.dryRun ? 'Valid Rows: ' : 'Created Drivers: '}
                    <span className="font-bold text-emerald-600">{importResult.created}</span>
                  </div>
                )}
                {importResult.totalRows !== undefined && <div>Total Rows: {importResult.totalRows}</div>}
                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="text-red-600 pt-1">
                    <span className="font-bold">Errors ({importResult.errors.length}):</span>
                    <ul className="list-disc list-inside mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                      {importResult.errors.slice(0, 5).map((err: any, i: number) => (
                        <li key={i}>
                          {err.row ? `Row ${err.row}: ` : ''}
                          {err.message}
                        </li>
                      ))}
                    </ul>
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
                disabled={!csvContent.trim()}
                isLoading={importing}
                onClick={handleExecuteCsvImport}
                leftIcon={<UploadCloud className="w-3.5 h-3.5" />}
              >
                {isDryRun ? 'Run Validation' : 'Import Drivers'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Driver Modal */}
      {editingDriver && (
        <Modal
          title={`Edit Driver — ${getDriverName(editingDriver)}`}
          subtitle="Update driver credentials and operational status"
          isOpen={Boolean(editingDriver)}
          onClose={() => setEditingDriver(null)}
        >
          <form onSubmit={handleSaveDriverEdit} className="space-y-4">
            {editError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}
            <Input
              label="Full Name"
              value={editDriverForm.name}
              onChange={(e) => setEditDriverForm({ ...editDriverForm, name: e.target.value })}
              required
            />
            <Input
              label="Email Address"
              type="email"
              value={editDriverForm.email}
              onChange={(e) => setEditDriverForm({ ...editDriverForm, email: e.target.value })}
              placeholder="driver@smartroute.internal"
            />
            <Input
              label="Phone Number"
              value={editDriverForm.phone}
              onChange={(e) => setEditDriverForm({ ...editDriverForm, phone: e.target.value })}
              placeholder="+91 94370 12345"
              required
            />
            <Input
              label="Commercial Driving License"
              value={editDriverForm.licenseNumber}
              onChange={(e) => setEditDriverForm({ ...editDriverForm, licenseNumber: e.target.value.toUpperCase() })}
              placeholder="OD-02-DL-2024-001"
              required
            />
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Availability Status
              </label>
              <select
                value={editDriverForm.availability}
                onChange={(e) => setEditDriverForm({ ...editDriverForm, availability: e.target.value })}
                className="w-full text-xs p-2.5 rounded-lg border border-outline-variant bg-surface-lowest text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="ON_DUTY">ON_DUTY</option>
                <option value="IN_TRANSIT">IN_TRANSIT</option>
                <option value="ON_BREAK">ON_BREAK</option>
                <option value="OFF_DUTY">OFF_DUTY</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Rating (1.0 – 5.0)
              </label>
              <input
                type="number"
                min="1.0"
                max="5.0"
                step="0.1"
                value={editDriverForm.rating}
                onChange={(e) => setEditDriverForm({ ...editDriverForm, rating: parseFloat(e.target.value) || 5.0 })}
                className="w-full text-xs p-2.5 rounded-lg border border-outline-variant bg-surface-lowest text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={editLoading}
                onClick={() => setEditingDriver(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={editLoading}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Driver Confirmation Modal */}
      {deletingDriver && (
        <Modal
          title={`Delete Driver — ${getDriverName(deletingDriver)}`}
          subtitle="Permanently remove driver profile"
          isOpen={Boolean(deletingDriver)}
          onClose={() => setDeletingDriver(null)}
        >
          <div className="space-y-4 text-sm">
            <p className="text-on-surface-variant">
              Are you sure you want to delete driver{' '}
              <span className="font-semibold text-on-surface">{getDriverName(deletingDriver)}</span>{' '}
              (<span className="font-mono">{deletingDriver.licenseNumber}</span>)? This will remove the driver and associated user accounts, and unpair any assigned vehicle.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={deleteLoading}
                onClick={() => setDeletingDriver(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={deleteLoading}
                onClick={handleConfirmDelete}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Delete Driver
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk Delete Drivers Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <Modal
          title={`Delete ${selectedDriverIds.length} Selected Driver${selectedDriverIds.length === 1 ? '' : 's'}`}
          subtitle="Permanently remove selected driver profiles"
          isOpen={isBulkDeleteModalOpen}
          onClose={() => !isBulkDeleting && setIsBulkDeleteModalOpen(false)}
        >
          <div className="space-y-4 text-sm">
            <p className="text-on-surface">
              Are you sure you want to delete <strong className="text-red-600 font-semibold">{selectedDriverIds.length}</strong> selected driver profile{selectedDriverIds.length === 1 ? '' : 's'}?
            </p>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-300">
              <strong>Operational Note:</strong> Drivers currently assigned to active routes or open shifts cannot be deleted and will trigger active operation conflicts. Assigned vehicles for deleted drivers will be unlinked automatically.
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
                onClick={handleConfirmBulkDeleteDrivers}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Delete {selectedDriverIds.length} Driver{selectedDriverIds.length === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Active Operation Conflict Modal */}
      <ActiveOperationConflictModal
        isOpen={conflictModalOpen}
        onClose={() => {
          setConflictModalOpen(false);
          setActiveConflict(null);
        }}
        conflict={activeConflict?.details || null}
        onConfirmReassignAndDelete={handleReassignAndDelete}
        isSubmitting={isRescuing}
      />
    </div>
  );
};
