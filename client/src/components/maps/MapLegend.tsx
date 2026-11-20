import React, { useState } from 'react';
import { Layers, ChevronDown, ChevronUp, Navigation } from 'lucide-react';

export interface MarkerFilters {
  drivers: boolean;
  nextStop: boolean;
  pending: boolean;
  completed: boolean;
  cancelled: boolean;
}

export interface MapLegendProps {
  filters: MarkerFilters;
  onToggleFilter: (key: keyof MarkerFilters) => void;
  className?: string;
}

interface FilterItemConfig {
  key: keyof MarkerFilters;
  label: string;
  badge: React.ReactNode;
}

export const MapLegend: React.FC<MapLegendProps> = ({
  filters,
  onToggleFilter,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const filterItems: FilterItemConfig[] = [
    {
      key: 'drivers',
      label: 'Live Drivers',
      badge: (
        <span
          data-testid="legend-badge-drivers"
          className="w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center text-white shrink-0 shadow-sm"
        >
          <Navigation className="w-2.5 h-2.5 fill-current" />
        </span>
      ),
    },
    {
      key: 'nextStop',
      label: 'Next Active Stop',
      badge: (
        <span
          data-testid="legend-badge-nextStop"
          className="w-3 h-3 rounded-full bg-indigo-500 border border-white dark:border-obsidian-950 shadow-sm shrink-0 inline-block"
        />
      ),
    },
    {
      key: 'pending',
      label: 'Pending Deliveries',
      badge: (
        <span
          data-testid="legend-badge-pending"
          className="w-3 h-3 rounded-full bg-emerald-500 border border-white dark:border-obsidian-950 shadow-sm shrink-0 inline-block"
        />
      ),
    },
    {
      key: 'completed',
      label: 'Completed (Delivered)',
      badge: (
        <span
          data-testid="legend-badge-completed"
          className="w-3 h-3 rounded-full bg-slate-500 border border-white dark:border-obsidian-950 shadow-sm shrink-0 inline-block"
        />
      ),
    },
    {
      key: 'cancelled',
      label: 'Cancelled / Failed',
      badge: (
        <span
          data-testid="legend-badge-cancelled"
          className="w-3 h-3 rounded-full bg-rose-500 border border-white dark:border-obsidian-950 shadow-sm shrink-0 inline-block"
        />
      ),
    },
  ];

  return (
    <div
      data-testid="map-legend-container"
      className={`absolute bottom-6 left-6 z-[1000] pointer-events-auto rounded-xl border border-white/20 dark:border-obsidian-750 bg-white/85 dark:bg-obsidian-950/85 backdrop-blur-md shadow-xl transition-all duration-200 text-xs text-on-surface ${className}`}
    >
      {/* Header Button Toggle */}
      <button
        type="button"
        data-testid="legend-toggle-btn"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left font-semibold text-on-surface hover:text-primary transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-primary" />
          <span>Map Legend & Layers</span>
        </span>
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-on-surface-muted" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-on-surface-muted" />
        )}
      </button>

      {/* Expanded Content: Filter Checkboxes & Route Polyline Indicators */}
      {isExpanded && (
        <div data-testid="legend-expanded-content" className="px-3 pb-3 pt-1 border-t border-white/10 dark:border-obsidian-800 space-y-2">
          {/* Layer Filter Checkboxes */}
          <div className="space-y-1.5">
            {filterItems.map((item) => (
              <label
                key={item.key}
                data-testid={`legend-filter-row-${item.key}`}
                className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-medium text-on-surface hover:text-primary transition-colors"
              >
                <input
                  type="checkbox"
                  data-testid={`filter-${item.key}`}
                  checked={filters[item.key]}
                  onChange={() => onToggleFilter(item.key)}
                  className="rounded border-outline-variant text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                />
                {item.badge}
                <span>{item.label}</span>
              </label>
            ))}
          </div>

          {/* Route Line Indicator Divider */}
          <div
            data-testid="legend-route-indicators"
            className="border-t border-outline-variant/40 dark:border-obsidian-800 pt-2 space-y-1.5 text-[10px] text-on-surface-variant font-medium"
          >
            <div className="flex items-center gap-2">
              <span
                data-testid="indicator-traversed"
                className="w-6 border-b-2 border-dashed border-slate-400 dark:border-slate-500 inline-block"
              />
              <span>Traversed Route</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                data-testid="indicator-remaining"
                className="w-6 border-b-2 border-solid border-emerald-500 inline-block"
              />
              <span>Remaining Route</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
