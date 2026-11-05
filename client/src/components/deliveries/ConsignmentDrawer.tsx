import React, { useEffect, useState } from 'react';
import { Drawer } from '../common/Drawer';
import { StatusBadge } from '../common/StatusBadge';
import { Delivery, AuditEvent, DeliveryStatus } from '../../types';
import { DeliveriesApi } from '../../api/client';
import {
  Package,
  MapPin,
  Clock,
  Phone,
  User,
  History,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface ConsignmentDrawerProps {
  delivery: Delivery | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChanged?: () => void;
}

export const ConsignmentDrawer: React.FC<ConsignmentDrawerProps> = ({
  delivery,
  isOpen,
  onClose,
  onStatusChanged,
}) => {
  const [timeline, setTimeline] = useState<AuditEvent[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState<boolean>(false);
  const [currentStatus, setCurrentStatus] = useState<DeliveryStatus | null>(delivery?.status || null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    if (delivery) {
      setCurrentStatus(delivery.status);
      setStatusError(null);
    }
  }, [delivery]);

  const handleStatusChange = async (newStatus: string) => {
    if (!delivery || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    setStatusError(null);
    try {
      await DeliveriesApi.updateStatus(delivery.id, { status: newStatus });
      setCurrentStatus(newStatus as DeliveryStatus);
      if (onStatusChanged) onStatusChanged();
    } catch (err: any) {
      setStatusError(err.response?.data?.error?.message || err.message || 'Failed to update delivery status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (delivery && isOpen) {
      const fetchDetails = async () => {
        setIsLoadingTimeline(true);
        try {
          const res = await DeliveriesApi.getById(delivery.id);
          if (isMounted && res.data && res.data.timeline) {
            setTimeline(res.data.timeline);
          }
        } catch (e) {
          console.warn('Failed to load consignment timeline:', e);
        } finally {
          if (isMounted) {
            setIsLoadingTimeline(false);
          }
        }
      };
      fetchDetails();
    } else {
      setTimeline([]);
    }
    return () => {
      isMounted = false;
    };
  }, [delivery?.id, isOpen]);

  if (!delivery) return null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={delivery.orderReference}
      subtitle="Canonical Bhubaneswar Waybill Specification"
      width="md"
    >
      <div className="space-y-6 text-sm">
        {/* Status & Priority Row */}
        <div className="p-3 rounded-lg bg-surface-low border border-outline-variant space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wider block">
                Consignment Status
              </span>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge status={currentStatus || delivery.status} />
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wider block">
                Handling Priority
              </span>
              <div className="mt-1">
                <StatusBadge status={delivery.priority} />
              </div>
            </div>
          </div>

          {/* Quick status transition dropdown/control */}
          <div className="pt-2 border-t border-outline-variant/60 flex items-center justify-between gap-2">
            <label htmlFor="status-select" className="text-xs text-on-surface-variant font-medium">
              Update Status:
            </label>
            <div className="flex items-center gap-2">
              <select
                id="status-select"
                disabled={isUpdatingStatus}
                value={currentStatus || delivery.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="text-xs bg-surface-lowest border border-outline-variant rounded px-2 py-1 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              >
                <option value="DRAFT">DRAFT</option>
                <option value="READY">READY</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="FAILED">FAILED</option>
              </select>
              {isUpdatingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
            </div>
          </div>
          {statusError && (
            <div className="p-2 rounded bg-error-container/20 border border-error/30 text-error text-xs flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{statusError}</span>
            </div>
          )}
        </div>

        {/* Consignee Card */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-4 h-4 text-secondary" />
            Consignee Profile
          </h4>
          <div className="p-3.5 rounded-lg border border-outline-variant bg-surface-lowest space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-semibold text-on-surface block text-sm">
                  {delivery.customer?.name || 'Unnamed Consignee'}
                </span>
                {delivery.customer?.email && (
                  <span className="text-xs text-on-surface-variant block">
                    {delivery.customer.email}
                  </span>
                )}
              </div>
              {delivery.customer?.phone && (
                <a
                  href={`tel:${delivery.customer.phone}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary/10 text-secondary hover:bg-secondary/20 text-xs font-mono font-medium transition-colors"
                >
                  <Phone className="w-3 h-3" />
                  {delivery.customer.phone}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Destination & Coordinates */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-secondary" />
            Delivery Destination
          </h4>
          <div className="p-3.5 rounded-lg border border-outline-variant bg-surface-lowest space-y-2">
            <p className="text-sm font-medium text-on-surface">{delivery.address?.street || 'No street specified'}</p>
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <span className="px-2 py-0.5 rounded bg-surface-low font-medium">
                {delivery.address?.zone || 'Unassigned Zone'}
              </span>
              <span>Pincode: {delivery.address?.postalCode || 'N/A'}</span>
            </div>
            {delivery.location?.coordinates && delivery.location.coordinates.length >= 2 && (
              <div className="pt-2 border-t border-outline-variant flex items-center justify-between text-xs font-mono text-on-surface-variant">
                <span>GeoJSON Coordinates:</span>
                <span className="text-secondary tabular-nums">
                  {delivery.location.coordinates[1].toFixed(5)}°N, {delivery.location.coordinates[0].toFixed(5)}°E
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Cargo Specification & SLA Window */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-outline-variant bg-surface-low">
            <span className="text-[11px] text-on-surface-variant font-medium block">
              Consignment Payload
            </span>
            <div className="mt-1 font-mono font-bold text-base text-on-surface tabular-nums">
              {(delivery.weightKg ?? 0).toFixed(1)} kg
            </div>
            <span className="text-[10px] text-on-surface-variant font-mono">
              Volume: {delivery.volumeM3 ? delivery.volumeM3.toFixed(3) : '0.010'} m³
            </span>
          </div>

          <div className="p-3 rounded-lg border border-outline-variant bg-surface-low">
            <span className="text-[11px] text-on-surface-variant font-medium block">
              SLA Time Window
            </span>
            <div className="mt-1 font-mono font-bold text-base text-secondary flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>
                {delivery.timeWindow?.start || '--:--'} - {delivery.timeWindow?.end || '--:--'}
              </span>
            </div>
            <span className="text-[10px] text-on-surface-variant">
              Service: {delivery.serviceDurationMinutes || 10} min dwell
            </span>
          </div>
        </div>

        {/* Immutable Audit Event Fulfillment Timeline */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-4 h-4 text-secondary" />
            Immutable Fulfillment Timeline
          </h4>

          {isLoadingTimeline ? (
            <div className="py-4 text-center">
              <Loader2 className="w-5 h-5 text-secondary animate-spin mx-auto" />
            </div>
          ) : timeline.length === 0 ? (
            <p className="text-xs text-on-surface-variant p-3 bg-surface-low rounded-md">
              No state transitions recorded yet.
            </p>
          ) : (
            <div className="space-y-3 relative pl-6 border-l-2 border-outline-variant">
              {timeline.map((event, idx) => (
                <div key={idx} className="relative group text-xs">
                  {/* Dot */}
                  <span className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-secondary ring-4 ring-white" />
                  <div className="p-2.5 rounded-md bg-surface-low border border-outline-variant/70 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-on-surface">{event.action}</span>
                      <span className="font-mono text-[10px] text-on-surface-variant">
                        {new Date(event.at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="text-[11px] text-on-surface-variant flex items-center justify-between">
                      <span>Actor: {typeof event.actorId === 'object' && event.actorId ? (event.actorId as any).name : 'System'} ({event.actorRole})</span>
                      <span className="font-mono text-[10px]">{event.type}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
};
