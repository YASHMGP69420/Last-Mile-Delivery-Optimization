import React, { useState } from 'react';
import {
  Navigation,
  Phone,
  CheckCircle2,
  MapPin,
  Clock,
  Package,
  AlertTriangle,
  ChevronDown,
  Loader2,
  ExternalLink,
  Snowflake,
  Zap,
} from 'lucide-react';
import { Button } from '../common/Button';

export interface CurrentStopProps {
  stop: {
    id?: string;
    deliveryId?: string;
    orderReference?: string;
    recipientName?: string;
    recipientPhone?: string;
    address?: string;
    zone?: string;
    weightKg?: number;
    priority?: string;
    status?: 'PENDING' | 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'ARRIVED' | 'COMPLETED' | 'FAILED' | string;
    coordinates?: [number, number]; // [lng, lat]
    location?: { lat: number; lng: number };
    sequenceOrder?: number;
    estimatedArrival?: string;
    distanceFromPrevKm?: number;
  };
  totalStops: number;
  currentStopIndex: number;
  onMarkArrived: (stopId: string) => Promise<void>;
  onCompleteStop: (stopId: string) => Promise<void>;
  onSkipStop: (stopId: string, reason: string) => Promise<void>;
  isActionLoading?: boolean;
}

export const CurrentStopHeroCard: React.FC<CurrentStopProps> = ({
  stop,
  totalStops,
  currentStopIndex,
  onMarkArrived,
  onCompleteStop,
  onSkipStop,
  isActionLoading = false,
}) => {
  const [showSkipMenu, setShowSkipMenu] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('ROAD_BLOCKED');

  const stopId = stop.id || stop.deliveryId || '';
  const lat = stop.location?.lat ?? (stop.coordinates ? stop.coordinates[1] : 20.2961);
  const lng = stop.location?.lng ?? (stop.coordinates ? stop.coordinates[0] : 85.8245);

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const phoneUrl = stop.recipientPhone ? `tel:${stop.recipientPhone.replace(/\s+/g, '')}` : null;

  const isArrived = stop.status === 'ARRIVED';
  const isUrgent = stop.priority === 'Urgent';
  const isColdChain = stop.priority === 'Cold Chain';

  const skipReasons = [
    { code: 'ROAD_BLOCKED', label: 'Road / Access Blocked' },
    { code: 'ADDRESS_UNREACHABLE', label: 'Address Unreachable' },
    { code: 'PREMISES_CLOSED', label: 'Premises Closed / Gate Locked' },
    { code: 'CUSTOMER_POSTPONED', label: 'Customer Requested Postponement' },
  ];

  const handleSkipConfirm = async () => {
    setShowSkipMenu(false);
    await onSkipStop(stopId, selectedReason);
  };

  return (
    <div className="bg-surface-lowest rounded-3xl p-5 sm:p-6 shadow-soft border border-outline-variant/60 flex flex-col justify-between space-y-5 transition-all">
      {/* 1. Top Identity Row: Step Counter & Priority Pills */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-primary text-white shadow-emerald">
            Stop {currentStopIndex} of {totalStops}
          </span>
          {stop.orderReference && (
            <span className="text-xs font-mono font-semibold text-on-surface-variant">
              #{stop.orderReference}
            </span>
          )}
        </div>

        {/* Priority & Status Pills */}
        <div className="flex items-center gap-1.5">
          {isColdChain && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
              <Snowflake className="w-3 h-3 text-cyan-600 animate-spin" />
              Cold Chain
            </span>
          )}
          {isUrgent && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <Zap className="w-3 h-3 text-amber-600 fill-amber-500" />
              Urgent
            </span>
          )}
          {isArrived && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              At Stop
            </span>
          )}
        </div>
      </div>

      {/* 2. Main Destination & Customer Block */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-on-surface tracking-tight">
              {stop.recipientName || 'Customer Consignment'}
            </h2>
            <div className="flex items-center gap-2 text-xs text-on-surface-variant mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="font-medium text-on-surface">
                {stop.address || 'Bhubaneswar Urban Delivery Zone'}
              </span>
            </div>
          </div>

          {/* Quick Call Button */}
          {phoneUrl && (
            <a
              href={phoneUrl}
              className="w-11 h-11 rounded-2xl bg-surface-low hover:bg-surface-container border border-outline-variant/60 flex items-center justify-center text-primary transition-colors shadow-sm shrink-0"
              title="Call Recipient"
            >
              <Phone className="w-5 h-5 stroke-[2.2]" />
            </a>
          )}
        </div>

        {/* Operational Metadata Strip: Weight, Zone, ETA */}
        <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-on-surface-variant font-mono">
          {stop.weightKg && (
            <div className="flex items-center gap-1 bg-surface-low px-2.5 py-1 rounded-lg border border-outline-variant/40">
              <Package className="w-3.5 h-3.5 text-on-surface-variant" />
              <span>{stop.weightKg} kg</span>
            </div>
          )}
          {stop.zone && (
            <div className="bg-surface-low px-2.5 py-1 rounded-lg border border-outline-variant/40">
              <span>{stop.zone}</span>
            </div>
          )}
          {stop.estimatedArrival && (
            <div className="flex items-center gap-1 bg-surface-low px-2.5 py-1 rounded-lg border border-outline-variant/40">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>ETA: {stop.estimatedArrival}</span>
            </div>
          )}
          {stop.distanceFromPrevKm !== undefined && (
            <div className="text-on-surface-variant/80">
              • {stop.distanceFromPrevKm.toFixed(1)} km away
            </div>
          )}
        </div>
      </div>

      {/* 3. Action Grid: Navigation + Stop Progression */}
      <div className="space-y-2.5 pt-2 border-t border-outline-variant/40">
        {/* Primary 1-Tap Google Maps Navigation Button */}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3.5 px-4 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 shadow-emerald hover:bg-primary-hover active:scale-[0.99] transition-all select-none"
        >
          <Navigation className="w-4 h-4 stroke-[2.5]" />
          <span>Start Google Maps Navigation</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-70" />
        </a>

        {/* Secondary Progression Buttons: Predictable Thumb Ergonomics */}
        <div className="grid grid-cols-3 gap-2">
          {/* Main Progression Button (Left 2 Columns) */}
          <div className="col-span-2">
            {!isArrived ? (
              <Button
                variant="outline"
                size="md"
                className="w-full h-12 font-bold rounded-2xl border-primary text-primary hover:bg-primary/5 active:scale-[0.99] text-xs sm:text-sm"
                onClick={() => onMarkArrived(stopId)}
                isLoading={isActionLoading}
                leftIcon={<MapPin className="w-4 h-4 text-primary shrink-0" />}
              >
                Mark Arrived
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                className="w-full h-12 font-bold rounded-2xl bg-emerald hover:bg-emerald-hover text-white shadow-emerald active:scale-[0.99] text-xs sm:text-sm"
                onClick={() => onCompleteStop(stopId)}
                isLoading={isActionLoading}
                leftIcon={<CheckCircle2 className="w-4 h-4 stroke-[2.5] shrink-0" />}
              >
                Complete Stop
              </Button>
            )}
          </div>

          {/* Exception Handler (Right 1 Column) */}
          <Button
            variant="outline"
            size="md"
            className="w-full h-12 font-semibold rounded-2xl border-outline-variant text-amber-800 hover:bg-amber-50/80 active:scale-[0.99] text-xs flex items-center justify-center gap-1"
            onClick={() => setShowSkipMenu(!showSkipMenu)}
            isLoading={isActionLoading}
            leftIcon={<AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
          >
            Skip
          </Button>
        </div>

        {/* Inline Skip Dialog Panel */}
        {showSkipMenu && (
          <div className="p-3.5 bg-surface-low rounded-2xl border border-amber-200/80 space-y-2.5 animate-fadeIn">
            <span className="text-xs font-bold text-on-surface block">
              Select Operational Skip Reason:
            </span>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full text-xs rounded-xl border border-outline-variant bg-surface-lowest px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {skipReasons.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowSkipMenu(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={handleSkipConfirm}
                isLoading={isActionLoading}
              >
                Confirm Skip
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
