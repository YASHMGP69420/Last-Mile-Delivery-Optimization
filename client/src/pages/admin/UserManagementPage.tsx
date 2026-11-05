import React, { useState, useEffect } from 'react';
import { AdminApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  UserPlus,
  ShieldAlert,
  Search,
  Filter,
  KeyRound,
  RotateCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { StatusBadge } from '../../components/common/StatusBadge';

export const UserManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [tempPasswordNotice, setTempPasswordNotice] = useState<string | null>(null);

  // Add user form
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'FLEET_MANAGER',
    phone: '',
    department: 'Bhubaneswar Operations Hub',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = {};
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await AdminApi.getUsers(params);
      setUsers(res.data.users || []);
      setTotal(res.data.total || 0);
    } catch (err: any) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await AdminApi.createUser(formData);
      setIsAddUserOpen(false);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'FLEET_MANAGER',
        phone: '',
        department: 'Bhubaneswar Operations Hub',
      });
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || err.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: any) => {
    const isCurrentlyActive = user.accountStatus === 'ACTIVE';
    const newStatus = isCurrentlyActive ? 'SUSPENDED' : 'ACTIVE';
    const promptReason = window.prompt(`Provide mandatory reason for changing account status to ${newStatus}:`, 'Security policy compliance review');
    if (!promptReason) return;

    try {
      await AdminApi.updateUserStatus(user._id || user.id, {
        status: newStatus,
        reason: promptReason,
      });
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to update account status');
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await AdminApi.resetUserPassword(selectedUser._id || selectedUser.id);
      setTempPasswordNotice(`Temporary password generated for ${selectedUser.email}: ${res.data.temporaryPassword}`);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-on-surface flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-500" />
            User and Access Governance
          </h1>
          <p className="text-xs text-on-surface-variant">
            Create, audit, suspend, and configure system credentials and role assignments.
          </p>
        </div>

        <Button variant="primary" onClick={() => setIsAddUserOpen(true)} className="bg-amber-600 hover:bg-amber-500">
          <UserPlus className="w-4 h-4 mr-1.5" />
          Create User Account
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-surface-lowest border border-outline-variant shadow-sm flex flex-col md:flex-row items-center gap-3 justify-between">
        <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-on-surface-variant absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by name, email, department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs bg-surface border border-outline-variant text-on-surface focus:outline-none focus:border-secondary"
            />
          </div>
          <Button type="submit" size="sm" variant="outline">
            Filter
          </Button>
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg text-xs bg-surface border border-outline-variant text-on-surface focus:outline-none"
          >
            <option value="">All Roles</option>
            <option value="ADMIN">ADMIN</option>
            <option value="FLEET_MANAGER">FLEET_MANAGER</option>
            <option value="DRIVER">DRIVER</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg text-xs bg-surface border border-outline-variant text-on-surface focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>

          <Button size="sm" variant="ghost" onClick={fetchUsers}>
            <RotateCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* User Table */}
      <div className="rounded-xl bg-surface-lowest border border-outline-variant shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface text-on-surface-variant font-semibold border-b border-outline-variant uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-on-surface-variant">
                    <RotateCw className="w-5 h-5 animate-spin mx-auto text-secondary mb-2" />
                    Loading system user accounts...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-on-surface-variant">
                    No users matching criteria found.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isCurrent = (u._id || u.id) === currentUser?.id;
                  const isActive = (u.accountStatus || (u.active ? 'ACTIVE' : 'INACTIVE')) === 'ACTIVE';

                  return (
                    <tr key={u._id || u.id} className="hover:bg-surface/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-on-surface flex items-center gap-1.5">
                          {u.name}
                          {isCurrent && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-blue-500/20 text-blue-400">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-on-surface-variant font-mono">{u.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                            u.role === 'ADMIN'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : u.role === 'FLEET_MANAGER'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant">{u.department || 'Operations'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-red-500/10 text-red-500'
                          }`}
                        >
                          {isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {u.accountStatus || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant font-mono text-[11px]">
                        {u.lastLogin ? new Date(u.lastLogin).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setTempPasswordNotice(null);
                            setIsResetPasswordOpen(true);
                          }}
                          className="px-2 py-1 rounded text-[11px] font-medium bg-surface hover:bg-surface-lowest border border-outline-variant text-on-surface"
                          title="Reset Password"
                        >
                          Reset Pass
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u)}
                          disabled={isCurrent}
                          className={`px-2 py-1 rounded text-[11px] font-medium border ${
                            isActive
                              ? 'border-red-500/30 text-red-500 hover:bg-red-500/10'
                              : 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'
                          } ${isCurrent ? 'opacity-40 cursor-not-allowed' : ''}`}
                          title={isCurrent ? 'Cannot suspend own account' : isActive ? 'Suspend Account' : 'Reactivate Account'}
                        >
                          {isActive ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create User Account */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-surface-lowest border border-outline-variant rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-500" />
                Register New User Account
              </h2>
              <button onClick={() => setIsAddUserOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-500 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-on-surface block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Chandra Das"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-surface border border-outline-variant text-on-surface focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-on-surface block mb-1">Work Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. ramesh@smartroute.io"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-surface border border-outline-variant text-on-surface focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-on-surface block mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  placeholder="Temporary access password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-surface border border-outline-variant text-on-surface focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-on-surface block mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-surface border border-outline-variant text-on-surface focus:outline-none"
                  >
                    <option value="FLEET_MANAGER">FLEET_MANAGER</option>
                    <option value="DRIVER">DRIVER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-on-surface block mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="+91 98610 12345"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-surface border border-outline-variant text-on-surface focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-on-surface block mb-1">Department / Branch</label>
                <input
                  type="text"
                  placeholder="e.g. Rasulgarh Central Logistics"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-surface border border-outline-variant text-on-surface focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAddUserOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isSubmitting} className="bg-amber-600 hover:bg-amber-500">
                  Register Account
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Password */}
      {isResetPasswordOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-surface-lowest border border-outline-variant rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-500" />
                Reset Credentials
              </h2>
              <button onClick={() => setIsResetPasswordOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                ✕
              </button>
            </div>

            <p className="text-xs text-on-surface-variant">
              Generate a temporary access password for <strong className="text-on-surface">{selectedUser.name}</strong> ({selectedUser.email}).
            </p>

            {tempPasswordNotice ? (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-500 font-mono select-all">
                {tempPasswordNotice}
              </div>
            ) : null}

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-500">
                {errorMsg}
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsResetPasswordOpen(false)}>
                Close
              </Button>
              {!tempPasswordNotice && (
                <Button type="button" variant="primary" onClick={handleResetPassword} isLoading={isSubmitting} className="bg-amber-600 hover:bg-amber-500">
                  Generate New Password
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
