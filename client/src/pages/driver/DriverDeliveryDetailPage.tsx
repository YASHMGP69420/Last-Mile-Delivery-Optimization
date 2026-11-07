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
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../../components/common/Button';

export const DriverDeliveryDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Stop Action State (No POD / OTP / Signature)
  const [handoverNotes, setHandoverNotes] = useState('');
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

  const handleCompleteStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await DriverHudApi.completeDelivery(id, {
        handoverNotes: handoverNotes || 'Completed stop on route',
      });
      navigate('/driver/route');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Failed to complete stop');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFailStop = async (e: React.FormEvent) => {
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
      setErrorMsg(err.response?.data?.error?.message || 'Failed to report exception');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getGoogleMapsUrl = () => {
    const coords = delivery?.location?.coordinates;
    if (coords && coords.length >= 2) {
      return `https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`;
    }
    const query = encodeURIComponent(`${delivery?.address?.street || ''}, ${delivery?.address?.zone || ''}, Bhubaneswar`);
    return `https://www.google.com/maps/dir/?api=1&destination=${query}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RotateCw className="w-8 h-8 text-primary animate-spin" />
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
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="text-xs font-semibold text-on-surface-variant hover:text-on-surface flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-primary" /> Back to Route
        </button>
        <span className="font-mono text-xs font-bold text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">
          {delivery.orderReference}
        </span>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Consignment Details Card */}
      <div className="p-5 rounded-[24px] bg-surface-lowest border border-outline-variant/60 shadow-soft space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-on-surface">{delivery.customer?.name}</h2>
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full font-mono ${
                  delivery.priority === 'Cold Chain'
                    ? 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                    : delivery.priority === 'Urgent'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-slate-100 text-slate-800 border border-slate-200'
                }`}
              >
                {delivery.priority || 'Standard'}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-1.5">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              {delivery.address?.street}, {delivery.address?.zone}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {delivery.customer?.phone && (
              <a
                href={`tel:${delivery.customer?.phone}`}
                className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                title="Call Customer"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
            <a
              href={getGoogleMapsUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-xl bg-surface border border-outline-variant/60 text-primary hover:bg-surface-lowest transition-colors"
              title="Open Navigation in Google Maps"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs bg-surface p-3 rounded-2xl border border-outline-variant/60 font-mono">
          <div>
            <span className="text-[10px] text-on-surface-variant block uppercase font-sans">Delivery Window</span>
            <span className="text-on-surface font-semibold flex items-center gap-1 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              {delivery.timeWindow?.start || '09:00'} - {delivery.timeWindow?.end || '18:00'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant block uppercase font-sans">Consignment Mass</span>
            <span className="text-on-surface font-semibold flex items-center gap-1 mt-0.5">
              <Package className="w-3.5 h-3.5 text-primary" />
              {delivery.weightKg} kg
            </span>
          </div>
        </div>
      </div>

      {/* Read-Only Status Banner if already finalized */}
      {isCompleted ? (
        <div className="p-5 rounded-[24px] bg-emerald-50 border border-emerald-200 shadow-soft space-y-2">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Consignment Successfully Delivered
          </div>
          <p className="text-xs text-emerald-900">
            Dispatch notes: {delivery.proofOfDelivery?.handoverNotes || 'Delivered to recipient'}
          </p>
          <span className="text-[10px] text-emerald-700 font-mono block">
            Completed on: {new Date(delivery.updatedAt).toLocaleString()}
          </span>
        </div>
      ) : isFailed ? (
        <div className="p-5 rounded-[24px] bg-red-50 border border-red-200 shadow-soft space-y-2">
          <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
            <XCircle className="w-5 h-5 text-red-600" />
            Delivery Exception Logged: {delivery.failureReason}
          </div>
          <p className="text-xs text-red-900">{delivery.failureNotes}</p>
          <span className="text-[10px] text-red-700 font-mono block">
            Logged on: {new Date(delivery.updatedAt).toLocaleString()}
          </span>
        </div>
      ) : (
        /* Action Forms: Complete Stop vs Exception Mode (Route & Management Only) */
        <div className="p-5 rounded-[24px] bg-surface-lowest border border-outline-variant/60 shadow-soft space-y-4">
          <div className="flex gap-2 p-1 bg-surface-low rounded-2xl border border-outline-variant/60">
            <button
              type="button"
              onClick={() => setIsFailureMode(false)}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                !isFailureMode
                  ? 'bg-primary text-white shadow-emerald font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Complete Stop
            </button>
            <button
              type="button"
              onClick={() => setIsFailureMode(true)}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                isFailureMode
                  ? 'bg-red-600 text-white shadow-sm font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Report Exception
            </button>
          </div>

          {!isFailureMode ? (
            <form onSubmit={handleCompleteStop} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-on-surface block mb-1">
                  Handover / Gate Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Handed to recipient / Left at reception"
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface border border-outline-variant text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                className="w-full py-2.5 font-bold flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                Mark Stop as Completed
              </Button>
            </form>
          ) : (
            <form onSubmit={handleFailStop} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-on-surface block mb-1">Exception Category</label>
                <select
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface border border-outline-variant text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
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
                  placeholder="Provide brief explanation of why the stop could not be executed..."
                  value={failureNotes}
                  onChange={(e) => setFailureNotes(e.target.value)}
                  className="w-full p-3 rounded-xl bg-surface border border-outline-variant text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <Button
                type="submit"
                variant="danger"
                isLoading={isSubmitting}
                className="w-full py-2.5 font-bold flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white"
              >
                <XCircle className="w-4 h-4 stroke-[2.5]" />
                Log Delivery Exception
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
