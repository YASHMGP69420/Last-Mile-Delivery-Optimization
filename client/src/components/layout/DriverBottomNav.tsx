import React from 'react';
import { NavLink } from 'react-router-dom';
import { Compass, Navigation, Package, Wrench, UserCircle } from 'lucide-react';
import { clsx } from 'clsx';

export const DriverBottomNav: React.FC = () => {
  const tabs = [
    { label: 'Cockpit', path: '/driver', icon: Compass },
    { label: 'My Route', path: '/driver/route', icon: Navigation },
    { label: 'Orders', path: '/driver/deliveries', icon: Package },
    { label: 'Vehicle', path: '/driver/vehicle-check', icon: Wrench },
    { label: 'Profile', path: '/driver/profile', icon: UserCircle },
  ];

  return (
    <nav className="h-16 bg-surface-lowest border-t border-outline-variant px-2 flex items-center justify-around shrink-0 z-30 shadow-lg select-none">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.path}
            to={tab.path}
            end={tab.path === '/driver'}
            className={({ isActive }) =>
              clsx(
                'flex flex-col items-center justify-center w-14 py-1 rounded-lg transition-all text-[10px] font-medium',
                isActive
                  ? 'text-secondary font-bold bg-secondary/10'
                  : 'text-on-surface-variant hover:text-on-surface'
              )
            }
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span>{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};
