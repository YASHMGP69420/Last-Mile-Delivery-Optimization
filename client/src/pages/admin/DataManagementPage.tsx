import React, { useState } from 'react';
import { AdminApi } from '../../api/client';
import {
  Database,
  Download,
  RotateCw,
  FileText,
  Truck,
  Users,
  Package,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../../components/common/Button';

export const DataManagementPage: React.FC = () => {
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const handleExport = async (dataset: string) => {
    setIsExporting(dataset);
    setExportNotice(null);
    try {
      const res = await AdminApi.exportData(dataset);
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(res.data, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `smartroute_${dataset}_export_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setExportNotice(`Successfully exported ${(res as any).count || (res.data as any)?.length || 0} records for dataset '${dataset}'.`);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to export dataset');
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-on-surface flex items-center gap-2">
            <Database className="w-6 h-6 text-amber-500" />
            Data Governance & Backup Management
          </h1>
          <p className="text-xs text-on-surface-variant">
            Export operational datasets, review replication health, and audit historical backup retention.
          </p>
        </div>
      </div>

      {exportNotice && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-500 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-on-surface">Deliveries & Consignments Dataset</h2>
              <span className="text-[11px] text-on-surface-variant">Addresses, geo coordinates, status history, PODs</span>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant">
            Full operational consignment ledger including time windows, customer contacts, weights, and delivery exceptions.
          </p>
          <Button
            size="sm"
            variant="outline"
            isLoading={isExporting === 'deliveries'}
            onClick={() => handleExport('deliveries')}
          >
            <Download className="w-3.5 h-3.5 mr-1 text-blue-500" />
            Export Deliveries JSON
          </Button>
        </div>

        <div className="p-5 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-on-surface">Fleet Vehicles Registry</h2>
              <span className="text-[11px] text-on-surface-variant">Vehicle specifications, capacities, propulsion types</span>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant">
            Fleet assets, fuel efficiency curves (km/L and kWh/km), license plates, and maintenance status logs.
          </p>
          <Button
            size="sm"
            variant="outline"
            isLoading={isExporting === 'fleets'}
            onClick={() => handleExport('fleets')}
          >
            <Download className="w-3.5 h-3.5 mr-1 text-emerald-500" />
            Export Vehicles JSON
          </Button>
        </div>

        <div className="p-5 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-on-surface">Driver Roster & Profiles</h2>
              <span className="text-[11px] text-on-surface-variant">Commercial licenses, ratings, assignments</span>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant">
            Driver operational records, phone numbers, ratings, lifetime on-time delivery percentages, and vehicle pairings.
          </p>
          <Button
            size="sm"
            variant="outline"
            isLoading={isExporting === 'drivers'}
            onClick={() => handleExport('drivers')}
          >
            <Download className="w-3.5 h-3.5 mr-1 text-amber-500" />
            Export Drivers JSON
          </Button>
        </div>

        <div className="p-5 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-on-surface">System Audit Trail</h2>
              <span className="text-[11px] text-on-surface-variant">Immutable administrative mutations & dispatch events</span>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant">
            Comprehensive audit events with timestamps, actor IDs, previous/new state diffs, and mandatory override rationales.
          </p>
          <Button
            size="sm"
            variant="outline"
            isLoading={isExporting === 'audit-logs'}
            onClick={() => handleExport('audit-logs')}
          >
            <Download className="w-3.5 h-3.5 mr-1 text-purple-500" />
            Export Audit Trail JSON
          </Button>
        </div>
      </div>

      {/* Backup & Recovery Documentation */}
      <div className="p-5 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          Disaster Recovery & Point-in-Time Database Snapshots
        </h2>
        <div className="text-xs text-on-surface-variant space-y-2">
          <p>
            Database automated snapshots are performed on MongoDB with 2dsphere index preservation. To take a cold or point-in-time snapshot directly from the server environment:
          </p>
          <pre className="p-3 rounded-lg bg-surface border border-outline-variant font-mono text-[11px] text-on-surface overflow-x-auto">
            mongodump --uri="mongodb://127.0.0.1:27017/smartroute" --out=/backup/smartroute-$(date +%F)
          </pre>
          <p className="text-[11px]">
            Retention policy: 30-day continuous audit logging, with daily automated volume checkpoints.
          </p>
        </div>
      </div>
    </div>
  );
};
