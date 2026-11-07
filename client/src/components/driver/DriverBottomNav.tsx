import React from 'react';
import { NavLink } from 'react-router-dom';
import { Compass, ListChecks, Map, User, AlertOctagon } from 'lucide-react';
import { clsx } from 'clsx';

export interface DriverBottomNavProps {
  remainingStopsCount?: number;
  onSosTrigger?: () => void;
}

export const DriverBottomNav: React.FC<DriverBottomNavProps> = ({
  remainingStopsCount = 0,
  onSosTrigger,
}) => {
  const navItems = [
    { label: 'Cockpit', path: '/driver', icon: Compass, end: true },
    { label: 'Manifest', path: '/driver/deliveries', icon: ListChecks, badge: remainingStopsCount > 0 ? remainingStopsCount : undefined },
    { label: 'Live Map', path: '/driver/route', icon: Map },
    { label: 'Profile', path: '/driver/profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface-lowest/95 backdrop-blur-md border-t border-outline-variant/60 shadow-lg px-3 py-2 flex items-center justify-around select-none">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            className={({ isActive }) =>
              clsx(
                'flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl min-w-[64px] min-h-[48px] transition-all relative',
                isActive
                  ? 'text-primary font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={clsx(
                    'w-9 h-9 rounded-xl flex items-center justify-center transition-all',
                    isActive ? 'bg-primary/10 text-primary shadow-sm scale-105' : ''
                  )}
                >
                  <Icon className="w-5 h-5 stroke-[2]" />
                </div>
                <span className="text-[10px] tracking-tight mt-0.5">{item.label}</span>

                {/* Badge for remaining stops on Manifest */}
                {item.badge !== undefined && (
                  <span className="absolute top-1 right-2 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-amber-500 text-white shadow-sm">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        );
      })}

      {/* Quick SOS Trigger Button in bottom bar if requested */}
      {onSosTrigger && (
        <button
          onClick={onSosTrigger}
          title="Emergency Dispatch SOS"
          className="flex flex-col items-center justify-center py-1.5 px-2 rounded-2xl min-h-[48px] text-red-500 hover:text-red-600 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-red-600 border border-red-200">
            <AlertOctagon className="w-5 h-5 stroke-[2.2]" />
          </div>
          <span className="text-[10px] font-bold tracking-tight mt-0.5 text-red-600">SOS</span>
        </button>
      )}
    </nav>
  );
};
