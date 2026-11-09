import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { UserRole, User } from '../types';
import {
  Route,
  Lock,
  Mail,
  AlertCircle,
  Shield,
  Truck,
  User as UserIcon,
  CheckCircle2,
  Phone,
  CreditCard,
  ArrowRight,
  X,
} from 'lucide-react';
import { ThemeToggle } from '../components/common/ThemeToggle';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, register, googleLogin, quickLogin, isLoading } = useAuth();

  // Mode: Sign In vs Create Account
  const [authMode, setAuthMode] = useState<'SIGN_IN' | 'REGISTER'>('SIGN_IN');

  // Sign In State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register State (Strictly Driver Onboarding; Admins & Fleet Managers are provisioned internally)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regLicense, setRegLicense] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [customGoogleName, setCustomGoogleName] = useState('');

  const redirectByRole = (user: User) => {
    if (user.role === 'DRIVER') {
      navigate('/driver');
    } else {
      navigate('/admin/control-center');
    }
  };

  const executeGoogleSignIn = async (userEmail: string, userName: string) => {
    setError(null);
    setSuccessMessage(null);
    setShowGoogleModal(false);

    try {
      const profile = {
        googleId: `google_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        email: userEmail.toLowerCase().trim(),
        name: userName.trim() || userEmail.split('@')[0],
        picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      };

      const user = await googleLogin({ profile }, 'DRIVER');
      redirectByRole(user);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          'Google authentication failed. Please check network connection.'
      );
    }
  };

  const handleGoogleSignInClick = () => {
    if (email && email.includes('@')) {
      executeGoogleSignIn(email, email.split('@')[0]);
    } else {
      setShowGoogleModal(true);
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    try {
      const user = await login(email, password);
      redirectByRole(user);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          'Authentication failed. Please check your credentials.'
      );
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      const user = await register({
        name: regName,
        email: regEmail,
        password: regPassword,
        role: 'DRIVER',
        phone: regPhone || undefined,
        licenseNumber: regLicense || undefined,
      });
      setSuccessMessage('Driver account registered successfully! Redirecting...');
      setTimeout(() => redirectByRole(user), 600);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          'Registration failed. Please verify your details.'
      );
    }
  };

  const handleQuickLogin = async (role: 'admin' | 'manager' | 'driver' | 'yashaswee') => {
    setError(null);
    try {
      const user = await quickLogin(role);
      redirectByRole(user);
    } catch (err: any) {
      setError('Quick login failed. Ensure the server is running.');
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-surface-canvas relative select-none">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <div className="w-12 h-12 rounded-xl bg-primary mx-auto flex items-center justify-center text-white shadow-sm">
          <Route className="w-6 h-6 stroke-[2.5]" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">
          Smart<span className="text-primary font-extrabold">Route</span> Operations
        </h1>
        <p className="text-xs text-on-surface-variant font-medium">
          Rasulgarh Urban Logistics Hub • Dispatch, Fleet & Driver Terminal
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface-lowest py-6 px-6 sm:px-8 shadow-sm rounded-xl border border-outline-variant/60 space-y-5 transition-colors">
          {/* Dual Mode Switcher: Sign In vs Create Account */}
          <div className="flex items-center bg-surface-low/80 p-1 rounded-lg border border-outline-variant/40">
            <button
              type="button"
              onClick={() => {
                setAuthMode('SIGN_IN');
                setError(null);
              }}
              className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                authMode === 'SIGN_IN'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('REGISTER');
                setError(null);
              }}
              className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                authMode === 'REGISTER'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error & Success Banners */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald/10 border border-emerald/30 rounded-lg text-emerald text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Google OAuth Section */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleGoogleSignInClick}
              disabled={isLoading}
              className="w-full h-11 px-4 rounded-lg border border-outline-variant/80 bg-surface-lowest hover:bg-surface-low text-on-surface text-xs font-semibold flex items-center justify-center gap-3 shadow-xs transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
            <p className="text-[10px] text-center text-on-surface-variant font-mono">
              Authorized credentials link directly to your assigned role
            </p>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-outline-variant/60" />
            <span className="flex-shrink mx-3 text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">
              Or Use Email & Password
            </span>
            <div className="flex-grow border-t border-outline-variant/60" />
          </div>

          {/* Form: Sign In vs Register */}
          {authMode === 'SIGN_IN' ? (
            <form className="space-y-3.5" onSubmit={handleSignInSubmit}>
              <Input
                label="Email, Phone Number, or License #"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@smartroute.io, 9876543210, or OD-02-..."
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
                variant="primary"
                className="w-full py-2.5 mt-2"
                isLoading={isLoading}
              >
                Sign In to Dashboard
              </Button>
            </form>
          ) : (
            <form className="space-y-3.5" onSubmit={handleRegisterSubmit}>
              <div className="p-3 bg-emerald/10 border border-emerald/20 rounded-2xl text-emerald text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Truck className="w-3.5 h-3.5 text-emerald" />
                  <span>Driver Onboarding & Registration</span>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Admin and Fleet Manager accounts are provisioned internally by corporate administration. Use the Sign In tab if you have corporate credentials.
                </p>
              </div>

              <Input
                label="Full Legal Name"
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="e.g. Rakesh Patnaik"
                leftIcon={<UserIcon className="w-4 h-4" />}
                required
              />

              <Input
                label="Email Address"
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="driver@company.com"
                leftIcon={<Mail className="w-4 h-4" />}
                required
              />

              <Input
                label="Password (min 6 characters)"
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="••••••••••••"
                leftIcon={<Lock className="w-4 h-4" />}
                required
              />

              <Input
                label="Mobile Phone"
                type="tel"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="+91 98765 43210"
                leftIcon={<Phone className="w-4 h-4" />}
                required
              />

              <Input
                label="Commercial Driver License #"
                type="text"
                value={regLicense}
                onChange={(e) => setRegLicense(e.target.value)}
                placeholder="OD-02-2026-98124"
                leftIcon={<CreditCard className="w-4 h-4" />}
                required
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full py-2.5 mt-2"
                isLoading={isLoading}
              >
                Register as SmartRoute Driver
              </Button>
            </form>
          )}

          {/* Quick-Fill Profiles */}
          <div className="pt-4 border-t border-outline-variant/40 space-y-3">
            {/* Primary User 1-Click Access */}
            <button
              type="button"
              onClick={() => handleQuickLogin('yashaswee')}
              className="w-full p-3 rounded-xl border border-primary/40 bg-primary/5 hover:bg-primary/10 text-left transition-colors flex items-center justify-between group shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  YM
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-on-surface">Yashaswee Mishra</span>
                    <span className="text-[10px] px-2 py-0.2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md font-mono font-semibold">
                      OD-02-YM-2026
                    </span>
                  </div>
                  <span className="text-[11px] text-on-surface-variant font-mono">
                    mishrayashaswee6@gmail.com
                  </span>
                </div>
              </div>
              <span className="text-xs font-semibold text-primary flex items-center gap-1">
                <span>Driver HUD</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>

            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block text-center pt-1">
              Test System Profiles
            </span>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin')}
                className="p-2.5 rounded-lg border border-outline-variant/60 hover:border-primary hover:bg-surface-low text-center transition-colors group"
              >
                <Shield className="w-4 h-4 text-purple-500 mx-auto mb-1" />
                <span className="text-xs font-bold text-on-surface block">Admin</span>
                <span className="text-[10px] text-on-surface-variant block font-mono">
                  Control Center
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('manager')}
                className="p-2.5 rounded-lg border border-outline-variant/60 hover:border-primary hover:bg-surface-low text-center transition-colors group"
              >
                <Truck className="w-4 h-4 text-emerald mx-auto mb-1" />
                <span className="text-xs font-bold text-on-surface block">Manager</span>
                <span className="text-[10px] text-on-surface-variant block font-mono">
                  Fleet Ops
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('driver')}
                className="p-2.5 rounded-lg border border-outline-variant/60 hover:border-primary hover:bg-surface-low text-center transition-colors group"
              >
                <UserIcon className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                <span className="text-xs font-bold text-on-surface block">Demo Driver</span>
                <span className="text-[10px] text-on-surface-variant block font-mono">
                  Ramesh C.
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-on-surface-variant font-mono">
          SmartRoute Logistics Platform &bull; Rasulgarh Hub, Bhubaneswar (OD)
        </div>
      </div>

      {/* Google Account Selector Dialog */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-surface-lowest border border-outline-variant rounded-xl shadow-xl p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/60">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <div>
                  <h3 className="text-base font-bold text-on-surface">Sign in with Google</h3>
                  <p className="text-xs text-on-surface-variant">Choose an account for SmartRoute</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGoogleModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-surface-low flex items-center justify-center text-on-surface-variant transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Account List */}
            <div className="space-y-2.5">
              {/* Yashaswee Mishra */}
              <button
                type="button"
                onClick={() => executeGoogleSignIn('mishrayashaswee6@gmail.com', 'Yashaswee Mishra')}
                className="w-full p-3.5 rounded-lg border border-primary/40 bg-surface-lowest hover:bg-surface-low flex items-center justify-between text-left transition-colors shadow-xs group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shadow-xs">
                    YM
                  </div>
                  <div>
                    <div className="font-bold text-xs text-on-surface">Yashaswee Mishra</div>
                    <div className="text-xs text-on-surface-variant font-mono">mishrayashaswee6@gmail.com</div>
                    <span className="text-[10px] text-primary font-semibold">Your Verified Driver Account</span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <span>Select</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>

              {/* Demo Courier Driver */}
              <button
                type="button"
                onClick={() => executeGoogleSignIn('driver.google@smartroute.io', 'Courier Driver (Google)')}
                className="w-full p-3.5 rounded-lg border border-outline-variant/60 bg-surface-lowest hover:bg-surface-low flex items-center justify-between text-left transition-colors shadow-xs group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                    CD
                  </div>
                  <div>
                    <div className="font-bold text-xs text-on-surface">Courier Driver (Demo)</div>
                    <div className="text-xs text-on-surface-variant font-mono">driver.google@smartroute.io</div>
                    <span className="text-[10px] text-blue-600 font-semibold">Fleet Operations Test Account</span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <span>Select</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
            </div>

            {/* Custom Google Account Section */}
            <div className="pt-3 border-t border-outline-variant/60 space-y-2">
              <span className="text-xs font-bold text-on-surface block">Use another Google account</span>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Full Name (e.g. Yashaswee Mishra)"
                  value={customGoogleName}
                  onChange={(e) => setCustomGoogleName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-outline-variant bg-surface-lowest text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="email"
                  placeholder="Google Email (e.g. user@gmail.com)"
                  value={customGoogleEmail}
                  onChange={(e) => setCustomGoogleEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-outline-variant bg-surface-lowest text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full rounded-lg"
                  disabled={!customGoogleEmail || !customGoogleEmail.includes('@')}
                  onClick={() =>
                    executeGoogleSignIn(
                      customGoogleEmail,
                      customGoogleName || customGoogleEmail.split('@')[0]
                    )
                  }
                >
                  Continue with this Account
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
