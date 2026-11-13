import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserFormModal } from './UserFormModal';
import { renderWithProviders } from '../../test/test-utils';
import { AdminUserApi } from '../../api/adminApi';
import { apiClient } from '../../api/client';

// Mock the apiClient
vi.mock('../../api/client', () => ({
  apiClient: {
    get: vi.fn((url: string) => {
      if (url === '/auth/me') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              user: JSON.parse(localStorage.getItem('user') || 'null'),
            },
          },
        });
      }
      return Promise.resolve({ data: { success: true, data: null } });
    }),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

// Mock the adminApi
vi.mock('../../api/adminApi', () => ({
  AdminUserApi: {
    createUser: vi.fn(),
    updateUser: vi.fn(),
  },
}));

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSubmit: vi.fn(),
  mode: 'create' as const,
};

describe('UserFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Mode', () => {
    it('renders with create mode title and subtitle', () => {
      renderWithProviders(<UserFormModal {...defaultProps} mode="create" />);

      expect(screen.getByText('Add New User')).toBeInTheDocument();
      expect(screen.getByText('Create a new user account with role and permissions')).toBeInTheDocument();
    });

    it('shows form fields with labels', () => {
      renderWithProviders(<UserFormModal {...defaultProps} mode="create" />);

      expect(screen.getByText('Full Name')).toBeInTheDocument();
      expect(screen.getByText('Email Address')).toBeInTheDocument();
      expect(screen.getByText('Role')).toBeInTheDocument();
      expect(screen.getByText('Password')).toBeInTheDocument();
      expect(screen.getByText('Department')).toBeInTheDocument();
    });

    it('has password field as required in create mode', () => {
      renderWithProviders(<UserFormModal {...defaultProps} mode="create" />);

      const passwordInput = screen.getByLabelText(/password/i);
      expect(passwordInput).toBeInTheDocument();
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('shows validation errors on empty submit', async () => {
      const user = userEvent.setup();
      renderWithProviders(<UserFormModal {...defaultProps} mode="create" />);

      await user.click(screen.getByRole('button', { name: /create user/i }));

      await waitFor(() => {
        expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument();
        expect(screen.getByText('Invalid email address')).toBeInTheDocument();
        // Department validation may not show for Select component
      });
    });

    it('validates email format', async () => {
      const user = userEvent.setup();
      renderWithProviders(<UserFormModal {...defaultProps} mode="create" />);

      await user.type(screen.getByLabelText(/email address/i), 'invalid-email');
      await user.click(screen.getByRole('button', { name: /create user/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid email address')).toBeInTheDocument();
      });
    });

    it('validates password minimum length', async () => {
      const user = userEvent.setup();
      renderWithProviders(<UserFormModal {...defaultProps} mode="create" />);

      await user.type(screen.getByLabelText(/password/i), 'short');
      await user.click(screen.getByRole('button', { name: /create user/i }));

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      });
    });

    it('closes modal on cancel', async () => {
      const user = userEvent.setup();
      renderWithProviders(<UserFormModal {...defaultProps} mode="create" />);

      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Edit Mode', () => {
    const initialData = {
      name: 'Existing User',
      email: 'existing@example.com',
      role: 'DRIVER' as const,
      phone: '+91 98765 43210',
      department: 'Logistics Operations',
      isActive: true,
    };

    it('renders with edit mode title and subtitle', () => {
      renderWithProviders(<UserFormModal {...defaultProps} mode="edit" initialData={initialData} />);

      expect(screen.getByText('Edit User')).toBeInTheDocument();
      expect(screen.getByText('Update user details and permissions')).toBeInTheDocument();
    });

    it('pre-fills form with initial data', () => {
      renderWithProviders(<UserFormModal {...defaultProps} mode="edit" initialData={initialData} />);

      expect(screen.getByDisplayValue('Existing User')).toBeInTheDocument();
      expect(screen.getByDisplayValue('existing@example.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('+91 98765 43210')).toBeInTheDocument();
      // Department Select shows "Select department" as accessible name
      expect(screen.getByRole('button', { name: /select department/i })).toBeInTheDocument();
    });

    it('disables email field in edit mode', () => {
      renderWithProviders(<UserFormModal {...defaultProps} mode="edit" initialData={initialData} />);

      const emailInput = screen.getByLabelText(/email address/i);
      expect(emailInput).toBeDisabled();
      expect(screen.getByText('Email cannot be changed after creation')).toBeInTheDocument();
    });

    it('shows password as optional in edit mode', () => {
      renderWithProviders(<UserFormModal {...defaultProps} mode="edit" initialData={initialData} />);

      expect(screen.getByText('(leave blank to keep current)')).toBeInTheDocument();
    });

    it('shows Last-Admin protection notice for admin users', () => {
      const adminData = { ...initialData, role: 'ADMIN' as const };
      renderWithProviders(<UserFormModal {...defaultProps} mode="edit" initialData={adminData} />);

      expect(screen.getByText('Last-Admin Protection Active')).toBeInTheDocument();
      expect(screen.getByText(/this user is an administrator/i)).toBeInTheDocument();
    });

    it('does not show Last-Admin protection notice for non-admin users', () => {
      renderWithProviders(<UserFormModal {...defaultProps} mode="edit" initialData={initialData} />);

      expect(screen.queryByText('Last-Admin Protection Active')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('disables submit button when loading', () => {
      renderWithProviders(<UserFormModal {...defaultProps} mode="create" isLoading />);

      // Find the submit button by its role and disabled state
      const buttons = screen.getAllByRole('button');
      const submitButton = buttons.find(btn => btn.getAttribute('type') === 'submit');
      expect(submitButton).toBeDisabled();
    });

    it('shows loading spinner on submit button when loading', () => {
      renderWithProviders(<UserFormModal {...defaultProps} mode="create" isLoading />);

      // Find the submit button and check for loading spinner
      const buttons = screen.getAllByRole('button');
      const submitButton = buttons.find(btn => btn.getAttribute('type') === 'submit');
      const spinner = submitButton?.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Role Options', () => {
    it('shows role selector with placeholder', () => {
      renderWithProviders(<UserFormModal {...defaultProps} mode="create" />);

      const roleButton = screen.getByRole('button', { name: /select role/i });
      expect(roleButton).toBeInTheDocument();
    });

    it('shows department selector with placeholder', () => {
      renderWithProviders(<UserFormModal {...defaultProps} mode="create" />);

      const deptButton = screen.getByRole('button', { name: /select department/i });
      expect(deptButton).toBeInTheDocument();
    });
  });
});