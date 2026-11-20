import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MapLegend, MarkerFilters } from '../MapLegend';

describe('MapLegend & Filter Checklist Component (D-11, D-12)', () => {
  const defaultFilters: MarkerFilters = {
    drivers: true,
    nextStop: true,
    pending: true,
    completed: true,
    cancelled: true,
  };

  it('renders header and all 5 entity filter checkboxes with their labels', () => {
    const onToggleFilter = vi.fn();
    render(<MapLegend filters={defaultFilters} onToggleFilter={onToggleFilter} />);

    expect(screen.getByText('Map Legend & Layers')).toBeInTheDocument();
    expect(screen.getByText('Live Drivers')).toBeInTheDocument();
    expect(screen.getByText('Next Active Stop')).toBeInTheDocument();
    expect(screen.getByText('Pending Deliveries')).toBeInTheDocument();
    expect(screen.getByText('Completed (Delivered)')).toBeInTheDocument();
    expect(screen.getByText('Cancelled / Failed')).toBeInTheDocument();

    const driversCheckbox = screen.getByTestId('filter-drivers') as HTMLInputElement;
    expect(driversCheckbox.checked).toBe(true);
  });

  it('toggles collapse/expand when header button is clicked', () => {
    const onToggleFilter = vi.fn();
    render(<MapLegend filters={defaultFilters} onToggleFilter={onToggleFilter} />);

    // Initially expanded
    expect(screen.getByTestId('legend-expanded-content')).toBeInTheDocument();

    // Click to collapse
    const toggleBtn = screen.getByTestId('legend-toggle-btn');
    fireEvent.click(toggleBtn);
    expect(screen.queryByTestId('legend-expanded-content')).not.toBeInTheDocument();

    // Click to re-expand
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('legend-expanded-content')).toBeInTheDocument();
  });

  it('triggers onToggleFilter callback when filter checkboxes are clicked', () => {
    const onToggleFilter = vi.fn();
    render(<MapLegend filters={defaultFilters} onToggleFilter={onToggleFilter} />);

    fireEvent.click(screen.getByTestId('filter-drivers'));
    expect(onToggleFilter).toHaveBeenCalledWith('drivers');

    fireEvent.click(screen.getByTestId('filter-nextStop'));
    expect(onToggleFilter).toHaveBeenCalledWith('nextStop');

    fireEvent.click(screen.getByTestId('filter-pending'));
    expect(onToggleFilter).toHaveBeenCalledWith('pending');

    fireEvent.click(screen.getByTestId('filter-completed'));
    expect(onToggleFilter).toHaveBeenCalledWith('completed');

    fireEvent.click(screen.getByTestId('filter-cancelled'));
    expect(onToggleFilter).toHaveBeenCalledWith('cancelled');
  });

  it('renders traversed dashed line and remaining solid line route indicators', () => {
    const onToggleFilter = vi.fn();
    render(<MapLegend filters={defaultFilters} onToggleFilter={onToggleFilter} />);

    expect(screen.getByText('Traversed Route')).toBeInTheDocument();
    expect(screen.getByText('Remaining Route')).toBeInTheDocument();
    expect(screen.getByTestId('indicator-traversed')).toBeInTheDocument();
    expect(screen.getByTestId('indicator-remaining')).toBeInTheDocument();
  });
});
