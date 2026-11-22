import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Table } from '../Table';

describe('Common Table Selection', () => {
  const data = [
    { id: '1', name: 'Alpha' },
    { id: '2', name: 'Beta' },
    { id: '3', name: 'Gamma' },
  ];

  const columns = [
    { header: 'Name', accessor: 'name' as const },
  ];

  it('renders select all checkbox and row checkboxes when selectable is true', () => {
    const onToggleSelect = vi.fn();
    const onSelectAll = vi.fn();

    render(
      <Table
        data={data}
        columns={columns}
        selectable
        selectedIds={['1']}
        onToggleSelect={onToggleSelect}
        onSelectAll={onSelectAll}
      />
    );

    const selectAllCheckbox = screen.getByLabelText('Select all rows') as HTMLInputElement;
    expect(selectAllCheckbox).toBeInTheDocument();
    expect(selectAllCheckbox.checked).toBe(false);
    expect(selectAllCheckbox.indeterminate).toBe(true);

    const rowCheckbox1 = screen.getByLabelText('Select row 1') as HTMLInputElement;
    const rowCheckbox2 = screen.getByLabelText('Select row 2') as HTMLInputElement;
    expect(rowCheckbox1.checked).toBe(true);
    expect(rowCheckbox2.checked).toBe(false);

    fireEvent.click(rowCheckbox2);
    expect(onToggleSelect).toHaveBeenCalledWith('2');

    fireEvent.click(selectAllCheckbox);
    expect(onSelectAll).toHaveBeenCalledWith(['1', '2', '3']);
  });

  it('deselects all when clicking select all if all rows are already selected', () => {
    const onSelectAll = vi.fn();

    render(
      <Table
        data={data}
        columns={columns}
        selectable
        selectedIds={['1', '2', '3']}
        onSelectAll={onSelectAll}
      />
    );

    const selectAllCheckbox = screen.getByLabelText('Select all rows') as HTMLInputElement;
    expect(selectAllCheckbox.checked).toBe(true);

    fireEvent.click(selectAllCheckbox);
    expect(onSelectAll).toHaveBeenCalledWith([]);
  });
});
