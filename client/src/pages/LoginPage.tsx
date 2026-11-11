import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, OtpChannel, OtpProvidersStatus } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';
import { User } from '../types';
import {
  Route,
  Lock,
  Mail,
  AlertCircle,
  User as UserIcon,
  CheckCircle2,
  Phone,
  CreditCard,
  KeyRound,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { ThemeToggle } from '../components/common/ThemeToggle';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    login,
    getOtpProviders,
    sendOtp,
    verifyOtp,
    loginWithOtp,
    register,
    googleLogin,
    isLoading,
  } = useAuth();

  // Top-level Auth Mode: Sign In vs Create Account
  const [authMode, setAuthMode] = useState<'SIGN_IN' | 'REGISTER'>('SIGN_IN');

  // Sign-In Method: Passwordless OTP (Primary) vs Corporate Password (Admins / Managers)
  const [signInMethod, setSignInMethod] = useState<'OTP' | 'PASSWORD'>('OTP');

  // Passwordless OTP Sign-In State
  const [otpLoginIdentifier, setOtpLoginIdentifier] = useState('');
  const [otpLoginStep, setOtpLoginStep] = useState<'IDENTIFY' | 'VERIFY'>('IDENTIFY');
  const [otpLoginTarget, setOtpLoginTarget] = useState('');
  const [otpLoginChannel, setOtpLoginChannel] = useState<OtpChannel>('EMAIL');
  const [otpLoginCode, setOtpLoginCode] = useState('');

  // Corporate Password Sign-In State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Driver OTP-Verified Registration State
  const [regStep, setRegStep] = useState<'DETAILS' | 'VERIFY_OTP'>('DETAILS');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regLicense, setRegLicense] = useState('');
  const [regOtpChannel, setRegOtpChannel] = useState<OtpChannel>('EMAIL');
  const [regOtpTarget, setRegOtpTarget] = useState('');
  const [regOtpCode, setRegOtpCode] = useState('');

  // Shared UI Feedback, Provider Readiness & Timer State
  const [otpProviders, setOtpProviders] = useState<OtpProvidersStatus | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getOtpProviders()
      .then((status) => {
        if (!active) return;
        setOtpProviders(status);
        if (!status.emailConfigured && status.smsConfigured) {
          setRegOtpChannel('PHONE');
        }
      })
      .catch(() => {
        // Ignore provider probe error; backend returns descriptive 503 if unconfigured
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const redirectByRole = (user: User) => {
    if (user.role === 'DRIVER') {
      navigate('/driver');
    } else {
      navigate('/admin/control-center');
    }
  };

  const resetFeedback = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const handleModeSwitch = (mode: 'SIGN_IN' | 'REGISTER') => {
    setAuthMode(mode);
    resetFeedback();
    setOtpLoginStep('IDENTIFY');
    setOtpLoginCode('');
    setRegStep('DETAILS');
    setRegOtpCode('');
  };

  const handleGoogleCredential = async (credential: string) => {
    resetFeedback();
    try {
      const user = await googleLogin(credential, authMode);
      redirectByRole(user);
    } catch (err: any) {
      const errorCode = err.response?.data?.error?.code;
      const errorMessage =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Google Sign-In failed.';

      if (errorCode === 'ACCOUNT_NOT_FOUND') {
        const googleProfile = err.response?.data?.error?.details?.[0];
        handleModeSwitch('REGISTER');
        if (googleProfile?.email) setRegEmail(googleProfile.email);
        if (googleProfile?.name) setRegName(googleProfile.name);
        setError(errorMessage);
        return;
      }

      setError(errorMessage);
    }
  };

  const handleSendLoginOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    resetFeedback();

    if (!otpLoginIdentifier.trim()) {
      setError('Enter your registered email address or phone number.');
      return;
    }

    setOtpBusy(true);
    try {
      const result = await sendOtp({
        identifier: otpLoginIdentifier.trim(),
        purpose: 'LOGIN',
      });
      setOtpLoginTarget(result.target);
      setOtpLoginChannel(result.channel);
      setOtpLoginStep('VERIFY');
      setResendCooldown(30);
      setSuccessMessage(
        result.channel === 'EMAIL'
          ? `6-digit verification code emailed to ${result.target}. Check your inbox or spam folder.`
          : `6-digit verification code sent via SMS to ${result.target}.`
      );
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Unable to send verification code.'
      );
    } finally {
      setOtpBusy(false);
    }
  };

  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^\d{6}$/.test(otpLoginCode.trim())) {
      setError('Enter the 6-digit verification code.');
      return;
    }

    try {
      const user = await loginWithOtp({
        identifier: otpLoginTarget || otpLoginIdentifier.trim(),
        channel: otpLoginChannel,
        code: otpLoginCode.trim(),
      });
      redirectByRole(user);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Invalid or expired verification code.'
      );
    }
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();
    try {
      const user = await login(email.trim(), password);
      redirectByRole(user);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Authentication failed. Check credentials.'
      );
    }
  };

  const handleSendRegisterOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    resetFeedback();

    if (!regName.trim() || !regEmail.trim() || !regPhone.trim() || !regLicense.trim()) {
      setError('Full name, email, phone number, and license number are required.');
      return;
    }

    const targetContact =
      regOtpChannel === 'PHONE' ? regPhone.trim() : regEmail.trim().toLowerCase();

    setOtpBusy(true);
    try {
      const result = await sendOtp({
        identifier: targetContact,
        channel: regOtpChannel,
        purpose: 'REGISTER',
      });
      setRegOtpTarget(result.target);
      setRegOtpChannel(result.channel);
      setRegStep('VERIFY_OTP');
      setResendCooldown(30);
      setSuccessMessage(
        result.channel === 'EMAIL'
          ? `Verification code emailed to ${result.target}. Check your inbox and enter the 6-digit code.`
          : `Verification code sent via SMS to ${result.target}. Enter the 6-digit code.`
      );
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Failed to dispatch verification OTP.'
      );
    } finally {
      setOtpBusy(false);
    }
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^\d{6}$/.test(regOtpCode.trim())) {
      setError('Enter the 6-digit verification code sent to your contact.');
      return;
    }

    setOtpBusy(true);
    try {
      const verified = await verifyOtp({
        identifier: regOtpTarget,
        channel: regOtpChannel,
        purpose: 'REGISTER',
        code: regOtpCode.trim(),
      });

      const user = await register({
        name: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        phone: regPhone.trim(),
        licenseNumber: regLicense.trim(),
        otpTarget: verified.target,
        otpChannel: verified.channel,
        verificationToken: verified.verificationToken,
      });

      redirectByRole(user);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'OTP verification or driver registration failed.'
      );
    } finally {
      setOtpBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-surface-canvas relative">
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
          Rasulgarh Urban Logistics Hub &bull; Dispatch, Fleet & Driver Terminal
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface-lowest py-6 px-6 sm:px-8 shadow-sm rounded-xl border border-outline-variant/60 space-y-5 transition-colors">
          {/* Top Switcher: Sign In vs Create Driver Account */}
          <div className="flex items-center bg-surface-low/80 p-1 rounded-lg border border-outline-variant/40">
            <button
              type="button"
              onClick={() => handleModeSwitch('SIGN_IN')}
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
              onClick={() => handleModeSwitch('REGISTER')}
              className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                authMode === 'REGISTER'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Create Driver Account
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

          {/* SIGN IN FLOW */}
          {authMode === 'SIGN_IN' && (
            <div className="space-y-4">
              {/* Sub-mode Toggle: Passwordless OTP vs Corporate Password */}
              <div className="flex items-center justify-between text-xs border-b border-outline-variant/40 pb-2.5">
                <span className="font-semibold text-on-surface flex items-center gap-1.5">
                  {signInMethod === 'OTP' ? (
                    <>
                      <KeyRound className="w-3.5 h-3.5 text-primary" />
                      <span>Passwordless OTP Sign-In</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 text-primary" />
                      <span>Corporate Password Sign-In</span>
                    </>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSignInMethod((prev) => (prev === 'OTP' ? 'PASSWORD' : 'OTP'));
                    resetFeedback();
                    setOtpLoginStep('IDENTIFY');
                    setOtpLoginCode('');
                  }}
                  className="text-primary font-semibold hover:underline"
                >
                  {signInMethod === 'OTP' ? 'Use Corporate Password' : 'Use Email / Phone OTP'}
                </button>
              </div>

              {signInMethod === 'OTP' ? (
                otpLoginStep === 'IDENTIFY' ? (
                  <form onSubmit={handleSendLoginOtp} className="space-y-4">
                    <Input
                      id="otp-login-identifier"
                      label="Email Address or Phone Number"
                      type="text"
                      required
                      value={otpLoginIdentifier}
                      onChange={(e) => setOtpLoginIdentifier(e.target.value)}
                      placeholder="driver@smartroute.io or +919876543210"
                      leftIcon={<Mail className="w-4 h-4" />}
                    />
                    {otpProviders && !otpProviders.emailConfigured && !otpProviders.smsConfigured && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        OTP email/SMS delivery is not configured on the server yet. Use{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setSignInMethod('PASSWORD');
                            resetFeedback();
                          }}
                          className="font-semibold underline"
                        >
                          Corporate Password
                        </button>{' '}
                        or Google Sign-In, or configure SMTP in <code className="font-mono">server/.env</code>.
                      </p>
                    )}
                    <Button type="submit" className="w-full" size="md" isLoading={otpBusy}>
                      Send 6-Digit Sign-In Code
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyLoginOtp} className="space-y-4">
                    <div className="text-xs text-on-surface-variant flex items-center justify-between">
                      <span>
                        Code sent to <strong className="text-on-surface">{otpLoginTarget}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setOtpLoginStep('IDENTIFY');
                          setOtpLoginCode('');
                          resetFeedback();
                        }}
                        className="text-primary font-semibold hover:underline flex items-center gap-1"
                      >
                        <ArrowLeft className="w-3 h-3" />
                        <span>Change</span>
                      </button>
                    </div>

                    <Input
                      id="otp-login-code"
                      label="6-Digit Verification Code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={otpLoginCode}
                      onChange={(e) => setOtpLoginCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      leftIcon={<KeyRound className="w-4 h-4" />}
                    />

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-on-surface-variant">Did not receive the code?</span>
                      <button
                        type="button"
                        disabled={resendCooldown > 0 || otpBusy}
                        onClick={() => handleSendLoginOtp()}
                        className="text-primary font-semibold disabled:opacity-50 flex items-center gap-1 hover:underline"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>
                          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                        </span>
                      </button>
                    </div>

                    <Button type="submit" className="w-full" size="md" isLoading={isLoading}>
                      Verify & Sign In
                    </Button>
                  </form>
                )
              ) : (
                <form onSubmit={handlePasswordSignIn} className="space-y-4">
                  <Input
                    id="corporate-email"
                    label="Work Email or Phone"
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@smartroute.io"
                    leftIcon={<Mail className="w-4 h-4" />}
                  />

                  <Input
                    id="corporate-password"
                    label="Password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    leftIcon={<Lock className="w-4 h-4" />}
                  />

                  <Button type="submit" className="w-full" size="md" isLoading={isLoading}>
                    Sign In with Password
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* DRIVER OTP-VERIFIED REGISTRATION FLOW */}
          {authMode === 'REGISTER' && (
            <div className="space-y-4">
              {regStep === 'DETAILS' ? (
                <form onSubmit={handleSendRegisterOtp} className="space-y-3.5">
                  <Input
                    id="reg-name"
                    label="Full Name"
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Surya Narayan Dash"
                    leftIcon={<UserIcon className="w-4 h-4" />}
                  />

                  <Input
                    id="reg-email"
                    label="Email Address"
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="driver@smartroute.io"
                    leftIcon={<Mail className="w-4 h-4" />}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      id="reg-phone"
                      label="Phone Number"
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+919876543210"
                      leftIcon={<Phone className="w-4 h-4" />}
                    />
                    <Input
                      id="reg-license"
                      label="License Number"
                      type="text"
                      required
                      value={regLicense}
                      onChange={(e) => setRegLicense(e.target.value)}
                      placeholder="OD02-2026-991"
                      leftIcon={<CreditCard className="w-4 h-4" />}
                    />
                  </div>

                  {/* Verification Channel Toggle */}
                  <div className="space-y-1.5">
                    <span className="block text-xs font-semibold text-on-surface-variant">
                      Verify account via OTP
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={otpProviders !== null && !otpProviders.emailConfigured}
                        onClick={() => setRegOtpChannel('EMAIL')}
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
                          regOtpChannel === 'EMAIL'
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-outline-variant/60 text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>
                          Email OTP
                          {otpProviders && !otpProviders.emailConfigured ? ' (Off)' : ''}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={otpProviders !== null && !otpProviders.smsConfigured}
                        onClick={() => setRegOtpChannel('PHONE')}
                        className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
                          regOtpChannel === 'PHONE'
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-outline-variant/60 text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>
                          Phone OTP
                          {otpProviders && !otpProviders.smsConfigured ? ' (Off)' : ''}
                        </span>
                      </button>
                    </div>
                    {otpProviders && !otpProviders.emailConfigured && !otpProviders.smsConfigured && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        No email SMTP or SMS OTP gateway is configured on the server yet. Use
                        Continue with Google below or configure SMTP in{' '}
                        <code className="font-mono">server/.env</code>.
                      </p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" size="md" isLoading={otpBusy}>
                    Send Verification OTP
                  </Button>

                  <p className="text-[11px] text-center text-on-surface-variant">
                    Self-registration provisions a verified Driver profile. Admin & Fleet Manager
                    accounts are provisioned internally.
                  </p>
                </form>
              ) : (
                <form onSubmit={handleCompleteRegistration} className="space-y-4">
                  <div className="text-xs text-on-surface-variant flex items-center justify-between">
                    <span>
                      Verify <strong className="text-on-surface">{regOtpTarget}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRegStep('DETAILS');
                        setRegOtpCode('');
                        resetFeedback();
                      }}
                      className="text-primary font-semibold hover:underline flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>Edit Details</span>
                    </button>
                  </div>

                  <Input
                    id="reg-otp-code"
                    label="6-Digit Verification Code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={regOtpCode}
                    onChange={(e) => setRegOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    leftIcon={<KeyRound className="w-4 h-4" />}
                  />

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-on-surface-variant">Didn&apos;t get the code?</span>
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || otpBusy}
                      onClick={() => handleSendRegisterOtp()}
                      className="text-primary font-semibold disabled:opacity-50 flex items-center gap-1 hover:underline"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                      </span>
                    </button>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    size="md"
                    isLoading={otpBusy || isLoading}
                  >
                    Verify OTP & Create Driver Account
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* Real Google Identity Services Sign-In */}
          <div className="pt-2 space-y-3">
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-outline-variant/60"></div>
              <span className="flex-shrink mx-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                Or continue with Google
              </span>
              <div className="flex-grow border-t border-outline-variant/60"></div>
            </div>

            <GoogleSignInButton
              onCredential={handleGoogleCredential}
              onError={(msg) => setError(msg)}
              disabled={isLoading || otpBusy}
            />
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-on-surface-variant font-mono">
          SmartRoute Logistics Platform &bull; Rasulgarh Hub, Bhubaneswar (OD)
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
