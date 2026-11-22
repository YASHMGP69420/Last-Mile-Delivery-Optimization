import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AdminUserApi } from '../../api/adminApi';
import { UserTable } from '../../components/admin/UserTable';
import { UserFormModal } from '../../components/admin/UserFormModal';
import {
  ActiveOperationConflictModal,
  ActiveOperationConflictDetails,
} from '../../components/admin/ActiveOperationConflictModal';
import { AdminUser, UserCreate, UserUpdate } from '../../types/admin';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Plus, RotateCw, AlertCircle, Shield, Users, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';

export const UserManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formLoading, setFormLoading] = useState(false);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [activeConflict, setActiveConflict] = useState<{
    user: AdminUser;
    details: ActiveOperationConflictDetails;
  } | null>(null);
  const [isCascadeSubmitting, setIsCascadeSubmitting] = useState(false);

  // Bulk selection and deletion state
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [targetUsersToDelete, setTargetUsersToDelete] = useState<AdminUser[]>([]);

  // Check if user is admin
  const isAdmin = user?.role === 'ADMIN';

  // Redirect non-admin users
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/admin/deliveries', { replace: true });
    }
  }, [authLoading, isAdmin, navigate]);

  const fetchUsers = useCallback(async (pageNum: number = 1) => {
    try {
      setIsLoading(pageNum === 1);
      setIsRefreshing(pageNum !== 1);
      const res = await AdminUserApi.getUsers({ page: pageNum, limit: 50 });
      if (res.success && res.data) {
        setUsers(res.data.users);
        setTotal(res.data.total);
        setPage(res.data.page);
        setPages(res.data.pages);
      }
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
      toast.error(err.friendlyMessage || 'Failed to load users');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers(1);
    }
  }, [isAdmin, fetchUsers]);

  const handlePageChange = (newPage: number) => {
    fetchUsers(newPage);
  };

  const handleCreateUser = async (data: UserCreate & { isActive?: boolean }) => {
    try {
      setFormLoading(true);
      // The backend creates new accounts as active. isActive belongs to the edit
      // workflow and must not be sent as an undocumented create payload field.
      const { isActive: _isActive, ...createPayload } = data;
      const res = await AdminUserApi.createUser(createPayload);
      if (res.success) {
        toast.success('User created successfully');
        setFormModalOpen(false);
        setEditingUser(null);
        fetchUsers(page);
      } else {
        throw new Error(res.message || 'Failed to create user');
      }
    } catch (err: any) {
      toast.error(err.friendlyMessage || err.message || 'Failed to create user');
      throw err;
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateUser = async (data: UserUpdate & { isActive?: boolean; password?: string }) => {
    if (!editingUser) return;
    try {
      setFormLoading(true);
      // PUT accepts accountStatus, not the form's boolean isActive. Passwords are
      // deliberately not sent here: changing one uses the dedicated reset endpoint.
      const { isActive, password: _password, ...userFields } = data;
      const updatePayload: UserUpdate = {
        ...userFields,
        accountStatus: isActive ? 'ACTIVE' : 'INACTIVE',
      };
      const res = await AdminUserApi.updateUser(editingUser.id, updatePayload);
      if (res.success) {
        toast.success('User updated successfully');
        setFormModalOpen(false);
        setEditingUser(null);
        fetchUsers(page);
      } else {
        throw new Error(res.message || 'Failed to update user');
      }
    } catch (err: any) {
      toast.error(err.friendlyMessage || err.message || 'Failed to update user');
      throw err;
    } finally {
      setFormLoading(false);
    }
  };

  const handleFormSubmit = (data: UserCreate | UserUpdate) => {
    if (formMode === 'create') {
      return handleCreateUser(data as UserCreate);
    } else {
      return handleUpdateUser(data as UserUpdate);
    }
  };

  const handleEdit = (user: AdminUser) => {
    setEditingUser(user);
    setFormMode('edit');
    setFormModalOpen(true);
  };

  const handleDelete = async (targetUser: AdminUser) => {
    if (targetUser.id === user?.id) {
      toast.error('Cannot delete your own account');
      return;
    }
    try {
      const res = await AdminUserApi.deleteUser(targetUser.id);
      if (res.success) {
        toast.success('User deleted successfully');
        fetchUsers(page);
      } else {
        if ((res as { error?: { code?: string } }).error?.code === 'LAST_ADMIN_PROTECTED') {
          toast.error('Cannot delete the last remaining active administrator');
          return;
        }
        if ((res as { error?: { code?: string } }).error?.code === 'ACTIVE_OPERATION_CONFLICT') {
          const details = (res as { error?: { details?: ActiveOperationConflictDetails } }).error?.details;
          setActiveConflict({
            user: targetUser,
            details: {
              routeId: details?.routeId,
              routeCode: details?.routeCode,
              activeDeliveryCount: details?.activeDeliveryCount ?? 0,
              driverName: targetUser.name,
            },
          });
          setConflictModalOpen(true);
          return;
        }
        throw new Error(res.message || 'Failed to delete user');
      }
    } catch (err: any) {
      if (err.response?.data?.error?.code === 'LAST_ADMIN_PROTECTED') {
        toast.error('Cannot delete the last remaining active administrator');
      } else if (err.response?.data?.error?.code === 'ACTIVE_OPERATION_CONFLICT') {
        const details = err.response.data.error.details;
        setActiveConflict({
          user: targetUser,
          details: {
            routeId: details?.routeId,
            routeCode: details?.routeCode,
            activeDeliveryCount: details?.activeDeliveryCount ?? 0,
            driverName: targetUser.name,
          },
        });
        setConflictModalOpen(true);
      } else {
        toast.error(err.friendlyMessage || err.message || 'Failed to delete user');
      }
    }
  };

  const handleStatusChange = async (targetUser: AdminUser, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') => {
    try {
      const res = await AdminUserApi.updateUserStatus(targetUser.id, status);
      if (res.success) {
        toast.success(`User account is now ${status}`);
        fetchUsers(page);
      } else {
        throw new Error(res.message || 'Failed to update status');
      }
    } catch (err: any) {
      if (err.response?.data?.error?.code === 'LAST_ADMIN_PROTECTED') {
        toast.error('Cannot deactivate the last remaining active administrator');
      } else if (err.response?.data?.error?.code === 'ACTIVE_OPERATION_CONFLICT') {
        const details = err.response.data.error.details;
        setActiveConflict({
          user: targetUser,
          details: {
            routeId: details?.routeId,
            routeCode: details?.routeCode,
            activeDeliveryCount: details?.activeDeliveryCount ?? 0,
            driverName: targetUser.name,
          },
        });
        setConflictModalOpen(true);
      } else {
        toast.error(err.friendlyMessage || err.message || 'Failed to update status');
      }
    }
  };

  const handleConfirmReassignAndDelete = async () => {
    if (!activeConflict) return;
    try {
      setIsCascadeSubmitting(true);
      const res = await AdminUserApi.deleteUser(activeConflict.user.id, { forceReassign: true });
      if (res.success) {
        toast.success('Active orders rescued & driver account deleted');
        setConflictModalOpen(false);
        setActiveConflict(null);
        fetchUsers(page);
      } else {
        throw new Error(res.message || 'Failed to execute mishap cascade');
      }
    } catch (err: any) {
      toast.error(err.friendlyMessage || err.message || 'Failed to execute mishap cascade');
    } finally {
      setIsCascadeSubmitting(false);
    }
  };

  const handleToggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllUsers = (ids: string[]) => {
    setSelectedUserIds(ids);
  };

  const handleOpenBulkDelete = (selectedUsers: AdminUser[]) => {
    setTargetUsersToDelete(selectedUsers);
    setIsBulkDeleteModalOpen(true);
  };

  const hasSelfSelected = targetUsersToDelete.some((u) => u.id === user?.id || (u as any)._id === user?.id);
  const eligibleUsersToDelete = targetUsersToDelete.filter((u) => u.id !== user?.id && (u as any)._id !== user?.id);

  const handleConfirmBulkDeleteUsers = async () => {
    if (eligibleUsersToDelete.length === 0) {
      setIsBulkDeleteModalOpen(false);
      setSelectedUserIds([]);
      return;
    }

    setIsBulkDeleting(true);
    let succeeded = 0;
    let protectedLastAdmin = 0;
    let otherErrors = 0;

    for (const targetUser of eligibleUsersToDelete) {
      try {
        const res = await AdminUserApi.deleteUser(targetUser.id);
        if (res.success) {
          succeeded++;
        } else {
          if ((res as any)?.error?.code === 'LAST_ADMIN_PROTECTED') {
            protectedLastAdmin++;
          } else {
            otherErrors++;
          }
        }
      } catch (err: any) {
        if (err.response?.data?.error?.code === 'LAST_ADMIN_PROTECTED') {
          protectedLastAdmin++;
        } else {
          otherErrors++;
        }
      }
    }

    if (succeeded > 0) {
      toast.success(`Successfully deleted ${succeeded} user account${succeeded === 1 ? '' : 's'}.`);
    }
    if (protectedLastAdmin > 0) {
      toast.error('The last remaining active administrator account was protected and could not be deleted.');
    }
    if (otherErrors > 0) {
      toast.error(`${otherErrors} user${otherErrors === 1 ? '' : 's'} could not be deleted.`);
    }

    setSelectedUserIds([]);
    setIsBulkDeleteModalOpen(false);
    fetchUsers(page);
    setIsBulkDeleting(false);
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setFormMode('create');
    setFormModalOpen(true);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading user management">
        <RotateCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">User Management</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Manage user accounts, roles, and access permissions
          </p>
        </div>
        <Button onClick={handleAddUser} leftIcon={<Plus className="w-4 h-4" />}>
          Add User
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={total}
          icon={<Users className="w-5 h-5" />}
          color="primary"
        />
        <StatCard
          title="Admins"
          value={users.filter((u) => u.role === 'ADMIN').length}
          icon={<Shield className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          title="Fleet Managers"
          value={users.filter((u) => u.role === 'FLEET_MANAGER').length}
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Drivers"
          value={users.filter((u) => u.role === 'DRIVER').length}
          icon={<Users className="w-5 h-5" />}
          color="emerald"
        />
      </div>

      {/* User Table */}
      <UserTable
        users={users}
        total={total}
        page={page}
        pages={pages}
        onPageChange={handlePageChange}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
        isLoading={isLoading}
        selectedUserIds={selectedUserIds}
        onToggleSelect={handleToggleSelectUser}
        onSelectAll={handleSelectAllUsers}
        onBulkDelete={handleOpenBulkDelete}
      />

      {/* Create/Edit User Modal */}
      <UserFormModal
        isOpen={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setEditingUser(null);
        }}
        onSubmit={handleFormSubmit}
        initialData={editingUser
          ? {
              name: editingUser.name,
              email: editingUser.email,
              role: editingUser.role,
              phone: editingUser.phone || '',
              department: editingUser.department || 'Logistics Operations',
              isActive: editingUser.accountStatus === 'ACTIVE',
            }
          : null}
        isLoading={formLoading}
        mode={formMode}
      />

      {/* Active Operation Conflict Resolution Modal */}
      <ActiveOperationConflictModal
        isOpen={conflictModalOpen}
        onClose={() => {
          setConflictModalOpen(false);
          setActiveConflict(null);
        }}
        conflict={activeConflict ? activeConflict.details : null}
        onConfirmReassignAndDelete={handleConfirmReassignAndDelete}
        isSubmitting={isCascadeSubmitting}
      />

      {/* Bulk Delete Users Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <Modal
          title={`Delete ${eligibleUsersToDelete.length} Selected User${eligibleUsersToDelete.length === 1 ? '' : 's'}`}
          subtitle="Permanently remove selected user accounts from the system"
          isOpen={isBulkDeleteModalOpen}
          onClose={() => !isBulkDeleting && setIsBulkDeleteModalOpen(false)}
        >
          <div className="space-y-4 text-sm">
            {hasSelfSelected && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                <Shield className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Self-Deletion Prevented:</strong> Your own account ({user?.email}) cannot be deleted and will be excluded.
                </span>
              </div>
            )}

            {eligibleUsersToDelete.length === 0 ? (
              <p className="text-on-surface-variant">
                No eligible user accounts selected for deletion.
              </p>
            ) : (
              <>
                <p className="text-on-surface">
                  Are you sure you want to permanently delete{' '}
                  <strong className="text-red-600 font-semibold">{eligibleUsersToDelete.length}</strong> selected user account{eligibleUsersToDelete.length === 1 ? '' : 's'}?
                </p>
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-700 dark:text-red-300">
                  <strong>Warning:</strong> This action is irreversible. Deleted users will immediately lose all system and dispatch access.
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBulkDeleting}
                onClick={() => setIsBulkDeleteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={eligibleUsersToDelete.length === 0}
                isLoading={isBulkDeleting}
                onClick={handleConfirmBulkDeleteUsers}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Delete {eligibleUsersToDelete.length} User{eligibleUsersToDelete.length === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'primary' | 'purple' | 'blue' | 'emerald';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  };

  return (
    <div className="glass-card p-4 rounded-2xl border border-outline-variant/60">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-on-surface mt-1">{value}</p>
        </div>
        <div className={clsx('p-3 rounded-xl', colorClasses[color])}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default UserManagementPage;
