import React, { useEffect, useState } from 'react';
import { FleetApi } from '../../api/client';
import { Vehicle } from '../../types';
import { AdminHeader } from '../../components/layout/AdminHeader';
import { Table } from '../../components/common/Table';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Truck, Plus, UploadCloud, CheckCircle2, AlertTriangle, FileText, RotateCw } from 'lucide-react';

export const FleetsPage: React.FC = () => {
  // Vehicle state
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);

  // Action status message
  const [actionMsg, setActionMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Create vehicle modal
  const [showCreateVehicle, setShowCreateVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    vehicleId: '',
    makeModel: '',
    type: 'Van' as const,
    capacityKg: 500,
    fuelType: 'Diesel' as const,
    kmPerLitre: 12,
  });
  const [creating, setCreating] = useState(false);

  // CSV Import Modal for Vehicles
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [isDryRun, setIsDryRun] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const fetchVehicles = async () => {
    setVehiclesLoading(true);
    setVehiclesError(null);
    try {
      const res = await FleetApi.getVehicles();
      setVehicles(res.data.vehicles || []);
    } catch (e: any) {
      setVehiclesError(e?.response?.data?.message || e.message || 'Failed to load vehicles');
    } finally {
      setVehiclesLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const handleCreateVehicle = async () => {
    setCreating(true);
    try {
      const res = await FleetApi.createVehicle(newVehicle);
      if (res.success) {
        setShowCreateVehicle(false);
        setNewVehicle({ vehicleId: '', makeModel: '', type: 'Van', capacityKg: 500, fuelType: 'Diesel', kmPerLitre: 12 });
        setActionMsg({ text: `Vehicle ${newVehicle.vehicleId} registered successfully!`, type: 'success' });
        fetchVehicles();
      }
    } catch (e: any) {
      setVehiclesError(e?.response?.data?.error?.message || e?.response?.data?.message || 'Failed to create vehicle');
    } finally {
      setCreating(false);
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
      `vehicleId,makeModel,type,capacityKg,fuelType,kmPerLitre\nOD-02-AX-9901,Tata Ace Gold,Van,750,Diesel,14\nOD-02-BX-9902,Mahindra Treo Zor,Van,550,Electric,0\nOD-02-CX-9903,Hero Electric Nyx,Bike,120,Electric,0`
    );
    setImportResult(null);
  };

  const handleExecuteCsvImport = async () => {
    if (!csvContent.trim()) return;
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
      setImportResult({
        errors: [{ message: e?.response?.data?.error?.message || e?.message || 'Import failed' }],
      });
    } finally {
      setImporting(false);
    }
  };

  const vehicleColumns = [
    { header: 'License Plate', accessor: (v: Vehicle) => v.vehicleId },
    { header: 'Make / Model', accessor: (v: Vehicle) => v.makeModel },
    { header: 'Type', accessor: (v: Vehicle) => v.type },
    { header: 'Capacity (kg)', accessor: (v: Vehicle) => v.capacityKg },
    { header: 'Fuel', accessor: (v: Vehicle) => v.fuelType },
    {
      header: 'Status',
      accessor: (v: Vehicle) => <StatusBadge status={v.availability} size="sm" />,
    },
    {
      header: 'Assigned Driver',
      accessor: (v: Vehicle) => {
        if (!v.assignedDriverId) return <span className="text-gray-400">—</span>;
        if (typeof v.assignedDriverId === 'string') return v.assignedDriverId;
        return (v.assignedDriverId as any)?.licenseNumber || 'Assigned';
      },
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
              }}
              leftIcon={<UploadCloud className="w-3.5 h-3.5 text-primary" />}
            >
              Import Vehicles CSV
            </Button>
            <Button size="sm" variant="primary" onClick={() => setShowCreateVehicle(true)} leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Add Vehicle
            </Button>
          </div>
        }
      />

      {actionMsg && (
        <div
          className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
            actionMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
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
          <div className="text-red-700 text-xs p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
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
          <div className="space-y-3">
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
                  onChange={(e) => setNewVehicle({ ...newVehicle, type: e.target.value as any })}
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
                value={String(newVehicle.capacityKg)}
                onChange={(e) => setNewVehicle({ ...newVehicle, capacityKg: Number(e.target.value) })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Fuel Type</label>
                <select
                  value={newVehicle.fuelType}
                  onChange={(e) => setNewVehicle({ ...newVehicle, fuelType: e.target.value as any })}
                  className="w-full h-9 px-3 rounded-lg border border-outline-variant text-sm bg-surface-lowest text-on-surface"
                >
                  <option value="Petrol">Petrol</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Electric">Electric</option>
                </select>
              </div>
              <Input
                label="Efficiency (km/L or km/kWh)"
                type="number"
                value={String(newVehicle.kmPerLitre)}
                onChange={(e) => setNewVehicle({ ...newVehicle, kmPerLitre: Number(e.target.value) })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowCreateVehicle(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" isLoading={creating} onClick={handleCreateVehicle}>
                Register Vehicle
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
                onChange={(e) => setCsvContent(e.target.value)}
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
                  <div>Created / Verified: <span className="font-bold text-emerald-600">{importResult.created}</span></div>
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
                {isDryRun ? 'Run Dry-Run Check' : 'Import CSV Data'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
