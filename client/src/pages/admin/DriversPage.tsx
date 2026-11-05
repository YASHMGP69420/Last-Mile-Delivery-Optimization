import React, { useEffect, useState, useCallback } from 'react';
import { FleetApi } from '../../api/client';
import { Driver, Vehicle } from '../../types';
import { AdminHeader } from '../../components/layout/AdminHeader';
import { Table } from '../../components/common/Table';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { UserCheck, UserX, RefreshCw, UserPlus, UploadCloud, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';

export const DriversPage: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

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
      setActionMsg('✅ Vehicle assigned successfully');
      setShowAssignModal(false);
      setSelectedDriverId(null);
      setSelectedVehicleId('');
      fetchData();
    } catch (e: any) {
      setActionMsg(`❌ ${e?.response?.data?.message || e.message || 'Assignment failed'}`);
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (driverId: string) => {
    try {
      await FleetApi.unassignVehicle(driverId);
      setActionMsg('✅ Vehicle unassigned successfully');
      fetchData();
    } catch (e: any) {
      setActionMsg(`❌ ${e?.response?.data?.message || e.message || 'Unassignment failed'}`);
    }
  };

  const handleOnboardDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriver.name || !newDriver.email || !newDriver.phone || !newDriver.licenseNumber) {
      setActionMsg('❌ All fields are required for driver onboarding');
      return;
    }
    setOnboarding(true);
    try {
      await FleetApi.createDriver(newDriver);
      setActionMsg(`✅ Driver ${newDriver.name} onboarded successfully!`);
      setShowOnboardModal(false);
      setNewDriver({ name: '', email: '', phone: '', licenseNumber: '', password: '' });
      fetchData();
    } catch (e: any) {
      setActionMsg(`❌ ${e?.response?.data?.error?.message || e?.response?.data?.message || 'Driver onboarding failed'}`);
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
        setActionMsg(`✅ Successfully imported ${res.data.created} drivers!`);
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
              : d.availability === 'ON_BREAK'
              ? 'bg-orange-100 text-orange-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {d.availability}
        </span>
      ),
    },
    { header: 'Rating', accessor: (d: Driver) => `${d.rating?.toFixed(1) || '—'} ★` },
    { header: 'Assigned Vehicle', accessor: (d: Driver) => getAssignedVehicle(d) },
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
    <div className="flex flex-col h-full p-4 space-y-4">
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
          className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
            actionMsg.startsWith('✅') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg(null)} className="ml-3 underline text-xs">
            Dismiss
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
