import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Shield, Mail, Phone, User, Lock, Building2 } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { Select } from '../common/Select';
import { UserRole } from '../../types';
import { clsx } from 'clsx';

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: UserFormData) => Promise<void>;
  initialData?: UserFormData | null;
  isLoading?: boolean;
  mode: 'create' | 'edit';
}

export interface UserFormData {
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  phone: string;
  department: string;
  isActive: boolean;
}

const userFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be under 100 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['ADMIN', 'FLEET_MANAGER', 'DRIVER']),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  department: z.string().min(1, 'Department is required'),
  isActive: z.boolean(),
});

type UserFormSchema = z.infer<typeof userFormSchema>;

const roleOptions = [
  { value: 'ADMIN', label: 'Administrator', description: 'Full system access' },
  { value: 'FLEET_MANAGER', label: 'Fleet Manager', description: 'Operations & dispatch access' },
  { value: 'DRIVER', label: 'Driver', description: 'Driver HUD access only' },
];

const departmentOptions = [
  'Logistics Operations',
  'Fleet Management',
  'Administration',
  'Customer Support',
  'IT & Systems',
  'Finance',
  'HR',
];

export const UserFormModal: React.FC<UserFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading = false,
  mode,
}) => {
  const isCreate = mode === 'create';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    watch,
    setValue,
    setError,
  } = useForm<UserFormSchema>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'DRIVER',
      password: '',
      phone: '',
      department: 'Logistics Operations',
      isActive: true,
      ...initialData,
    },
    mode: 'onBlur',
  });

  const passwordValue = watch('password');
  const passwordRequired = isCreate || (passwordValue && passwordValue.length > 0);

  React.useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name || '',
        email: initialData.email || '',
        role: initialData.role || 'DRIVER',
        password: '',
        phone: initialData.phone || '',
        department: initialData.department || 'Logistics Operations',
        isActive: initialData.isActive !== false,
      });
    } else if (isCreate) {
      reset({
        name: '',
        email: '',
        role: 'DRIVER',
        password: '',
        phone: '',
        department: 'Logistics Operations',
        isActive: true,
      });
    }
  }, [initialData, isCreate, reset]);

  const handleFormSubmit = async (data: UserFormSchema) => {
    const password = data.password ?? '';
    if (isCreate && !password.trim()) {
      setError('password', { type: 'required', message: 'Password is required when creating a user' });
      return;
    }
    const phone = data.phone ?? '';
    const submitData: UserFormData = {
      name: data.name,
      email: data.email,
      role: data.role,
      password: isCreate ? password : (password || undefined),
      phone,
      department: data.department,
      isActive: data.isActive,
    };
    await onSubmit(submitData);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isCreate ? 'Add New User' : 'Edit User'}
      subtitle={isCreate ? 'Create a new user account with role and permissions' : 'Update user details and permissions'}
      maxWidth="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isLoading || isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="user-form"
            variant="primary"
            isLoading={isLoading || isSubmitting}
          >
            {isCreate ? 'Create User' : 'Save Changes'}
          </Button>
        </div>
      }
    >
      <form id="user-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-xs font-semibold text-on-surface-variant mb-1.5">
            Full Name <span className="text-error">*</span>
          </label>
          <Input
            id="name"
            placeholder="John Doe"
            leftIcon={<User className="w-4 h-4" />}
            error={errors.name?.message}
            {...register('name')}
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-xs font-semibold text-on-surface-variant mb-1.5">
            Email Address <span className="text-error">*</span>
          </label>
          <Input
            id="email"
            type="email"
            placeholder="john.doe@company.com"
            leftIcon={<Mail className="w-4 h-4" />}
            error={errors.email?.message}
            {...register('email')}
            disabled={!isCreate}
          />
          {!isCreate && (
            <p className="text-xs text-on-surface-variant mt-1">Email cannot be changed after creation</p>
          )}
        </div>

        {/* Role */}
        <div>
          <label htmlFor="role" className="block text-xs font-semibold text-on-surface-variant mb-1.5">
            Role <span className="text-error">*</span>
          </label>
          <Select
            id="role"
            options={roleOptions}
            placeholder="Select role"
            aria-label="Select role"
            error={errors.role?.message}
            value={watch('role')}
            onChange={(event) => setValue('role', event.target.value as UserRole, { shouldValidate: true })}
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-xs font-semibold text-on-surface-variant mb-1.5">
            Password {isCreate ? <span className="text-error">*</span> : <span className="text-on-surface-variant">(leave blank to keep current)</span>}
          </label>
          <Input
            id="password"
            type="password"
            placeholder={isCreate ? 'Minimum 8 characters' : 'Leave blank to keep current password'}
            leftIcon={<Lock className="w-4 h-4" />}
            error={errors.password?.message}
            {...register('password')}
          />
          {isCreate && (
            <p className="text-xs text-on-surface-variant mt-1">Must be at least 8 characters</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="block text-xs font-semibold text-on-surface-variant mb-1.5">
            Phone Number
          </label>
          <Input
            id="phone"
            type="tel"
            placeholder="+91 98765 43210"
            leftIcon={<Phone className="w-4 h-4" />}
            error={errors.phone?.message}
            {...register('phone')}
          />
        </div>

        {/* Department */}
        <div>
          <label htmlFor="department" className="block text-xs font-semibold text-on-surface-variant mb-1.5">
            Department <span className="text-error">*</span>
          </label>
          <Select
            id="department"
            options={departmentOptions.map((d) => ({ value: d, label: d }))}
            placeholder="Select department"
            aria-label="Select department"
            error={errors.department?.message}
            value={watch('department')}
            onChange={(event) => setValue('department', event.target.value, { shouldValidate: true })}
          />
        </div>

        {/* Active Status */}
        <div className="pt-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-outline-variant/60 text-primary focus:ring-primary/25 bg-surface-lowest"
              {...register('isActive')}
            />
            <div>
              <p className="text-sm font-medium text-on-surface">Active Account</p>
              <p className="text-xs text-on-surface-variant">User can log in and access the system</p>
            </div>
          </label>
        </div>

        {/* Last-Admin Protection Notice */}
        {initialData?.role === 'ADMIN' && !isCreate && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-2">
              <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Last-Admin Protection Active</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  This user is an Administrator. The system prevents demoting, deactivating, or deleting the last
                  remaining active administrator account.
                </p>
              </div>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
};
