import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AdminApi, DeliveriesApi, FleetApi, BatchesApi } from '../../api/client';
import { RoutesApi } from '../../api/routeApi';
import { AdminHeader } from '../../components/layout/AdminHeader';
import { OperationsCommandStrip } from '../../components/dashboard/OperationsCommandStrip';
import { ConsignmentPipelineCard } from '../../components/dashboard/ConsignmentPipelineCard';
import { HubTerminalCard } from '../../components/dashboard/HubTerminalCard';
import { RecentActivityStream } from '../../components/dashboard/RecentActivityStream';
import { LiveDriverFleetBoard } from '../../components/dashboard/LiveDriverFleetBoard';
import { DemoDatasetPanel } from '../../components/dashboard/DemoDatasetPanel';
import { useStaggerEntrance } from '../../components/common/MotionPrimitives';
import { io } from 'socket.io-client';
import {
  Route,
  Plus,
  RotateCw,
} from 'lucide-react';

export const AdminControlCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [activeDriversList, setActiveDriversList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      // Load drivers for the fleet board
      const driversPromise = FleetApi.getDrivers().catch(() => ({ data: { drivers: [] } }));

      if (user?.role === 'ADMIN') {
        const [res, dRes] = await Promise.all([AdminApi.getOverview(), driversPromise]);
        setData(res.data);
        const rawDrivers = dRes.data?.drivers || [];
        setActiveDriversList(
          rawDrivers.slice(0, 4).map((d: any) => ({
            name: typeof d.userId === 'object' && d.userId?.name ? d.userId.name : d.name || `Driver ${d.licenseNumber}`,
            vehicleId: typeof d.assignedVehicleId === 'object' && d.assignedVehicleId?.vehicleId ? d.assignedVehicleId.vehicleId : 'Assigned',
            type: typeof d.assignedVehicleId === 'object' && d.assignedVehicleId?.fuelType ? d.assignedVehicleId.fuelType : undefined,
            status: d.availability === 'IN_TRANSIT' ? 'In Transit' : d.availability === 'ON_DUTY' ? 'On Duty' : 'Available',
          }))
        );
      } else {
        // Fleet Manager: Aggregate operational metrics from authorized logistics endpoints
        const [delivRes, vehRes, batchRes, routeRes, dRes] = await Promise.all([
          DeliveriesApi.list({ limit: 100 }),
          FleetApi.getVehicles(),
          BatchesApi.list(),
          RoutesApi.list({ limit: 50 }).catch(() => ({ data: { routes: [] } })),
          driversPromise,
        ]);

        const deliveries = delivRes.data?.deliveries || [];
        const vehicles = vehRes.data?.vehicles || [];
        const batches = batchRes.data?.batches || [];
        const routes = routeRes.data?.routes || [];
        const rawDrivers = dRes.data?.drivers || [];

        setActiveDriversList(
          rawDrivers.slice(0, 4).map((d: any) => ({
            name: typeof d.userId === 'object' && d.userId?.name ? d.userId.name : d.name || `Driver ${d.licenseNumber}`,
            vehicleId: typeof d.assignedVehicleId === 'object' && d.assignedVehicleId?.vehicleId ? d.assignedVehicleId.vehicleId : 'Assigned',
            type: typeof d.assignedVehicleId === 'object' && d.assignedVehicleId?.fuelType ? d.assignedVehicleId.fuelType : undefined,
            status: d.availability === 'IN_TRANSIT' ? 'In Transit' : d.availability === 'ON_DUTY' ? 'On Duty' : 'Available',
          }))
        );

        const totalDeliveries = deliveries.length;
        const completed = deliveries.filter((d: any) => d.status === 'COMPLETED').length;
        const active = deliveries.filter((d: any) => d.status === 'OUT_FOR_DELIVERY' || d.status === 'ASSIGNED').length;
        const unassigned = deliveries.filter((d: any) => d.status === 'DRAFT' || d.status === 'READY').length;
        const failed = deliveries.filter((d: any) => d.status === 'FAILED').length;
        const totalVehicles = vehicles.length;
        const availableVehicles = vehicles.filter((v: any) => v.availability === 'AVAILABLE').length;
        const onTimeRate = totalDeliveries > 0 ? Number(((completed / totalDeliveries) * 100).toFixed(1)) : 0;
        const totalDistanceSavedKm = Number(
          routes.reduce((sum: number, r: any) => sum + (r.deltas?.distanceSavedKm || 0), 0).toFixed(1)
        );
        const fuelSavedInr = Math.round(
          routes.reduce((sum: number, r: any) => sum + (r.deltas?.costSavedInr || 0), 0)
        );

        setData({
          metrics: {
            totalDeliveries,
            activeDeliveries: active,
            completedDeliveries: completed,
            failedDeliveries: failed,
            totalVehicles,
            availableVehicles,
            maintenanceVehicles: vehicles.filter((v: any) => v.availability === 'MAINTENANCE').length,
            activeDriversCount: rawDrivers.length,
            onTimeDeliveryRate: onTimeRate,
            totalFleetUtilization: totalVehicles > 0 ? Number((((totalVehicles - availableVehicles) / totalVehicles) * 100).toFixed(1)) : 0,
          },
          operational: {
            activeBatches: batches.length,
            activeRoutes: routes.length,
            unassignedDeliveries: unassigned,
            totalDistanceSavedKm,
            fuelSavedInr,
          },
          recentActivity: deliveries.slice(0, 6).map((d: any, idx: number) => ({
            id: d.id || String(idx),
            orderReference: d.orderReference || `DEL-${idx}`,
            recipientOrAction: d.customer?.name || 'Consignment Dispatch',
            zone: d.address?.zone || 'Rasulgarh Hub',
            timestamp: 'Today',
            status: d.status === 'FAILED' ? 'Failed' : d.status === 'COMPLETED' ? 'Completed' : 'In Transit',
            weightKg: d.weightKg,
          })),
        });
      }
    } catch (err) {
      console.error('Failed to load admin overview:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    const socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
    });
    const onLiveEvent = () => {
      fetchData();
    };
    socket.on('delivery:updated', onLiveEvent);
    socket.on('route:progress', onLiveEvent);
    socket.on('route:dispatched', onLiveEvent);
    socket.on('telemetry:alert', onLiveEvent);

    return () => {
      socket.off('delivery:updated', onLiveEvent);
      socket.off('route:progress', onLiveEvent);
      socket.off('route:dispatched', onLiveEvent);
      socket.off('telemetry:alert', onLiveEvent);
      socket.disconnect();
    };
  }, []);

  const dashboardRef = useRef<HTMLDivElement>(null);
  useStaggerEntrance(dashboardRef, '.gsap-dashboard-panel', [isLoading]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RotateCw className="w-8 h-8 text-emerald animate-spin" />
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const operational = data?.operational || {};
  const recentLogs = data?.recentActivity || [];

  // Map real activity stream items safely (handling both Admin AuditEvent rows and Fleet Manager Delivery rows)
  const formattedActivities = recentLogs.slice(0, 6).map((log: any, idx: number) => {
    if ('recipientOrAction' in log) {
      return {
        id: log.id || String(idx),
        orderReference: log.orderReference || `DEL-${idx + 1}`,
        recipientOrAction: log.recipientOrAction,
        zone: log.zone || 'Rasulgarh Hub',
        timestamp: log.timestamp || 'Today',
        status: log.status || 'In Transit',
        weightKg: log.weightKg,
      };
    }
    return {
      id: log._id || log.id || String(idx),
      orderReference: log.metadata?.orderReference || log.metadata?.batchCode || log.type || 'EVENT',
      recipientOrAction: log.action || 'Operational Event',
      zone: log.metadata?.zone || 'Rasulgarh Hub',
      timestamp: log.at ? new Date(log.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
      status: log.type === 'ERROR' || log.type === 'EXCEPTION_REPORTED' ? 'Failed' : log.type === 'ROUTE_DISPATCHED' ? 'In Transit' : 'Completed',
      weightKg: log.metadata?.weightKg,
    };
  });

  return (
    <div ref={dashboardRef} className="space-y-6">
      {/* Operations Header */}
      <AdminHeader
        title="Operations Control Center"
        subtitle="Rasulgarh Urban Logistics Hub • Fleet Operations & Dispatch Telemetry"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/batches')}
              className="spring-press flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant/60 dark:border-obsidian-750 bg-surface-lowest dark:bg-obsidian-900 text-on-surface dark:text-slate-200 hover:bg-surface-low dark:hover:bg-obsidian-850 text-xs font-medium"
            >
              <Plus className="w-3.5 h-3.5 text-primary dark:text-emerald-400" />
              <span>New Batch</span>
            </button>
            <button
              onClick={() => navigate('/admin/optimizer')}
              className="spring-press flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-sm"
            >
              <Route className="w-3.5 h-3.5" />
              <span>Optimize Dispatch</span>
            </button>
          </div>
        }
      />

      {/* Top 4 Operations KPI Command Strip */}
      <OperationsCommandStrip metrics={metrics} operational={operational} />

      {/* Main Operations Command Grid: Consignment Funnel (7 cols) + Hub Command Console (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7 flex flex-col gsap-dashboard-panel">
          <ConsignmentPipelineCard metrics={metrics} operational={operational} />
        </div>

        <div className="lg:col-span-5 flex flex-col gsap-dashboard-panel">
          <HubTerminalCard />
        </div>
      </div>

      {/* Secondary Operations Grid: Real Consignments Audit Stream (8 cols) & Driver Fleet Board (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-8 flex flex-col gsap-dashboard-panel">
          <RecentActivityStream items={formattedActivities.length > 0 ? formattedActivities : undefined} />
        </div>
        <div className="lg:col-span-4 flex flex-col gsap-dashboard-panel">
          <LiveDriverFleetBoard
            activeDriversCount={metrics.activeDriversCount ?? activeDriversList.length}
            totalVehicles={metrics.totalVehicles ?? 0}
            availableVehicles={metrics.availableVehicles ?? 0}
            maintenanceVehicles={metrics.maintenanceVehicles ?? 0}
            drivers={activeDriversList}
          />
        </div>
      </div>

      {/* Temporary Removable Admin-Only Demo Dataset Controls */}
      {user?.role === 'ADMIN' && <DemoDatasetPanel onDataChanged={fetchData} />}
    </div>
  );
};

export default AdminControlCenterPage;
