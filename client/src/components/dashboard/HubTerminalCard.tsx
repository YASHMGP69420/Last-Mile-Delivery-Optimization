import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Clock,
  Radio,
  Route,
  Layers,
  Navigation,
  FileSpreadsheet,
  Cpu,
} from 'lucide-react';

interface HubTerminalCardProps {
  systemHealth?: {
    backend?: { status: string };
    socketIo?: { status: string };
    geoapify?: { status: string };
  };
}

export const HubTerminalCard: React.FC<HubTerminalCardProps> = ({ systemHealth }) => {
  const navigate = useNavigate();

  const isSocketLive = systemHealth?.socketIo?.status === 'OPERATIONAL' || true;

  return (
    <div className="bg-surface-lowest rounded-[28px] p-6 shadow-soft border border-outline-variant/60 flex flex-col justify-between space-y-5 transition-colors">
      {/* Hub Depot Identity */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-sm">
              <MapPin className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-on-surface">Rasulgarh Central Hub</h3>
              <p className="text-[11px] text-on-surface-variant font-mono">Bhubaneswar Urban Terminal</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald/10 text-emerald text-[11px] font-mono border border-emerald/20">
            <Radio className="w-3 h-3 text-emerald animate-pulse" />
            <span>Telemetry Online</span>
          </div>
        </div>

        {/* Depot Details Bento */}
        <div className="p-3.5 rounded-2xl bg-surface-low border border-outline-variant/40 space-y-2 text-xs">
          <div className="flex items-center justify-between text-on-surface">
            <span className="text-on-surface-variant">Depot Location:</span>
            <span className="font-medium truncate max-w-[180px]">Plot 104/A, Industrial Estate</span>
          </div>
          <div className="flex items-center justify-between text-on-surface">
            <span className="text-on-surface-variant">Active Operations:</span>
            <span className="font-semibold text-primary">Shift A (08:00 - 17:00 IST)</span>
          </div>
          <div className="flex items-center justify-between text-on-surface">
            <span className="text-on-surface-variant">Optimization Heuristic:</span>
            <span className="font-mono text-[11px] text-on-surface font-semibold">2-Opt + EV First</span>
          </div>
        </div>
      </div>

      {/* Operational Dispatch Actions (4 functional buttons) */}
      <div className="space-y-2 pt-2 border-t border-outline-variant/40">
        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block">
          Dispatch Command Actions
        </span>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => navigate('/admin/optimizer')}
            className="p-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-emerald transition-all duration-200"
          >
            <Route className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Route Optimizer</span>
          </button>

          <button
            onClick={() => navigate('/admin/batches')}
            className="p-2.5 rounded-xl bg-surface-low hover:bg-surface-container text-on-surface text-xs font-semibold flex items-center justify-center gap-2 border border-outline-variant/60 transition-all duration-200"
          >
            <Layers className="w-3.5 h-3.5 stroke-[2.2] text-primary" />
            <span>Dispatch Batches</span>
          </button>

          <button
            onClick={() => navigate('/admin/tracking')}
            className="p-2.5 rounded-xl bg-surface-low hover:bg-surface-container text-on-surface text-xs font-semibold flex items-center justify-center gap-2 border border-outline-variant/60 transition-all duration-200"
          >
            <Navigation className="w-3.5 h-3.5 stroke-[2.2] text-blue-500" />
            <span>Live Telemetry</span>
          </button>

          <button
            onClick={() => navigate('/admin/deliveries')}
            className="p-2.5 rounded-xl bg-surface-low hover:bg-surface-container text-on-surface text-xs font-semibold flex items-center justify-center gap-2 border border-outline-variant/60 transition-all duration-200"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 stroke-[2.2] text-purple-500" />
            <span>Master Manifest</span>
          </button>
        </div>
      </div>
    </div>
  );
};
