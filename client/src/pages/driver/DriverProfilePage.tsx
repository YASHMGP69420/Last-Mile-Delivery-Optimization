import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DriverHudApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  UserCircle,
  Truck,
  MapPin,
  Phone,
  Mail,
  Award,
  TrendingUp,
  CheckCircle2,
  ShieldCheck,
  RotateCw,
  LogOut,
  LifeBuoy,
  FileText,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { ThemeToggle } from '../../components/common/ThemeToggle';

export const DriverProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const res = await DriverHudApi.getProfile();
      setProfile(res.data);
    } catch (err) {
      console.error('Failed to load driver profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RotateCw className="w-8 h-8 text-secondary animate-spin" />
      </div>
    );
  }

  const driver = profile?.driver || {};
  const perf = profile?.performance || {};

  return (
    <div className="space-y-4 pb-6">
      {/* Profile Card Header */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-primary to-slate-900 text-white shadow-xl border border-secondary/30 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center font-black text-lg text-white shadow-md">
            {driver.name ? driver.name.slice(0, 2).toUpperCase() : 'DR'}
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">{driver.name || 'Commercial Driver'}</h1>
            <p className="text-xs text-slate-300 font-mono">LIC: {driver.licenseNumber}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono font-bold">
                VERIFIED OPERATOR
              </span>
              <span className="text-xs text-amber-400 font-bold">★ {driver.rating?.toFixed(1) || '4.9'}</span>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-700/60 grid grid-cols-2 gap-2 text-xs text-slate-300">
          <div className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-secondary" />
            <span>{driver.phone}</span>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <Mail className="w-3.5 h-3.5 text-secondary" />
            <span className="truncate">{driver.email}</span>
          </div>
        </div>
      </div>

      {/* Lifetime Performance Statistics */}
      <div className="p-4 rounded-2xl bg-surface-lowest border border-outline-variant shadow-sm space-y-3">
        <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          Service Quality & Reliability Metrics
        </h2>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-surface border border-outline-variant">
            <span className="text-[10px] text-slate-400 block font-medium">On-Time Success Rate</span>
            <span className="text-xl font-black text-emerald-500">{perf.onTimeDeliveryPercentage ?? 100}%</span>
            <span className="text-[9px] text-on-surface-variant block">Based on dispatched commitments</span>
          </div>

          <div className="p-3 rounded-xl bg-surface border border-outline-variant">
            <span className="text-[10px] text-slate-400 block font-medium">Delivered Consignments</span>
            <span className="text-xl font-black text-on-surface">{perf.totalCompletedDeliveries ?? 0}</span>
            <span className="text-[9px] text-on-surface-variant block">Lifetime completed parcels</span>
          </div>

          <div className="p-3 rounded-xl bg-surface border border-outline-variant">
            <span className="text-[10px] text-slate-400 block font-medium">Completed Dispatches</span>
            <span className="text-xl font-black text-secondary">{perf.completedRuns ?? 0}</span>
            <span className="text-[9px] text-on-surface-variant block">Closed route runs</span>
          </div>

          <div className="p-3 rounded-xl bg-surface border border-outline-variant">
            <span className="text-[10px] text-slate-400 block font-medium">Pre-Trip Inspections</span>
            <span className="text-xl font-black text-amber-500">{perf.preTripInspectionsCompleted ?? 0}</span>
            <span className="text-[9px] text-on-surface-variant block">Vehicle checks passed</span>
          </div>
        </div>
      </div>

      {/* Quick Access Menu */}
      <div className="rounded-2xl bg-surface-lowest border border-outline-variant shadow-sm overflow-hidden divide-y divide-outline-variant text-xs">
        <button
          onClick={() => navigate('/driver/support')}
          className="w-full p-3.5 flex items-center justify-between text-on-surface hover:bg-surface transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <LifeBuoy className="w-4 h-4 text-red-500" />
            <span className="font-semibold">Field Support & Incident Reporting</span>
          </div>
          <span className="text-on-surface-variant">→</span>
        </button>

        <button
          onClick={() => navigate('/driver/vehicle-check')}
          className="w-full p-3.5 flex items-center justify-between text-on-surface hover:bg-surface transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Truck className="w-4 h-4 text-secondary" />
            <span className="font-semibold">Vehicle Safety Checklist</span>
          </div>
          <span className="text-on-surface-variant">→</span>
        </button>

        <div className="p-3.5 flex items-center justify-between text-on-surface">
          <span className="font-semibold">Display Appearance</span>
          <ThemeToggle />
        </div>
      </div>

      {/* Logout */}
      <Button
        variant="outline"
        onClick={logout}
        className="w-full border-red-500/30 text-red-500 hover:bg-red-500/10 font-bold py-2.5"
      >
        <LogOut className="w-4 h-4 mr-1.5" />
        Log Out of Driver Cockpit
      </Button>
    </div>
  );
};
