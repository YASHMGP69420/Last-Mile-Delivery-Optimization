import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Route, Lock, Mail, AlertCircle, Shield, Truck, User } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, quickLogin, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const user = await login(email, password);
      if (user.role === 'DRIVER') {
        navigate('/driver');
      } else {
        navigate('/admin/deliveries');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message || 'Authentication failed. Please verify credentials.'
      );
    }
  };

  const handleQuickLogin = async (role: 'admin' | 'manager' | 'driver') => {
    setError(null);
    try {
      const user = await quickLogin(role);
      if (user.role === 'DRIVER') {
        navigate('/driver');
      } else {
        navigate('/admin/deliveries');
      }
    } catch (err: any) {
      setError('Quick login failed. Please ensure backend server is running.');
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-surface">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <div className="w-12 h-12 rounded-xl bg-secondary mx-auto flex items-center justify-center text-white shadow-lg">
          <Route className="w-7 h-7 stroke-[2.5]" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-on-surface">SmartRoute Platform</h2>
        <p className="text-xs text-on-surface-variant font-medium">
          Last-Mile Delivery Optimization & Fleet Dispatch Engine
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface-lowest py-8 px-6 shadow-xl rounded-xl border border-outline-variant sm:px-10 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              label="Work Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@smartroute.io"
              leftIcon={<Mail className="w-4 h-4" />}
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              leftIcon={<Lock className="w-4 h-4" />}
              required
            />

            <Button
              type="submit"
              variant="secondary"
              className="w-full py-2.5 mt-2"
              isLoading={isLoading}
            >
              Sign In to Command Center
            </Button>
          </form>

          {/* Quick-Fill Demo Profiles */}
          <div className="pt-4 border-t border-outline-variant space-y-3">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider block text-center">
              Quick-Fill Bhubaneswar Demo Profiles
            </span>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin')}
                className="p-2 rounded-lg border border-outline-variant hover:border-secondary hover:bg-surface-low text-center transition-colors group"
              >
                <Shield className="w-4 h-4 text-purple-600 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-on-surface block">Admin</span>
                <span className="text-[10px] text-on-surface-variant block font-mono">Full Access</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('manager')}
                className="p-2 rounded-lg border border-outline-variant hover:border-secondary hover:bg-surface-low text-center transition-colors group"
              >
                <Truck className="w-4 h-4 text-secondary mx-auto mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-on-surface block">Manager</span>
                <span className="text-[10px] text-on-surface-variant block font-mono">Dispatcher</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('driver')}
                className="p-2 rounded-lg border border-outline-variant hover:border-secondary hover:bg-surface-low text-center transition-colors group"
              >
                <User className="w-4 h-4 text-emerald-600 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-on-surface block">Driver</span>
                <span className="text-[10px] text-on-surface-variant block font-mono">Mobile HUD</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
