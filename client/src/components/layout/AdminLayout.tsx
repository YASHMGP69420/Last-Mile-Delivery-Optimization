import React, { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { useAuth } from '../../context/AuthContext';
import { ArrowUp, Loader2 } from 'lucide-react';
import { PageTransition } from '../common/MotionPrimitives';
import { smoothScrollToTop } from '../../utils/smoothScroll';

export const AdminLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const isMapRoute =
    location.pathname.startsWith('/admin/optimizer') ||
    location.pathname.startsWith('/admin/routes') ||
    location.pathname.startsWith('/admin/tracking');

  useEffect(() => {
    if (isMapRoute) {
      setShowScrollTop(false);
    } else if (mainRef.current) {
      setShowScrollTop(mainRef.current.scrollTop > 360);
    }
  }, [isMapRoute, location.pathname]);

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

  if (user.role === 'DRIVER') {
    return <Navigate to="/driver" replace />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-canvas p-3 lg:p-4 gap-3 lg:gap-4 select-none">
      {/* Sleek Continuous Left Dock */}
      <AdminSidebar />

      {/* Main Content Viewport */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative">
        <main
          ref={mainRef}
          data-scroll-container="primary"
          onScroll={(e) => {
            if (isMapRoute) {
              setShowScrollTop(false);
              return;
            }
            setShowScrollTop(e.currentTarget.scrollTop > 360);
          }}
          className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar smooth-scroll overscroll-y-contain pr-1"
        >
          <PageTransition className="min-h-full" skipTransform={isMapRoute}>
            <Outlet />
          </PageTransition>
        </main>

        {!isMapRoute && showScrollTop && (
          <button
            type="button"
            aria-label="Scroll to top"
            title="Scroll to top"
            onClick={() => smoothScrollToTop(mainRef.current, 'smooth')}
            className="glass-floating spring-press fixed bottom-6 right-6 z-30 h-10 w-10 rounded-full flex items-center justify-center text-on-surface hover:text-primary"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
