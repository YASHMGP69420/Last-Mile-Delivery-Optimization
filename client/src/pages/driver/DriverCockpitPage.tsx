import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DriverHudApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Compass,
  Play,
  Pause,
  StopCircle,
  Truck,
  Route as RouteIcon,
  CheckCircle2,
  Clock,
  Navigation,
  RotateCw,
  AlertTriangle,
  Wrench,
  Package,
  Calendar,
  Fuel,
  Battery,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { Button } from '../../components/common/Button';

export const DriverCockpitPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isShiftActionLoading, setIsShiftActionLoading] = useState(false);
  const [handoverModalOpen, setHandoverModalOpen] = useState(false);
  const [handoverNotes, setHandoverNotes] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const res = await DriverHudApi.getDashboard();
      setData(res.data);
    } catch (err) {
      console.error('Failed to load driver dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleStartShift = async () => {
    setIsShiftActionLoading(true);
    setActionNotice(null);
    try {
      await DriverHudApi.startShift();
      setActionNotice('Shift clocked in. You are now ON DUTY.');
      fetchDashboard();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to start shift');
    } finally {
      setIsShiftActionLoading(false);
    }
  };

  const handleToggleBreak = async (onBreak: boolean) => {
    setIsShiftActionLoading(true);
    setActionNotice(null);
    try {
      await DriverHudApi.toggleBreak({ onBreak, breakDurationMinutes: 15 });
      setActionNotice(onBreak ? 'Break mode active (15m allotted).' : 'Break ended. Back on duty.');
      fetchDashboard();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to toggle break');
    } finally {
      setIsShiftActionLoading(false);
    }
  };

  const handleEndShift = async () => {
    // Check if there are remaining stops
    if (data?.metrics?.remainingStops > 0) {
      setHandoverModalOpen(true);
      return;
    }

    submitEndShift('');
  };

  const submitEndShift = async (notes: string) => {
    setIsShiftActionLoading(true);
    setActionNotice(null);
    try {
      await DriverHudApi.endShift({ handoverNotes: notes });
      setHandoverModalOpen(false);
      setActionNotice('Shift completed and clocked out successfully.');
      fetchDashboard();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to end shift');
    } finally {
      setIsShiftActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RotateCw className="w-8 h-8 text-secondary animate-spin" />
      </div>
    );
  }

  const driver = data?.driver || {};
  const shift = data?.shift;
  const vehicle = data?.vehicle;
  const activeRoute = data?.activeRoute;
  const metrics = data?.metrics || {};
  const isShiftActive = shift?.status === 'IN_PROGRESS';
  const isOnBreak = driver.availability === 'ON_BREAK';

  return (
    <div className="space-y-4 pb-4">
      {/* Driver Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-on-surface">Hello, {driver.name || user?.name}!</h1>
          <p className="text-[11px] text-on-surface-variant flex items-center gap-1 font-mono">
            <span>LIC: {driver.licenseNumber || 'Verified Commercial'}</span>
            <span>•</span>
            <span className="text-secondary font-bold">★ {driver.rating?.toFixed(1) || '4.9'}</span>
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchDashboard} className="p-1.5">
          <RotateCw className="w-4 h-4 text-on-surface-variant" />
        </Button>
      </div>

      {actionNotice && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-500 flex items-center justify-between">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* 1. Shift & Attendance Card */}
      <div className="p-4 rounded-2xl bg-surface-lowest border border-outline-variant shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-secondary" />
            <span className="text-xs font-bold text-on-surface">Shift Attendance</span>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
              isShiftActive
                ? isOnBreak
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-700 text-slate-300'
            }`}
          >
            {isShiftActive ? (isOnBreak ? 'ON BREAK' : 'ON DUTY') : 'OFF DUTY'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-on-surface-variant bg-surface p-2.5 rounded-xl border border-outline-variant">
          <div>
            <span className="text-[10px] text-slate-400 block">Shift Window</span>
            <span className="font-mono font-semibold text-on-surface">
              {shift ? `${shift.startTime} - ${shift.endTime}` : '08:00 - 18:00 (Scheduled)'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">Break Time Taken</span>
            <span className="font-mono font-semibold text-on-surface">{shift?.breakMinutes || 0} mins</span>
          </div>
        </div>

        {/* Shift Action Buttons */}
        <div className="flex items-center gap-2">
          {!isShiftActive ? (
            <Button
              variant="primary"
              size="sm"
              isLoading={isShiftActionLoading}
              onClick={handleStartShift}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5"
            >
              <Play className="w-4 h-4 mr-1.5" />
              Clock In & Start Shift
            </Button>
          ) : (
            <>
              {!isOnBreak ? (
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={isShiftActionLoading}
                  onClick={() => handleToggleBreak(true)}
                  className="flex-1 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                >
                  <Pause className="w-3.5 h-3.5 mr-1" />
                  Take Break
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={isShiftActionLoading}
                  onClick={() => handleToggleBreak(false)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <Play className="w-3.5 h-3.5 mr-1" />
                  Resume Shift
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                isLoading={isShiftActionLoading}
                onClick={handleEndShift}
                className="flex-1 border-red-500/40 text-red-400 hover:bg-red-500/10"
              >
                <StopCircle className="w-3.5 h-3.5 mr-1" />
                End Shift
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 2. Today's Performance Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-xl bg-surface-lowest border border-outline-variant text-center space-y-0.5">
          <span className="text-[10px] text-on-surface-variant block uppercase font-medium">Assigned</span>
          <span className="text-xl font-black text-on-surface">{metrics.assignedDeliveries ?? 0}</span>
          <span className="text-[9px] text-slate-400 block">Total Stops</span>
        </div>

        <div className="p-3 rounded-xl bg-surface-lowest border border-outline-variant text-center space-y-0.5">
          <span className="text-[10px] text-emerald-500 block uppercase font-bold">Done</span>
          <span className="text-xl font-black text-emerald-500">{metrics.completedDeliveries ?? 0}</span>
          <span className="text-[9px] text-slate-400 block">Completed</span>
        </div>

        <div className="p-3 rounded-xl bg-surface-lowest border border-outline-variant text-center space-y-0.5">
          <span className="text-[10px] text-amber-500 block uppercase font-bold">Remaining</span>
          <span className="text-xl font-black text-amber-500">{metrics.remainingStops ?? 0}</span>
          <span className="text-[9px] text-slate-400 block">In Queue</span>
        </div>
      </div>

      {/* 3. Assigned Vehicle & Pre-Trip Checklist Status Card */}
      <div className="p-4 rounded-2xl bg-surface-lowest border border-outline-variant shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-secondary" />
            <span className="text-xs font-bold text-on-surface">Assigned Vehicle</span>
          </div>
          <span className="text-xs font-mono font-bold text-secondary">
            {vehicle?.registrationNumber || 'Tata Ace EV'}
          </span>
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface border border-outline-variant text-xs">
          <div className="flex items-center gap-2">
            {vehicle?.fuelType === 'Electric' ? (
              <Battery className="w-4 h-4 text-emerald-500" />
            ) : (
              <Fuel className="w-4 h-4 text-amber-500" />
            )}
            <span className="text-on-surface font-medium">{vehicle?.type || 'Van'} ({vehicle?.fuelType || 'Electric'})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-on-surface-variant">Pre-Trip Check:</span>
            {data?.checklistCompleted ? (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> PASSED
              </span>
            ) : (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> PENDING
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/driver/vehicle-check')}
            className="flex-1 text-xs"
          >
            <Wrench className="w-3.5 h-3.5 mr-1" />
            {data?.checklistCompleted ? 'Review Inspection' : 'Perform Pre-Trip Check'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/driver/support')}
            className="text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
          >
            Report Issue
          </Button>
        </div>
      </div>

      {/* 4. Active Dispatched Route Card */}
      {activeRoute ? (
        <div className="p-4 rounded-2xl bg-gradient-to-br from-primary to-slate-900 text-white shadow-xl border border-secondary/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RouteIcon className="w-4 h-4 text-secondary" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Active Dispatched Route</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary/20 text-blue-300 font-bold">
              {activeRoute.routeCode}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Depot: <strong>{activeRoute.depot?.name || 'Rasulgarh Hub'}</strong></span>
              <span className="font-mono text-emerald-400 font-bold">{metrics.completedDeliveries} / {metrics.assignedDeliveries} Stops</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
              <div
                className="bg-secondary h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${
                    metrics.assignedDeliveries > 0
                      ? (metrics.completedDeliveries / metrics.assignedDeliveries) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          <div className="pt-1 flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/driver/route')}
              className="flex-1 bg-secondary hover:bg-secondary/90 text-white font-bold py-2.5"
            >
              <Navigation className="w-4 h-4 mr-1.5" />
              Start / Resume Route
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/driver/deliveries')}
              className="border-slate-700 text-slate-200 hover:bg-white/10"
            >
              Stops List
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-2xl bg-surface-lowest border border-outline-variant text-center space-y-2">
          <Package className="w-8 h-8 text-on-surface-variant mx-auto opacity-40" />
          <h3 className="text-xs font-bold text-on-surface">No Route Currently Dispatched</h3>
          <p className="text-[11px] text-on-surface-variant max-w-xs mx-auto">
            Your fleet manager will assign an optimized delivery batch to your vehicle shortly.
          </p>
        </div>
      )}

      {/* Handover Modal (Safety check when ending shift with incomplete deliveries) */}
      {handoverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-surface-lowest border border-outline-variant rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="text-sm font-bold text-on-surface">Handover Notes Required</h2>
            </div>

            <p className="text-xs text-on-surface-variant">
              Route <strong className="text-on-surface">{activeRoute?.routeCode}</strong> has{' '}
              <strong className="text-amber-500">{metrics.remainingStops} pending stops</strong>. To end your shift safely, please provide handover notes (relief driver name or depot staging location):
            </p>

            <textarea
              rows={3}
              required
              placeholder="e.g. Handed over consignments to relief driver at Rasulgarh Hub depot bay 3."
              value={handoverNotes}
              onChange={(e) => setHandoverNotes(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface focus:outline-none"
            />

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setHandoverModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={handoverNotes.trim().length < 5}
                onClick={() => submitEndShift(handoverNotes)}
                className="bg-red-600 hover:bg-red-500 text-white"
              >
                Confirm Handover & End Shift
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
