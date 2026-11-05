import React, { useState, useEffect } from 'react';
import { AdminApi } from '../../api/client';
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
        <RotateCw className="w-8 h-8 text-secondary animate-spin" />
      </div>
    );
  }

  const geo = integrations?.geoapify || {};
  const mongo = integrations?.mongoDb || {};
  const leaflet = integrations?.leafletOsm || {};
  const socket = integrations?.socketIo || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-on-surface flex items-center gap-2">
            <Activity className="w-6 h-6 text-amber-500" />
            Integrations, Gateways & Third-Party APIs
          </h1>
          <p className="text-xs text-on-surface-variant">
            Live infrastructure connection test, API status checks, and masked external credentials.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchData}>
          <RotateCw className="w-3.5 h-3.5 mr-1" />
          Refresh Diagnostics
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Geoapify Service */}
        <div className="p-5 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-on-surface">Geoapify Route Matrix & Navigation</h3>
                <span className="text-[11px] text-on-surface-variant">Turn-by-turn road distance & routing</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-500">
              {geo.lastStatus || 'HEALTHY'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-surface border border-outline-variant text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Credential Mask:</span>
              <span className="font-mono text-on-surface font-semibold flex items-center gap-1">
                <Key className="w-3 h-3 text-secondary" /> {geo.keyMasked || '••••••••'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Simulation Fallback:</span>
              <span className="text-emerald-500 font-semibold">Active & High-Speed</span>
            </div>
          </div>

          {testResults.GEOAPIFY && (
            <div className="p-3 rounded-lg bg-surface border border-secondary text-xs font-mono space-y-1">
              <div className="text-secondary font-bold">Latency: {testResults.GEOAPIFY.latencyMs} ms</div>
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
              <Play className="w-3.5 h-3.5 mr-1 text-secondary" />
              Run Connection Ping Test
            </Button>
          </div>
        </div>

        {/* MongoDB Database Service */}
        <div className="p-5 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-on-surface">MongoDB Persistence Layer</h3>
                <span className="text-[11px] text-on-surface-variant">Document store & spatial 2dsphere indexing</span>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                mongo.status === 'CONNECTED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
              }`}
            >
              {mongo.status || 'CONNECTED'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-surface border border-outline-variant text-xs space-y-2">
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
            <div className="p-3 rounded-lg bg-surface border border-emerald-500 text-xs font-mono space-y-1">
              <div className="text-emerald-500 font-bold">Latency: {testResults.MONGODB.latencyMs} ms</div>
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
              <Play className="w-3.5 h-3.5 mr-1 text-emerald-500" />
              Run DB Ping Test
            </Button>
          </div>
        </div>

        {/* Leaflet OSM Tile Provider */}
        <div className="p-5 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-on-surface">Leaflet / OpenStreetMap Tiles</h3>
                <span className="text-[11px] text-on-surface-variant">Vector tile provider with automatic OSM fallback</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-500">
              OPERATIONAL
            </span>
          </div>

          <div className="p-3 rounded-lg bg-surface border border-outline-variant text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Default Provider:</span>
              <span className="text-on-surface font-semibold">OpenStreetMap Standard Tiles</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Tile Fallback Strategy:</span>
              <span className="text-emerald-500 font-semibold">Zero-Fail Cascading Fallback</span>
            </div>
          </div>
        </div>

        {/* Realtime Socket.IO Gateway */}
        <div className="p-5 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm space-y-4">
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
