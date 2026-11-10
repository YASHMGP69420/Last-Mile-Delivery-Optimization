import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { DriverHeader } from './DriverHeader';
import { DriverBottomNav } from './DriverBottomNav';
import { useAuth } from '../../context/AuthContext';
import { DriverSocketProvider } from '../../context/DriverSocketContext';
import { Loader2 } from 'lucide-react';
import { PageTransition } from '../common/MotionPrimitives';

export const DriverLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-surface">
        <Loader2 className="w-8 h-8 text-secondary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isMapRoute = location.pathname.startsWith('/driver/route');

  return (
    <DriverSocketProvider>
      <div className="flex flex-col h-[100dvh] w-full max-w-md mx-auto min-h-0 bg-surface overflow-hidden shadow-2xl border-x border-outline-variant">
        <DriverHeader />
        <main className="flex-1 min-h-0 flex flex-col bg-surface overscroll-contain overflow-hidden relative">
          <PageTransition className="flex-1 min-h-0 flex flex-col w-full h-full" skipTransform={isMapRoute}>
            <Outlet />
          </PageTransition>
        </main>
        <DriverBottomNav />
      </div>
    </DriverSocketProvider>
  );
};
