import React, { useEffect, useState } from 'react';
import { FleetApi } from '../../api/client';
import { Vehicle, Fleet } from '../../types';
import { AdminHeader } from '../../components/layout/AdminHeader';
import { Table } from '../../components/common/Table';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Truck, Plus, Users, UploadCloud, CheckCircle2, AlertTriangle, FileText, RotateCw } from 'lucide-react';

type TabId = 'vehicles' | 'fleets';

export const FleetsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('vehicles');

  // Vehicle state
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);

  // Fleet state
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [fleetsLoading, setFleetsLoading] = useState(true);
  const [fleetsError, setFleetsError] = useState<string | null>(null);

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

  // Create fleet modal
  const [showCreateFleet, setShowCreateFleet] = useState(false);
  const [newFleet, setNewFleet] = useState({ name: '', description: '' });
  const [creatingFleet, setCreatingFleet] = useState(false);

  // CSV Import Modal (shared for Vehicle or Fleet depending on active tab)
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

  const fetchFleets = async () => {
    setFleetsLoading(true);
    setFleetsError(null);
    try {
      const res = await FleetApi.list();
      setFleets(res.data.fleets || []);
    } catch (e: any) {
      setFleetsError(e?.response?.data?.message || e.message || 'Failed to load fleets');
    } finally {
      setFleetsLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
    fetchFleets();
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

  const handleCreateFleet = async () => {
    setCreatingFleet(true);
    try {
      await FleetApi.create({ name: newFleet.name, description: newFleet.description });
      setShowCreateFleet(false);
      setNewFleet({ name: '', description: '' });
      setActionMsg({ text: `Fleet '${newFleet.name}' created successfully!`, type: 'success' });
      fetchFleets();
    } catch (e: any) {
      setFleetsError(e?.response?.data?.error?.message || e?.response?.data?.message || 'Failed to create fleet');
    } finally {
      setCreatingFleet(false);
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
    if (activeTab === 'vehicles') {
      setCsvContent(
        `vehicleId,makeModel,type,capacityKg,fuelType,kmPerLitre\nOD-02-AX-9901,Tata Ace Gold,Van,750,Diesel,14\nOD-02-BX-9902,Mahindra Treo Zor,Van,550,Electric,0\nOD-02-CX-9903,Hero Electric Nyx,Bike,120,Electric,0`
      );
    } else {
      setCsvContent(
        `name,description,ownerEmail\nBhubaneswar North Fleet,Suburban distribution cluster,admin@example.com\nCuttack Express Fleet,Inter-city arterial freight line,admin@example.com`
      );
    }
    setImportResult(null);
  };

  const handleExecuteCsvImport = async () => {
    if (!csvContent.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      if (activeTab === 'vehicles') {
        const res = await FleetApi.importVehicleCsv(csvContent, { dryRun: isDryRun });
        setImportResult(res.data);
        if (!isDryRun) {
          fetchVehicles();
          setActionMsg({ text: 'Vehicles imported successfully!', type: 'success' });
        }
      } else {
        const res = await FleetApi.importCsv(csvContent, { dryRun: isDryRun });
        setImportResult(res.data);
        if (!isDryRun) {
          fetchFleets();
          setActionMsg({ text: 'Fleets imported successfully!', type: 'success' });
        }
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

  const fleetColumns = [
    { header: 'Fleet Name', accessor: (f: Fleet) => f.name },
    { header: 'Description', accessor: (f: Fleet) => f.description || '—' },
    {
      header: 'Owner',
      accessor: (f: Fleet) => {
        if (!f.ownerId) return <span className="text-gray-400">—</span>;
        if (typeof f.ownerId === 'string') return f.ownerId;
        return (f.ownerId as any)?.name || (f.ownerId as any)?.email || 'Unknown';
      },
    },
    { header: 'Created', accessor: (f: Fleet) => (f.createdAt ? new Date(f.createdAt).toLocaleDateString() : '—') },
  ];

  const tabs: { id: TabId; label: string; icon: typeof Truck }[] = [
    { id: 'vehicles', label: 'Vehicles', icon: Truck },
    { id: 'fleets', label: 'Fleets', icon: Users },
  ];

  return (
    <div className="flex flex-col h-full space-y-4">
      <AdminHeader
        title="Fleet & Vehicle Operations"
        subtitle="Manage logistics assets, vehicular specifications, and corporate fleets"
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
              Import {activeTab === 'vehicles' ? 'Vehicles' : 'Fleets'} CSV
            </Button>
            {activeTab === 'vehicles' && (
              <Button size="sm" variant="primary" onClick={() => setShowCreateVehicle(true)} leftIcon={<Plus className="w-3.5 h-3.5" />}>
                Add Vehicle
              </Button>
            )}
            {activeTab === 'fleets' && (
              <Button size="sm" variant="primary" onClick={() => setShowCreateFleet(true)} leftIcon={<Plus className="w-3.5 h-3.5" />}>
                Add Fleet
              </Button>
            )}
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

      {/* Tab Capsule Segmented Bar */}
      <div className="flex items-center gap-2 p-1.5 rounded-full bg-surface-lowest border border-outline-variant/60 shadow-soft w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setActionMsg(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-primary text-white shadow-emerald font-bold scale-[1.02]'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-low'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span
                className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-surface-low text-on-surface-variant'
                }`}
              >
                {tab.id === 'vehicles' ? vehicles.length : fleets.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'vehicles' && (
        <>
          {vehiclesLoading && (
            <div className="flex flex-col items-center justify-center py-16 bg-surface-lowest rounded-[24px] border border-outline-variant/60 shadow-soft space-y-2">
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
        </>
      )}

      {activeTab === 'fleets' && (
        <>
          {fleetsLoading && (
            <div className="flex flex-col items-center justify-center py-16 bg-surface-lowest rounded-[24px] border border-outline-variant/60 shadow-soft space-y-2">
              <RotateCw className="w-7 h-7 text-primary animate-spin" />
              <span className="text-xs font-semibold text-on-surface-variant">Loading fleet partitions...</span>
            </div>
          )}
          {fleetsError && (
            <div className="text-red-700 text-xs p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{fleetsError}</span>
            </div>
          )}
          {!fleetsLoading && !fleetsError && (
            <Table data={fleets} columns={fleetColumns} emptyMessage="No fleets created yet" />
          )}
        </>
      )}

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

      {/* Create Fleet Modal */}
      {showCreateFleet && (
        <Modal title="Create New Fleet Group" isOpen={showCreateFleet} onClose={() => setShowCreateFleet(false)}>
          <div className="space-y-3">
            <Input
              label="Fleet Name"
              value={newFleet.name}
              onChange={(e) => setNewFleet({ ...newFleet, name: e.target.value })}
              placeholder="e.g., Rasulgarh High-Density Express"
              required
            />
            <Input
              label="Description"
              value={newFleet.description}
              onChange={(e) => setNewFleet({ ...newFleet, description: e.target.value })}
              placeholder="Optional operational brief"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowCreateFleet(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" isLoading={creatingFleet} onClick={handleCreateFleet}>
                Create Fleet
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk CSV Import Modal */}
      {showCsvModal && (
        <Modal
          title={`Bulk Import ${activeTab === 'vehicles' ? 'Vehicles' : 'Fleets'} via CSV`}
          subtitle={`Upload or paste structured comma-separated data to register ${activeTab}`}
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
