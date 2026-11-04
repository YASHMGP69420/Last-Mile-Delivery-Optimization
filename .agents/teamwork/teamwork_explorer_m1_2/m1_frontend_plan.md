# Milestone 1 Frontend Technical Implementation Plan

**Target System:** SmartRoute — Last-Mile Delivery Optimization Platform  
**Target Subsystem:** Client Web Application (`client/`)  
**Milestone:** M1 — Core Scaffolding, Identity & Fleet Operations  
**Author:** Teamwork Explorer M1-2 (`teamwork_explorer_m1_2`)  
**Date:** 2026-11-03  
**Status:** Complete Implementation Specification  

---

## 1. Executive Summary & Design System Foundations

This specification establishes the architectural blueprint, type contracts, component tree, and layout mechanics for the **Milestone 1 Frontend** of SmartRoute. The frontend is built on **React 18**, **TypeScript**, **Vite**, **React Router v6**, and **Tailwind CSS**, strictly reproducing the enterprise command aesthetic specified in Google Stitch designs (`smartroute_delivery_operations_batch_management` and `smartroute_logistics_operations_system/DESIGN.md`).

### 1.1 Stitch Visual Tokens & Palette Mapping

The design system enforces high information density, crisp boundary delineations, and zero layout shift during real-time data ingestion.

| Token Name | Hex Code | Utility / Context | Tailwind Class |
|---|---|---|---|
| `primary` | `#14243A` | Deep Navy: Command bars, primary sidebar, master page headers, solid badges | `bg-primary`, `text-primary` |
| `primary-hover` | `#1E3557` | Hover state for primary buttons and nav items | `hover:bg-primary-hover` |
| `secondary` | `#0051D5` / `#2563EB` | Electric Blue: Interactive buttons, active route vectors, selection rings, primary action triggers | `bg-secondary`, `text-secondary`, `ring-secondary` |
| `secondary-container` | `#316BF3` / `#DBEAFE` | Active nav pill backgrounds, in-transit telemetry pill container | `bg-secondary-container`, `text-secondary` |
| `surface` | `#FAF8FF` / `#F8FAFC` | Ergonomic low-glare dashboard canvas background | `bg-surface` |
| `surface-container-lowest` | `#FFFFFF` | Card shells, table row backgrounds, modal bodies, slide-over panels | `bg-surface-lowest` |
| `surface-container-low` | `#F2F3FF` / `#F1F5F9` | Table header bars, bento sub-panels, input background accents | `bg-surface-low` |
| `surface-container` | `#EAEDFF` | Input fields, search bars, pill container backdrops | `bg-surface-container` |
| `surface-container-high` | `#E2E7FF` | Gauge background tracks, hover container highlights | `bg-surface-high` |
| `outline` | `#75777D` | High-contrast divider rules and borders | `border-outline` |
| `outline-variant` | `#C5C6CD` / `#E2E8F0` | Subtle card dividers and table grid rules | `border-outline-variant` |
| `text-primary` | `#131B2E` / `#0F172A` | Primary typography, headers, metric figures | `text-on-surface` |
| `text-secondary` | `#44474D` / `#64748B` | Subheaders, meta tags, table header labels | `text-on-surface-variant` |
| `success` | `#16A34A` | Fulfilled / Completed deliveries, active GPS connection, valid dry-run status | `bg-success`, `text-success` |
| `warning` | `#F59E0B` | Delayed deliveries, approaching SLA window, shift break alerts | `bg-warning`, `text-warning` |
| `error` | `#BA1A1A` / `#DC2626` | Delivery exceptions, unassigned payload alerts, failed CSV rows, SLA breaches | `bg-error`, `text-error` |
| `error-container` | `#FFDAD6` / `#FEE2E2` | Exception pill background, invalid table row tint | `bg-error-container` |

