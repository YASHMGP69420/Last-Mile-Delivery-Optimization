import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { DeliveriesPage } from './pages/DeliveriesPage';
import { BatchesPage } from './pages/BatchesPage';
import { RoutePlannerPage } from './pages/admin/RoutePlannerPage';
import { DriverHomePage } from './pages/DriverHomePage';
import { AdminLayout } from './components/layout/AdminLayout';
import { DriverLayout } from './components/layout/DriverLayout';

const RootRedirect: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  React.useEffect(() => {
    if (isLoading) return;
    if (!user) navigate('/login', { replace: true });
    else if (user.role === 'DRIVER') navigate('/driver', { replace: true });
    else navigate('/admin/deliveries', { replace: true });
  }, [user, isLoading, navigate]);
  return null;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Admin & Fleet Operations Layout */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/deliveries" replace />} />
            <Route path="deliveries" element={<DeliveriesPage />} />
            <Route path="batches" element={<BatchesPage />} />
            <Route path="optimizer" element={<RoutePlannerPage />} />
            <Route path="routes" element={<Navigate to="/admin/optimizer" replace />} />
            <Route path="*" element={<Navigate to="/admin/deliveries" replace />} />
          </Route>

          {/* Driver Mobile Layout */}
          <Route path="/driver" element={<DriverLayout />}>
            <Route index element={<DriverHomePage />} />
            <Route path="*" element={<Navigate to="/driver" replace />} />
          </Route>

          {/* Root fallback */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
