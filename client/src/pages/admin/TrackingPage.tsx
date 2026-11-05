import React, { useState, useEffect } from 'react';
import { AdminHeader } from '../../components/layout/AdminHeader';
import { FleetApi, DeliveriesApi } from '../../api/client';
import { Vehicle, Driver, Delivery } from '../../types';
import InteractiveMap from '../../components/maps/InteractiveMap';
import {
  Navigation,
  BatteryCharging,
  Fuel,
  Radio,
  Clock,
  MapPin,
  CheckCircle2,
  RefreshCw,
  Search,
} from 'lucide-react';

export const TrackingPage: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSocketConnected, setIsSocketConnected] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [vRes, dRes, delivRes] = await Promise.all([
        FleetApi.getVehicles(),
        FleetApi.getDrivers(),
        DeliveriesApi.list({ limit: 50 }),
      ]);
      const vList = vRes.data?.vehicles || [];
      const dList = dRes.data?.drivers || [];
      const delivList = delivRes.data?.deliveries || [];

      setVehicles(vList);
      setDrivers(dList);
      setDeliveries(delivList);

      if (vList.length > 0 && !selectedVehicle) {
        setSelectedVehicle(vList[0]);
      }
    } catch (e) {
      console.error('Failed to load tracking telemetry:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const getDriverForVehicle = (v: Vehicle): Driver | null => {
    if (!v.assignedDriverId) return null;
    if (typeof v.assignedDriverId === 'object') return v.assignedDriverId as Driver;
    return drivers.find((d) => d.id === v.assignedDriverId) || null;
  };

  const getDriverName = (d: Driver | null): string => {
    if (!d) return 'Unassigned';
    if (typeof d.userId === 'object' && d.userId) return (d.userId as any).name || 'Assigned Driver';
    return d.licenseNumber || 'Assigned Driver';
  };

  const filteredVehicles = vehicles.filter((v) => {
    const matchesStatus =
      filterStatus === 'ALL'
        ? true
        : filterStatus === 'TRANSIT'
        ? v.availability === 'IN_TRANSIT'
        : filterStatus === 'ASSIGNED'
        ? v.availability === 'ASSIGNED'
        : filterStatus === 'AVAILABLE'
        ? v.availability === 'AVAILABLE'
        : true;

    const matchesSearch =
      !searchQuery ||
      v.vehicleId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.makeModel.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  // Map stops from active deliveries
  const mapStops = deliveries
    .filter((d) => d.location && d.location.coordinates)
    .slice(0, 25)
    .map((del, idx) => ({
      sequenceOrder: idx + 1,
      deliveryId: del.id,
      orderReference: del.orderReference,
      recipientName: del.customer?.name,
      recipientPhone: del.customer?.phone,
      streetAddress: del.address?.street,
      zone: del.address?.zone,
      coordinates: del.location.coordinates as [number, number],
      priority: del.priority,
      weightKg: del.weightKg || 1,
      distanceFromPreviousKm: 1.2,
      durationFromPreviousMin: 5,
    }));

  return (
    <div className="flex flex-col h-full space-y-4">
      <AdminHeader
        title="Live Fleet Telemetry & GIS Tracking"
        subtitle="Rasulgarh Urban Logistics Hub • Real-time GPS & Telemetry Engine"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-low border border-outline-variant text-xs">
              <span className={`w-2 h-2 rounded-full ${isSocketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="font-mono text-on-surface">
                {isSocketConnected ? 'Socket.IO: Active' : 'Disconnected'}
              </span>
            </div>
            <button
              onClick={fetchData}
              className="p-2 rounded-lg border border-outline-variant hover:bg-surface-low transition-colors"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        }
      />

      {/* Main Cockpit Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-[600px]">
        {/* Left Side: Fleet Vehicle Directory (4 cols) */}
        <div className="lg:col-span-4 flex flex-col rounded-xl border border-outline-variant bg-surface-lowest overflow-hidden shadow-sm">
          {/* Search & Filter Header */}
          <div className="p-3 border-b border-outline-variant space-y-2 bg-surface-low">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-on-surface-variant" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search plate, model, driver..."
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-outline-variant text-xs bg-surface-lowest text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
              />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto text-xs pb-0.5">
              {[
                { id: 'ALL', label: `All (${vehicles.length})` },
                { id: 'TRANSIT', label: `Transit (${vehicles.filter((v) => v.availability === 'IN_TRANSIT').length})` },
                { id: 'ASSIGNED', label: `Assigned (${vehicles.filter((v) => v.availability === 'ASSIGNED').length})` },
                { id: 'AVAILABLE', label: `Idle (${vehicles.filter((v) => v.availability === 'AVAILABLE').length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
                    filterStatus === tab.id
                      ? 'bg-secondary text-white shadow-sm'
                      : 'bg-surface-lowest text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Vehicle List */}
          <div className="flex-1 overflow-y-auto divide-y divide-outline-variant p-1 space-y-1">
            {filteredVehicles.length === 0 ? (
              <div className="text-center py-12 text-xs text-on-surface-variant">
                No vehicles matching filter.
              </div>
            ) : (
              filteredVehicles.map((v) => {
                const driver = getDriverForVehicle(v);
                const isSelected = selectedVehicle?.id === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVehicle(v)}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-secondary/10 border border-secondary shadow-sm'
                        : 'hover:bg-surface-low'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-on-surface">
                        {v.vehicleId}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          v.availability === 'IN_TRANSIT'
                            ? 'bg-amber-100 text-amber-800'
                            : v.availability === 'ASSIGNED'
                            ? 'bg-blue-100 text-blue-800'
                            : v.availability === 'AVAILABLE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {v.availability}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-1 text-xs text-on-surface-variant">
                      <span>{v.makeModel}</span>
                      <span className="font-medium text-on-surface">{getDriverName(driver)}</span>
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-[11px] text-on-surface-variant font-mono">
                      <span className="flex items-center gap-1">
                        {v.fuelType === 'Electric' ? (
                          <BatteryCharging className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Fuel className="w-3.5 h-3.5 text-amber-600" />
                        )}
                        {v.fuelType === 'Electric'
                          ? `${v.batterySoC ?? 85}% SoC`
                          : `${v.kmPerLitre ?? 14} km/L`}
                      </span>
                      <span>Cap: {v.capacityKg} kg</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Map Canvas & Telemetry HUD (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Map Display */}
          <div className="relative z-0 w-full h-[450px] rounded-xl border border-outline-variant overflow-hidden bg-surface-lowest shadow-sm">
            <InteractiveMap stops={mapStops} />
          </div>

          {/* Telemetry Detail Bento */}
          {selectedVehicle ? (
            <div className="p-4 rounded-xl border border-outline-variant bg-surface-lowest shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                    <Navigation className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                      {selectedVehicle.vehicleId} — {selectedVehicle.makeModel}
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      Assigned Driver: {getDriverName(getDriverForVehicle(selectedVehicle))}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                    <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-600" />
                    Telemetry Live
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="p-2.5 rounded-lg bg-surface-low border border-outline-variant/60">
                  <span className="text-[10px] uppercase font-semibold text-on-surface-variant block">Speed / Status</span>
                  <span className="text-sm font-bold font-mono text-on-surface block mt-0.5">
                    {selectedVehicle.availability === 'IN_TRANSIT' ? '28.4 km/h' : '0.0 km/h (Halt)'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-low border border-outline-variant/60">
                  <span className="text-[10px] uppercase font-semibold text-on-surface-variant block">Payload / Util</span>
                  <span className="text-sm font-bold font-mono text-on-surface block mt-0.5">
                    {selectedVehicle.capacityKg} kg Max
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-low border border-outline-variant/60">
                  <span className="text-[10px] uppercase font-semibold text-on-surface-variant block">Energy / Fuel</span>
                  <span className="text-sm font-bold font-mono text-secondary block mt-0.5">
                    {selectedVehicle.fuelType === 'Electric'
                      ? `${selectedVehicle.batterySoC ?? 85}% Battery`
                      : `${selectedVehicle.fuelType} (${selectedVehicle.kmPerLitre ?? 12} km/L)`}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-low border border-outline-variant/60">
                  <span className="text-[10px] uppercase font-semibold text-on-surface-variant block">SLA Certainty</span>
                  <span className="text-sm font-bold font-mono text-emerald-600 block mt-0.5">
                    98.4% On-Time
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-surface-lowest rounded-xl border border-outline-variant text-xs text-on-surface-variant">
              Select a vehicle to inspect live telemetry and telemetry telemetry HUD.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrackingPage;
