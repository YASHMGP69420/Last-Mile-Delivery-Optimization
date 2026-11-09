import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Truck, ArrowRight } from 'lucide-react';

interface LiveDriverFleetBoardProps {
  activeDriversCount?: number;
  totalVehicles?: number;
  availableVehicles?: number;
  maintenanceVehicles?: number;
  drivers?: Array<{
    name: string;
    vehicleId?: string;
    type?: string;
    status: string;
  }>;
}

export const LiveDriverFleetBoard: React.FC<LiveDriverFleetBoardProps> = ({
  activeDriversCount = 0,
  totalVehicles = 0,
  availableVehicles = 0,
  maintenanceVehicles = 0,
  drivers = [],
}) => {
  const navigate = useNavigate();

  return (
    <div className="panel-card rounded-xl p-5 border border-outline-variant/60 dark:border-obsidian-750 flex flex-col justify-between space-y-4 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-surface-low dark:bg-obsidian-800 text-on-surface-variant dark:text-slate-300 flex items-center justify-center border border-outline-variant/40 dark:border-obsidian-700">
            <Users className="w-4 h-4 stroke-[2]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-on-surface dark:text-white">Fleet Operators</h3>
            <p className="text-[11px] text-on-surface-variant dark:text-slate-400">Active Shift Duty</p>
          </div>
        </div>

        <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-surface-low dark:bg-obsidian-800 text-on-surface dark:text-slate-300 border border-outline-variant/50 dark:border-obsidian-700">
          {activeDriversCount} on duty
        </span>
      </div>

      {/* 2 Stat Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="p-3 rounded-lg bg-surface-low dark:bg-obsidian-950/60 border border-outline-variant/40 dark:border-obsidian-750">
          <span className="text-[10px] uppercase font-medium text-on-surface-variant dark:text-slate-400 block">Available Vehicles</span>
          <span className="text-xl font-semibold font-mono text-emerald-500 dark:text-emerald-400 mt-0.5 block tabular-nums">
            {availableVehicles}
          </span>
        </div>

        <div className="p-3 rounded-lg bg-surface-low dark:bg-obsidian-950/60 border border-outline-variant/40 dark:border-obsidian-750">
          <span className="text-[10px] uppercase font-medium text-on-surface-variant dark:text-slate-400 block">Total Fleet</span>
          <span className="text-xl font-semibold font-mono text-on-surface dark:text-white mt-0.5 block tabular-nums">
            {totalVehicles}
          </span>
        </div>
      </div>

      {/* Driver Roster Snippet or Honest Empty State */}
      <div className="space-y-2 pt-1 border-t border-outline-variant/40 dark:border-obsidian-750">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant dark:text-slate-400 block">
          Active Couriers
        </span>

        {drivers.length > 0 ? (
          <div className="space-y-1.5">
            {drivers.map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2.5 rounded-lg bg-surface-low dark:bg-obsidian-950/60 border border-outline-variant/40 dark:border-obsidian-750 text-xs"
              >
                <div className="space-y-0.5">
                  <span className="font-medium text-on-surface dark:text-slate-200 block">{d.name}</span>
                  <span className="text-[10px] font-mono text-on-surface-variant dark:text-slate-400 flex items-center gap-1.5">
                    <Truck className="w-3 h-3 text-slate-400" />
                    {d.vehicleId || 'Assigned'}{d.type ? ` • ${d.type}` : ''}
                  </span>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    d.status === 'In Transit' || d.status === 'IN_TRANSIT'
                      ? 'bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  }`}
                >
                  {d.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4 text-center border border-dashed border-outline-variant/50 dark:border-obsidian-750 rounded-lg">
            <p className="text-xs text-on-surface-variant dark:text-slate-400">No couriers currently on route</p>
          </div>
        )}
      </div>

      {/* Action Link */}
      <button
        onClick={() => navigate('/admin/drivers')}
        className="w-full py-2 px-3 rounded-lg bg-surface-low dark:bg-obsidian-800 hover:bg-surface-container dark:hover:bg-obsidian-750 text-on-surface dark:text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 border border-outline-variant/60 dark:border-obsidian-700 transition-colors"
      >
        <span>Drivers Roster</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
