import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AdminUserApi } from '../../api/adminApi';
import { UserTable } from '../../components/admin/UserTable';
import { UserFormModal } from '../../components/admin/UserFormModal';
import { AdminUser, UserCreate, UserUpdate } from '../../types/admin';
import { Button } from '../../components/common/Button';
import { Plus, RotateCw, AlertCircle, Shield, Users } from 'lucide-react';
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
        throw new Error(res.message || 'Failed to delete user');
      }
    } catch (err: any) {
      if (err.response?.data?.error?.code === 'LAST_ADMIN_PROTECTED') {
        toast.error('Cannot delete the last remaining active administrator');
      } else {
        toast.error(err.friendlyMessage || err.message || 'Failed to delete user');
      }
    }
  };

  const handleStatusChange = async (user: AdminUser, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') => {
    try {
      const res = await AdminUserApi.updateUserStatus(user.id, status);
      if (res.success) {
        toast.success(`User account is now ${status}`);
        fetchUsers(page);
      } else {
        throw new Error(res.message || 'Failed to update status');
      }
    } catch (err: any) {
      if (err.response?.data?.error?.code === 'LAST_ADMIN_PROTECTED') {
        toast.error('Cannot deactivate the last remaining active administrator');
      } else {
        toast.error(err.friendlyMessage || err.message || 'Failed to update status');
      }
    }
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
