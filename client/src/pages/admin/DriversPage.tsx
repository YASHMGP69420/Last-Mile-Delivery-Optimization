import React, { useEffect, useState, useCallback } from 'react';
import { FleetApi } from '../../api/client';
import { Driver, Vehicle } from '../../types';
import { AdminHeader } from '../../components/layout/AdminHeader';
import { Table } from '../../components/common/Table';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { UserCheck, UserX, RefreshCw, UserPlus, UploadCloud, CheckCircle2, AlertTriangle, AlertCircle, FileText, Star, X } from 'lucide-react';

export const DriversPage: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Assign modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  // Onboard driver modal
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [newDriver, setNewDriver] = useState({
    name: '',
    email: '',
    phone: '',
    licenseNumber: '',
    password: '',
    assignedVehicleId: '',
  });
  const [onboarding, setOnboarding] = useState(false);

  // Driver CSV Import modal
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [isDryRun, setIsDryRun] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

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

  const handleAssign = async () => {
    if (!selectedDriverId || !selectedVehicleId) return;
    setAssigning(true);
    try {
      await FleetApi.assignVehicle(selectedDriverId, selectedVehicleId);
      setActionMsg({ type: 'success', text: 'Vehicle assigned successfully' });
      setShowAssignModal(false);
      setSelectedDriverId(null);
      setSelectedVehicleId('');
      fetchData();
    } catch (e: any) {
      setActionMsg({
        type: 'error',
        text: e?.friendlyMessage || e?.response?.data?.error?.message || e?.response?.data?.message || e.message || 'Assignment failed',
      });
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (driverId: string) => {
    try {
      await FleetApi.unassignVehicle(driverId);
      setActionMsg({ type: 'success', text: 'Vehicle unassigned successfully' });
      fetchData();
    } catch (e: any) {
      setActionMsg({
        type: 'error',
        text: e?.friendlyMessage || e?.response?.data?.error?.message || e?.response?.data?.message || e.message || 'Unassignment failed',
      });
    }
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
      const createdDriverId = res.data?.driver?.id || (res.data?.driver as any)?._id || (res.data as any)?.id;
      if (newDriver.assignedVehicleId && createdDriverId) {
        try {
          await FleetApi.assignVehicle(createdDriverId, newDriver.assignedVehicleId);
        } catch (assignErr) {
          console.warn('Auto vehicle assignment error:', assignErr);
        }
      }
      setActionMsg({ type: 'success', text: `Driver ${newDriver.name} onboarded successfully.` });
      setShowOnboardModal(false);
      setNewDriver({ name: '', email: '', phone: '', licenseNumber: '', password: '', assignedVehicleId: '' });
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
      `name,email,phone,licenseNumber,password\nRamesh Chandra,ramesh.chandra@smartroute.internal,+91 94370 12345,OD-02-DL-2024-001,driver123\nBikash Mohanty,bikash.mohanty@smartroute.internal,+91 94370 67890,OD-02-DL-2024-002,driver123\nSunil Kumar Panda,sunil.panda@smartroute.internal,+91 94371 11223,OD-02-DL-2024-003,driver123`
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
          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
            d.availability === 'AVAILABLE'
              ? 'bg-emerald-100 text-emerald-700'
              : d.availability === 'ON_DUTY'
              ? 'bg-blue-100 text-blue-700'
              : d.availability === 'IN_TRANSIT'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-gray-100 text-gray-600'
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
        const dId = getDriverId(d);
        const hasVehicle = !!d.assignedVehicleId;
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setSelectedDriverId(dId);
                setShowAssignModal(true);
              }}
              className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50 transition-colors"
              title="Assign Vehicle"
            >
              <UserCheck className="w-4 h-4" />
            </button>
            {hasVehicle && (
              <button
                onClick={() => handleUnassign(dId)}
                className="p-1.5 rounded-md text-red-600 hover:bg-red-50 transition-colors"
                title="Unassign Vehicle"
              >
                <UserX className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col h-full space-y-4">
      <AdminHeader
        title="Driver Management"
        subtitle="Onboard drivers, manage availability, and assign vehicles"
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

      {loading && <div className="text-center py-8 text-sm text-gray-500">Loading drivers...</div>}
      {error && <div className="text-red-500 text-sm p-3 bg-red-50 rounded-lg">{error}</div>}
      {!loading && !error && (
        <Table data={drivers} columns={columns} emptyMessage="No drivers registered yet" />
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
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Assign Vehicle to Driver (Optional)
              </label>
              <select
                value={newDriver.assignedVehicleId}
                onChange={(e) => setNewDriver({ ...newDriver, assignedVehicleId: e.target.value })}
                className="w-full text-xs rounded-xl border border-outline-variant bg-surface-lowest px-3 py-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">— No Vehicle Assigned Yet (Stage in Driver Pool) —</option>
                {availableVehicles.map((v) => (
                  <option key={(v as any)._id || v.id} value={(v as any)._id || v.id}>
                    {v.vehicleId} — {v.makeModel} ({v.type})
                  </option>
                ))}
              </select>
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

      {/* Assign Vehicle Modal */}
      {showAssignModal && (
        <Modal
          title="Assign Vehicle to Driver"
          subtitle="Pair an active delivery asset with driver shift"
          isOpen={showAssignModal}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedDriverId(null);
          }}
        >
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Select Available Vehicle</label>
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-outline-variant text-sm bg-surface-lowest text-on-surface"
              >
                <option value="">— Select a vehicle —</option>
                {availableVehicles.map((v) => (
                  <option key={(v as any)._id || v.id} value={(v as any)._id || v.id}>
                    {v.vehicleId} — {v.makeModel} ({v.type}, {v.availability})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedDriverId(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" disabled={!selectedVehicleId} isLoading={assigning} onClick={handleAssign}>
                Confirm Assignment
              </Button>
            </div>
          </div>
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
              <span className="text-on-surface-variant font-medium">CSV Format: name,email,phone,licenseNumber,password</span>
              <button
                type="button"
                onClick={loadSampleCsv}
                className="text-secondary hover:underline flex items-center gap-1 font-semibold"
              >
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
    </div>
  );
};
