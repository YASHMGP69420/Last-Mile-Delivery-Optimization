import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Truck, CheckCircle2, BatteryCharging, ArrowRight, ShieldCheck } from 'lucide-react';

interface LiveDriverFleetBoardProps {
  activeDriversCount?: number;
  totalVehicles?: number;
  availableVehicles?: number;
  maintenanceVehicles?: number;
}

export const LiveDriverFleetBoard: React.FC<LiveDriverFleetBoardProps> = ({
  activeDriversCount = 0,
  totalVehicles = 0,
  availableVehicles = 0,
  maintenanceVehicles = 0,
}) => {
  const navigate = useNavigate();

  // Representative active drivers on shift
  const sampleRoster = [
    { name: 'Rakesh Patnaik', vehicleId: 'OD-02-AX-1049', type: 'Cargo EV', status: 'In Transit' },
    { name: 'Soumya Mishra', vehicleId: 'OD-02-BV-4821', type: 'Tata Ace (Diesel)', status: 'Available' },
    { name: 'Amit Kumar Sahoo', vehicleId: 'OD-02-CX-7732', type: 'Cargo EV', status: 'In Transit' },
  ];

  return (
    <div className="bg-surface-lowest rounded-[28px] p-6 shadow-soft border border-outline-variant/60 flex flex-col justify-between space-y-5 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-sm">
            <Users className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-on-surface">Fleet Operators Board</h3>
            <p className="text-[11px] text-on-surface-variant font-mono">Shift A Active Roster</p>
          </div>
        </div>

        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
          {activeDriversCount} Drivers On Duty
        </span>
      </div>

      {/* 4 Stat Metrics Bento */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="p-3 rounded-2xl bg-surface-low border border-outline-variant/40">
          <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Available Vehicles</span>
          <span className="text-xl font-bold font-mono text-emerald mt-0.5 block tabular-nums">
            {availableVehicles}
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-surface-low border border-outline-variant/40">
          <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Total Fleet</span>
          <span className="text-xl font-bold font-mono text-on-surface mt-0.5 block tabular-nums">
            {totalVehicles}
          </span>
        </div>
      </div>

      {/* Driver Roster Snippet */}
      <div className="space-y-2 pt-1 border-t border-outline-variant/40">
        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block">
          Active Couriers On Route
        </span>

        <div className="space-y-2">
          {sampleRoster.map((d, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-2.5 rounded-xl bg-surface-low border border-outline-variant/40 text-xs"
            >
              <div className="space-y-0.5">
                <span className="font-semibold text-on-surface block">{d.name}</span>
                <span className="text-[10px] font-mono text-on-surface-variant flex items-center gap-1.5">
                  <Truck className="w-3 h-3 text-emerald" />
                  {d.vehicleId} • {d.type}
                </span>
              </div>

              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  d.status === 'In Transit'
                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                    : 'bg-emerald/10 text-emerald border border-emerald/30'
                }`}
              >
                {d.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Link */}
      <button
        onClick={() => navigate('/admin/drivers')}
        className="w-full py-2.5 px-4 rounded-xl bg-surface-low hover:bg-surface-container text-on-surface text-xs font-semibold flex items-center justify-center gap-2 border border-outline-variant/60 transition-all duration-200"
      >
        <span>Manage Complete Drivers Roster</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
