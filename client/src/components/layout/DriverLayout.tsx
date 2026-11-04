import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { DriverHeader } from './DriverHeader';
import { DriverBottomNav } from './DriverBottomNav';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

export const DriverLayout: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-surface">
        <Loader2 className="w-8 h-8 text-secondary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex flex-col h-screen w-screen max-w-md mx-auto bg-surface overflow-hidden shadow-2xl border-x border-outline-variant">
      <DriverHeader />
      <main className="flex-1 overflow-y-auto p-4 bg-surface">
        <Outlet />
      </main>
      <DriverBottomNav />
    </div>
  );
};
