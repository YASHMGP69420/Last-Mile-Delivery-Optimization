import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DriverHudApi } from '../../api/client';
import { Toast } from '../../components/common/Toast';
import { useAuth } from '../../context/AuthContext';
import { useDriverSocketContext } from '../../context/DriverSocketContext';
import { CurrentStopHeroCard } from '../../components/driver/CurrentStopHeroCard';
import { DriverVehicleStatusCard } from '../../components/driver/DriverVehicleStatusCard';
import {
  Compass,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  Package,
  MapPin,
  Clock,
  AlertOctagon,
  Navigation,
  ChevronRight,
  ShieldAlert,
  X,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { formatAddress } from '../../utils/formatters';
import { buildNavigationUrl, setCachedDeviceLocation } from '../../utils/googleMaps';

export const DriverCockpitPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Core state
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [routeData, setRouteData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isShiftActionLoading, setIsShiftActionLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // UI state
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [handoverModalOpen, setHandoverModalOpen] = useState(false);
  const [handoverNotes, setHandoverNotes] = useState('');

  // GPS Telemetry speed tracking ref
  const lastSpeedRef = useRef<number>(0);

  // Fetch dashboard summary
  const fetchDashboard = useCallback(async () => {
    try {
      const res = await DriverHudApi.getDashboard();
      setDashboardData(res.data);
    } catch (err) {
      console.error('Failed to load driver dashboard:', err);
    }
  }, []);

  // Fetch active route details with enriched stops
  const fetchRoute = useCallback(async () => {
    try {
      const res = await DriverHudApi.getActiveRoute();
      setRouteData(res.data?.route || null);
    } catch (err) {
      console.error('Failed to load active route:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchDashboard(), fetchRoute()]);
    setIsLoading(false);
  }, [fetchDashboard, fetchRoute]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Consume global DriverSocketContext for real-time dispatch updates
  const { refreshKey } = useDriverSocketContext();

  useEffect(() => {
    refreshAll();
  }, [refreshKey, refreshAll]);

  // Dynamic Background GPS Telemetry Stream
  useEffect(() => {
    if (dashboardData?.shift?.status !== 'IN_PROGRESS') return;

    let timeoutId: any = null;
    let isCancelled = false;

    const transmitLocation = () => {
      if (!navigator.geolocation || isCancelled) return;

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (isCancelled) return;
          setCachedDeviceLocation([pos.coords.latitude, pos.coords.longitude]);
          try {
            let batteryPercent: number | undefined = undefined;
            if ('getBattery' in navigator) {
              const battery: any = await (navigator as any).getBattery();
              batteryPercent = Math.round(battery.level * 100);
            }

            const speedKmh =
              pos.coords.speed !== null && pos.coords.speed >= 0
                ? Math.round(pos.coords.speed * 3.6 * 10) / 10
                : 0;

            lastSpeedRef.current = speedKmh;

            await DriverHudApi.updateLocation({
              coordinates: [pos.coords.longitude, pos.coords.latitude],
              accuracyMeters: Math.round(pos.coords.accuracy),
              speedKmh,
              headingDegrees: pos.coords.heading || 0,
              altitudeMeters: pos.coords.altitude || undefined,
              batteryPercent,
            });
          } catch (e) {
            // Silently ignore transient telemetry errors
          } finally {
            if (!isCancelled) {
              // Dynamic interval: 8s when moving (>3 km/h), 30s when stationary
              const intervalMs = lastSpeedRef.current > 3 ? 8000 : 30000;
              timeoutId = setTimeout(transmitLocation, intervalMs);
            }
          }
        },
        () => {
          if (!isCancelled) {
            timeoutId = setTimeout(transmitLocation, 30000);
          }
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 4000 }
      );
    };

    transmitLocation();

    return () => {
      isCancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [dashboardData?.shift?.status]);

  // Stop Progression Handlers (Zero POD: 1-click execution)
  const handleMarkArrived = async (stopId: string) => {
    if (!stopId) return;
    setIsActionLoading(true);
    try {
      await DriverHudApi.markDeliveryArrived(stopId);
      setActionNotice('Arrived at delivery location. Customer notified.');
      await fetchRoute();
    } catch (err: any) {
      setToastMsg(err.response?.data?.error?.message || 'Failed to mark arrival');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCompleteStop = async (stopId: string, pod?: any) => {
    if (!stopId) return;
    setIsActionLoading(true);
    try {
      await DriverHudApi.completeDelivery(stopId, {
        pod: pod || { handoverNotes: 'Direct doorstep handover verified' },
      });
      setActionNotice('Stop marked COMPLETED successfully.');
      await Promise.all([fetchRoute(), fetchDashboard()]);
    } catch (err: any) {
      setToastMsg(err.response?.data?.error?.message || 'Failed to complete stop');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSkipStop = async (stopId: string, reason: string) => {
    if (!stopId) return;
    setIsActionLoading(true);
    try {
      await DriverHudApi.failDelivery(stopId, {
        failureReason: reason,
        failureNotes: 'Skipped by driver due to road/operational constraint',
      });
      setActionNotice('Stop skipped. Route updated.');
      await Promise.all([fetchRoute(), fetchDashboard()]);
    } catch (err: any) {
      setToastMsg(err.response?.data?.error?.message || 'Failed to skip stop');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Shift Attendance Handlers
  const handleStartShift = async () => {
    setIsShiftActionLoading(true);
    try {
      await DriverHudApi.startShift();
      setActionNotice('Shift started. You are now ON DUTY.');
      await refreshAll();
    } catch (err: any) {
      setToastMsg(err.response?.data?.error?.message || 'Failed to start shift');
    } finally {
      setIsShiftActionLoading(false);
    }
  };

  const handleEndShift = async () => {
    const remainingCount = dashboardData?.metrics?.remainingStops ?? 0;
    if (remainingCount > 0) {
      setHandoverModalOpen(true);
      return;
    }
    submitEndShift('');
  };

  const submitEndShift = async (notes: string) => {
    setIsShiftActionLoading(true);
    try {
      await DriverHudApi.endShift({ handoverNotes: notes });
      setHandoverModalOpen(false);
      setActionNotice('Shift clocked out successfully. Good job today!');
      await refreshAll();
    } catch (err: any) {
      setToastMsg(err.response?.data?.error?.message || 'Failed to end shift');
    } finally {
      setIsShiftActionLoading(false);
    }
  };

  // Emergency SOS Trigger
  const handleTriggerSos = async () => {
    setSosModalOpen(false);
    setIsActionLoading(true);
    try {
      await DriverHudApi.reportIncident({
        type: 'EMERGENCY_SOS',
        severity: 'HIGH',
        description: 'Driver triggered Emergency SOS panic alert from handheld cockpit',
      });
      alert('Emergency alert dispatched to Rasulgarh Operations Hub. Stay calm, help is on the way.');
    } catch (err) {
      alert('Failed to transmit SOS alert. Please contact emergency services or hub dispatch.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleClaimRoute = async () => {
    setIsClaiming(true);
    try {
      const res = await DriverHudApi.claimRoute();
      setActionNotice(res.message || 'Route claimed and assigned to your cockpit!');
      await refreshAll();
    } catch (err: any) {
      setToastMsg(err.response?.data?.error?.message || 'No available unassigned route found to claim');
    } finally {
      setIsClaiming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 space-y-3 bg-surface">
        <RotateCw className="w-8 h-8 text-primary animate-spin" />
        <span className="text-xs font-bold text-on-surface-variant font-mono">
          Connecting to Rasulgarh Logistics Hub...
        </span>
      </div>
    );
  }

  const driver = dashboardData?.driver || {};
  const shift = dashboardData?.shift;
  const vehicle = dashboardData?.vehicle;
  const metrics = dashboardData?.metrics || {};
  const stops: any[] = routeData?.stops || [];

  // Determine current active stop (first stop not COMPLETED and not FAILED)
  const currentStopIndex = stops.findIndex(
    (s) => s.status !== 'COMPLETED' && s.status !== 'FAILED'
  );
  const currentStop = currentStopIndex !== -1 ? stops[currentStopIndex] : null;
  const allStopsCompleted = stops.length > 0 && currentStopIndex === -1;

  // Upcoming stops excluding the current stop and completed ones
  const upcomingStops = currentStopIndex !== -1 ? stops.slice(currentStopIndex + 1) : [];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-24 space-y-4 select-none">
      {/* 1. Tactical Status & Quick Tools Bar */}
      <div className="flex items-center justify-between gap-2 px-1">
        {/* Left: Shift Duty Indicator & Active Route Code */}
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase font-mono shadow-xs ${
              shift?.status === 'IN_PROGRESS'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            {shift?.status === 'IN_PROGRESS' ? 'On Duty' : 'Off Duty'}
          </span>

          {routeData?.routeCode && (
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-lg bg-surface-low border border-outline-variant text-on-surface-variant">
              {routeData.routeCode}
            </span>
          )}
        </div>

        {/* Right: Emergency SOS Button */}
        <button
          onClick={() => setSosModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 hover:bg-red-100 active:scale-95 border border-red-200 text-red-600 text-xs font-bold transition-all shadow-xs"
          title="Emergency SOS"
          aria-label="Trigger emergency SOS distress alert"
        >
          <AlertOctagon className="w-3.5 h-3.5 fill-red-600 text-white" />
          <span>SOS</span>
        </button>
      </div>

      {/* 3. Action Notice Alert */}
      {actionNotice && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-between" role="status">
          <span>{actionNotice}</span>
          <button
            onClick={() => setActionNotice(null)}
            className="p-1 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss operational notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4. Active Delivery Hero Banner or Empty State */}
      {currentStop ? (
        <CurrentStopHeroCard
          stop={{
            id: currentStop.deliveryId || currentStop.id || currentStop._id,
            deliveryId: currentStop.deliveryId,
            orderReference:
              currentStop.delivery?.orderReference ||
              currentStop.orderReference ||
              `DEL-${currentStopIndex + 1}`,
            recipientName:
              currentStop.delivery?.recipientName ||
              currentStop.delivery?.customer?.name ||
              currentStop.recipientName,
            recipientPhone:
              currentStop.delivery?.recipientPhone ||
              currentStop.delivery?.customer?.phone ||
              currentStop.recipientPhone,
            address: formatAddress(
              currentStop.delivery?.address ||
              currentStop.delivery?.location?.address ||
              currentStop.address
            ),
            zone: currentStop.delivery?.zone || currentStop.zone || 'Rasulgarh Zone',
            weightKg:
              currentStop.delivery?.packageDetails?.weightKg ||
              currentStop.delivery?.weightKg ||
              currentStop.weightKg,
            priority: currentStop.delivery?.priority || currentStop.priority || 'Standard',
            status: currentStop.status || 'ASSIGNED',
            coordinates: currentStop.coordinates,
            location: currentStop.location,
            sequenceOrder: currentStop.sequenceOrder || currentStopIndex + 1,
            estimatedArrival: currentStop.estimatedArrival || '15 mins',
            distanceFromPrevKm: currentStop.distanceFromPrevKm,
          }}
          totalStops={stops.length}
          currentStopIndex={currentStopIndex + 1}
          onMarkArrived={handleMarkArrived}
          onCompleteStop={handleCompleteStop}
          onSkipStop={handleSkipStop}
          isActionLoading={isActionLoading}
        />
      ) : allStopsCompleted ? (
        <div className="p-6 rounded-xl bg-surface-lowest dark:bg-obsidian-900 border border-outline-variant/60 dark:border-obsidian-750 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-on-surface dark:text-white">
              All Assigned Deliveries Completed
            </h2>
            <p className="text-xs text-on-surface-variant dark:text-slate-400 mt-1 max-w-xs mx-auto">
              Please return the vehicle to Rasulgarh Logistics Hub depot bay.
            </p>
          </div>
          <a
            href={buildNavigationUrl({ destination: [20.2961, 85.8645] })}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Navigate to Depot</span>
          </a>
        </div>
      ) : (
        <div className="p-6 rounded-xl bg-surface-lowest dark:bg-obsidian-900 border border-outline-variant/60 dark:border-obsidian-750 text-center space-y-3">
          <Package className="w-8 h-8 text-on-surface-variant/40 mx-auto" />
          <div>
            <h3 className="text-sm font-semibold text-on-surface dark:text-white">No Active Route Dispatched</h3>
            <p className="text-xs text-on-surface-variant dark:text-slate-400 mt-0.5 max-w-xs mx-auto">
              An optimized delivery route will be dispatched by fleet operations.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAll}
              isLoading={isLoading}
              className="text-xs"
            >
              <RotateCw className="w-3.5 h-3.5 mr-1" /> Check for New Route
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleClaimRoute}
              isLoading={isClaiming}
              className="text-xs"
            >
              <Package className="w-3.5 h-3.5 mr-1" /> Claim Available Route
            </Button>
          </div>
          {shift?.status !== 'IN_PROGRESS' && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleStartShift}
              isLoading={isShiftActionLoading}
              className="mt-2"
            >
              Clock In & Start Shift
            </Button>
          )}
        </div>
      )}

      {/* 5. Assigned Vehicle & Shift Fleet Status Card */}
      <DriverVehicleStatusCard
        vehicle={vehicle}
        shift={shift}
        metrics={{
          totalStops: stops.length,
          completedStops: stops.filter((s) => s.status === 'COMPLETED').length,
          remainingStops: stops.filter((s) => s.status !== 'COMPLETED' && s.status !== 'FAILED').length,
        }}
        onEndShift={shift?.status === 'IN_PROGRESS' ? handleEndShift : undefined}
        isShiftActionLoading={isShiftActionLoading}
      />

      {/* 6. Upcoming Stops Queue (Manifest Preview) */}
      {upcomingStops.length > 0 && (
        <div className="p-4 rounded-xl bg-surface-lowest dark:bg-obsidian-900 border border-outline-variant/60 dark:border-obsidian-750 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-outline-variant/40 dark:border-obsidian-750">
            <span className="text-xs font-semibold text-on-surface dark:text-white uppercase tracking-wider font-mono">
              Next in Queue ({upcomingStops.length})
            </span>
            <button
              onClick={() => navigate('/driver/deliveries')}
              className="text-xs text-primary dark:text-emerald-400 font-semibold hover:underline inline-flex items-center gap-0.5"
            >
              <span>Full Manifest</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {upcomingStops.slice(0, 4).map((stop, idx) => (
              <div
                key={stop.deliveryId || idx}
                className="p-2.5 rounded-lg bg-surface-low dark:bg-obsidian-950/60 border border-outline-variant/40 dark:border-obsidian-750 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <span className="w-6 h-6 rounded-lg bg-surface-lowest font-bold text-[11px] text-on-surface font-mono flex items-center justify-center border border-outline-variant/60 shrink-0">
                    {currentStopIndex + 2 + idx}
                  </span>
                  <div className="truncate">
                    <span className="font-semibold text-on-surface block truncate">
                      {stop.delivery?.recipientName || stop.recipientName || 'Recipient'}
                    </span>
                    <span className="text-[11px] text-on-surface-variant truncate block">
                      {formatAddress(stop.delivery?.address || stop.address) || 'Bhubaneswar'}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span className="font-mono text-[11px] text-on-surface-variant font-medium block">
                    {stop.estimatedArrival || `${(idx + 1) * 15}m`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emergency SOS Confirmation Dialog */}
      {sosModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="sos-dialog-title">
          <div className="w-full max-w-sm bg-surface-lowest border border-red-200 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7 stroke-[2.5]" />
            </div>
            <div className="text-center">
              <h3 id="sos-dialog-title" className="text-base font-bold text-on-surface">Emergency SOS Alert</h3>
              <p className="text-xs text-on-surface-variant mt-1">
                Are you sure you want to broadcast an emergency distress signal to Rasulgarh Operations Hub?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="md"
                className="flex-1"
                onClick={() => setSosModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                className="flex-1 font-bold"
                onClick={handleTriggerSos}
                isLoading={isActionLoading}
              >
                Confirm SOS
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Handover Modal when ending shift with pending stops */}
      {handoverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="handover-dialog-title">
          <div className="w-full max-w-sm bg-surface-lowest border border-outline-variant/60 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 id="handover-dialog-title" className="text-sm font-bold text-on-surface">Handover Notes Required</h3>
            </div>
            <p className="text-xs text-on-surface-variant">
              There are pending stops remaining on this route. Please specify handover details
              (e.g., relief driver or depot staging bay):
            </p>
            <textarea
              id="handover-notes-input"
              aria-label="Shift handover notes"
              rows={3}
              value={handoverNotes}
              onChange={(e) => setHandoverNotes(e.target.value)}
              placeholder="e.g. Staged remaining packages at Rasulgarh Hub Bay 2 for evening shift."
              className="w-full p-3 rounded-2xl bg-surface-low border border-outline-variant text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setHandoverModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={handoverNotes.trim().length < 5}
                onClick={() => submitEndShift(handoverNotes)}
                isLoading={isShiftActionLoading}
              >
                End Shift
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
