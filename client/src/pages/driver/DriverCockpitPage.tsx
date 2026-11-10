import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DriverHudApi } from '../../api/client';
import { Toast } from '../../components/common/Toast';
import { useAuth } from '../../context/AuthContext';
import { useDriverSocketContext } from '../../context/DriverSocketContext';
import { CurrentStopHeroCard } from '../../components/driver/CurrentStopHeroCard';
import { DriverVehicleStatusCard } from '../../components/driver/DriverVehicleStatusCard';
import { ShiftTelemetryModal } from '../../components/driver/ShiftTelemetryModal';
import {
  RotateCw,
  CheckCircle2,
  Package,
  MapPin,
  Navigation,
  ChevronRight,
  LifeBuoy,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { formatAddress } from '../../utils/formatters';
import { buildNavigationUrl } from '../../utils/googleMaps';
import { useStaggerEntrance } from '../../components/common/MotionPrimitives';

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
  const [shiftModalMode, setShiftModalMode] = useState<'START' | 'END' | null>(null);
  const [shiftModalHint, setShiftModalHint] = useState<string | null>(null);
  const [shiftModalError, setShiftModalError] = useState<string | null>(null);
  const [pendingArrivalStopId, setPendingArrivalStopId] = useState<string | null>(null);

  const cockpitRef = useRef<HTMLDivElement>(null);
  useStaggerEntrance(cockpitRef, '.gsap-cockpit-card', [isLoading]);

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

  // Consume global DriverSocketContext for real-time dispatch updates & shared shift GPS telemetry
  const { refreshKey, triggerRefresh } = useDriverSocketContext();

  useEffect(() => {
    refreshAll();
  }, [refreshKey, refreshAll]);

  const driver = dashboardData?.driver || {};
  const shift = dashboardData?.shift;
  const vehicle = dashboardData?.vehicle;
  const metrics = dashboardData?.metrics || {};
  const stops: any[] = routeData?.stops || [];
  const isVehicleBlocked = Boolean(
    vehicle && ['MAINTENANCE', 'RETIRED'].includes(String(vehicle.status || '').toUpperCase())
  );
  const needsInspectionWarning = Boolean(
    vehicle &&
      !isVehicleBlocked &&
      (!dashboardData?.latestChecklist ||
        ['FAILED_CRITICAL', 'NEEDS_ATTENTION'].includes(dashboardData?.latestChecklist?.status))
  );

  // Stop Progression Handlers (gated by active shift & start telemetry)
  const executeMarkArrived = async (stopId: string) => {
    setIsActionLoading(true);
    try {
      await DriverHudApi.markDeliveryArrived(stopId);
      setActionNotice('Arrived at delivery location. Customer notified.');
      await fetchRoute();
    } catch (err: any) {
      setToastMsg(err.friendlyMessage || err.response?.data?.error?.message || 'Failed to mark arrival');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleMarkArrived = async (stopId: string) => {
    if (!stopId) return;
    if (shift?.status !== 'IN_PROGRESS') {
      if (isVehicleBlocked) {
        setToastMsg(
          `Cannot start shift: assigned vehicle ${vehicle?.registrationNumber || ''} is currently ${String(
            vehicle?.status || ''
          ).toUpperCase()}.`
        );
        return;
      }
      setShiftModalError(null);
      setPendingArrivalStopId(stopId);
      setShiftModalHint(
        'Enter your starting odometer reading & remaining fuel/charge before starting your delivery.'
      );
      setShiftModalMode('START');
      return;
    }
    await executeMarkArrived(stopId);
  };

  const handleCompleteStop = async (stopId: string, pod?: any) => {
    if (!stopId) return;
    setIsActionLoading(true);
    try {
      await DriverHudApi.completeDelivery(stopId, {
        otp: pod?.otp || undefined,
        signatureSvg: pod?.signature || undefined,
        photoUrl: pod?.photo || undefined,
        handoverNotes: pod?.notes || 'Direct doorstep handover verified',
      });
      setActionNotice('Stop marked COMPLETED with Proof of Delivery.');
      await Promise.all([fetchRoute(), fetchDashboard()]);
      triggerRefresh();
    } catch (err: any) {
      setToastMsg(err.friendlyMessage || err.response?.data?.error?.message || 'Failed to complete stop');
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
      setToastMsg(err.friendlyMessage || err.response?.data?.error?.message || 'Failed to skip stop');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleStartShift = () => {
    if (isVehicleBlocked) {
      setToastMsg(
        `Cannot start shift: assigned vehicle ${vehicle?.registrationNumber || ''} is currently ${String(
          vehicle?.status || ''
        ).toUpperCase()}.`
      );
      return;
    }
    setShiftModalError(null);
    setPendingArrivalStopId(null);
    setShiftModalHint(null);
    setShiftModalMode('START');
  };

  const handleEndShift = () => {
    setShiftModalError(null);
    setShiftModalHint(null);
    setShiftModalMode('END');
  };

  const handleShiftTelemetrySubmit = async (payload: {
    odometerKm?: number;
    remainingFuelOrCharge?: number;
    handoverNotes?: string;
    requireTelemetry: boolean;
  }) => {
    setIsShiftActionLoading(true);
    setShiftModalError(null);
    try {
      if (shiftModalMode === 'START') {
        await DriverHudApi.startShift({
          odometerKm: payload.odometerKm,
          remainingFuelOrCharge: payload.remainingFuelOrCharge,
          requireTelemetry: payload.requireTelemetry,
        });
        const queuedStop = pendingArrivalStopId;
        setShiftModalMode(null);
        setShiftModalHint(null);
        setShiftModalError(null);
        setPendingArrivalStopId(null);
        setActionNotice('Shift started with odometer & fuel log recorded.');
        await refreshAll();
        triggerRefresh();
        if (queuedStop) {
          await executeMarkArrived(queuedStop);
        }
      } else if (shiftModalMode === 'END') {
        const res = await DriverHudApi.endShift({
          handoverNotes: payload.handoverNotes,
          odometerKm: payload.odometerKm,
          remainingFuelOrCharge: payload.remainingFuelOrCharge,
          requireTelemetry: payload.requireTelemetry,
        });
        const closedShift = res.data?.shift;
        setShiftModalMode(null);
        setShiftModalHint(null);
        setShiftModalError(null);
        if (closedShift?.telemetryCapturedAtEnd) {
          setActionNotice(
            `Shift clocked out: ${closedShift.actualDistanceKm} km driven, ${closedShift.actualFuelOrChargeUsed}${closedShift.fuelUnit || 'L'} used.`
          );
        } else {
          setActionNotice('Shift clocked out successfully. Good job today!');
        }
        await refreshAll();
        triggerRefresh();
      }
    } catch (err: any) {
      const msg =
        err.friendlyMessage ||
        err.response?.data?.error?.message ||
        (shiftModalMode === 'START' ? 'Failed to start shift' : 'Failed to end shift');
      setShiftModalError(msg);
      setToastMsg(msg);
    } finally {
      setIsShiftActionLoading(false);
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

  // Determine current active stop (first stop not COMPLETED and not FAILED)
  const currentStopIndex = stops.findIndex(
    (s) => s.status !== 'COMPLETED' && s.status !== 'FAILED'
  );
  const currentStop = currentStopIndex !== -1 ? stops[currentStopIndex] : null;
  const allStopsCompleted = stops.length > 0 && currentStopIndex === -1;

  // Upcoming stops excluding the current stop and completed ones
  const upcomingStops = currentStopIndex !== -1 ? stops.slice(currentStopIndex + 1) : [];

  return (
    <div ref={cockpitRef} className="flex-1 min-h-0 overflow-y-auto p-4 pb-24 space-y-4 select-none">
      {/* 1. Tactical Status & Quick Tools Bar */}
      <div className="gsap-cockpit-card flex items-center justify-between gap-2 px-1">
        {/* Left: Shift Duty Indicator & Active Route Code */}
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase font-mono shadow-xs ${
              shift?.status === 'IN_PROGRESS'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30'
                : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-obsidian-800 dark:text-slate-300 dark:border-obsidian-700'
            }`}
          >
            {shift?.status === 'IN_PROGRESS' ? 'On Duty' : 'Off Duty'}
          </span>

          {routeData?.routeCode && (
            <span className="text-[11px] font-mono font-semibold text-on-surface-variant">
              {routeData.routeCode}
            </span>
          )}
        </div>

        {/* Right: Clock-In CTA when off duty + Issue Support Link */}
        <div className="flex items-center gap-2">
          {shift?.status !== 'IN_PROGRESS' && (
            <Button
              size="sm"
              variant="primary"
              onClick={handleStartShift}
              disabled={isVehicleBlocked}
              isLoading={isShiftActionLoading}
              className="text-xs px-3 py-1 rounded-full"
            >
              Clock In
            </Button>
          )}
          <button
            type="button"
            onClick={() => navigate('/driver/support')}
            className="spring-press flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-lowest hover:bg-surface-low border border-outline-variant text-on-surface text-xs font-semibold shadow-xs"
            title="Dispatch Support & Report Issue"
            aria-label="Open dispatch support and issue reporting"
          >
            <LifeBuoy className="w-3.5 h-3.5 text-primary" />
            <span>Support</span>
          </button>
        </div>
      </div>

      {/* 2. Vehicle Unavailability Guard & Pre-Trip Inspection Banner */}
      {isVehicleBlocked && (
        <div
          role="alert"
          data-guard="VEHICLE_UNAVAILABLE_FOR_SHIFT"
          className="gsap-cockpit-card p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400 flex items-start gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">
              Vehicle Unavailable ({String(vehicle?.status || '').toUpperCase()})
            </p>
            <p className="mt-0.5 opacity-90">
              Assigned vehicle {vehicle?.registrationNumber || ''} is currently marked{' '}
              {String(vehicle?.status || '').toUpperCase()}. Clock In is blocked until Fleet Operations clears the vehicle.
            </p>
          </div>
        </div>
      )}

      {needsInspectionWarning && (
        <div
          role="status"
          className="gsap-cockpit-card p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                {!dashboardData?.latestChecklist
                  ? "Today's Pre-Trip Inspection Missing"
                  : `Pre-Trip Inspection ${String(dashboardData.latestChecklist.status || '').replace('_', ' ')}`}
              </p>
              <p className="mt-0.5 opacity-90">
                Complete today's roadworthiness inspection before starting deliveries.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => navigate('/driver/vehicle-check')}
            className="shrink-0 text-xs border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/15"
          >
            Inspect Now
          </Button>
        </div>
      )}

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
      <div className="gsap-cockpit-card">
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
            zone: currentStop.delivery?.zone || currentStop.zone,
            weightKg:
              currentStop.delivery?.packageDetails?.weightKg ||
              currentStop.delivery?.weightKg ||
              currentStop.weightKg,
            priority: currentStop.delivery?.priority || currentStop.priority || 'Standard',
            status: currentStop.status || 'ASSIGNED',
            coordinates: currentStop.coordinates,
            location: currentStop.location,
            sequenceOrder: currentStop.sequenceOrder || currentStopIndex + 1,
            estimatedArrival: currentStop.estimatedArrival || currentStop.eta,
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
              disabled={isVehicleBlocked}
              isLoading={isShiftActionLoading}
              className="mt-2"
            >
              Clock In & Start Shift
            </Button>
          )}
        </div>
      )}
      </div>

      {/* 5. Assigned Vehicle & Shift Fleet Status Card */}
      <div className="gsap-cockpit-card">
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
      </div>

      {/* 6. Upcoming Stops Queue (Manifest Preview) */}
      {upcomingStops.length > 0 && (
        <div className="gsap-cockpit-card p-4 rounded-xl bg-surface-lowest dark:bg-obsidian-900 border border-outline-variant/60 dark:border-obsidian-750 space-y-3">
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

                {(stop.estimatedArrival || stop.eta) && (
                  <div className="shrink-0 text-right">
                    <span className="font-mono text-[11px] text-on-surface-variant font-medium block">
                      {stop.estimatedArrival || stop.eta}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shift Start / End Odometer & Fuel/Charge Telemetry Modal */}
      <ShiftTelemetryModal
        isOpen={shiftModalMode !== null}
        mode={shiftModalMode || 'START'}
        vehicle={vehicle}
        startOdometerKm={shift?.startOdometerKm ?? null}
        startFuelOrCharge={shift?.startFuelOrCharge ?? null}
        requiresHandoverNotes={
          shiftModalMode === 'END' &&
          stops.filter((s) => s.status !== 'COMPLETED' && s.status !== 'FAILED').length > 0
        }
        promptHint={shiftModalHint}
        serverError={shiftModalError}
        isSubmitting={isShiftActionLoading}
        onClose={() => {
          setShiftModalMode(null);
          setShiftModalHint(null);
          setShiftModalError(null);
          setPendingArrivalStopId(null);
        }}
        onSubmit={handleShiftTelemetrySubmit}
      />

      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg(null)} />}
    </div>
  );
};
