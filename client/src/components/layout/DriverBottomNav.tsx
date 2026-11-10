import React from 'react';
import { NavLink } from 'react-router-dom';
import { Compass, Navigation, Package, Wrench, UserCircle } from 'lucide-react';
import { clsx } from 'clsx';

export const DriverBottomNav: React.FC = () => {
  const tabs = [
    { label: 'Cockpit', path: '/driver', icon: Compass },
    { label: 'My Route', path: '/driver/route', icon: Navigation },
    { label: 'Manifest', path: '/driver/deliveries', icon: Package },
    { label: 'Vehicle', path: '/driver/vehicle-check', icon: Wrench },
    { label: 'Profile', path: '/driver/profile', icon: UserCircle },
  ];

  return (
    <nav className="glass-floating border-t border-outline-variant/60 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around shrink-0 z-30 shadow-soft select-none" aria-label="Driver Handheld Navigation">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.path}
            to={tab.path}
            end={tab.path === '/driver'}
            className={({ isActive }) =>
              clsx(
                'spring-press flex flex-col items-center justify-center min-w-[58px] min-h-[48px] px-1 py-1 rounded-2xl text-[10px] font-medium active:scale-90',
                isActive
                  ? 'text-primary font-bold bg-primary/12 shadow-xs scale-[1.03]'
                  : 'text-on-surface-variant hover:text-on-surface'
              )
            }
          >
            <Icon className="w-5 h-5 mb-0.5 stroke-[2.2]" />
            <span className="leading-tight">{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};
