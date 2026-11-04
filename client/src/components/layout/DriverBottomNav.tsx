import React from 'react';
import { NavLink } from 'react-router-dom';
import { Compass, ListOrdered, CheckCircle2, UserCircle } from 'lucide-react';
import { clsx } from 'clsx';

export const DriverBottomNav: React.FC = () => {
  const tabs = [
    { label: 'Active Stop', path: '/driver', icon: Compass },
    { label: 'Manifest', path: '/driver/stops', icon: ListOrdered },
    { label: 'POD Verification', path: '/driver/pod', icon: CheckCircle2 },
    { label: 'Profile', path: '/driver/profile', icon: UserCircle },
  ];

  return (
    <nav className="h-16 bg-surface-lowest border-t border-outline-variant px-4 flex items-center justify-around shrink-0 z-30 shadow-lg">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.path}
            to={tab.path}
            end={tab.path === '/driver'}
            className={({ isActive }) =>
              clsx(
                'flex flex-col items-center justify-center w-16 py-1 rounded-md transition-colors text-[11px] font-medium',
                isActive ? 'text-secondary font-bold' : 'text-on-surface-variant hover:text-on-surface'
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
