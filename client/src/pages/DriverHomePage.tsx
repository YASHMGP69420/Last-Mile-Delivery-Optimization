import React, { useState, useEffect } from 'react';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { DeliveriesApi } from '../api/client';
import { Delivery } from '../types';
import {
  MapPin,
  Navigation,
  Phone,
  CheckCircle2,
  Clock,
  Package,
  BatteryCharging,
  AlertCircle,
  Truck,
} from 'lucide-react';

export const DriverHomePage: React.FC = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [activeStop, setActiveStop] = useState<Delivery | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStops = async () => {
      try {
        const res = await DeliveriesApi.list({ limit: 10 });
        const list = res.data.deliveries || [];
        setDeliveries(list);
        if (list.length > 0) {
          setActiveStop(list[0]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStops();
  }, []);

  return (
    <div className="space-y-4">
      {/* Shift Overview Bento */}
      <div className="p-4 rounded-xl bg-primary text-white shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
            Active Dispatched Shift
          </span>
          <span className="text-[11px] font-mono bg-secondary px-2 py-0.5 rounded text-white font-bold">
            BBSR-EXP-01
          </span>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div>
            <h2 className="text-base font-bold text-white">Rasulgarh → Patia Cluster</h2>
            <p className="text-xs text-slate-400 mt-0.5">Shift A (08:00 - 17:00)</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold font-mono text-emerald-400">
              {deliveries.length}
            </span>
            <span className="text-[10px] text-slate-400 block uppercase font-medium">Stops Left</span>
          </div>
        </div>
      </div>

      {/* Active Stop Card */}
      {activeStop && (
        <div className="p-4 rounded-xl bg-surface-lowest border border-outline-variant shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Navigation className="w-4 h-4" /> Next Target Consignment
            </span>
            <StatusBadge status={activeStop.priority} size="sm" />
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-xs font-bold text-on-surface">
                {activeStop.orderReference}
              </span>
              <span className="text-xs font-mono font-medium text-secondary flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {activeStop.timeWindow.start} - {activeStop.timeWindow.end}
              </span>
            </div>
            <h3 className="text-base font-bold text-on-surface mt-1">
              {activeStop.customer.name}
            </h3>
            <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5 text-secondary shrink-0" />
              <span>
                {activeStop.address.street}, {activeStop.address.zone}
              </span>
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-surface-low border border-outline-variant/60 flex items-center justify-between text-xs font-mono">
            <span>Payload: {activeStop.weightKg.toFixed(1)} kg</span>
            <span>Dwell: {activeStop.serviceDurationMinutes || 10} mins</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <a
              href={`tel:${activeStop.customer.phone}`}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-surface-low hover:bg-surface-container text-on-surface text-xs font-semibold border border-outline-variant transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-secondary" />
              Call Consignee
            </a>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              Verify POD
            </Button>
          </div>
        </div>
      )}

      {/* Manifest Queue Preview */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-on-surface uppercase tracking-wider block">
          Upcoming Stops in Sequence ({deliveries.length})
        </span>

        <div className="space-y-2">
          {deliveries.slice(1, 6).map((stop, i) => (
            <div
              key={stop.id}
              className="p-3 rounded-lg bg-surface-lowest border border-outline-variant flex items-center justify-between text-xs shadow-sm"
            >
              <div className="flex items-center gap-2.5 truncate">
                <span className="w-5 h-5 rounded-full bg-surface-low text-on-surface-variant flex items-center justify-center font-mono font-bold text-[10px] shrink-0">
                  {i + 2}
                </span>
                <div className="truncate">
                  <span className="font-semibold text-on-surface block truncate">
                    {stop.customer.name}
                  </span>
                  <span className="text-[11px] text-on-surface-variant truncate block">
                    {stop.address.street}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0 pl-2">
                <StatusBadge status={stop.status} size="sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
