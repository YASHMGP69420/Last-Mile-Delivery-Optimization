import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LoginPage } from './pages/LoginPage';
import { DeliveriesPage } from './pages/DeliveriesPage';
import { BatchesPage } from './pages/BatchesPage';
import { RoutePlannerPage } from './pages/admin/RoutePlannerPage';
import { FleetsPage } from './pages/admin/FleetsPage';
import { DriversPage } from './pages/admin/DriversPage';
import { TrackingPage } from './pages/admin/TrackingPage';
import { AnalyticsPage } from './pages/admin/AnalyticsPage';

// Admin & Operations Pages
import { AdminControlCenterPage } from './pages/admin/AdminControlCenterPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { SystemNotificationsPage } from './pages/admin/SystemNotificationsPage';
import { UserManagementPage } from './pages/admin/UserManagementPage';

// Driver HUD Pages
import { DriverCockpitPage } from './pages/driver/DriverCockpitPage';
import { DriverRoutePage } from './pages/driver/DriverRoutePage';
import { DriverDeliveriesPage } from './pages/driver/DriverDeliveriesPage';
import { DriverVehicleCheckPage } from './pages/driver/DriverVehicleCheckPage';
import { DriverSupportPage } from './pages/driver/DriverSupportPage';
import { DriverProfilePage } from './pages/driver/DriverProfilePage';

import { AdminLayout } from './components/layout/AdminLayout';
import { DriverLayout } from './components/layout/DriverLayout';
import { ScrollManager } from './components/common/ScrollManager';

const RootRedirect: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  React.useEffect(() => {
    if (isLoading) return;
    if (!user) navigate('/login', { replace: true });
    else if (user.role === 'DRIVER') navigate('/driver', { replace: true });
    else navigate('/admin/control-center', { replace: true });
  }, [user, isLoading, navigate]);
  return null;
};

// Route guard for Super Admin exclusive views
const SuperAdminGuard: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/admin/deliveries" replace />;
  }
  return <Outlet />;
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ScrollManager />
          <Routes>
            {/* Public Authentication Route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Admin & Fleet Operations Layout */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/control-center" replace />} />
              {/* Operations, Dispatch, Telemetry & Shared Alerts */}
              <Route path="control-center" element={<AdminControlCenterPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="deliveries" element={<DeliveriesPage />} />
              <Route path="batches" element={<BatchesPage />} />
              <Route path="optimizer" element={<RoutePlannerPage />} />
              <Route path="routes" element={<Navigate to="/admin/optimizer" replace />} />
              <Route path="fleets" element={<FleetsPage />} />
              <Route path="drivers" element={<DriversPage />} />
              <Route path="tracking" element={<TrackingPage />} />
              <Route path="notifications" element={<SystemNotificationsPage />} />

              {/* Super Admin Exclusive Audit Trail */}
              <Route element={<SuperAdminGuard />}>
                <Route path="audit-logs" element={<AuditLogsPage />} />
                <Route path="users" element={<UserManagementPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/admin/control-center" replace />} />
            </Route>

            {/* Driver HUD / Cockpit Layout */}
            <Route path="/driver" element={<DriverLayout />}>
              <Route index element={<DriverCockpitPage />} />
              <Route path="home" element={<DriverCockpitPage />} />
              <Route path="route" element={<DriverRoutePage />} />
              <Route path="deliveries" element={<DriverDeliveriesPage />} />
              <Route path="manifest" element={<Navigate to="/driver/deliveries" replace />} />
              <Route path="vehicle-check" element={<DriverVehicleCheckPage />} />
              <Route path="support" element={<DriverSupportPage />} />
              <Route path="profile" element={<DriverProfilePage />} />
              <Route path="*" element={<Navigate to="/driver" replace />} />
            </Route>

            {/* Root fallback */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
