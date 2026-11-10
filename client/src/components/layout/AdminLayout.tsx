import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';
import { PageTransition } from '../common/MotionPrimitives';

export const AdminLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const isMapRoute =
    location.pathname.startsWith('/admin/optimizer') ||
    location.pathname.startsWith('/admin/routes') ||
    location.pathname.startsWith('/admin/tracking');

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-surface-canvas">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Initializing SmartRoute Platform...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-canvas p-3 lg:p-4 gap-3 lg:gap-4 select-none">
      {/* Sleek Continuous Left Dock */}
      <AdminSidebar />

      {/* Main Content Viewport */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pr-1">
          <PageTransition className="min-h-full" skipTransform={isMapRoute}>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  );
};
