import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ManifestTable } from '../ManifestTable';
import { createMockDelivery } from '../../../test/mocks';

describe('ManifestTable Bulk Delete', () => {
  const d1 = createMockDelivery({ id: 'del-1', orderReference: 'ORD-001' });
  const d2 = createMockDelivery({ id: 'del-2', orderReference: 'ORD-002' });
  const deliveries = [d1, d2];

  it('does not render bulk delete action when selectedIds is empty', () => {
    const onDeleteSelected = vi.fn();
    render(
      <ManifestTable
        deliveries={deliveries}
        selectedIds={[]}
        onToggleSelect={vi.fn()}
        onSelectAll={vi.fn()}
        onViewConsignment={vi.fn()}
        onOpenBatchComposer={vi.fn()}
        onDeleteSelected={onDeleteSelected}
      />
    );

    expect(screen.queryByText(/Delete Selected/i)).not.toBeInTheDocument();
  });

  it('renders Delete Selected button when items are selected and triggers callback', () => {
    const onDeleteSelected = vi.fn();
    render(
      <ManifestTable
        deliveries={deliveries}
        selectedIds={['del-1', 'del-2']}
        onToggleSelect={vi.fn()}
        onSelectAll={vi.fn()}
        onViewConsignment={vi.fn()}
        onOpenBatchComposer={vi.fn()}
        onDeleteSelected={onDeleteSelected}
      />
    );

    const deleteBtn = screen.getByRole('button', { name: /Delete Selected \(2\)/i });
    expect(deleteBtn).toBeInTheDocument();

    fireEvent.click(deleteBtn);
    expect(onDeleteSelected).toHaveBeenCalledTimes(1);
    expect(onDeleteSelected).toHaveBeenCalledWith(['del-1', 'del-2']);
  });
});
