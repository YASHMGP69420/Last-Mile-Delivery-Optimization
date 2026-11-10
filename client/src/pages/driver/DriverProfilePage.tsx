import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DriverHudApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Truck,
  Phone,
  Mail,
  TrendingUp,
  RotateCw,
  LogOut,
  LifeBuoy,
  ChevronRight,
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
      <div className="flex-1 min-h-0 flex items-center justify-center p-8 bg-surface">
        <RotateCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const driver = profile?.driver || {};
  const perf = profile?.performance || {};

  return (
    <div className="flex-1 min-h-0 overflow-y-auto smooth-scroll overscroll-y-contain p-4 pb-24 space-y-4 select-none">
      {/* Profile Card Header */}
      <div className="p-6 rounded-xl bg-surface-lowest border border-outline-variant/60 shadow-sm space-y-4">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-lg text-primary shadow-sm">
            {driver.name ? driver.name.slice(0, 2).toUpperCase() : 'DR'}
          </div>
          <div>
            <h1 className="text-base font-bold text-on-surface leading-tight">{driver.name || 'Driver'}</h1>
            <p className="text-xs text-on-surface-variant font-mono">LIC: {driver.licenseNumber || '—'}</p>
          </div>
        </div>

        <div className="pt-3 border-t border-outline-variant/60 grid grid-cols-2 gap-2 text-xs text-on-surface-variant">
          <div className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-primary" />
            <span className="font-mono">{driver.phone || '—'}</span>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <Mail className="w-3.5 h-3.5 text-primary" />
            <span className="truncate">{driver.email || '—'}</span>
          </div>
        </div>
      </div>

      {/* Lifetime Performance Statistics */}
      <div className="p-5 rounded-xl bg-surface-lowest border border-outline-variant/60 shadow-sm space-y-4">
        <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          Performance Summary
        </h2>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-lg bg-surface border border-outline-variant/60">
            <span className="text-[10px] text-on-surface-variant block font-medium">Delivery Completion Rate</span>
            <span className="text-xl font-black text-emerald-700">
              {perf.totalCompletedDeliveries + perf.totalFailedDeliveries > 0 && perf.onTimeDeliveryPercentage != null
                ? `${perf.onTimeDeliveryPercentage}%`
                : '—'}
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-surface border border-outline-variant/60">
            <span className="text-[10px] text-on-surface-variant block font-medium">Delivered Consignments</span>
            <span className="text-xl font-black text-on-surface">{perf.totalCompletedDeliveries ?? 0}</span>
          </div>

          <div className="p-3.5 rounded-lg bg-surface border border-outline-variant/60">
            <span className="text-[10px] text-on-surface-variant block font-medium">Completed Dispatches</span>
            <span className="text-xl font-black text-primary">{perf.completedRuns ?? 0}</span>
          </div>

          <div className="p-3.5 rounded-lg bg-surface border border-outline-variant/60">
            <span className="text-[10px] text-on-surface-variant block font-medium">Pre-Trip Inspections</span>
            <span className="text-xl font-black text-amber-600">{perf.preTripInspectionsCompleted ?? 0}</span>
          </div>

          <div className="p-3.5 rounded-lg bg-surface border border-outline-variant/60">
            <span className="text-[10px] text-on-surface-variant block font-medium">Kilometers Saved</span>
            <span className="text-xl font-black text-emerald-500 font-mono">{perf.kmSaved ?? 0} km</span>
          </div>

          <div className="p-3.5 rounded-lg bg-surface border border-outline-variant/60">
            <span className="text-[10px] text-on-surface-variant block font-medium">Fuel / Energy Saved</span>
            <span className="text-lg font-black text-emerald-500 font-mono block">
              {perf.fuelSavedLitres ?? 0} L{perf.energySavedKwh ? ` + ${perf.energySavedKwh} kWh` : ''}
            </span>
            <span className="text-[10px] text-on-surface-variant font-mono">
              ₹{(perf.costSavedInr ?? 0).toLocaleString('en-IN')} saved
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-surface border border-outline-variant/60">
            <span className="text-[10px] text-on-surface-variant block font-medium">Odometer Driven</span>
            <span className="text-lg font-black text-on-surface font-mono">{perf.actualDistanceKm ?? 0} km</span>
          </div>

          <div className="p-3.5 rounded-lg bg-surface border border-outline-variant/60">
            <span className="text-[10px] text-on-surface-variant block font-medium">Fuel / Charge Used</span>
            <span className="text-lg font-black text-on-surface font-mono">
              {(perf.actualFuelUsedLitres ?? 0) > 0
                ? `${perf.actualFuelUsedLitres} L`
                : `${perf.actualChargeUsedPct ?? 0}%`}
            </span>
          </div>
        </div>

        {Array.isArray(perf.recentShifts) && perf.recentShifts.length > 0 && (
          <div className="pt-3 border-t border-outline-variant/60 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block">
              Recent Shift Odometer & Usage Logs
            </span>
            <div className="space-y-1.5">
              {perf.recentShifts.map((s: any) => (
                <div
                  key={s.id}
                  className="p-2.5 rounded-lg bg-surface border border-outline-variant/40 flex items-center justify-between text-xs font-mono"
                >
                  <div>
                    <span className="text-on-surface font-semibold block">
                      {s.startOdometerKm ?? '—'} → {s.endOdometerKm ?? '—'} km
                    </span>
                    <span className="text-[10px] text-on-surface-variant">
                      {s.startTime} - {s.endTime}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-primary font-bold block">{s.actualDistanceKm ?? 0} km driven</span>
                    <span className="text-[10px] text-on-surface-variant">
                      Used {s.actualFuelOrChargeUsed ?? 0} {s.fuelUnit || 'L'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Access Menu */}
      <div className="rounded-xl bg-surface-lowest border border-outline-variant/60 shadow-sm overflow-hidden divide-y divide-outline-variant/60 text-xs">
        <button
          onClick={() => navigate('/driver/support')}
          aria-label="Navigate to Field Support and Incident Reporting"
          className="w-full p-4 flex items-center justify-between text-on-surface hover:bg-surface transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <LifeBuoy className="w-4 h-4 text-red-500" />
            <span className="font-semibold">Field Support & Incident Reporting</span>
          </div>
          <ChevronRight className="w-4 h-4 text-on-surface-variant" />
        </button>

        <button
          onClick={() => navigate('/driver/vehicle-check')}
          aria-label="Navigate to Pre-Trip Vehicle Safety Checklist"
          className="w-full p-4 flex items-center justify-between text-on-surface hover:bg-surface transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Truck className="w-4 h-4 text-primary" />
            <span className="font-semibold">Vehicle Safety Checklist</span>
          </div>
          <ChevronRight className="w-4 h-4 text-on-surface-variant" />
        </button>

        <div className="p-4 flex items-center justify-between text-on-surface">
          <span className="font-semibold">Display Appearance</span>
          <ThemeToggle />
        </div>
      </div>

      {/* Logout */}
      <Button
        variant="outline"
        onClick={logout}
        className="w-full h-11 border-red-500/30 text-red-600 hover:bg-red-50 font-bold rounded-lg"
      >
        <LogOut className="w-4 h-4 mr-1.5" />
        Log Out of Driver Cockpit
      </Button>
    </div>
  );
};
