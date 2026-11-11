import React, { useState } from 'react';
import { PODModal, PODData } from './PODModal';
import { Button } from '../common/Button';
import { formatAddress } from '../../utils/formatters';
import { buildNavigationUrl } from '../../utils/googleMaps';
import {
  Navigation,
  Phone,
  CheckCircle2,
  MapPin,
  Clock,
  Package,
  AlertTriangle,
  ExternalLink,
  Snowflake,
  Zap,
} from 'lucide-react';

export interface CurrentStopProps {
  stop: {
    id?: string;
    deliveryId?: string;
    orderReference?: string;
    recipientName?: string;
    recipientPhone?: string;
    address?: any;
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
  onCompleteStop: (stopId: string, pod?: PODData) => Promise<void>;
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
  const [selectedReason, setSelectedReason] = useState<string>('CUSTOMER_UNAVAILABLE');
  const [isPodOpen, setIsPodOpen] = useState(false);

  const stopId = stop.id || stop.deliveryId || '';
  const lat = stop.location?.lat ?? (stop.coordinates ? stop.coordinates[1] : 20.2961);
  const lng = stop.location?.lng ?? (stop.coordinates ? stop.coordinates[0] : 85.8245);

  const googleMapsUrl = buildNavigationUrl({ destination: [lat, lng] });
  const phoneUrl = stop.recipientPhone ? `tel:${stop.recipientPhone.replace(/\s+/g, '')}` : null;

  const isArrived = stop.status === 'ARRIVED';
  const isUrgent = stop.priority === 'Urgent';
  const isColdChain = stop.priority === 'Cold Chain';

  const skipReasons = [
    { code: 'CUSTOMER_UNAVAILABLE', label: 'Customer Unavailable / No Response' },
    { code: 'ACCESS_RESTRICTED', label: 'Road / Gate Access Restricted' },
    { code: 'WRONG_ADDRESS', label: 'Wrong / Incomplete Address' },
    { code: 'DAMAGED_PACKAGE', label: 'Consignment Damaged' },
    { code: 'TIME_EXPIRED', label: 'Delivery Window Expired' },
    { code: 'OTHER', label: 'Other Operational Exception' },
  ];

  const handleSkipConfirm = async () => {
    setShowSkipMenu(false);
    await onSkipStop(stopId, selectedReason);
  };

  const handlePodComplete = async (podData: PODData) => {
    setIsPodOpen(false);
    await onCompleteStop(stopId, podData);
  };

  return (
    <div className="bg-surface-lowest dark:bg-obsidian-900 rounded-xl p-5 border border-outline-variant/60 dark:border-obsidian-750 flex flex-col justify-between space-y-4 transition-colors">
      {/* 1. Top Identity Row: Step Counter & Priority Pills */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-md text-xs font-semibold font-mono bg-primary text-white">
            Stop {currentStopIndex} of {totalStops}
          </span>
          {stop.orderReference && (
            <span className="text-xs font-mono font-medium text-on-surface-variant dark:text-slate-400">
              #{stop.orderReference}
            </span>
          )}
        </div>

        {/* Priority & Status Micro-Tags */}
        <div className="flex items-center gap-1.5">
          {isColdChain && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-mono uppercase tracking-wider font-semibold bg-surface-low dark:bg-obsidian-850 text-on-surface dark:text-sky-200 border border-outline-variant/80 dark:border-obsidian-750 border-l-[3px] border-l-sky-400">
              <Snowflake className="w-3 h-3 text-sky-400" />
              Cold Chain
            </span>
          )}
          {isUrgent && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-mono uppercase tracking-wider font-semibold bg-surface-low dark:bg-obsidian-850 text-on-surface dark:text-amber-200 border border-outline-variant/80 dark:border-obsidian-750 border-l-[3px] border-l-amber-500">
              <Zap className="w-3 h-3 text-amber-500" />
              Urgent
            </span>
          )}
          {isArrived && (
            <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-mono uppercase tracking-wider font-semibold bg-surface-low dark:bg-obsidian-850 text-on-surface dark:text-zinc-100 border border-outline-variant/80 dark:border-obsidian-750 border-l-[3px] border-l-primary">
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
                {formatAddress(stop.address) || 'Bhubaneswar Urban Delivery Zone'}
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
          aria-label="Start Google Maps navigation for current stop"
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
                aria-label="Mark arrived at current stop"
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
                aria-label="Complete delivery for current stop"
                className="w-full h-12 font-bold rounded-2xl bg-emerald hover:bg-emerald-hover text-white shadow-emerald active:scale-[0.99] text-xs sm:text-sm"
                onClick={() => setIsPodOpen(true)}
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
            aria-label="Skip current stop with operational exception"
            aria-expanded={showSkipMenu}
            className="w-full h-12 font-semibold rounded-2xl border-outline-variant text-amber-800 dark:text-amber-300 hover:bg-amber-50/80 dark:hover:bg-amber-500/15 active:scale-[0.99] text-xs flex items-center justify-center gap-1"
            onClick={() => setShowSkipMenu(!showSkipMenu)}
            isLoading={isActionLoading}
            leftIcon={<AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />}
          >
            Skip
          </Button>
        </div>

        {/* Inline Skip Dialog Panel */}
        {showSkipMenu && (
          <div className="p-3.5 bg-surface-low rounded-2xl border border-amber-200/80 dark:border-amber-500/30 space-y-2.5 animate-fadeIn" role="region" aria-label="Skip delivery options">
            <label htmlFor="skip-reason-select" className="text-xs font-bold text-on-surface block">
              Select Operational Skip Reason:
            </label>
            <select
              id="skip-reason-select"
              aria-label="Select operational skip reason"
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full text-xs rounded-xl border border-outline-variant bg-surface-lowest px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {skipReasons.map((r) => (
                <option key={r.code} value={r.code} >
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

      {isPodOpen && (
        <PODModal
          isOpen={isPodOpen}
          onClose={() => setIsPodOpen(false)}
          onComplete={handlePodComplete}
        />
      )}
    </div>
  );
};
