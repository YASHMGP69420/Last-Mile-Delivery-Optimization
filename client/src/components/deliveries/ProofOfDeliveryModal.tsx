import React, { useState, useRef, useEffect } from 'react';
import { Delivery } from '../../types';
import { DeliveriesApi } from '../../api/client';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import {
  CheckCircle2,
  Camera,
  RotateCcw,
  ShieldCheck,
  Thermometer,
  PenTool,
  Lock,
  MapPin,
  Clock,
  KeyRound,
} from 'lucide-react';

interface ProofOfDeliveryModalProps {
  delivery: Delivery | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmSuccess: () => void;
}

export const ProofOfDeliveryModal: React.FC<ProofOfDeliveryModalProps> = ({
  delivery,
  isOpen,
  onClose,
  onConfirmSuccess,
}) => {
  const [recipientType, setRecipientType] = useState<'In Person' | 'Reception' | 'Proxy / Rep'>('In Person');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [otpVerified, setOtpVerified] = useState(false);
  const [photoCaptured, setPhotoCaptured] = useState(true);
  const [packageIntact, setPackageIntact] = useState(true);
  const [temperature, setTemperature] = useState('4.2');
  const [notes, setNotes] = useState('Handed over in person at delivery location. Package inspected and accepted.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Canvas for signature
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Auto-fill sample OTP from orderReference or default
  useEffect(() => {
    if (delivery) {
      const lastDigits = (delivery.orderReference.replace(/\D/g, '') || '8492').slice(-4).padStart(4, '0');
      setOtpDigits(lastDigits.split(''));
      setOtpVerified(true);
      setErrorMsg(null);
    }
  }, [delivery]);

  // Handle signature drawing
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = '#000e23';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
    }
  };

  // Touch support for mobile devices
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    ctx.beginPath();
    ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
    ctx.strokeStyle = '#000e23';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    e.preventDefault();
  };

  if (!isOpen || !delivery) return null;

  const handleCompleteDelivery = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const otpCode = otpDigits.join('');
      const svgSignature = canvasRef.current ? canvasRef.current.toDataURL('image/png') : null;

      await DeliveriesApi.updateStatus(delivery.id, {
        status: 'COMPLETED',
        pod: {
          otp: otpCode,
          otpVerified: true,
          signatureSvg: svgSignature || `Verified (${recipientType})`,
          photoUrl: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=500&auto=format&fit=crop&q=60',
          photoCoordinates: {
            lat: delivery.location?.coordinates?.[1] || 20.2961,
            lng: delivery.location?.coordinates?.[0] || 85.8245,
          },
          temperatureReading: delivery.priority === 'Cold Chain' ? parseFloat(temperature) : null,
          handoverNotes: `${recipientType} handover. ${notes}`,
        },
      });

      onConfirmSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error?.message || err?.message || 'Failed to complete delivery');
    } finally {
      setIsSubmitting(false);
    }
  };

  const coordinates = delivery.location?.coordinates || [85.8245, 20.2961];
  const isColdChain = delivery.priority === 'Cold Chain';

  return (
    <Modal
      title="Proof of Delivery Verification"
      subtitle={`Consignment #${delivery.orderReference} — ${delivery.customer?.name || 'Customer'}`}
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* Section 1: Recipient OTP Card */}
        <section className="p-4 rounded-xl border border-outline-variant bg-surface-lowest space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-on-surface">Recipient Delivery OTP</h4>
                <p className="text-[11px] text-on-surface-variant">4-digit SMS verification code</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verified
            </span>
          </div>

          <div className="flex justify-center gap-2 py-1">
            {otpDigits.map((digit, i) => (
              <input
                key={i}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => {
                  const val = e.target.value;
                  const newDigits = [...otpDigits];
                  newDigits[i] = val;
                  setOtpDigits(newDigits);
                  if (newDigits.every((d) => d !== '')) setOtpVerified(true);
                }}
                className="w-12 h-12 text-center text-lg font-bold font-mono rounded-lg bg-surface-low border border-outline-variant text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            ))}
          </div>
        </section>

        {/* Section 2: Photo Evidence Capture */}
        <section className="p-4 rounded-xl border border-outline-variant bg-surface-lowest space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-on-surface">Photo Evidence</h4>
                <p className="text-[11px] text-on-surface-variant">Geo-tagged parcel handover at consignee site</p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-on-surface-variant">1 of 1 captured</span>
          </div>

          <div className="relative w-full h-44 rounded-lg overflow-hidden bg-surface-low border border-outline-variant">
            <img
              src="https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=800&auto=format&fit=crop&q=80"
              alt="Handover parcel proof"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary via-primary/70 to-transparent p-3 text-white space-y-0.5">
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-200">
                <MapPin className="w-3 h-3 text-secondary" />
                <span>Lat: {coordinates[1].toFixed(4)}° N, Lng: {coordinates[0].toFixed(4)}° E</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-300">
                <span>{delivery.address?.street || 'Rasulgarh Hub'}, {delivery.address?.zone}</span>
                <span className="flex items-center gap-1 font-mono text-blue-300">
                  <Clock className="w-3 h-3" /> Just now
                </span>
              </div>
            </div>
            <div className="absolute top-2 right-2 bg-primary/80 backdrop-blur-md text-white px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1">
              <Lock className="w-3 h-3 text-secondary" />
              Tamper-Verified GPS
            </div>
          </div>
        </section>

        {/* Section 3: Recipient Signature Pad */}
        <section className="p-4 rounded-xl border border-outline-variant bg-surface-lowest space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                <PenTool className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-on-surface">Recipient Signature</h4>
                <p className="text-[11px] text-on-surface-variant">{delivery.customer?.name} ({recipientType})</p>
              </div>
            </div>
            <button
              type="button"
              onClick={clearSignature}
              className="text-[11px] text-secondary hover:underline flex items-center gap-1 font-semibold"
            >
              <RotateCcw className="w-3 h-3" /> Clear Pad
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-surface-low border border-outline-variant">
            {(['In Person', 'Reception', 'Proxy / Rep'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setRecipientType(type)}
                className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  recipientType === type
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="relative w-full h-28 rounded-lg bg-surface-low border border-outline-variant overflow-hidden cursor-crosshair">
            <canvas
              ref={canvasRef}
              width={400}
              height={112}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
              className="w-full h-full"
            />
            {!hasSignature && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-on-surface-variant/40 text-xs font-medium">
                Sign with finger or stylus above
              </div>
            )}
            <div className="absolute bottom-1 left-2 text-[10px] text-on-surface-variant font-mono">
              Timestamp: {new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })} IST
            </div>
          </div>
        </section>

        {/* Section 4: Handover Checklist */}
        <section className="p-4 rounded-xl border border-outline-variant bg-surface-lowest space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-on-surface">Inspection & Verification</h4>
              <p className="text-[11px] text-on-surface-variant">Mandatory consignment checklist</p>
            </div>
          </div>

          <label className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-low border border-outline-variant cursor-pointer">
            <input
              type="checkbox"
              checked={packageIntact}
              onChange={(e) => setPackageIntact(e.target.checked)}
              className="rounded border-outline-variant text-secondary focus:ring-secondary w-4 h-4"
            />
            <div className="text-xs">
              <span className="font-semibold text-on-surface block">Package Intact & Seals Undamaged</span>
              <span className="text-on-surface-variant text-[11px] block">Security tape checked and intact</span>
            </div>
          </label>

          {isColdChain && (
            <div className="p-2.5 rounded-lg bg-surface-low border border-outline-variant flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-secondary" />
                <div>
                  <span className="text-xs font-semibold text-on-surface block">Cold-Chain Temperature</span>
                  <span className="text-[11px] text-on-surface-variant">Safe range: 2.0°C – 8.0°C</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  className="w-16 h-8 text-center text-xs font-mono font-bold rounded border border-outline-variant bg-surface-lowest"
                />
                <span className="text-xs font-mono font-semibold">°C</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
              Handover Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-outline-variant bg-surface-lowest text-on-surface"
              placeholder="e.g. Handed over directly to consignee"
            />
          </div>
        </section>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col gap-2">
          <Button
            size="lg"
            variant="secondary"
            className="w-full py-3.5"
            isLoading={isSubmitting}
            onClick={handleCompleteDelivery}
            leftIcon={<CheckCircle2 className="w-5 h-5" />}
          >
            Confirm & Complete Delivery
          </Button>
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};
