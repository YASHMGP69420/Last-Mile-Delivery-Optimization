import { apiClient } from './client';
import { AdminUser, UserCreate, UserUpdate, UserListResponse, UserApiResponse } from '../types/admin';

export const AdminUserApi = {
  /**
   * GET /api/v1/admin/users
   * List all users with pagination, filtering, and search
   */
  getUsers: async (params?: {
    role?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<UserApiResponse<UserListResponse>> => {
    const res = await apiClient.get('/admin/users', { params });
    return res.data;
  },

  /**
   * POST /api/v1/admin/users
   * Create a new user account
   */
  createUser: async (data: UserCreate): Promise<UserApiResponse<{ user: AdminUser }>> => {
    const res = await apiClient.post('/admin/users', data);
    return res.data;
  },

  /**
   * PUT /api/v1/admin/users/:id
   * Update user details
   */
  updateUser: async (id: string, data: UserUpdate): Promise<UserApiResponse<{ user: AdminUser }>> => {
    const res = await apiClient.put(`/admin/users/${id}`, data);
    return res.data;
  },

  /**
   * PATCH /api/v1/admin/users/:id/status
   * Update user account status (activate, deactivate, suspend)
   */
  updateUserStatus: async (
    id: string,
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
    reason?: string
  ): Promise<UserApiResponse<{ user: AdminUser }>> => {
    const res = await apiClient.patch(`/admin/users/${id}/status`, { status, reason });
    return res.data;
  },

  /**
   * DELETE /api/v1/admin/users/:id
   * Delete user account (with Last-Admin protection)
   */
  deleteUser: async (id: string): Promise<UserApiResponse<{ userId: string }>> => {
    const res = await apiClient.delete(`/admin/users/${id}`);
    return res.data;
  },

  /**
   * POST /api/v1/admin/users/:id/reset-password
   * Reset user password with secure temporary password
   */
  resetUserPassword: async (id: string, newPassword?: string): Promise<UserApiResponse<{
    userId: string;
    email: string;
    temporaryPassword: string;
  }>> => {
    const res = await apiClient.post(`/admin/users/${id}/reset-password`, { newPassword });
    return res.data;
  },
};