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

// Admin Control Center Pages
import { AdminControlCenterPage } from './pages/admin/AdminControlCenterPage';
import { UserManagementPage } from './pages/admin/UserManagementPage';
import { PermissionMatrixPage } from './pages/admin/PermissionMatrixPage';
import { OrganizationPage } from './pages/admin/OrganizationPage';
import { FleetControlPage } from './pages/admin/FleetControlPage';
import { OperationsControlPage } from './pages/admin/OperationsControlPage';
import { OptimizationSettingsPage } from './pages/admin/OptimizationSettingsPage';
import { FuelSettingsPage } from './pages/admin/FuelSettingsPage';
import { IntegrationsPage } from './pages/admin/IntegrationsPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { SystemNotificationsPage } from './pages/admin/SystemNotificationsPage';
import { DataManagementPage } from './pages/admin/DataManagementPage';

// Driver HUD Pages
import { DriverCockpitPage } from './pages/driver/DriverCockpitPage';
import { DriverRoutePage } from './pages/driver/DriverRoutePage';
import { DriverDeliveriesPage } from './pages/driver/DriverDeliveriesPage';
import { DriverDeliveryDetailPage } from './pages/driver/DriverDeliveryDetailPage';
import { DriverVehicleCheckPage } from './pages/driver/DriverVehicleCheckPage';
import { DriverSupportPage } from './pages/driver/DriverSupportPage';
import { DriverProfilePage } from './pages/driver/DriverProfilePage';

import { AdminLayout } from './components/layout/AdminLayout';
import { DriverLayout } from './components/layout/DriverLayout';

const RootRedirect: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  React.useEffect(() => {
    if (isLoading) return;
    if (!user) navigate('/login', { replace: true });
    else if (user.role === 'DRIVER') navigate('/driver', { replace: true });
    else if (user.role === 'ADMIN') navigate('/admin/control-center', { replace: true });
    else navigate('/admin/deliveries', { replace: true });
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
          <Routes>
            {/* Public Authentication Route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Admin & Fleet Operations Layout */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/deliveries" replace />} />
              {/* Common Operations */}
              <Route path="deliveries" element={<DeliveriesPage />} />
              <Route path="batches" element={<BatchesPage />} />
              <Route path="optimizer" element={<RoutePlannerPage />} />
              <Route path="routes" element={<Navigate to="/admin/optimizer" replace />} />
              <Route path="fleets" element={<FleetsPage />} />
              <Route path="drivers" element={<DriversPage />} />
              <Route path="tracking" element={<TrackingPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />

              {/* Super Admin Exclusive Modules */}
              <Route element={<SuperAdminGuard />}>
                <Route path="control-center" element={<AdminControlCenterPage />} />
                <Route path="users" element={<UserManagementPage />} />
                <Route path="permissions" element={<PermissionMatrixPage />} />
                <Route path="organization" element={<OrganizationPage />} />
                <Route path="fleet-control" element={<FleetControlPage />} />
                <Route path="operations" element={<OperationsControlPage />} />
                <Route path="optimization-settings" element={<OptimizationSettingsPage />} />
                <Route path="fuel-settings" element={<FuelSettingsPage />} />
                <Route path="integrations" element={<IntegrationsPage />} />
                <Route path="audit-logs" element={<AuditLogsPage />} />
                <Route path="notifications" element={<SystemNotificationsPage />} />
                <Route path="data-management" element={<DataManagementPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/admin/deliveries" replace />} />
            </Route>

            {/* Driver HUD / Cockpit Layout */}
            <Route path="/driver" element={<DriverLayout />}>
              <Route index element={<DriverCockpitPage />} />
              <Route path="home" element={<DriverCockpitPage />} />
              <Route path="route" element={<DriverRoutePage />} />
              <Route path="deliveries" element={<DriverDeliveriesPage />} />
              <Route path="deliveries/:id" element={<DriverDeliveryDetailPage />} />
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
