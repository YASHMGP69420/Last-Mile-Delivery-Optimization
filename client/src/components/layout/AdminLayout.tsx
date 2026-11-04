import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-surface">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-secondary animate-spin mx-auto" />
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
    <div className="flex h-screen w-screen overflow-hidden bg-surface">
      <AdminSidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-surface p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
