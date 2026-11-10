import React, { useState, useEffect } from 'react';
import { AdminHeader } from '../../components/layout/AdminHeader';
import { AdminApi, DeliveriesApi } from '../../api/client';
import { Delivery } from '../../types';
import { Button } from '../../components/common/Button';
import {
  Download,
  TrendingUp,
  Package,
  CheckCircle2,
  Navigation,
  Clock,
  Fuel,
  Leaf,
  Layers,
  MapPin,
  RefreshCw,
  Gauge,
  Route as RouteIcon,
  Truck,
  IndianRupee,
  Activity,
} from 'lucide-react';

interface AnalyticsSummaryData {
  totalDeliveries: number;
  completedDeliveries: number;
  activeDeliveries: number;
  failedDeliveries: number;
  unassignedDeliveries: number;
  hasResolvedDeliveries: boolean;
  deliveryCompletionRatePct: number;
  onTimeDeliveryRatePct: number;
  averageDeliveryTimeMin: number | null;
  avgPlannedStopDurationMin: number | null;
  totalOperatingCostInr: number;
  fuelCostPerDeliveryInr: number;
  routeEfficiencyScorePct: number;
  costEfficiencyPct: number;
  vehicleUtilizationRatePct: number;
  cargoLoadPct: number;
  activeCargoKg: number;
  activeCapacityKg: number;
  totalWeightKg: number;
  totalCo2AvoidedKg: number;
  totalDistanceSavedKm: number;
  fuelSavedInr: number;
  fuelSavedLitres: number;
  energySavedKwh: number;
  plannedVsActual: {
    plannedBaselineDistanceKm: number;
    plannedOptimizedDistanceKm: number;
    plannedFuelLitres: number;
    plannedEnergyKwh: number;
    plannedBaselineFuelLitres: number;
    plannedCostInr: number;
    actualDistanceKm: number;
    actualFuelLitres: number;
    actualAvgBatteryUsedPct: number;
    completedShiftsCount: number;
    executedRoutesCount: number;
    distanceVarianceKm: number;
  };
  zoneBreakdown: Array<{ zone: string; count: number; pct: number }>;
  propulsionBreakdown: { electric: number; diesel: number; petrol: number };
  counts: {
    totalVehicles: number;
    availableVehicles: number;
    maintenanceVehicles: number;
    nonRetiredVehicles: number;
    activeVehicles: number;
    nonDraftRoutesCount: number;
  };
}

