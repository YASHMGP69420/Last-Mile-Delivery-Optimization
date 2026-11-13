import { UserRole } from '../types';

export interface AdminUser {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  department?: string;
  accountStatus: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  active: boolean;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  avatarUrl?: string | null;
  isDemoData?: boolean;
  createdAt: string;
  updatedAt?: string;
  lastLogin?: string | null;
}

export interface UserCreate {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  department?: string;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  phone?: string | null;
  department?: string;
  role?: UserRole;
  accountStatus?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export interface UserListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  pages: number;
}

export interface UserApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}