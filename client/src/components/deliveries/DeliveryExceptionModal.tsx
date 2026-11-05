import React, { useState } from 'react';
import { Delivery, FailureReason } from '../../types';
import { DeliveriesApi } from '../../api/client';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { AlertTriangle } from 'lucide-react';

interface DeliveryExceptionModalProps {
  delivery: Delivery | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmSuccess: () => void;
}

const FAILURE_OPTIONS: { reason: FailureReason; label: string; desc: string }[] = [
  { reason: 'CUSTOMER_UNAVAILABLE', label: 'Consignee Unavailable', desc: 'Door locked, phone unanswered after 3 attempts' },
  { reason: 'WRONG_ADDRESS', label: 'Incomplete / Incorrect Address', desc: 'Could not locate street or building' },
  { reason: 'ACCESS_RESTRICTED', label: 'Access Restricted', desc: 'Gated community, security entry refusal' },
  { reason: 'DAMAGED_PACKAGE', label: 'Package Damaged', desc: 'Carton crushed or seal breached prior to handover' },
  { reason: 'VEHICLE_BREAKDOWN', label: 'Vehicle Breakdown', desc: 'Engine / battery failure during active transit' },
  { reason: 'TIME_EXPIRED', label: 'Shift Time Expired', desc: 'SLA time window passed' },
  { reason: 'OTHER', label: 'Other Operational Issue', desc: 'Detailed notes required below' },
];

export const DeliveryExceptionModal: React.FC<DeliveryExceptionModalProps> = ({
  delivery,
  isOpen,
  onClose,
  onConfirmSuccess,
}) => {
  const [selectedReason, setSelectedReason] = useState<FailureReason>('CUSTOMER_UNAVAILABLE');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !delivery) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await DeliveriesApi.updateStatus(delivery.id, {
        status: 'FAILED',
        failureReason: selectedReason,
        failureNotes: notes.trim() || undefined,
      });
      onConfirmSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error?.message || err?.message || 'Failed to record delivery exception');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title="Report Delivery Exception"
      subtitle={`Flag issue for Consignment #${delivery.orderReference}`}
      isOpen={isOpen}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Primary Exception Reason
          </label>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {FAILURE_OPTIONS.map((opt) => (
              <label
                key={opt.reason}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                  selectedReason === opt.reason
                    ? 'border-red-500 bg-red-50/50 text-red-950 font-medium'
                    : 'border-outline-variant bg-surface-lowest text-on-surface hover:bg-surface-low'
                }`}
              >
                <input
                  type="radio"
                  name="failureReason"
                  checked={selectedReason === opt.reason}
                  onChange={() => setSelectedReason(opt.reason)}
                  className="mt-0.5 text-red-600 focus:ring-red-500"
                />
                <div>
                  <span className="block font-semibold">{opt.label}</span>
                  <span className="text-[11px] text-on-surface-variant block">{opt.desc}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-on-surface-variant mb-1">
            Operational Exception Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add details regarding failed attempt, customer communication, or location notes..."
            rows={3}
            className="w-full text-xs p-2.5 rounded-lg border border-outline-variant bg-surface-lowest text-on-surface focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            type="submit"
            isLoading={isSubmitting}
            leftIcon={<AlertTriangle className="w-3.5 h-3.5" />}
          >
            Confirm Exception
          </Button>
        </div>
      </form>
    </Modal>
  );
};
