import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserTable } from '../UserTable';
import { AdminUser } from '../../../types/admin';

describe('UserTable Multi-Select & Bulk Actions', () => {
  const mockUsers: AdminUser[] = [
    {
      id: 'u-1',
      name: 'Alice Admin',
      email: 'alice@smartroute.internal',
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      active: true,
      department: 'Headquarters',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'u-2',
      name: 'Bob Driver',
      email: 'bob@smartroute.internal',
      role: 'DRIVER',
      accountStatus: 'ACTIVE',
      active: true,
      department: 'Logistics Operations',
      createdAt: new Date().toISOString(),
    },
  ];

  it('renders selection checkboxes and triggers toggle and select all', () => {
    const onToggleSelect = vi.fn();
    const onSelectAll = vi.fn();
    const onBulkDelete = vi.fn();

    render(
      <UserTable
        users={mockUsers}
        total={2}
        page={1}
        pages={1}
        onPageChange={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onStatusChange={vi.fn()}
        selectedUserIds={['u-1']}
        onToggleSelect={onToggleSelect}
        onSelectAll={onSelectAll}
        onBulkDelete={onBulkDelete}
      />
    );

    const selectAllCheckbox = screen.getByLabelText('Select all users') as HTMLInputElement;
    expect(selectAllCheckbox).toBeInTheDocument();
    expect(selectAllCheckbox.checked).toBe(false);
    expect(selectAllCheckbox.indeterminate).toBe(true);

    const rowCheckboxAlice = screen.getByLabelText('Select user Alice Admin') as HTMLInputElement;
    const rowCheckboxBob = screen.getByLabelText('Select user Bob Driver') as HTMLInputElement;
    expect(rowCheckboxAlice.checked).toBe(true);
    expect(rowCheckboxBob.checked).toBe(false);

    fireEvent.click(rowCheckboxBob);
    expect(onToggleSelect).toHaveBeenCalledWith('u-2');

    // Sticky bulk bar is visible because selectedUserIds.length > 0
    expect(screen.getByText('1 Users Selected')).toBeInTheDocument();
    const deleteBtn = screen.getByRole('button', { name: /Delete Selected \(1\)/i });
    fireEvent.click(deleteBtn);
    expect(onBulkDelete).toHaveBeenCalledWith([mockUsers[0]]);
  });
});
