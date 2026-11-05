import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DriverHudApi } from '../../api/client';
import {
  Package,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCw,
  Camera,
  PenTool,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '../../components/common/Button';

export const DriverDeliveryDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // POD Form State
  const [recipientName, setRecipientName] = useState('');
  const [otp, setOtp] = useState('');
  const [signatureSvg, setSignatureSvg] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  // Failure Form State
  const [isFailureMode, setIsFailureMode] = useState(false);
  const [failureReason, setFailureReason] = useState('CUSTOMER_UNAVAILABLE');
  const [failureNotes, setFailureNotes] = useState('');

  const fetchDelivery = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await DriverHudApi.getDeliveryById(id);
      const del = res.data.delivery;
      setDelivery(del);
      if (del.customer?.name) {
        setRecipientName(del.customer.name);
      }
    } catch (err: any) {
      console.error('Failed to load delivery details:', err);
      setErrorMsg(err.response?.data?.error?.message || 'Failed to load delivery record');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDelivery();
  }, [id]);

  const handleCompletePOD = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await DriverHudApi.completeDelivery(id, {
        recipientName: recipientName || delivery?.customer?.name,
        otp: otp || undefined,
        signatureSvg: signatureSvg || '<svg>simulated_signature_capture</svg>',
        photoUrl: photoUrl || 'https://smartroute.io/pod/simulated_proof.jpg',
        handoverNotes: handoverNotes || `Delivered to ${recipientName || delivery?.customer?.name}`,
      });
      navigate('/driver/route');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Failed to complete delivery');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFailDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!failureNotes || failureNotes.trim().length < 5) {
      setErrorMsg('Mandatory failure notes (minimum 5 characters) are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await DriverHudApi.failDelivery(id, {
        failureReason,
        failureNotes,
      });
      navigate('/driver/route');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Failed to report failure');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RotateCw className="w-8 h-8 text-secondary animate-spin" />
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="p-8 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
        <h2 className="text-sm font-bold text-on-surface">Consignment Not Found</h2>
        <Button size="sm" variant="outline" onClick={() => navigate('/driver/deliveries')}>
          Return to Orders
        </Button>
      </div>
    );
  }

  const isCompleted = delivery.status === 'COMPLETED';
  const isFailed = delivery.status === 'FAILED';

  return (
    <div className="space-y-4 pb-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="text-xs font-semibold text-on-surface-variant hover:text-on-surface flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <span className="font-mono text-xs font-bold text-on-surface">{delivery.orderReference}</span>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-500 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Consignment Details Card */}
      <div className="p-4 rounded-2xl bg-surface-lowest border border-outline-variant shadow-sm space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-bold text-on-surface">{delivery.customer?.name}</h2>
            <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-secondary shrink-0" />
              {delivery.address?.street}, {delivery.address?.zone}
            </p>
          </div>
          <a
            href={`tel:${delivery.customer?.phone}`}
            className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30"
          >
            <Phone className="w-4 h-4" />
          </a>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs bg-surface p-2.5 rounded-xl border border-outline-variant font-mono">
          <div>
            <span className="text-[10px] text-slate-400 block">Delivery Window</span>
            <span className="text-on-surface font-semibold">{delivery.timeWindow?.start} - {delivery.timeWindow?.end}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">Package Weight</span>
            <span className="text-on-surface font-semibold">{delivery.weightKg} kg</span>
          </div>
        </div>
      </div>

      {/* If already completed or failed, display read-only summary */}
      {isCompleted ? (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
          <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4" />
            Consignment Successfully Delivered
          </div>
          <p className="text-xs text-on-surface">
            Handover notes: {delivery.proofOfDelivery?.handoverNotes || 'Delivered to customer'}
          </p>
          <span className="text-[10px] text-slate-400 font-mono block">
            Completed on: {new Date(delivery.updatedAt).toLocaleString()}
          </span>
        </div>
      ) : isFailed ? (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-2">
          <div className="flex items-center gap-2 text-red-500 font-bold text-xs">
            <XCircle className="w-4 h-4" />
            Delivery Exception Reported: {delivery.failureReason}
          </div>
          <p className="text-xs text-on-surface">{delivery.failureNotes}</p>
        </div>
      ) : (
        /* Action Forms: Proof of Delivery vs Exception Mode */
        <div className="p-4 rounded-2xl bg-surface-lowest border border-outline-variant shadow-sm space-y-4">
          <div className="flex border-b border-outline-variant">
            <button
              type="button"
              onClick={() => setIsFailureMode(false)}
              className={`flex-1 py-2 text-xs font-bold transition-colors border-b-2 ${
                !isFailureMode
                  ? 'border-emerald-500 text-emerald-500'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Verify POD & Complete
            </button>
            <button
              type="button"
              onClick={() => setIsFailureMode(true)}
              className={`flex-1 py-2 text-xs font-bold transition-colors border-b-2 ${
                isFailureMode
                  ? 'border-red-500 text-red-500'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Report Delivery Exception
            </button>
          </div>

          {!isFailureMode ? (
            <form onSubmit={handleCompletePOD} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-on-surface block mb-1">Recipient Name</label>
                <input
                  type="text"
                  required
                  placeholder="Person receiving package"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-surface border border-outline-variant text-on-surface focus:outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Verification OTP / PIN (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 4-digit customer SMS OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-surface border border-outline-variant text-on-surface font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Digital Signature</label>
                <div
                  onClick={() => setSignatureSvg('<svg>captured_signature_verified</svg>')}
                  className="p-4 rounded-xl bg-surface border border-dashed border-outline-variant text-center cursor-pointer hover:border-secondary transition-colors"
                >
                  <PenTool className="w-5 h-5 text-secondary mx-auto mb-1" />
                  <span className="text-[11px] text-on-surface-variant block">
                    {signatureSvg ? '✓ Digital signature captured' : 'Tap to sign on glass'}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Photo Evidence (Optional)</label>
                <div
                  onClick={() => setPhotoUrl('https://smartroute.io/pod/photo_sample.jpg')}
                  className="p-3 rounded-xl bg-surface border border-outline-variant text-center cursor-pointer hover:border-secondary flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4 text-secondary" />
                  <span className="text-[11px] text-on-surface-variant">
                    {photoUrl ? '✓ Photo proof attached' : 'Attach Doorstep Photo'}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Handover Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Left with security / Handed to customer"
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-surface border border-outline-variant text-on-surface focus:outline-none"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Confirm Proof of Delivery (POD)
              </Button>
            </form>
          ) : (
            <form onSubmit={handleFailDelivery} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-on-surface block mb-1">Exception Category</label>
                <select
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-surface border border-outline-variant text-on-surface focus:outline-none"
                >
                  <option value="CUSTOMER_UNAVAILABLE">Customer Unavailable / Phone Unreachable</option>
                  <option value="WRONG_ADDRESS">Incorrect / Non-Existent Address</option>
                  <option value="CUSTOMER_REFUSED">Customer Refused Package</option>
                  <option value="ACCESS_RESTRICTED">Gate / Community Access Restricted</option>
                  <option value="DAMAGED_PACKAGE">Damaged / Leaking Package</option>
                  <option value="VEHICLE_BREAKDOWN">Vehicle Breakdown / Mechanical Failure</option>
                  <option value="OTHER">Other Operational Obstruction</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-on-surface block mb-1">Mandatory Field Notes</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Provide detailed explanation of why the delivery could not be completed..."
                  value={failureNotes}
                  onChange={(e) => setFailureNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-surface border border-outline-variant text-on-surface focus:outline-none"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2.5"
              >
                <XCircle className="w-4 h-4 mr-1.5" />
                Submit Delivery Exception
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