### 1.2 Typography & Tabular Lining Numbers
- **Font Family:** `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Tabular Figures (`tnum`):** Enforced across all coordinates, weights (kg), volumes ($m^3$), order IDs, timestamps, and ETA metrics via the utility class `tabular-nums` / `font-mono-numbers`. This prevents horizontal layout jitter as values update dynamically.

---

## 2. `client/` Package & Build Configuration

The current `client/` workspace contains a bare Vite template without React or routing dependencies. The implementer must update the configuration files as specified below.

### 2.1 `client/package.json`

```json
{
  "name": "smartroute-client",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext ts,tsx"
  },
  "dependencies": {
    "axios": "^1.7.2",
    "clsx": "^2.1.1",
    "lucide-react": "^0.378.0",
    "papaparse": "^5.4.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.1",
    "tailwind-merge": "^2.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.12",
    "@types/papaparse": "^5.3.14",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.3",
    "typescript": "^5.4.5",
    "vite": "^5.2.11"
  }
}
```

### 2.2 `client/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
```

### 2.3 `client/tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#14243A',
          hover: '#1E3557',
          container: '#14243A',
          on: '#FFFFFF',
          'on-container': '#7C8BA6',
        },
        secondary: {
          DEFAULT: '#0051D5',
          hover: '#316BF3',
          container: '#DBEAFE',
          fixed: '#DBE1FF',
          'on-fixed': '#00174B',
          on: '#FFFFFF',
        },
        surface: {
          DEFAULT: '#FAF8FF',
          canvas: '#FAF8FF',
          lowest: '#FFFFFF',
          low: '#F2F3FF',
          container: '#EAEDFF',
          high: '#E2E7FF',
          highest: '#DAE2FD',
        },
        'on-surface': {
          DEFAULT: '#131B2E',
          variant: '#44474D',
          muted: '#64748B',
        },
        outline: {
          DEFAULT: '#75777D',
          variant: '#C5C6CD',
          subtle: '#E2E8F0',
        },
        success: {
          DEFAULT: '#16A34A',
          container: '#DCFCE7',
          on: '#FFFFFF',
          border: '#BBF7D0',
        },
        warning: {
          DEFAULT: '#F59E0B',
          container: '#FEF3C7',
          on: '#FFFFFF',
          border: '#FDE68A',
        },
        error: {
          DEFAULT: '#BA1A1A',
          alt: '#DC2626',
          container: '#FFDAD6',
          'container-subtle': '#FEE2E2',
          on: '#FFFFFF',
          border: '#FECACA',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        'display-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['24px', { lineHeight: '32px', letterSpacing: '-0.015em', fontWeight: '600' }],
        'headline-md': ['20px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'title-lg': ['16px', { lineHeight: '24px', letterSpacing: '-0.005em', fontWeight: '600' }],
        'title-md': ['14px', { lineHeight: '20px', letterSpacing: '0em', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '18px', fontWeight: '400' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.01em', fontWeight: '500' }],
        'label-sm': ['11px', { lineHeight: '14px', letterSpacing: '0.03em', fontWeight: '600' }],
        'code-sm': ['12px', { lineHeight: '16px', letterSpacing: '0em', fontWeight: '500' }],
      },
      borderRadius: {
        sm: '0.125rem',
        DEFAULT: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(20, 36, 58, 0.05)',
        md: '0 4px 12px -2px rgba(20, 36, 58, 0.08), 0 2px 6px -1px rgba(20, 36, 58, 0.04)',
        xl: '0 20px 25px -5px rgba(20, 36, 58, 0.12), 0 8px 10px -6px rgba(20, 36, 58, 0.08)',
      },
    },
  },
  plugins: [],
};
```

### 2.4 `client/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    /* Path Aliases */
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 2.5 `client/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <title>SmartRoute — Last-Mile Delivery Optimization</title>
  </head>
  <body class="bg-surface font-sans text-on-surface antialiased selection:bg-secondary selection:text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## 3. Domain Models & TypeScript Interfaces

All domain contracts reside in `client/src/types/`.

### 3.1 `client/src/types/auth.ts`
```typescript
export type UserRole = 'ADMIN' | 'FLEET_MANAGER' | 'DRIVER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  active: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  refreshToken?: string;
  user: User;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
```

### 3.2 `client/src/types/delivery.ts`
```typescript
export type DeliveryPriority = 'Standard' | 'Urgent' | 'Cold Chain';

export type DeliveryStatus =
  | 'DRAFT'
  | 'READY'
  | 'ASSIGNED'
  | 'OUT_FOR_DELIVERY'
  | 'COMPLETED'
  | 'FAILED';

export interface GeoCoordinate {
  lat: number;
  lng: number;
}

export interface TimeWindow {
  start: string; // HH:mm format, e.g. "09:00"
  end: string;   // HH:mm format, e.g. "11:00"
}

export interface FulfillmentMilestone {
  id: string;
  title: string;
  timestamp: string;
  description: string;
  status: 'COMPLETED' | 'ACTIVE' | 'PENDING';
  actorName?: string;
}

