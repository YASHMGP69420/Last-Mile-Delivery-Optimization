import React, { useState, useEffect } from 'react';
import { AdminHeader } from '../../components/layout/AdminHeader';
import { DeliveriesApi, FleetApi } from '../../api/client';
import { RoutesApi } from '../../api/routeApi';
import { Delivery, Vehicle } from '../../types';
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
} from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [delivRes, vehRes, routeRes] = await Promise.all([
        DeliveriesApi.list({ limit: 100 }),
        FleetApi.getVehicles(),
        RoutesApi.list({ limit: 50 }),
      ]);
      setDeliveries(delivRes.data?.deliveries || []);
      setVehicles(vehRes.data?.vehicles || []);
      setRoutes(routeRes.data?.routes || []);
    } catch (e) {
      console.error('Failed to load operations analytics:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute metrics from actual database documents
  const totalDeliveries = deliveries.length;
  const completedDeliveries = deliveries.filter((d) => d.status === 'COMPLETED').length;
  const inTransitDeliveries = deliveries.filter(
    (d) => d.status === 'OUT_FOR_DELIVERY' || d.status === 'ASSIGNED'
  ).length;
  const failedDeliveries = deliveries.filter((d) => d.status === 'FAILED').length;

  const clearanceRate =
    totalDeliveries > 0 ? ((completedDeliveries / totalDeliveries) * 100).toFixed(1) : '0.0';

  // Total weight and fuel metrics from routes
  const totalWeightKg = deliveries.reduce((sum, d) => sum + (d.weightKg || 0), 0);
  const totalOperatingCostInr = routes.reduce(
    (sum, r) => sum + (r.metrics?.costInr || 0),
    0
  );
  const totalCo2AvoidedKg = routes.reduce(
    (sum, r) => sum + (r.deltas?.co2AvoidedKg || 0),
    0
  );

  // Group by zone
  const zoneCounts: Record<string, number> = {};
  deliveries.forEach((d) => {
    const zone = d.address?.zone || 'Other';
    zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
  });

  // Vehicle fuel breakdown
  const evVehicles = vehicles.filter((v) => v.fuelType === 'Electric').length;
  const dieselVehicles = vehicles.filter((v) => v.fuelType === 'Diesel').length;
  const petrolVehicles = vehicles.filter((v) => v.fuelType === 'Petrol').length;

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
  };

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

      {/* 6 KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* Card 1: Total Deliveries */}
        <div className="p-4 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 bg-surface-lowest dark:bg-obsidian-900 space-y-1.5">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-[10px] uppercase font-semibold tracking-wider">Total Consignments</span>
            <Package className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold font-mono text-on-surface dark:text-white">
            {totalDeliveries}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Active Manifest</span>
          </div>
        </div>

        {/* Card 2: Completed */}
        <div className="p-4 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 bg-surface-lowest dark:bg-obsidian-900 space-y-1.5">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-[10px] uppercase font-semibold tracking-wider">Completed (POD)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {completedDeliveries}
          </div>
          <div className="text-[11px] text-on-surface-variant dark:text-slate-400">
            <span className="font-semibold text-on-surface dark:text-slate-200">{clearanceRate}%</span> clearance rate
          </div>
        </div>

        {/* Card 3: In Transit */}
        <div className="p-4 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 bg-surface-lowest dark:bg-obsidian-900 space-y-1.5">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-[10px] uppercase font-semibold tracking-wider">Active Transit</span>
            <Navigation className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-500">
            {inTransitDeliveries}
          </div>
          <div className="text-[11px] text-on-surface-variant dark:text-slate-400">
            Couriers En-Route
          </div>
        </div>

        {/* Card 4: SLA On-Time % */}
        <div className="p-4 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 bg-surface-lowest dark:bg-obsidian-900 space-y-1.5">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-[10px] uppercase font-semibold tracking-wider">On-Time SLA</span>
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold font-mono text-on-surface dark:text-white">
            {totalDeliveries > 0 ? (100 - (failedDeliveries / totalDeliveries) * 100).toFixed(1) : 100}%
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            SLA Compliant
          </div>
        </div>

        {/* Card 5: Fuel / Energy Expenditure */}
        <div className="p-4 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 bg-surface-lowest dark:bg-obsidian-900 space-y-1.5">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-[10px] uppercase font-semibold tracking-wider">Est. Fuel Cost</span>
            <Fuel className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-on-surface dark:text-white">
            ₹{totalOperatingCostInr.toFixed(0)}
          </div>
          <div className="text-[11px] text-on-surface-variant dark:text-slate-400">
            {routes.length} Active Route(s)
          </div>
        </div>

        {/* Card 6: CO2 Avoided */}
        <div className="p-4 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 bg-surface-lowest dark:bg-obsidian-900 space-y-1.5">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-[10px] uppercase font-semibold tracking-wider">CO₂ Saved</span>
            <Leaf className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {totalCo2AvoidedKg.toFixed(1)} kg
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            Emissions Abatement
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
            {Object.entries(zoneCounts).map(([zone, count]) => {
              const pct = totalDeliveries > 0 ? Math.round((count / totalDeliveries) * 100) : 0;
              return (
                <div key={zone} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-on-surface dark:text-slate-200">{zone}</span>
                    <span className="font-mono text-on-surface-variant dark:text-slate-400">
                      {count} stops ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-surface-low dark:bg-obsidian-950 rounded-full h-2 overflow-hidden border border-outline-variant/40 dark:border-obsidian-750">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fleet Propulsion & Asset Utilization (5 cols) */}
        <div className="lg:col-span-5 p-5 rounded-xl border border-outline-variant/60 dark:border-obsidian-750 bg-surface-lowest dark:bg-obsidian-900 space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-on-surface dark:text-white">Fleet Propulsion Breakdown</h3>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-center pt-1">
            <div className="p-3 rounded-lg bg-surface-low dark:bg-obsidian-950/60 border border-outline-variant/40 dark:border-obsidian-750">
              <span className="text-[10px] uppercase font-semibold text-emerald-600 dark:text-emerald-400 block">Electric</span>
              <span className="text-xl font-bold font-mono text-on-surface dark:text-white block mt-0.5">{evVehicles}</span>
              <span className="text-[10px] text-on-surface-variant dark:text-slate-400 block">Zero Emission</span>
            </div>
            <div className="p-3 rounded-lg bg-surface-low dark:bg-obsidian-950/60 border border-outline-variant/40 dark:border-obsidian-750">
              <span className="text-[10px] uppercase font-semibold text-amber-500 block">Diesel</span>
              <span className="text-xl font-bold font-mono text-on-surface dark:text-white block mt-0.5">{dieselVehicles}</span>
              <span className="text-[10px] text-on-surface-variant dark:text-slate-400 block">Heavy Cargo</span>
            </div>
            <div className="p-3 rounded-lg bg-surface-low dark:bg-obsidian-950/60 border border-outline-variant/40 dark:border-obsidian-750">
              <span className="text-[10px] uppercase font-semibold text-blue-500 block">Petrol / Bikes</span>
              <span className="text-xl font-bold font-mono text-on-surface dark:text-white block mt-0.5">{petrolVehicles}</span>
              <span className="text-[10px] text-on-surface-variant dark:text-slate-400 block">Express Delivery</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-surface-low dark:bg-obsidian-950/60 border border-outline-variant/40 dark:border-obsidian-750 text-xs text-on-surface-variant dark:text-slate-400 space-y-1">
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
