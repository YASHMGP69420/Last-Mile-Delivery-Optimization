import React, { useState, useRef } from 'react';
import { X, Camera, PenTool, CheckCircle2 } from 'lucide-react';
import { Button } from '../common/Button';

export interface PODData {
  photo?: string;
  signature?: string;
  otp?: string;
  notes?: string;
}

export const PODModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onComplete: (pod: PODData) => void;
}> = ({ isOpen, onClose, onComplete }) => {
  const [pod, setPod] = useState<PODData>({});
  const [activeTab, setActiveTab] = useState<'photo' | 'signature' | 'otp'>('photo');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  if (!isOpen) return null;

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    setPod({ ...pod, photo: canvas.toDataURL('image/jpeg') });
    setActiveTab('signature');
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert('Camera access denied');
    }
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
    setPod({ ...pod, signature: canvasRef.current.toDataURL() });
    setActiveTab('otp');
  };

  React.useEffect(() => {
    if (activeTab === 'photo') startCamera();
    if (activeTab === 'signature') {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#000';
        }
      }
    }
  }, [activeTab]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="pod-modal-title">
      <div className="w-full max-w-md bg-white dark:bg-obsidian-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center justify-between bg-surface-low">
          <h3 id="pod-modal-title" className="font-bold text-on-surface">Proof of Delivery (POD)</h3>
          <button
            onClick={onClose}
            aria-label="Close Proof of Delivery modal"
            className="p-1 hover:bg-surface-container rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Progress Tabs */}
          <div className="flex gap-2 p-1 bg-surface-low rounded-xl" role="tablist" aria-label="Proof of delivery steps">
            {(['photo', 'signature', 'otp'] as const).map(tab => (
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
                <Button onClick={() => setPod({...pod, photo: undefined})} variant="outline" className="w-full">
                  Retake Photo
                </Button>
              )}
            </div>
          )}

          {activeTab === 'signature' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-outline-variant rounded-2xl bg-surface-low relative h-48 overflow-hidden">
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

          {activeTab === 'otp' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="pod-otp-input" className="text-xs font-bold text-on-surface-variant uppercase">Delivery OTP</label>
                <input
                  id="pod-otp-input"
                  aria-label="Delivery OTP"
                  type="text"
                  placeholder="Enter 4-6 digit OTP"
                  className="w-full p-4 rounded-2xl border border-outline-variant bg-surface-low text-center text-xl font-mono tracking-widest focus:ring-2 focus:ring-primary outline-none"
                  value={pod.otp}
                  onChange={(e) => setPod({...pod, otp: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="pod-notes-input" className="text-xs font-bold text-on-surface-variant uppercase">Delivery Notes (Optional)</label>
                <textarea
                  id="pod-notes-input"
                  aria-label="Delivery Notes"
                  className="w-full p-4 rounded-2xl border border-outline-variant bg-surface-low text-sm focus:ring-2 focus:ring-primary outline-none"
                  rows={3}
                  value={pod.notes}
                  onChange={(e) => setPod({...pod, notes: e.target.value})}
                  placeholder="e.g. Left with neighbor at No 42"
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-surface-low border-t">
          <Button
            onClick={() => onComplete(pod)}
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
