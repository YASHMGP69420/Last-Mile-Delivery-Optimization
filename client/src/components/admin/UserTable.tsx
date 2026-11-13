import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
  ColumnFiltersState,
  PaginationState,
} from '@tanstack/react-table';
import { User, Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, MoreVertical, Edit2, Trash2, Shield } from 'lucide-react';
import { AdminUser } from '../../types/admin';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { clsx } from 'clsx';

interface UserTableProps {
  users: AdminUser[];
  total: number;
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
  onEdit: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
  onStatusChange: (user: AdminUser, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') => void;
  isLoading?: boolean;
}

const columnHelper = createColumnHelper<AdminUser>();

export const UserTable: React.FC<UserTableProps> = ({
  users,
  total,
  page,
  pages,
  onPageChange,
  onEdit,
  onDelete,
  onStatusChange,
  isLoading = false,
}) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: page - 1,
    pageSize: 50,
  });
  const [globalFilter, setGlobalFilter] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<AdminUser | null>(null);

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: (info) => (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-on-surface">{info.getValue()}</p>
              <p className="text-xs text-on-surface-variant">{info.row.original.email}</p>
            </div>
          </div>
        ),
      }),
      columnHelper.accessor('role', {
        header: 'Role',
        cell: (info) => {
          const role = info.getValue();
          const roleColors = {
            ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
            FLEET_MANAGER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
            DRIVER: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
          };
          return (
            <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', roleColors[role as keyof typeof roleColors] || 'bg-slate-100 text-slate-700')}>
              {role}
            </span>
          );
        },
      }),
      columnHelper.accessor('accountStatus', {
        header: 'Status',
        cell: (info) => {
          const status = info.getValue();
          return <StatusBadge status={status} />;
        },
      }),
      columnHelper.accessor('department', {
        header: 'Department',
        cell: (info) => <span className="text-xs text-on-surface-variant">{info.getValue() || '—'}</span>,
      }),
      columnHelper.accessor('createdAt', {
        header: 'Created',
        cell: (info) => {
          const date = new Date(info.getValue());
          return <span className="text-xs text-on-surface-variant">{date.toLocaleDateString()}</span>;
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: (info) => {
          const user = info.row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(user)}
                className="p-1.5"
                title="Edit user"
                aria-label={`Edit user ${user.name}`}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteConfirm(user)}
                className="p-1.5 text-error hover:text-error hover:bg-red-50"
                title="Delete user"
                aria-label={`Delete user ${user.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          );
        },
      }),
    ],
    []
  );

  const table = useReactTable({
    data: users,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: pages,
  });

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, pageIndex: newPage - 1 }));
    onPageChange(newPage);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading users">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <Input
            placeholder="Search users by name, email, department..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-outline-variant/60 bg-surface-lowest overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-low border-b border-outline-variant/60">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={clsx(
                      'px-4 py-3 text-left font-semibold text-on-surface-variant uppercase tracking-wider text-[11px]',
                      header.column.getCanSort() && 'cursor-pointer hover:text-on-surface select-none'
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ width: header.getSize() }}
                  >
                    <div className="flex items-center gap-1.5">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() && (
                        header.column.getIsSorted() === 'asc' ? (
                          <ChevronUp className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-primary" />
                        )
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-outline-variant/60">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-on-surface-variant">
                  No users found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-surface-low/60 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-on-surface">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-on-surface-variant">
          Showing {Math.min((page - 1) * 50 + 1, total)} to {Math.min(page * 50, total)} of {total} users
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(1)}
            disabled={page === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="px-3 text-xs font-medium text-on-surface">
            Page {page} of {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page + 1)}
            disabled={page === pages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(pages)}
            disabled={page === pages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete User"
        subtitle={`Are you sure you want to delete ${deleteConfirm?.name} (${deleteConfirm?.email})?`}
        maxWidth="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleteConfirm) {
                  onDelete(deleteConfirm);
                  setDeleteConfirm(null);
                }
              }}
            >
              Delete
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-surface-low rounded-xl">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-on-surface">{deleteConfirm?.name}</p>
              <p className="text-xs text-on-surface-variant">{deleteConfirm?.email}</p>
              <p className="text-xs text-on-surface-variant">Role: {deleteConfirm?.role}</p>
            </div>
          </div>
          <p className="text-sm text-on-surface-variant">
            This action cannot be undone. The user will be permanently removed from the system.
            {deleteConfirm?.role === 'ADMIN' && (
              <span className="text-error font-medium ml-1">(Last-Admin protection applies)</span>
            )}
          </p>
        </div>
      </Modal>
    </div>
  );
};
