import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminSidebar } from '../AdminSidebar';
import { useAuth } from '../../../context/AuthContext';

vi.mock('../../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('AdminSidebar Hover-Expand & Retract (Quick Task)', () => {
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
      user: { id: 'admin-1', name: 'Ops Director', role: 'ADMIN' },
      logout: mockLogout,
    });
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <AdminSidebar />
      </MemoryRouter>
    );

  it('renders in initial collapsed dock state with aria-expanded="false"', () => {
    renderComponent();

    const sidebar = screen.getByTestId('admin-sidebar');
    expect(sidebar).toBeInTheDocument();
    expect(sidebar).toHaveAttribute('aria-expanded', 'false');
    expect(sidebar.className).toContain('w-[60px]');

    // Operations nav items exist
    expect(screen.getByRole('link', { name: /Route Optimizer/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Live Telemetry/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Fleet Vehicles/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Drivers Roster/i })).toBeInTheDocument();
  });

  it('expands on hover (mouseEnter) displaying expanded width, glassmorphism, and icon labels', () => {
    renderComponent();

    const sidebar = screen.getByTestId('admin-sidebar');
    fireEvent.mouseEnter(sidebar);

    expect(sidebar).toHaveAttribute('aria-expanded', 'true');
    expect(sidebar.className).toContain('w-60');
    expect(sidebar.className).toContain('glass-panel-expanded');

    // Verify label spans receive expanded visible styling
    const routeOptimizerLink = screen.getByRole('link', { name: /Route Optimizer/i });
    const labelSpan = routeOptimizerLink.querySelector('span.opacity-100');
    expect(labelSpan).toBeInTheDocument();
    expect(labelSpan).toHaveTextContent('Route Optimizer');
  });

  it('retracts back when the cursor is moved away (mouseLeave)', () => {
    renderComponent();

    const sidebar = screen.getByTestId('admin-sidebar');

    // Hover to expand
    fireEvent.mouseEnter(sidebar);
    expect(sidebar).toHaveAttribute('aria-expanded', 'true');
    expect(sidebar.className).toContain('w-60');

    // Leave to retract
    fireEvent.mouseLeave(sidebar);
    expect(sidebar).toHaveAttribute('aria-expanded', 'false');
    expect(sidebar.className).toContain('w-[60px]');
  });

  it('expands on keyboard focus and retracts on blur', () => {
    renderComponent();

    const sidebar = screen.getByTestId('admin-sidebar');

    fireEvent.focus(sidebar);
    expect(sidebar).toHaveAttribute('aria-expanded', 'true');
    expect(sidebar.className).toContain('w-60');

    fireEvent.blur(sidebar, { relatedTarget: document.body });
    expect(sidebar).toHaveAttribute('aria-expanded', 'false');
    expect(sidebar.className).toContain('w-[60px]');
  });

  it('triggers logout when Sign Out button is clicked', () => {
    renderComponent();

    const signOutBtn = screen.getByRole('button', { name: /Sign Out/i });
    fireEvent.click(signOutBtn);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