export const AnalyticsPage: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsSummaryData | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [analyticsRes, delivRes] = await Promise.all([
        AdminApi.getAnalytics().catch(() => null),
        DeliveriesApi.list({ limit: 100 }).catch(() => ({ data: { deliveries: [] } })),
      ]);

      if (analyticsRes?.data) {
        setAnalytics(analyticsRes.data);
      }
      setDeliveries(delivRes.data?.deliveries || []);
    } catch (e) {
      console.error('Failed to load operations analytics:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Authoritative backend analytics with honest zero fallbacks
  const totalDeliveries = analytics?.totalDeliveries ?? deliveries.length;
  const completedDeliveries =
    analytics?.completedDeliveries ??
    deliveries.filter((d) => d.status === 'COMPLETED').length;
  const inTransitDeliveries =
    analytics?.activeDeliveries ??
    deliveries.filter((d) => d.status === 'OUT_FOR_DELIVERY' || d.status === 'ASSIGNED').length;
  const failedDeliveries =
    analytics?.failedDeliveries ??
    deliveries.filter((d) => d.status === 'FAILED').length;

  const hasResolvedDeliveries =
    analytics?.hasResolvedDeliveries ?? completedDeliveries + failedDeliveries > 0;
  const clearanceRate =
    analytics?.deliveryCompletionRatePct ??
    (totalDeliveries > 0 ? Number(((completedDeliveries / totalDeliveries) * 100).toFixed(1)) : 0);
  const onTimeRatePct = analytics?.onTimeDeliveryRatePct ?? 0;

  const totalOperatingCostInr = analytics?.totalOperatingCostInr ?? 0;
  const totalCo2AvoidedKg = analytics?.totalCo2AvoidedKg ?? 0;
  const totalWeightKg =
    analytics?.totalWeightKg ??
    deliveries.reduce((sum, d) => sum + (d.weightKg || 0), 0);

  // 4 PRD KPIs (D-06)
  const averageDeliveryTimeMin = analytics?.averageDeliveryTimeMin ?? null;
  const avgPlannedStopDurationMin = analytics?.avgPlannedStopDurationMin ?? null;
  const fuelCostPerDeliveryInr = analytics?.fuelCostPerDeliveryInr ?? 0;
  const routeEfficiencyScorePct = analytics?.routeEfficiencyScorePct ?? 0;
  const costEfficiencyPct = analytics?.costEfficiencyPct ?? 0;
  const vehicleUtilizationRatePct = analytics?.vehicleUtilizationRatePct ?? 0;
  const cargoLoadPct = analytics?.cargoLoadPct ?? 0;

  const nonDraftRoutesCount = analytics?.counts?.nonDraftRoutesCount ?? 0;
  const activeVehiclesCount = analytics?.counts?.activeVehicles ?? 0;
  const nonRetiredVehiclesCount = analytics?.counts?.nonRetiredVehicles ?? 0;

  // Planned vs Actual (D-07)
  const pva = analytics?.plannedVsActual ?? {
    plannedBaselineDistanceKm: 0,
    plannedOptimizedDistanceKm: 0,
    plannedFuelLitres: 0,
    plannedEnergyKwh: 0,
    plannedBaselineFuelLitres: 0,
    plannedCostInr: 0,
    actualDistanceKm: 0,
    actualFuelLitres: 0,
    actualAvgBatteryUsedPct: 0,
    completedShiftsCount: 0,
    executedRoutesCount: 0,
    distanceVarianceKm: 0,
  };

  const zoneBreakdown =
    analytics?.zoneBreakdown && analytics.zoneBreakdown.length > 0
      ? analytics.zoneBreakdown
      : Object.entries(
          deliveries.reduce((acc: Record<string, number>, d) => {
            const zone = d.address?.zone || 'Other';
            acc[zone] = (acc[zone] || 0) + 1;
            return acc;
          }, {})
        ).map(([zone, count]) => ({
          zone,
          count,
          pct: totalDeliveries > 0 ? Number(((count / totalDeliveries) * 100).toFixed(1)) : 0,
        }));

  const evVehicles = analytics?.propulsionBreakdown?.electric ?? 0;
  const dieselVehicles = analytics?.propulsionBreakdown?.diesel ?? 0;
  const petrolVehicles = analytics?.propulsionBreakdown?.petrol ?? 0;

  const handleExportCsv = () => {
    const headers = 'OrderReference,Customer,Phone,Zone,WeightKg,Priority,Status\n';
    const rows = deliveries
      .map(
        (d) =>
          `"${d.orderReference}","${d.customer?.name || ''}","${d.customer?.phone || ''}","${
            d.address?.zone || ''
          }",${d.weightKg || 0},"${d.priority}","${d.status}"`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SmartRoute_Analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const varianceSign = pva.distanceVarianceKm > 0 ? '+' : '';
  const hasShiftTelemetry = pva.completedShiftsCount > 0;
  const plannedDistanceSavedKm = Number(
    Math.max(0, pva.plannedBaselineDistanceKm - pva.plannedOptimizedDistanceKm).toFixed(2)
  );

  return (
    <div className="flex flex-col h-full space-y-6 pb-12">
      {/* Header */}
      <AdminHeader
        title="Operations Analytics & KPI Reporting"
        subtitle="Rasulgarh Logistics Center • Bhubaneswar Last-Mile Fleet Performance"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={fetchData}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleExportCsv}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Export CSV Log
            </Button>
          </div>
        }
      />

      {/* Core Operational KPI Strip (6 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* Card 1: Total Deliveries */}
        <div className="p-4 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 bg-surface-lowest dark:bg-obsidian-900 space-y-1.5">
          <div className="flex items-center justify-between text-on-surface-variant dark:text-slate-400">
            <span className="text-[10px] uppercase font-semibold tracking-wider">Total Consignments</span>
            <Package className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-on-surface dark:text-white">
            {totalDeliveries}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Active Manifest</span>
          </div>
        </div>

        {/* Card 2: Completed */}
        <div className="p-4 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 bg-surface-lowest dark:bg-obsidian-900 space-y-1.5">
          <div className="flex items-center justify-between text-on-surface-variant dark:text-slate-400">
            <span className="text-[10px] uppercase font-semibold tracking-wider">Completed (POD)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {completedDeliveries}
          </div>
          <div className="text-[11px] text-on-surface-variant dark:text-slate-400">
            <span className="font-semibold text-on-surface dark:text-slate-200">{clearanceRate.toFixed(1)}%</span> clearance rate
          </div>
        </div>

        {/* Card 3: In Transit */}
        <div className="p-4 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 bg-surface-lowest dark:bg-obsidian-900 space-y-1.5">
          <div className="flex items-center justify-between text-on-surface-variant dark:text-slate-400">
            <span className="text-[10px] uppercase font-semibold tracking-wider">Active Transit</span>
            <Navigation className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-sky-600 dark:text-sky-400">
            {inTransitDeliveries}
          </div>
          <div className="text-[11px] text-on-surface-variant dark:text-slate-400">
            Couriers En-Route
          </div>
        </div>

        {/* Card 4: SLA On-Time % (Honest 0 / — fallback when no resolved deliveries) */}
        <div className="p-4 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 bg-surface-lowest dark:bg-obsidian-900 space-y-1.5">
          <div className="flex items-center justify-between text-on-surface-variant dark:text-slate-400">
            <span className="text-[10px] uppercase font-semibold tracking-wider">On-Time SLA</span>
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-on-surface dark:text-white">
            {hasResolvedDeliveries ? `${onTimeRatePct.toFixed(1)}%` : '—'}
          </div>
          <div className="text-[11px] text-on-surface-variant dark:text-slate-400">
            {hasResolvedDeliveries ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {completedDeliveries}/{completedDeliveries + failedDeliveries} resolved
              </span>
            ) : (
              <span>Awaiting completed PODs</span>
            )}
          </div>
        </div>

        {/* Card 5: Operating / Fuel Expenditure (non-draft routes) */}
        <div className="p-4 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 bg-surface-lowest dark:bg-obsidian-900 space-y-1.5">
          <div className="flex items-center justify-between text-on-surface-variant dark:text-slate-400">
            <span className="text-[10px] uppercase font-semibold tracking-wider">Est. Operating Cost</span>
            <Fuel className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-on-surface dark:text-white">
            ₹{totalOperatingCostInr.toFixed(0)}
          </div>
          <div className="text-[11px] text-on-surface-variant dark:text-slate-400">
            {nonDraftRoutesCount} Non-Draft Route(s)
          </div>
        </div>

        {/* Card 6: CO2 Avoided */}
        <div className="p-4 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 bg-surface-lowest dark:bg-obsidian-900 space-y-1.5">
          <div className="flex items-center justify-between text-on-surface-variant dark:text-slate-400">
            <span className="text-[10px] uppercase font-semibold tracking-wider">CO₂ Saved</span>
            <Leaf className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {totalCo2AvoidedKg.toFixed(1)} kg
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            Emissions Abatement
          </div>
        </div>
      </div>

      {/* PRD Efficiency & Utilization KPIs (D-06) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[4px] border border-outline-variant/80 dark:border-obsidian-750 border-l-[3px] border-l-primary bg-surface-low dark:bg-obsidian-850">
            <Gauge className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-on-surface dark:text-slate-200">
              PRD Fleet Efficiency KPIs
            </span>
          </div>
          <span className="text-[11px] font-mono text-on-surface-variant dark:text-slate-400">
            Excludes DRAFT & CANCELLED routes
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {/* Average Delivery Time */}
          <div className="p-4 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 bg-surface-lowest dark:bg-obsidian-900 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-on-surface-variant dark:text-slate-400">
                Average Delivery Time
              </span>
              <Clock className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-on-surface dark:text-white">
              {averageDeliveryTimeMin !== null ? `${averageDeliveryTimeMin} min` : '—'}
            </div>
            <div className="text-[11px] text-on-surface-variant dark:text-slate-400">
              {avgPlannedStopDurationMin !== null
                ? `Planned avg ${avgPlannedStopDurationMin} min/stop`
                : 'Awaiting completed PODs'}
            </div>
          </div>

          {/* Fuel Cost per Delivery */}
          <div className="p-4 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 bg-surface-lowest dark:bg-obsidian-900 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-on-surface-variant dark:text-slate-400">
                Fuel Cost per Delivery
              </span>
              <IndianRupee className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-on-surface dark:text-white">
              ₹{fuelCostPerDeliveryInr.toFixed(0)}
            </div>
            <div className="text-[11px] text-on-surface-variant dark:text-slate-400">
              {completedDeliveries > 0 ? 'per completed POD' : 'per consignment'}
            </div>
          </div>

          {/* Route Efficiency Score */}
          <div className="p-4 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 bg-surface-lowest dark:bg-obsidian-900 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-on-surface-variant dark:text-slate-400">
                Route Efficiency Score
              </span>
              <RouteIcon className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {routeEfficiencyScorePct.toFixed(1)}%
            </div>
            <div className="text-[11px] text-on-surface-variant dark:text-slate-400">
              Distance reduction • {costEfficiencyPct.toFixed(1)}% cost gain
            </div>
          </div>

          {/* Vehicle Utilization Rate */}
          <div className="p-4 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 bg-surface-lowest dark:bg-obsidian-900 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-on-surface-variant dark:text-slate-400">
                Vehicle Utilization Rate
              </span>
              <Truck className="w-4 h-4 text-sky-500" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-on-surface dark:text-white">
              {vehicleUtilizationRatePct.toFixed(1)}%
            </div>
            <div className="text-[11px] text-on-surface-variant dark:text-slate-400">
              {activeVehiclesCount}/{nonRetiredVehiclesCount} active • {cargoLoadPct.toFixed(1)}% cargo load
            </div>
          </div>
        </div>
      </div>

      {/* Planned vs Actual Performance Section (D-07) */}
      <div className="p-5 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 bg-surface-lowest dark:bg-obsidian-900 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[4px] border border-outline-variant/80 dark:border-obsidian-750 border-l-[3px] border-l-primary bg-surface-low dark:bg-obsidian-850">
              <Activity className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-on-surface dark:text-slate-200">
                Planned vs Actual Performance
              </span>
            </div>
            <span className="text-xs text-on-surface-variant dark:text-slate-400">
              Executed Routes ({pva.executedRoutesCount}) vs Completed Driver Shifts ({pva.completedShiftsCount})
            </span>
          </div>

          {!hasShiftTelemetry && (
            <span className="px-2.5 py-1 rounded-[4px] border border-amber-500/30 border-l-[3px] border-l-amber-500 bg-amber-500/10 text-[11px] font-mono text-amber-800 dark:text-amber-300">
              Awaiting completed shift telemetry
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {/* Planned Baseline vs Optimized Distance */}
          <div className="p-4 rounded-lg bg-surface-low dark:bg-obsidian-850 border border-outline-variant/50 dark:border-obsidian-750 space-y-1.5">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-on-surface-variant dark:text-slate-400">
              Planned Distance (Opt / Base)
            </span>
            <div className="text-xl font-bold font-mono tabular-nums text-on-surface dark:text-white">
              {pva.plannedOptimizedDistanceKm.toFixed(1)} km
            </div>
            <div className="text-[11px] font-mono text-on-surface-variant dark:text-slate-400">
              Baseline: {pva.plannedBaselineDistanceKm.toFixed(1)} km ({plannedDistanceSavedKm} km saved)
            </div>
          </div>

          {/* Actual Odometer Distance */}
          <div className="p-4 rounded-lg bg-surface-low dark:bg-obsidian-850 border border-outline-variant/50 dark:border-obsidian-750 space-y-1.5">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-on-surface-variant dark:text-slate-400">
              Actual Shift Distance
            </span>
            <div className="text-xl font-bold font-mono tabular-nums text-on-surface dark:text-white">
              {pva.actualDistanceKm.toFixed(1)} km
            </div>
            <div className="text-[11px] font-mono text-on-surface-variant dark:text-slate-400">
              {hasShiftTelemetry
                ? `Variance vs planned: ${varianceSign}${pva.distanceVarianceKm.toFixed(1)} km`
                : '0 shifts logged'}
            </div>
          </div>

          {/* Planned Fuel / EV Energy */}
          <div className="p-4 rounded-lg bg-surface-low dark:bg-obsidian-850 border border-outline-variant/50 dark:border-obsidian-750 space-y-1.5">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-on-surface-variant dark:text-slate-400">
              Planned Energy & Cost
            </span>
            <div className="text-xl font-bold font-mono tabular-nums text-on-surface dark:text-white">
              {pva.plannedFuelLitres.toFixed(1)} L{pva.plannedEnergyKwh > 0 ? ` / ${pva.plannedEnergyKwh.toFixed(1)} kWh` : ''}
            </div>
            <div className="text-[11px] font-mono text-on-surface-variant dark:text-slate-400">
              Est. Cost: ₹{pva.plannedCostInr.toFixed(0)} (Base {pva.plannedBaselineFuelLitres.toFixed(1)} L)
            </div>
          </div>

          {/* Actual Fuel & Battery Telemetry */}
          <div className="p-4 rounded-lg bg-surface-low dark:bg-obsidian-850 border border-outline-variant/50 dark:border-obsidian-750 space-y-1.5">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-on-surface-variant dark:text-slate-400">
              Actual Fuel / Battery Used
            </span>
            <div className="text-xl font-bold font-mono tabular-nums text-on-surface dark:text-white">
              {pva.actualFuelLitres.toFixed(1)} L{pva.actualAvgBatteryUsedPct > 0 ? ` • ${pva.actualAvgBatteryUsedPct.toFixed(1)}% EV` : ''}
            </div>
            <div className="text-[11px] font-mono text-on-surface-variant dark:text-slate-400">
              {hasShiftTelemetry
                ? `Across ${pva.completedShiftsCount} completed shift(s)`
                : 'Awaiting driver shift clock-out'}
            </div>
          </div>
        </div>
      </div>

      {/* Analytical Detail Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Zone Distribution Breakdown (7 cols) */}
        <div className="lg:col-span-7 p-5 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 bg-surface-lowest dark:bg-obsidian-900 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-on-surface dark:text-white">Consignment Density by Urban Zone</h3>
            </div>
            <span className="text-xs text-on-surface-variant dark:text-slate-400 font-mono">
              Total Cargo: {totalWeightKg.toFixed(1)} kg
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {zoneBreakdown.length === 0 ? (
              <div className="py-6 text-center text-xs text-on-surface-variant dark:text-slate-400 font-mono">
                No zone consignment records found.
              </div>
            ) : (
              zoneBreakdown.map(({ zone, count, pct }) => (
                <div key={zone} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-on-surface dark:text-slate-200">{zone}</span>
                    <span className="font-mono tabular-nums text-on-surface-variant dark:text-slate-400">
                      {count} stops ({Math.round(pct)}%)
                    </span>
                  </div>
                  <div className="w-full bg-surface-low dark:bg-obsidian-950 rounded-[4px] h-2 overflow-hidden border border-outline-variant/40 dark:border-obsidian-750">
                    <div
                      className="bg-primary h-2 rounded-[4px] transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.round(pct))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Fleet Propulsion & Asset Utilization (5 cols) */}
        <div className="lg:col-span-5 p-5 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 bg-surface-lowest dark:bg-obsidian-900 space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-on-surface dark:text-white">Fleet Propulsion Breakdown</h3>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-center pt-1">
            <div className="p-3 rounded-lg bg-surface-low dark:bg-obsidian-850 border border-outline-variant/40 dark:border-obsidian-750">
              <span className="text-[10px] uppercase font-semibold text-emerald-600 dark:text-emerald-400 block">Electric</span>
              <span className="text-xl font-bold font-mono tabular-nums text-on-surface dark:text-white block mt-0.5">{evVehicles}</span>
              <span className="text-[10px] text-on-surface-variant dark:text-slate-400 block">Zero Emission</span>
            </div>
            <div className="p-3 rounded-lg bg-surface-low dark:bg-obsidian-850 border border-outline-variant/40 dark:border-obsidian-750">
              <span className="text-[10px] uppercase font-semibold text-amber-500 block">Diesel</span>
              <span className="text-xl font-bold font-mono tabular-nums text-on-surface dark:text-white block mt-0.5">{dieselVehicles}</span>
              <span className="text-[10px] text-on-surface-variant dark:text-slate-400 block">Heavy Cargo</span>
            </div>
            <div className="p-3 rounded-lg bg-surface-low dark:bg-obsidian-850 border border-outline-variant/40 dark:border-obsidian-750">
              <span className="text-[10px] uppercase font-semibold text-sky-500 block">Petrol / Bikes</span>
              <span className="text-xl font-bold font-mono tabular-nums text-on-surface dark:text-white block mt-0.5">{petrolVehicles}</span>
              <span className="text-[10px] text-on-surface-variant dark:text-slate-400 block">Express Delivery</span>
            </div>
          </div>

          <div className="p-3 rounded-[4px] bg-surface-low dark:bg-obsidian-850 border border-outline-variant/60 dark:border-obsidian-750 border-l-[3px] border-l-primary text-xs text-on-surface-variant dark:text-slate-400 space-y-1">
            <div className="font-medium text-on-surface dark:text-slate-200">Dispatch Routing Policy</div>
            <p className="text-[11px] leading-relaxed">
              Vehicles are matched to zone density and cargo weight thresholds. Electric vehicles are prioritized for dense urban clusters to lower operating costs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
