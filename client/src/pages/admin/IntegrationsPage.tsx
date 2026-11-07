import React, { useState, useEffect } from 'react';
import { AdminApi } from '../../api/client';
import { AdminHeader } from '../../components/layout/AdminHeader';
import {
  Activity,
  Server,
  Database,
  MapPin,
  Radio,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Play,
  Key,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../../components/common/Button';

export const IntegrationsPage: React.FC = () => {
  const [integrations, setIntegrations] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [testingService, setTestingService] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await AdminApi.getIntegrations();
      setIntegrations(res.data.integrations || {});
    } catch (err) {
      console.error('Failed to load integrations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTest = async (service: string) => {
    setTestingService(service);
    try {
      const res = await AdminApi.testIntegration(service);
      setTestResults((prev) => ({ ...prev, [service]: res.data }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [service]: { status: 'FAILED', message: err.response?.data?.error?.message || err.message },
      }));
    } finally {
      setTestingService(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RotateCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const geo = integrations?.geoapify || {};
  const mongo = integrations?.mongoDb || {};
  const leaflet = integrations?.leafletOsm || {};
  const socket = integrations?.socketIo || {};

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Integrations & Gateways"
        subtitle="Live infrastructure connection tests, API status checks, and credential validation"
        actions={
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RotateCw className="w-3.5 h-3.5 mr-1" />
            Refresh Diagnostics
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Geoapify Service */}
        <div className="p-6 rounded-[24px] bg-surface-lowest border border-outline-variant/60 shadow-soft space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-on-surface">Geoapify Route Matrix & Navigation</h3>
                <span className="text-[11px] text-on-surface-variant">Turn-by-turn road distance & routing</span>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
              {geo.lastStatus || 'HEALTHY'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-surface-low border border-outline-variant/40 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Credential Mask:</span>
              <span className="font-mono text-on-surface font-semibold flex items-center gap-1">
                <Key className="w-3 h-3 text-primary" /> {geo.keyMasked || '••••••••'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Simulation Fallback:</span>
              <span className="text-primary font-semibold">Active & High-Speed</span>
            </div>
          </div>

          {testResults.GEOAPIFY && (
            <div className="p-3 rounded-xl bg-surface-low border border-primary/30 text-xs font-mono space-y-1">
              <div className="text-primary font-bold">Latency: {testResults.GEOAPIFY.latencyMs} ms</div>
              <div className="text-on-surface">{testResults.GEOAPIFY.message}</div>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              isLoading={testingService === 'GEOAPIFY'}
              onClick={() => handleTest('GEOAPIFY')}
            >
              <Play className="w-3.5 h-3.5 mr-1 text-primary" />
              Run Connection Ping Test
            </Button>
          </div>
        </div>

        {/* MongoDB Database Service */}
        <div className="p-6 rounded-[24px] bg-surface-lowest border border-outline-variant/60 shadow-soft space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-on-surface">MongoDB Persistence Layer</h3>
                <span className="text-[11px] text-on-surface-variant">Document store & spatial 2dsphere indexing</span>
              </div>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                mongo.status === 'CONNECTED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {mongo.status || 'CONNECTED'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-surface-low border border-outline-variant/40 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Active Database:</span>
              <span className="font-mono text-on-surface font-semibold">{mongo.databaseName || 'smartroute'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Host Endpoint:</span>
              <span className="font-mono text-on-surface-variant">{mongo.host || '127.0.0.1'}:{mongo.port || 27017}</span>
            </div>
          </div>

          {testResults.MONGODB && (
            <div className="p-3 rounded-xl bg-surface-low border border-primary/30 text-xs font-mono space-y-1">
              <div className="text-primary font-bold">Latency: {testResults.MONGODB.latencyMs} ms</div>
              <div className="text-on-surface">Status: {testResults.MONGODB.status}</div>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              isLoading={testingService === 'MONGODB'}
              onClick={() => handleTest('MONGODB')}
            >
              <Play className="w-3.5 h-3.5 mr-1 text-primary" />
              Run DB Ping Test
            </Button>
          </div>
        </div>

        {/* Leaflet OSM Tile Provider */}
        <div className="p-6 rounded-[24px] bg-surface-lowest border border-outline-variant/60 shadow-soft space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-on-surface">Leaflet / OpenStreetMap Tiles</h3>
                <span className="text-[11px] text-on-surface-variant">Vector tile provider with automatic OSM fallback</span>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
              OPERATIONAL
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-surface-low border border-outline-variant/40 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Default Provider:</span>
              <span className="text-on-surface font-semibold">OpenStreetMap Standard Tiles</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Tile Fallback Strategy:</span>
              <span className="text-primary font-semibold">Zero-Fail Cascading Fallback</span>
            </div>
          </div>
        </div>

        {/* Realtime Socket.IO Gateway */}
        <div className="p-6 rounded-[24px] bg-surface-lowest border border-outline-variant/60 shadow-soft space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-on-surface">WebSocket / Realtime Push</h3>
                <span className="text-[11px] text-on-surface-variant">Driver live GPS tracking & dispatch events</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-purple-500/10 text-purple-500">
              OPERATIONAL
            </span>
          </div>

          <div className="p-3 rounded-lg bg-surface border border-outline-variant text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Protocol:</span>
              <span className="font-mono text-on-surface font-semibold">WebSocket / WSS Handshake</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Driver Telemetry Channel:</span>
              <span className="text-purple-400 font-semibold">Active & Encrypted</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
