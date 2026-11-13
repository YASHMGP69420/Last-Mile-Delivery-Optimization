import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Camera, CheckCircle2, AlertCircle, Shield, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '../common/Button';
import { toast } from 'sonner';

export interface PODData {
  photo?: string;
  signature?: string;
  otp?: string;
  otpVerified?: boolean;
  notes?: string;
}

export const PODModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onComplete: (pod: PODData) => void;
  deliveryId?: string;
  customerPhone?: string;
}> = ({ isOpen, onClose, onComplete, deliveryId, customerPhone }) => {
  const [pod, setPod] = useState<PODData>({ otp: '', notes: '', otpVerified: false });
  const [activeTab, setActiveTab] = useState<'photo' | 'signature' | 'otp'>('photo');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [otpState, setOtpState] = useState<'idle' | 'requested' | 'verified'>('idle');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Feature flag check
  const enablePodOtp = import.meta.env.VITE_ENABLE_POD_OTP === 'true';

  // OTP cooldown timer
  useEffect(() => {
    if (otpCooldown > 0) {
      const timer = setInterval(() => {
        setOtpCooldown((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [otpCooldown]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera API unavailable in this browser. Switch to Signature or OTP tab.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setCameraError('Camera access denied or unavailable. Switch to Signature or OTP tab.');
    }
  }, [stopCamera]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }
    if (activeTab === 'photo' && !pod.photo) {
      startCamera();
    } else {
      stopCamera();
    }

    if (activeTab === 'signature') {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#0F172A';
        }
      }
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, pod.photo, startCamera, stopCamera]);

  const capturePhoto = async () => {
    if (!videoRef.current || !videoRef.current.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    setPod((prev) => ({ ...prev, photo: canvas.toDataURL('image/jpeg') }));
    stopCamera();
    setActiveTab('signature');
  };

  const handleSignature = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = () => {
    if (!canvasRef.current) return;
    setPod((prev) => ({ ...prev, signature: canvasRef.current!.toDataURL() }));
    if (enablePodOtp) {
      setActiveTab('otp');
    }
  };

  const requestOtp = async () => {
    if (!deliveryId || !customerPhone) {
      toast.error('Missing delivery or customer information');
      return;
    }

    try {
      const res = await fetch(`/api/v1/deliveries/${deliveryId}/send-pod-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to send OTP');
      }

      setOtpState('requested');
      setOtpCooldown(30); // 30 second cooldown
      toast.success('Verification code sent via SMS');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send OTP');
    }
  };

  const verifyOtp = async () => {
    if (!deliveryId || !pod.otp) {
      toast.error('Please enter the OTP code');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const res = await fetch(`/api/v1/deliveries/${deliveryId}/verify-pod-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ otp: pod.otp }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Invalid OTP');
      }

      setPod((prev) => ({ ...prev, otpVerified: true }));
      setOtpState('verified');
      toast.success('OTP verified successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid OTP code');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const canComplete = () => {
    // Must have at least one verification method
    const hasVerification = pod.photo || pod.signature || (enablePodOtp ? pod.otpVerified : false);
    return hasVerification;
  };

  if (!isOpen) return null;

  const tabs = enablePodOtp ? (['photo', 'signature', 'otp'] as const) : (['photo', 'signature'] as const);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="pod-modal-title">
      <div className="w-full max-w-md bg-white dark:bg-obsidian-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-outline-variant/60 flex items-center justify-between bg-surface-low">
          <h3 id="pod-modal-title" className="font-bold text-on-surface">Proof of Delivery (POD)</h3>
          <button
            onClick={handleClose}
            aria-label="Close Proof of Delivery modal"
            className="p-1 hover:bg-surface-container rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {cameraError && activeTab === 'photo' && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}
          {/* Progress Tabs */}
          <div className="flex gap-2 p-1 bg-surface-low rounded-xl" role="tablist" aria-label="Proof of delivery steps">
            {tabs.map(tab => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === tab ? 'bg-white dark:bg-obsidian-800 shadow-sm text-primary' : 'text-on-surface-variant'
                }`}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>

          {activeTab === 'photo' && (
            <div className="space-y-4 text-center">
              <div className="relative aspect-square bg-black rounded-2xl overflow-hidden">
                {pod.photo ? (
                  <img src={pod.photo} className="w-full h-full object-cover" alt="POD" />
                ) : (
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                )}
              </div>
              {!pod.photo && (
                <Button onClick={capturePhoto} className="w-full gap-2" leftIcon={<Camera className="w-4 h-4" />}>
                  Capture Photo
                </Button>
              )}
              {pod.photo && (
                <Button onClick={() => setPod({ ...pod, photo: undefined })} variant="outline" className="w-full">
                  Retake Photo
                </Button>
              )}
            </div>
          )}

          {activeTab === 'signature' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-outline-variant rounded-2xl bg-white relative h-48 overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={200}
                  onMouseDown={(e) => {
                    const ctx = canvasRef.current?.getContext('2d');
                    ctx?.beginPath();
                    handleSignature(e);
                  }}
                  onMouseMove={handleSignature}
                  onTouchStart={(e) => {
                    const ctx = canvasRef.current?.getContext('2d');
                    ctx?.beginPath();
                    handleSignature(e);
                  }}
                  onTouchMove={handleSignature}
                  className="w-full h-full touch-none cursor-crosshair"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={clearSignature} variant="outline" className="flex-1">Clear</Button>
                <Button onClick={saveSignature} className="flex-1">Confirm Signature</Button>
              </div>
            </div>
          )}

          {activeTab === 'otp' && enablePodOtp && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Optional: Verify delivery with SMS OTP sent to customer</span>
              </div>

              {otpState === 'idle' && (
                <div className="space-y-4 text-center">
                  <MessageSquare className="w-12 h-12 text-on-surface-muted mx-auto" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-on-surface">Send OTP to Customer</p>
                    <p className="text-xs text-on-surface-variant">A 6-digit code will be sent via SMS to {customerPhone || 'customer'}</p>
                  </div>
                  <Button
                    onClick={requestOtp}
                    disabled={otpCooldown > 0}
                    className="w-full gap-2"
                    leftIcon={<MessageSquare className="w-4 h-4" />}
                  >
                    {otpCooldown > 0 ? `Request OTP ({otpCooldown}s)` : 'Request OTP via SMS'}
                  </Button>
                  <p className="text-xs text-on-surface-muted">OTP verification is optional. You can complete delivery without it.</p>
                </div>
              )}

              {otpState === 'requested' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="pod-otp-input" className="text-xs font-bold text-on-surface-variant uppercase">Enter 6-Digit OTP</label>
                    <input
                      id="pod-otp-input"
                      aria-label="Delivery OTP"
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      className="w-full p-4 rounded-2xl border border-outline-variant bg-surface-low text-on-surface placeholder:text-on-surface-muted text-center text-xl font-mono tracking-widest focus:ring-2 focus:ring-primary outline-none"
                      value={pod.otp || ''}
                      onChange={(e) => setPod({ ...pod, otp: e.target.value.replace(/\D/g, '') })}
                      autoComplete="one-time-code"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={verifyOtp}
                      disabled={!pod.otp || pod.otp.length !== 6 || isVerifyingOtp}
                      className="flex-1"
                      leftIcon={isVerifyingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    >
                      {isVerifyingOtp ? 'Verifying...' : 'Verify OTP'}
                    </Button>
                    <Button
                      onClick={() => setOtpState('idle')}
                      variant="outline"
                      className="flex-1"
                    >
                      Resend
                    </Button>
                  </div>
                </div>
              )}

              {otpState === 'verified' && (
                <div className="space-y-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">OTP Verified Successfully</p>
                  <p className="text-xs text-on-surface-variant">Delivery will be marked with OTP verification</p>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="pod-notes-input" className="text-xs font-bold text-on-surface-variant uppercase">Delivery Notes (Optional)</label>
                <textarea
                  id="pod-notes-input"
                  aria-label="Delivery Notes"
                  className="w-full p-4 rounded-2xl border border-outline-variant bg-surface-low text-on-surface placeholder:text-on-surface-muted text-sm focus:ring-2 focus:ring-primary outline-none"
                  rows={3}
                  value={pod.notes || ''}
                  onChange={(e) => setPod({ ...pod, notes: e.target.value })}
                  placeholder="e.g. Left with neighbor at No 42"
                />
              </div>
            </div>
          )}

          {/* Skip OTP / Complete without OTP button when OTP is enabled but not verified */}
          {enablePodOtp && otpState !== 'verified' && activeTab !== 'otp' && (
            <div className="p-3 rounded-xl bg-surface-low border border-outline-variant/60">
              <p className="text-xs text-on-surface-variant text-center">
                OTP verification is optional. You can complete delivery with just photo and signature.
              </p>
            </div>
          )}
        </div>

        <div className="p-4 bg-surface-low border-t border-outline-variant/60">
          <Button
            onClick={() => onComplete({ ...pod, otpVerified: pod.otpVerified })}
            disabled={!canComplete()}
            className="w-full py-4 font-bold text-base rounded-2xl gap-2"
            leftIcon={<CheckCircle2 className="w-5 h-5" />}
          >
            Complete Delivery
          </Button>
        </div>
      </div>
    </div>
  );
};