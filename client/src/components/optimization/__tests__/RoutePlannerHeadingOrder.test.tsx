import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminHeader } from '../../layout/AdminHeader';
import { CurrentRouteCard } from '../CurrentRouteCard';
import { MemoryRouter } from 'react-router-dom';
import * as AuthContextModule from '../../../context/AuthContext';

vi.mock('../../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../common/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

const mockUseAuth = vi.mocked(AuthContextModule.useAuth);

describe('AdminHeader Semantic Headings & WCAG Contrast (D-07, D-08)', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        name: 'Test Admin',
        role: 'ADMIN',
        isDemoData: true,
      } as any,
      token: 'mock-token',
      refreshToken: 'mock-refresh',
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      demoLogin: vi.fn(),
      logout: vi.fn(),
      updateUser: vi.fn(),
    });
  });

  it('renders a single h1 tag for the SmartRoute workspace brand', () => {
    const { container } = render(
      <MemoryRouter>
        <AdminHeader title="Route Optimizer & Dispatch" subtitle="Test subtitle" />
      </MemoryRouter>
    );

    const h1Elements = container.querySelectorAll('h1');
    expect(h1Elements.length).toBe(1);
    expect(h1Elements[0].textContent).toContain('SmartRoute');

    // Title should be h2 to preserve sequential hierarchy
    const h2Elements = container.querySelectorAll('h2');
    expect(h2Elements.length).toBe(1);
    expect(h2Elements[0].textContent).toBe('Route Optimizer & Dispatch');
  });

  it('renders the Demo badge with high-contrast WCAG AA compliant classes', () => {
    render(
      <MemoryRouter>
        <AdminHeader title="Dashboard" />
      </MemoryRouter>
    );

    const demoBadge = screen.getByText('Demo');
    expect(demoBadge).toBeInTheDocument();
    expect(demoBadge.className).toContain('bg-amber-100');
    expect(demoBadge.className).toContain('text-amber-900');
    expect(demoBadge.className).toContain('dark:bg-amber-950/80');
    expect(demoBadge.className).toContain('dark:text-amber-200');
    expect(demoBadge.className).toContain('border-amber-300');
    expect(demoBadge.className).toContain('dark:border-amber-700');
  });
});

describe('CurrentRouteCard Heading Hierarchy (D-08)', () => {
  const mockBaseline = {
    routes: [{ id: 'r1', stops: [{ id: 's1' }] }],
    metrics: {
      totalDistanceKm: 15.2,
      totalDurationMin: 45,
      totalFuelLiters: 1.8,
      totalCost: 180,
      carbonKg: 4.2,
      startingLocation: { name: 'Central Depot Hub', address: '123 Logistics Way' },
      endingLocation: { name: 'Central Depot Hub', address: '123 Logistics Way' },
    },
  } as any;

  const mockOptResult = {
    optimized: {
      routes: [{ id: 'r1', stops: [{ id: 's1' }] }],
      metrics: {
        totalDistanceKm: 12.0,
        totalDurationMin: 35,
        totalFuelLiters: 1.4,
        totalCost: 140,
        carbonKg: 3.2,
        startingLocation: { name: 'Central Depot Hub', address: '123 Logistics Way' },
        endingLocation: { name: 'Central Depot Hub', address: '123 Logistics Way' },
      },
    },
    baseline: mockBaseline,
    delta: {
      distanceKm: -3.2,
      durationMin: -10,
      fuelLiters: -0.4,
      cost: -40,
      carbonKg: -1.0,
      distancePct: -21,
      durationPct: -22,
      fuelPct: -22,
    },
  } as any;

  it('renders primary section title as h2 and sub-sections as h3 without skipping levels', () => {
    const { container } = render(
      <CurrentRouteCard
        baseline={mockBaseline}
        optResult={mockOptResult}
        vehicleAssignments={[
          {
            binIndex: 0,
            vehicle: { id: 'v1', name: 'Van 1', type: 'VAN', capacityKg: 500 } as any,
            driver: { id: 'd1', name: 'John Doe', phone: '123' } as any,
            stopCount: 5,
            totalWeightKg: 120,
          },
        ]}
      />
    );

    // Primary card section title should be h2
    const h2Elements = container.querySelectorAll('h2');
    expect(h2Elements.length).toBeGreaterThanOrEqual(1);
    const h2Texts = Array.from(h2Elements).map((el) => el.textContent?.trim());
    expect(h2Texts.some((t) => t?.includes('Current Route — Before Optimization'))).toBe(true);

    // Sub-section titles should be h3
    const h3Elements = container.querySelectorAll('h3');
    expect(h3Elements.length).toBeGreaterThanOrEqual(1);
    const h3Texts = Array.from(h3Elements).map((el) => el.textContent?.trim());
    expect(
      h3Texts.some((t) => t?.includes('Performance Comparison: Current Route vs Optimized Route'))
    ).toBe(true);
    expect(h3Texts.some((t) => t?.includes('Auto-Assigned Fleet'))).toBe(true);

    // No h4, h5, or h6 should exist in CurrentRouteCard to avoid skipping or deep nesting
    const h4Elements = container.querySelectorAll('h4, h5, h6');
    expect(h4Elements.length).toBe(0);
  });
});

describe('RoutePlannerPage Heading Hierarchy (D-08)', () => {
  it('enforces h2 tags for Geospatial Route Map and Dispatched Routes in RoutePlannerPage.tsx', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve(__dirname, '../../../pages/admin/RoutePlannerPage.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toMatch(/<h2[^>]*>[\s\S]*?Geospatial Route Map[\s\S]*?<\/h2>/);
    expect(content).toMatch(/<h2[^>]*>[\s\S]*?Dispatched Routes[\s\S]*?<\/h2>/);
  });
});