export interface DeliveryConsignment {
  id: string;
  orderId: string; // e.g. "#DEL-8492"
  sku?: string;
  recipientName: string;
  recipientPhone: string;
  address: string;
  landmark?: string;
  zone: string; // e.g. "Patia (Z-1)", "Jaydev Vihar (Z-2)"
  geo: GeoCoordinate;
  weightKg: number;
  volumeM3: number;
  priority: DeliveryPriority;
  timeWindow: TimeWindow;
  status: DeliveryStatus;
  batchId?: string;
  assignedDriver?: {
    id: string;
    name: string;
    initials: string;
    phone: string;
  };
  assignedVehicle?: {
    id: string;
    plateNumber: string; // e.g. "OD-02-B-1102"
    model: string;       // e.g. "Mahindra Bolero Maxi"
    type: 'Van' | 'EV' | 'Bike';
  };
  specialInstructions?: string;
  failureReason?: string;
  milestones?: FulfillmentMilestone[];
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryKPIs {
  totalDeliveries: number;
  deliveriesChangePercent: number;
  unbatchedCount: number;
  criticalSlaCount: number;
  inTransitCount: number;
  onSchedulePercent: number;
  completedCount: number;
  fulfillmentPercent: number;
  averageOtpSeconds: number;
  exceptionsCount: number;
  addressIncorrectCount: number;
}
```

### 3.3 `client/src/types/batch.ts`
```typescript
export type BatchStatus = 'DRAFT' | 'READY' | 'PLANNED' | 'IN_PROGRESS' | 'CLOSED';

export interface StagedStop {
  sequence: number;
  deliveryId: string;
  orderId: string;
  destination: string;
  estimatedArrival: string;
  priority: 'Standard' | 'Urgent' | 'Cold Chain';
}

export interface DeliveryBatch {
  id: string;
  code: string; // e.g. "BBSR-AM-EXPRESS-09"
  name: string;
  depotId: string;
  depotName: string; // e.g. "Rasulgarh Central Hub"
  depotGeo: { lat: number; lng: number };
  status: BatchStatus;
  deliveryIds: string[];
  stops?: StagedStop[];
  totalWeightKg: number;
  totalVolumeM3: number;
  vehicleCapacityKg: number;
  assignedVehicleId?: string;
  assignedVehicle?: {
    id: string;
    plateNumber: string;
    model: string;
    type: 'Van' | 'EV' | 'Bike';
    capacityKg: number;
  };
  assignedDriverId?: string;
  assignedDriver?: {
    id: string;
    name: string;
    punctualityRate: number;
    phone: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateBatchPayload {
  code: string;
  name: string;
  depotId: string;
  deliveryIds: string[];
  assignedVehicleId?: string;
  assignedDriverId?: string;
}
```

### 3.4 `client/src/types/csv.ts`
```typescript
export interface CsvDeliveryRow {
  orderId?: string;
  customerName: string;
  phone: string;
  address: string;
  zone: string;
  weightKg: string | number;
  volumeM3: string | number;
  priority: 'Standard' | 'Urgent' | 'Cold Chain';
  timeWindowStart: string;
  timeWindowEnd: string;
}

export interface CsvValidationRowError {
  rowIndex: number;
  field: keyof CsvDeliveryRow;
  message: string;
  rawValue: string;
}

export interface CsvDryRunResult {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  validRows: DeliveryConsignment[];
  errors: CsvValidationRowError[];
}
```

---

## 4. API Client & Authentication State

### 4.1 Axios Client Configuration (`client/src/services/api.ts`)

```typescript
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor injecting Bearer JWT token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('smartroute_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response interceptor handling unauthenticated session expiry
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('smartroute_token');
      localStorage.removeItem('smartroute_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=true';
      }
    }
    return Promise.reject(error);
  }
);
```

### 4.2 `AuthContext.tsx` Specification (`client/src/context/AuthContext.tsx`)

The authentication context handles login, session hydration from `localStorage`, role introspection, and quick demo logins for testing.

```typescript
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole, AuthResponse } from '@/types/auth';
import { apiClient } from '@/services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Hydrate existing session
    const savedToken = localStorage.getItem('smartroute_token');
    const savedUser = localStorage.getItem('smartroute_user');
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('smartroute_token');
        localStorage.removeItem('smartroute_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await apiClient.post<{ success: boolean; data: AuthResponse }>('/auth/login', {
        email,
        password,
      });
      const { token: jwtToken, user: authUser } = res.data.data;
      setToken(jwtToken);
      setUser(authUser);
      localStorage.setItem('smartroute_token', jwtToken);
      localStorage.setItem('smartroute_user', JSON.stringify(authUser));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = (): void => {
    apiClient.post('/auth/logout').catch(() => {});
    setToken(null);
    setUser(null);
    localStorage.removeItem('smartroute_token');
    localStorage.removeItem('smartroute_user');
  };

  const hasRole = (roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

### 4.3 Protected Route Guard (`client/src/components/common/ProtectedRoute.tsx`)

```typescript
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-transparent"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect drivers to handheld interface, admins to dashboard/deliveries
    if (user.role === 'DRIVER') {
      return <Navigate to="/driver/home" replace />;
    }
    return <Navigate to="/deliveries" replace />;
  }

  return <>{children}</>;
};
```

---

## 5. Layout Shells & Navigation Hierarchy

The application features two dedicated layout wrappers tailored for operational contexts:
1. **AdminLayout:** High-density 3-zone desktop console for Admin and Fleet Managers.
2. **DriverLayout:** Touch-optimized mobile layout with top HUD and fixed 5-tab bottom navigation rail.

### 5.1 Admin Sidebar (`client/src/components/layout/AdminSidebar.tsx`)
- **Dimensions:** Fixed `w-[250px]`, `h-full`, `z-50`, `bg-surface-lowest`, border right `border-outline-variant`.
- **Top Brand Hub:**
  - Icon: `Truck` (`text-secondary` inside `bg-primary` rounded container).
  - Title: `SmartRoute` (14px, `font-bold text-primary`).
  - Subtitle: `Fleet Ops v2.4` (11px, `uppercase tracking-wider text-on-surface-variant`).
  - Status Dot: Pulsing green/secondary dot indicating online operational status.
- **Navigation Sections & Links:**
  - **Overview:**
    - Dashboard (`/dashboard`) -> Lucide `LayoutDashboard`
  - **Operations:**
    - Deliveries (`/deliveries`) -> Lucide `Package` [Active M1 target]
    - Batches (`/batches`) -> Lucide `Layers` [Active M1 target]
    - Route Planner (`/route-planner`) -> Lucide `GitFork`
    - Live Tracking (`/live-tracking`) -> Lucide `Navigation`
  - **Fleet:**
    - Vehicles (`/fleet/vehicles`) -> Lucide `Car`
    - Drivers (`/fleet/drivers`) -> Lucide `BadgeCheck`
  - **Insights:**
    - Analytics (`/analytics`) -> Lucide `BarChart3`
    - Reports (`/reports`) -> Lucide `FileText`
  - **Administration:** (Admin only)
    - User Management (`/admin/users`) -> Lucide `Users`
    - Settings (`/admin/settings`) -> Lucide `Settings`
- **Active State Style:** `bg-primary text-white font-semibold rounded-lg shadow-sm`.
- **Hover State Style:** `hover:bg-surface-container hover:text-on-surface transition-colors`.
- **Bottom Switch Pill:**
  - Direct switch to handheld mode: "Driver Mobile Mode" (`/driver/home`) with `Smartphone` icon.

### 5.2 Admin Header (`client/src/components/layout/AdminHeader.tsx`)
- **Dimensions:** Fixed `h-14` (56px), `left-[250px]`, `right-0`, `top-0`, `bg-surface-lowest/90 backdrop-blur-xl`, `border-b border-outline-variant`, `z-40`.
- **Left Zone:**
  - Global Search Input: `w-72 h-8 pl-8 pr-3 bg-surface-container rounded-lg text-body-sm` with `Search` icon. Placeholder: `"Search shipments, VIN, driver ID, SLA..."`.
  - Hub Filter Pill: `MapPin` icon + `"Bhubaneswar Hub (Rasulgarh)"` + dropdown arrow.
  - Date Filter Pill: `Calendar` icon + `"Today (Live Shifts)"` + dropdown arrow.
- **Right Zone:**
  - Real-time GPS Pulse: Pulsing green circle + `"GPS Sync Active"` (`font-mono text-code-sm`).
  - Notification Bell: `Bell` icon with red badge count indicator.
  - Vertical Divider: `h-6 w-[1px] bg-surface-high`.
  - User Profile Widget:
    - User Full Name (`font-title-md text-on-surface`).
    - User Role Badge: `Super Admin` or `Fleet Manager` (`font-label-sm text-on-surface-variant`).
    - Avatar Circle: Dark navy circle with white initials (`BD`, `AR`).
    - Dropdown menu on click: User details, Settings link, and Red Logout button.

### 5.3 Driver Header (`client/src/components/layout/DriverHeader.tsx`)
- **Dimensions:** Fixed mobile header `h-14`, `top-0`, `left-0`, `right-0`, `bg-surface-lowest shadow-sm z-40 px-4 flex items-center justify-between`.
- **Left:** App mark + Assigned vehicle badge: Tata Ace EV (`OD-02-CD-5678`), Battery `84%` SoC with battery icon.
- **Center:** Shift toggle pill: On Duty (green ring) / Break / Off Duty.
- **Right:** Driver avatar + Emergency SOS trigger button (`bg-error/10 text-error p-1.5 rounded-lg`).

### 5.4 Driver Bottom Nav (`client/src/components/layout/DriverBottomNav.tsx`)
- **Dimensions:** Fixed `bottom-0 left-0 right-0 h-16 bg-surface-lowest border-t border-outline-variant z-40 flex items-center justify-around pb-safe`.
- **5 Touch Targets ($\ge 48$px touch area):**
  1. **Home (`/driver/home`):** `Home` icon + "Home"
  2. **Nav (`/driver/navigation`):** `Navigation` icon + "Navigate"
  3. **Manifest (`/driver/manifest`):** `ListOrdered` icon + "Stops"
  4. **History (`/driver/history`):** `Clock` icon + "History"
  5. **Profile (`/driver/profile`):** `User` icon + "Profile"
- **Active Tab Styling:** Electric Blue (`text-secondary font-bold`).

### 5.5 Top-Level Route Definition (`client/src/App.tsx`)

```tsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DriverLayout } from '@/components/layout/DriverLayout';
import LoginPage from '@/pages/LoginPage';
import DeliveriesPage from '@/pages/DeliveriesPage';
import BatchesPage from '@/pages/BatchesPage';

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Public Auth Route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Admin / Fleet Manager Protected Console */}
      <Route
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'FLEET_MANAGER']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/deliveries" replace />} />
        <Route path="/deliveries" element={<DeliveriesPage />} />
        <Route path="/batches" element={<BatchesPage />} />
        {/* Placeholders for M2/M3 views */}
        <Route path="/dashboard" element={<Navigate to="/deliveries" replace />} />
        <Route path="/route-planner" element={<div className="p-8">Route Planner (Milestone 2)</div>} />
        <Route path="/live-tracking" element={<div className="p-8">Live Tracking (Milestone 3)</div>} />
        <Route path="/fleet/vehicles" element={<div className="p-8">Vehicle Registry</div>} />
        <Route path="/fleet/drivers" element={<div className="p-8">Driver Profiles</div>} />
        <Route path="/analytics" element={<div className="p-8">Analytics (Milestone 3)</div>} />
      </Route>

      {/* Driver Handheld Interface */}
      <Route
        path="/driver"
        element={
          <ProtectedRoute allowedRoles={['DRIVER', 'ADMIN']}>
            <DriverLayout />
          </ProtectedRoute>
        }
      >
        <Route path="home" element={<div className="p-4">Driver Home Bento (Milestone 3)</div>} />
        <Route path="navigation" element={<div className="p-4">Driver Turn-by-Turn HUD (Milestone 3)</div>} />
        <Route path="manifest" element={<div className="p-4">Driver Manifest Stops</div>} />
        <Route path="history" element={<div className="p-4">Driver Completed History</div>} />
        <Route path="profile" element={<div className="p-4">Driver Profile & Vehicle Specs</div>} />
      </Route>

      {/* Catch-all fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default App;
```

---

## 6. Manifest & Deliveries Management UI

### 6.1 `DeliveriesPage.tsx` Architecture (`client/src/pages/DeliveriesPage.tsx`)

The `DeliveriesPage` is the central command center for parcel manifest intake and assignment.

#### Layout Breakdown:
1. **Top Context Header & Action Toolbar:**
   - Regional badge: `Bhubaneswar Eastern Cluster · Terminal 04 / Manifest v4.12 Live` with secondary blue dot.
   - Title: `Delivery Operations & Manifest Management`
   - Subtitle: `Real-time parcel routing, dynamic vehicle load balancing, and autonomous multi-zone dispatch.`
   - Action Button Row:
     - `Batch Composer (badge: count)`: Opens or focuses Batch Composer sidebar.
     - `Import CSV`: Launches `CsvImportModal`.
     - `Export`: Triggers CSV manifest download via PapaParse.
     - `+ Create Delivery`: Launches manual consignment modal (`CreateDeliveryModal`).
2. **5-Card Operational KPI Metrics Grid:**
   - **Card 1: All Deliveries:** Count `1,428 orders`, delta `+12.4% vs yesterday`, bottom border in `bg-surface-high`.
   - **Card 2: Unbatched Queue:** Count `142 awaiting load`, warning subtext `38 critical SLA limits`, bottom border in `bg-error`.
   - **Card 3: In Transit:** Count `198 active vans`, metric `91.8% on-schedule rate`, bottom border in `bg-secondary`.
   - **Card 4: Delivered:** Count `1,064 fulfilled (74.5%)`, subtext `Avg OTP: 38 sec`, bottom border in `bg-primary`.
   - **Card 5: Exceptions:** Count `24 action req.`, subtext `11 address incorrect`, bottom border in `bg-error`.
3. **Operational Split-View Workspace (12-column grid):**
   - **Left / Main Section (8 cols on xl):**
     - Filter & Search Control Bar.
     - Dynamic Floating Bulk Selection Bar (appears when $\ge 1$ deliveries selected).
     - High-Density 10-Column Manifest Table (`ManifestTable`).
     - Pagination & Density Footer (`Showing 1 - 10 of 1,428 items | Density: Standard 36px`).
     - Hub Sortation Staging Card (Patia Z1: 82%, Jaydev Vihar Z2: 95%, Saheed Nagar Z3: 64%).
   - **Right Sidebar (4 cols on xl):**
     - Active Batch Composer Panel (`BatchComposerPanel`).
     - Mini Telemetry Congestion Widget (Rasulgarh Junction snapshot).

### 6.2 `ManifestTable.tsx` Specification (`client/src/components/deliveries/ManifestTable.tsx`)

A high-density tabular grid rendering delivery consignments with sorting, filtering, and selection.

#### Component Props:
```typescript
export interface ManifestTableProps {
  deliveries: DeliveryConsignment[];
  selectedIds: string[];
  onSelectDelivery: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onInspectDelivery: (delivery: DeliveryConsignment) => void;
  onSortChange: (field: string, direction: 'asc' | 'desc') => void;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  isLoading?: boolean;
}
```

#### The 10 Columns (Exact Layout & Visual Styling):
1. **Selection Checkbox (`w-10 text-center`):**
   - Header: Master checkbox (`master-checkbox`), handles tri-state or toggle-all.
   - Row: Individual checkbox (`w-3.5 h-3.5 text-secondary rounded focus:ring-0 cursor-pointer`). `e.stopPropagation()` prevents row click trigger.
2. **Order / Reference (`py-2.5 px-3`):**
   - Order ID: `font-mono text-code-sm font-semibold text-secondary` (e.g. `#DEL-8492`).
   - Subtext: SKU or Package code `text-[11px] text-on-surface-variant` (e.g. `SKU-99218-MED`).
3. **Recipient & Phone (`py-2.5 px-3`):**
   - Recipient Name: `font-medium text-on-surface` (e.g. `Priyanka Mohapatra`).
   - Phone: `font-mono text-[11px] text-on-surface-variant` (e.g. `+91 98451 22019`).
4. **Zone & Destination (`py-2.5 px-3 max-w-[210px]`):**
   - Icon: `MapPin` (15px, `text-secondary shrink-0`).
   - Address snippet with tooltip: `truncate text-[12px] text-on-surface` (e.g. `DLF Cybercity, Patia (Z-1)`).
5. **Weight / Volume (`py-2.5 px-3`):**
   - Weight: `font-mono font-semibold text-primary text-[12px]` (e.g. `14.5 kg`).
   - Volume: `font-mono text-[11px] text-on-surface-variant` (e.g. `0.08 m³`).
6. **Time Window (`py-2.5 px-3`):**
   - Pill: `inline-flex items-center gap-1 text-[11px] font-medium text-on-surface bg-surface-container px-2 py-0.5 rounded`.
   - Icon: `Clock` (13px, `text-on-surface-variant`).
   - Value: `09:00 - 11:00`.
7. **Priority (`py-2.5 px-3`):**
   - `Standard`: `bg-surface-container text-on-surface-variant`.
   - `Urgent`: `bg-error-container text-error font-semibold` + red bullet dot.
   - `Cold Chain`: `bg-secondary-fixed text-on-secondary-fixed font-semibold` + snowflake indicator.
8. **Fleet Assignment (`py-2.5 px-3`):**
   - If assigned: Avatar initials in `bg-primary text-white text-[10px] w-6 h-6 rounded-full`, Driver Name (`text-[12px] font-medium`), License Plate (`text-[10px] font-mono text-on-surface-variant`).
   - If unassigned: `span.px-2.py-0.5.rounded.bg-surface-container.text-on-surface-variant.text-[11px]` "Unassigned".
9. **Status (`py-2.5 px-3`):**
   - `DRAFT`: Gray pill.
   - `READY`: Amber pill.
   - `ASSIGNED`: Light blue pill.
   - `IN_TRANSIT`: `bg-secondary-fixed text-on-secondary-fixed` with pulsing blue dot.
   - `COMPLETED`: `bg-success/15 text-success font-semibold` with checkmark.
   - `FAILED`: `bg-error-container text-error font-semibold` with alert icon.
10. **Actions (`py-2.5 px-3 text-right`):**
    - Inspection Details button: `Eye` icon (`w-7 h-7 hover:bg-surface-container rounded`).
    - Telemetry / Map trigger: `Map` icon.
    - Context Menu trigger: `MoreVertical` icon.

#### Dynamic Bulk Selection Action Bar:
When `selectedIds.length > 0`, an animated bar slides in:
- Container: `bg-primary text-white rounded-lg px-4 py-2 flex items-center justify-between shadow-md`.
- Left info: Badge with count `X Deliveries Selected` + `| Combined Load: YY.Y kg (Z.ZZ m³)`.
- Action buttons:
  - `Assign to Batch`: Moves selected deliveries into Active Batch Composer queue.
  - `Flag Urgent`: Bulk updates priority to `Urgent`.
  - `Print Waybills`: Triggers print preview for shipping labels.
  - `Clear Selection (X)`: Deselects all rows.

---

## 7. Batch Operations & Composer Panel

### 7.1 `BatchComposerPanel.tsx` Specification (`client/src/components/deliveries/BatchComposerPanel.tsx`)

The Batch Composer allows dispatchers to assemble, balance, and assign deliveries to vehicles and drivers.

#### Component Props:
```typescript
export interface BatchComposerPanelProps {
  batch: DeliveryBatch | null;
  depots: Array<{ id: string; name: string }>;
  selectedDepotId: string;
  onDepotChange: (depotId: string) => void;
  stagedDeliveries: DeliveryConsignment[];
  availableVehicles: Array<{ id: string; plateNumber: string; model: string; capacityKg: number }>;
  availableDrivers: Array<{ id: string; name: string; punctualityRate: number }>;
  selectedVehicleId?: string;
  selectedDriverId?: string;
  onVehicleChange: (vehicleId: string) => void;
  onDriverChange: (driverId: string) => void;
  onRemoveStop: (deliveryId: string) => void;
  onReorderStops?: (reorderedIds: string[]) => void;
  onFinalizeBatch: () => void;
  isDispatching?: boolean;
}
```

#### Panel Sections:
1. **Header:**
   - Icon: `Package` inside `w-8 h-8 rounded-lg bg-primary text-secondary flex items-center justify-center`.
   - Batch Title: `BBSR-AM-EXPRESS-09` (`font-title-md font-bold text-primary`).
   - Status Badge: `Draft` (`bg-secondary-fixed text-on-secondary-fixed text-[11px] font-bold rounded-full px-2 py-0.5`).
2. **Depot Selector:**
   - Dropdown: Central Hub Rasulgarh (Default), Patia Sub-Depot, Khandagiri Terminal.
3. **Batch Metrics Bento:**
   - 2-column card in `bg-surface-low p-2 rounded-lg`:
     - Col 1: `Allocated Parcels`: **12** drops.
     - Col 2: `Estimated Efficiency`: **94%** vol. match.
4. **Chassis Payload Utilization Bar:**
   - Header: `Payload Utilization` vs `142 kg / 800 kg capacity` (`font-mono text-primary font-semibold`).
   - Progress bar: `h-2 w-full bg-surface-high rounded-full overflow-hidden flex`.
   - Progress fill: `bg-secondary` at `17.75%` width (turns `bg-error` if payload $> 100\%$).
   - Footnote: `658 kg remaining allowance on selected chassis`.
5. **AI Suggested Vehicle & Driver:**
   - AI Pick banner: `auto_awesome` spark icon + `AI Pick`.
   - Vehicle details: Tata Ace EV (`OD-02-CD-5678`), Driver: Subrat Jena (`98% punctuality`).
   - Override controls to select alternate vehicle or driver.
6. **Optimized Stop Sequence (Quick Sequencer List):**
   - Displays first 4 of N staged stops with sequence numbers (1, 2, 3, 4), Order ID, Destination, and Estimated Arrival Time (`09:15 AM`, `09:42 AM`, `10:10 AM`, `10:35 AM`).
   - Delete/Remove stop button (`X`) per item.
7. **Primary Dispatch Button:**
   - Label: `Generate Manifest & Assign Load`
   - Icon: `CheckCircle2`
   - Style: `w-full h-9 rounded-lg bg-secondary hover:bg-secondary/90 text-white font-label-md font-semibold shadow transition-all`.
   - Disabled state: Overload ($>100\%$) or 0 deliveries.

### 7.2 `BatchesPage.tsx` Architecture (`client/src/pages/BatchesPage.tsx`)

Provides a full-page view for managing the lifecycle of dispatch clusters (`DRAFT` $\to$ `READY` $\to$ `PLANNED` $\to$ `IN_PROGRESS` $\to$ `CLOSED`).

#### Key Features:
- Filter tabs: All Batches, Draft, Ready, Planned, Active in Run, Completed.
- Batch Summary Cards Grid:
  - Batch ID and Name.
  - Creation timestamp and scheduled delivery window.
  - Assigned Driver & Vehicle tag.
  - Progress bar of completed stops vs total.
  - Action menu: "Plan Route" (navigates to `/route-planner?batchId=...`), "Edit Stops", "Close Batch".

---

## 8. CSV Drag-and-Drop Ingestion & Dry-Run Engine

### 8.1 `CsvImportModal.tsx` Specification (`client/src/components/deliveries/CsvImportModal.tsx`)

Enables logistics operators to bulk-ingest shipments with client-side syntax checks and backend dry-run address geocoding.

#### Component Props:
```typescript
export interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (importedCount: number) => void;
}
```

#### Ingestion Pipeline Steps:
1. **Dropzone & File Parser:**
   - Drag-and-drop dropzone supporting `.csv` files up to 10MB.
   - In-browser parsing using `PapaParse` (`header: true`, `skipEmptyLines: true`).
   - Expected CSV Header Schema:
     - `orderId` (optional, auto-generated if missing)
     - `customerName` (required string)
     - `phone` (required 10-digit Indian mobile number format)
     - `address` (required street address string)
     - `zone` (required cluster name, e.g. `Patia`, `Jaydev Vihar`, `Saheed Nagar`)
     - `weightKg` (required positive number)
     - `volumeM3` (required positive number)
     - `priority` (`Standard`, `Urgent`, `Cold Chain`)
     - `timeWindowStart` (format `HH:mm`, e.g. `09:00`)
     - `timeWindowEnd` (format `HH:mm`, e.g. `11:00`)
2. **Client-Side Dry-Run Validation Rules:**
   - Mandatory check: `customerName`, `phone`, `address`, `weightKg` cannot be empty.
   - Type check: `weightKg` and `volumeM3` must parse to `> 0`.
   - Time window sanity: `timeWindowStart < timeWindowEnd`, duration $\ge 30$ minutes.
   - Zone check: Must belong to one of Bhubaneswar's operational zones.
3. **Backend Dry-Run Service Call:**
   - Client sends parsed rows to `POST /api/v1/deliveries/import-csv?dryRun=true`.
   - Backend evaluates geocoding feasibility and returns `{ validCount, invalidCount, errors: [...] }`.
4. **Validation Preview UI:**
   - 3 Summary Stat Badges:
     - Total Records (e.g. `50`)
     - Valid Records (e.g. `46` in green badge)
     - Rejected / Action Required (e.g. `4` in red badge)
   - Interactive Preview Table: Displays parsed rows; invalid cells are outlined in red (`border-error bg-error-container/30`) with hover tooltips displaying the exact validation message.
5. **Error Remediation & Download:**
   - **Download Error CSV Button:** Re-assembles rejected rows via `PapaParse.unparse`, appends an `ErrorReason` column, and triggers a `.csv` file download via Blob.
   - **Proceed with Valid Records Button:** Posts only clean records (`POST /api/v1/deliveries/import-csv?dryRun=false`), closes modal, and refreshes the manifest table.

---

## 9. Waybill Inspector & Milestone Drawer

### 9.1 `ConsignmentDrawer.tsx` Specification (`client/src/components/deliveries/ConsignmentDrawer.tsx`)

A slide-over right panel providing deep inspection of a consignment, its chain-of-custody audit log, and fulfillment milestones.

#### Component Props:
```typescript
export interface ConsignmentDrawerProps {
  delivery: DeliveryConsignment | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus?: (deliveryId: string, newStatus: DeliveryStatus) => void;
  onFlagException?: (deliveryId: string) => void;
}
```

#### Drawer Layout Breakdown:
- **Dimensions:** Fixed `w-full max-w-md bg-surface-lowest shadow-2xl z-50 transform translate-x-0 transition-transform duration-300 ease-in-out`.
- **Header:**
  - Order ID: `#DEL-8492` (`font-title-md font-bold text-primary`).
  - Subtitle: `Live Waybill Inspector`.
  - Close button: `X` icon.
- **Section 1: Current Telemetry & Status:**
  - Status Pill: `In Transit` (`bg-secondary-fixed text-on-secondary-fixed font-mono text-[12px] font-bold`).
  - Active Context: `Active in Last-Mile · ETA 09:15 AM`.
- **Section 2: Consignee Card:**
  - Name: `Priyanka Mohapatra` (16px, `font-semibold text-primary`).
  - Phone: `+91 98451 22019` (`font-mono text-on-surface-variant`).
  - Address: `Plot 412, DLF Cybercity, Patia, Bhubaneswar, 751024`.
- **Section 3: Assigned Carrier Telemetry:**
  - Driver: Avatar with initials `BD`, Name `Bikram Das`.
  - Vehicle: `Mahindra Bolero Maxi · OD-02-B-1102`.
  - Quick action: Click-to-call phone button (`tel:+919845122019`).
- **Section 4: Chain of Custody Timeline (Fulfillment Milestones):**
  - Continuous vertical line (`w-0.5 bg-surface-high`) connecting milestone nodes:
    1. **Out for Delivery:** `08:45 AM` · Loaded at Bhubaneswar Central Hub (Rasulgarh). Secondary blue node.
    2. **Manifest Verified & Sequenced:** `07:20 AM` · Dispatch Supervisor Alex Rivera. Secondary container node.
    3. **Inbound Ingestion:** `05:15 AM` · Line-haul arrived from Kolkata Hub. Slate container node.
- **Section 5: Action Commands:**
  - `Print Thermal Shipping Label`: Primary button (`bg-primary text-white`).
  - `Re-sequence In Run Manifest`: Secondary outline button (`bg-surface-container`).
  - `Flag for Dispatch Exception Review`: Destructive button (`bg-error-container text-error`).

---

## 10. Authentication UI & Demo Quick-Fill

### 10.1 `LoginPage.tsx` Specification (`client/src/pages/LoginPage.tsx`)

The authentication page provides an authoritative login portal with pre-configured demo persona quick-fills for testing and evaluation.

#### Component Architecture:
- **Layout:** Centered command card or split layout with deep navy branding (`#14243A`).
- **Brand Elements:**
  - Logo: SmartRoute icon with electric blue accent.
  - Headline: `SmartRoute Command Console`.
  - Subtext: `Bhubaneswar Regional Logistics & Autonomous Dispatch Network`.
- **Credentials Form:**
  - Email input with `Mail` icon.
  - Password input with `Lock` icon and toggle visibility button (`Eye` / `EyeOff`).
  - "Remember session" checkbox and "Forgot password?" link.
  - Submit button: `Sign In to Dispatch Console` with loading spinner.
- **Role Badge Demo Quick-Fill Buttons:**
  Three interactive pills located directly above or below the form:
  1. **Super Admin:**
     - Label: `👑 Demo Super Admin`
     - Action: Pre-fills `admin@smartroute.internal` / `Admin@1234` and sets role badge to `ADMIN`.
  2. **Fleet Manager:**
     - Label: `🚛 Demo Fleet Manager`
     - Action: Pre-fills `manager.bbsr@smartroute.internal` / `Manager@1234` and sets role badge to `FLEET_MANAGER`.
  3. **Driver:**
     - Label: `📱 Demo Driver`
     - Action: Pre-fills `driver.bikram@smartroute.internal` / `Driver@1234` and sets role badge to `DRIVER`.
- **Post-Login Routing:**
  - If `ADMIN` or `FLEET_MANAGER`: Navigate to `/deliveries`.
  - If `DRIVER`: Navigate to `/driver/home`.

---

## 11. Complete Component Tree & File Mapping Matrix

```
client/
├── package.json                          # Vite, React 18, React Router v6, Tailwind, Lucide, PapaParse, Axios
├── vite.config.ts                        # Proxy /api to backend, path aliases
├── tailwind.config.js                    # Stitch design tokens (#14243A, #0051D5, #FAF8FF)
├── tsconfig.json                         # React-JSX, path aliases
├── index.html                            # Inter fonts, viewport, title
└── src/
    ├── main.tsx                          # App bootstrapping, AuthProvider, BrowserRouter
    ├── App.tsx                           # Role-based route definitions
    ├── types/
    │   ├── auth.ts                       # User, UserRole, AuthState
    │   ├── delivery.ts                   # DeliveryConsignment, Priority, Status, KPIs
    │   ├── batch.ts                      # DeliveryBatch, StagedStop, BatchStatus
    │   └── csv.ts                        # CsvDeliveryRow, CsvDryRunResult
    ├── services/
    │   ├── api.ts                        # Axios instance, interceptors, error handler
    │   ├── deliveryService.ts            # CRUD, CSV import, status patch
    │   └── batchService.ts               # Batch CRUD, vehicle/driver assignment
    ├── context/
    │   └── AuthContext.tsx               # AuthState, login, logout, role check
    ├── components/
    │   ├── common/
    │   │   ├── ProtectedRoute.tsx        # Role-based route guard
    │   │   ├── StatusBadge.tsx           # Reusable status pill (Delivered, Urgent, In Transit)
    │   │   └── Toast.tsx                 # Temporary notification banner
    │   ├── layout/
    │   │   ├── AdminLayout.tsx           # 3-zone desktop shell
    │   │   ├── AdminHeader.tsx           # Global search, hub selector, GPS pulse, profile
    │   │   ├── AdminSidebar.tsx          # 250px navigation rail, module links, mobile switch
    │   │   ├── DriverLayout.tsx          # Mobile container with top HUD & bottom rail
    │   │   ├── DriverHeader.tsx          # Vehicle specs, SoC %, shift status toggle
    │   │   └── DriverBottomNav.tsx       # 5-tab fixed touch navigation
    │   └── deliveries/
    │       ├── ManifestTable.tsx         # 10-column parcel table, sorting, selection
    │       ├── BatchComposerPanel.tsx    # Active batch sidebar, payload gauge, AI pick
    │       ├── CsvImportModal.tsx        # Drag-drop CSV, client validation, dry-run preview
    │       ├── ConsignmentDrawer.tsx     # Slide-over waybill inspector, milestone timeline
    │       └── CreateDeliveryModal.tsx   # Manual consignment entry dialog
    └── pages/
        ├── LoginPage.tsx                 # Credentials form + Demo role badges
        ├── DeliveriesPage.tsx            # Operational master manifest workspace
        └── BatchesPage.tsx               # Batch lifecycle and staging management
```

---

## 12. Phased Implementation Roadmap for M1 Frontend Agent

To implement Milestone 1 Frontend without friction, the implementer agent should execute in this strict order:

| Step | Action | Files Impacted | Deliverable Criteria |
|---|---|---|---|
| **1** | Package & Environment Scaffolding | `client/package.json`, `client/vite.config.ts`, `client/tailwind.config.js`, `client/tsconfig.json`, `client/index.html` | `npm install` installs cleanly; Tailwind tokens compile without warnings. |
| **2** | Domain Types & API Setup | `client/src/types/*.ts`, `client/src/services/api.ts` | Clean TypeScript definitions covering User, Delivery, Batch, and CSV schemas. |
| **3** | Auth Context & Login Page | `client/src/context/AuthContext.tsx`, `client/src/components/common/ProtectedRoute.tsx`, `client/src/pages/LoginPage.tsx` | Demo buttons prefill forms; login stores JWT; unauthorized access redirects to `/login`. |
| **4** | Layout Shells & Router | `client/src/components/layout/*.tsx`, `client/src/App.tsx` | AdminLayout renders 250px sidebar and 56px header; DriverLayout renders mobile HUD and bottom nav. |
| **5** | Manifest Table & KPI Grid | `client/src/components/deliveries/ManifestTable.tsx`, `client/src/pages/DeliveriesPage.tsx` | 10-column table renders with status badges, sorting, searching, and row selection bar. |
| **6** | Active Batch Composer | `client/src/components/deliveries/BatchComposerPanel.tsx`, `client/src/pages/BatchesPage.tsx` | Capacity gauge reflects staged payload; vehicle/driver AI pick displayed; dispatch button triggers API. |
| **7** | CSV Drag-and-Drop Ingestion | `client/src/components/deliveries/CsvImportModal.tsx` | PapaParse parses uploaded CSV; dry-run preview highlights invalid rows; error CSV downloadable. |
| **8** | Waybill Inspector Drawer | `client/src/components/deliveries/ConsignmentDrawer.tsx` | Clicking any table row opens drawer displaying recipient details, carrier info, and milestone timeline. |

---

## 13. Independent Verification & Testing Protocol

The implementer can verify the frontend implementation using these concrete checks:

1. **Build & Bundle Validation:**
   ```bash
   cd client
   npm run build
   ```
   *Expected Result:* TypeScript compilation passes (`tsc`) with zero errors and Vite bundles the production output into `client/dist/`.
2. **Visual Token Alignment:**
   - Verify sidebar and header use `#14243A` (Deep Navy).
   - Verify action buttons and selection highlights use `#0051D5` (Electric Blue).
   - Verify canvas background renders in `#FAF8FF`.
   - Verify numeric columns (weight, volume, order ID) render in tabular figures (`tnum`).
3. **Authentication & Role Flow:**
   - Navigate to `http://localhost:5173/login`.
   - Click "👑 Demo Super Admin", verify form fills with `admin@smartroute.internal`, click "Sign In", verify redirect to `/deliveries`.
   - Click "Driver Mobile Mode" link in sidebar, verify redirect to `/driver/home` with mobile layout.
4. **Manifest Table Interactions:**
   - Check rows: verify floating bulk action bar appears displaying selected count and combined weight.
   - Click a table row: verify slide-over waybill drawer opens with milestone timeline.
   - Click "Import CSV": verify modal opens, drag a CSV file, verify dry-run preview table renders invalid rows with error badges.
   - In Batch Composer: verify capacity bar reflects percentage of 800 kg capacity and turns red if overload occurs.
