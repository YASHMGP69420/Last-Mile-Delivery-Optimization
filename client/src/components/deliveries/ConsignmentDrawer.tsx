import React, { useEffect, useState } from 'react';
import { Drawer } from '../common/Drawer';
import { StatusBadge } from '../common/StatusBadge';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Delivery, AuditEvent, DeliveryPriority, DeliveryStatus, Vehicle, Driver } from '../../types';
import { DeliveriesApi } from '../../api/client';
import {
  MapPin,
  Clock,
  Phone,
  User,
  History,
  AlertTriangle,
  Loader2,
  Pencil,
  Check,
  X,
  Truck,
  Trash2,
} from 'lucide-react';

export const PRESET_DELIVERY_ZONES = [
  'Patia (Z-1)',
  'Jaydev Vihar (Z-2)',
  'Saheed Nagar (Z-3)',
  'Khandagiri (Z-4)',
  'Chandrasekharpur',
];

const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
const PHONE_FORMAT_REGEX = /^\+?[0-9\s\-()]{10,20}$/;
const POSTAL_CODE_REGEX = /^\d{6}$/;

export interface ConsignmentFormInput {
  orderReference?: string;
  customerName: string;
  customerPhone: string;
  street: string;
  zone: string;
  postalCode: string;
  weightKg: string;
  volumeM3: string;
  serviceDurationMinutes: string;
  priority: DeliveryPriority;
  timeWindowStart: string;
  timeWindowEnd: string;
}

export function validateConsignmentForm(
  input: ConsignmentFormInput,
  options: { requireOrderReference?: boolean } = {}
): { error: string | null; payload?: Partial<Delivery> } {
  const orderReference = (input.orderReference ?? '').trim().toUpperCase();
  if (options.requireOrderReference && !orderReference) {
    return { error: 'Order reference is required.' };
  }

  const customerName = input.customerName.trim();
  if (!customerName) {
    return { error: 'Customer name is required.' };
  }

  const customerPhone = input.customerPhone.trim();
  const phoneDigits = customerPhone.replace(/\D/g, '');
  if (!PHONE_FORMAT_REGEX.test(customerPhone) || phoneDigits.length < 10 || phoneDigits.length > 15) {
    return { error: 'Customer phone must be a valid 10–15 digit phone number.' };
  }

  const street = input.street.trim();
  if (!street) {
    return { error: 'Street address is required.' };
  }

  const zone = input.zone.trim() || 'Other';
  const postalCode = input.postalCode.trim();
  if (!POSTAL_CODE_REGEX.test(postalCode)) {
    return { error: 'Postal code must be a valid 6-digit pincode.' };
  }

  const weightKg = Number(input.weightKg);
  if (input.weightKg.trim() === '' || !Number.isFinite(weightKg) || weightKg <= 0) {
    return { error: 'Weight (kg) must be greater than 0.' };
  }

  const volumeM3 = Number(input.volumeM3);
  if (input.volumeM3.trim() === '' || !Number.isFinite(volumeM3) || volumeM3 < 0) {
    return { error: 'Volume (m³) must be 0 or greater.' };
  }

  const serviceDurationMinutes = Number(input.serviceDurationMinutes);
  if (
    input.serviceDurationMinutes.trim() === '' ||
    !Number.isFinite(serviceDurationMinutes) ||
    serviceDurationMinutes <= 0
  ) {
    return { error: 'Service duration must be greater than 0 minutes.' };
  }

  const start = input.timeWindowStart.trim();
  const end = input.timeWindowEnd.trim();
  if (!TIME_REGEX.test(start) || !TIME_REGEX.test(end)) {
    return { error: 'Time window start and end must use valid HH:MM format.' };
  }

  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (sh * 60 + sm >= eh * 60 + em) {
    return { error: 'Time window start must be earlier than the end time.' };
  }

  return {
    error: null,
    payload: {
      ...(options.requireOrderReference ? { orderReference } : {}),
      customer: {
        name: customerName,
        phone: customerPhone,
      },
      address: {
        street,
        city: 'Bhubaneswar',
        zone,
        postalCode,
      },
      weightKg,
      volumeM3,
      serviceDurationMinutes,
      priority: input.priority,
      timeWindow: {
        start: `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`,
        end: `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`,
      },
    },
  };
}

export interface ConsignmentDrawerFeedback {
  variant: 'success' | 'error' | 'warning' | 'info';
  badge: string;
  title: string;
  message: string;
  meta?: Array<{ label: string; value: string }>;
}

interface ConsignmentDrawerProps {
  delivery: Delivery | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChanged?: () => void;
  vehicles?: Vehicle[];
  drivers?: Driver[];
  onConsignmentDeleted?: (orderReference: string) => void;
  onFeedback?: (feedback: ConsignmentDrawerFeedback) => void;
}

const EDITABLE_STATUSES: DeliveryStatus[] = ['DRAFT', 'READY', 'ASSIGNED'];
const DELETABLE_STATUSES: DeliveryStatus[] = ['DRAFT', 'READY'];

const getDriverName = (driver?: Driver | null): string => {
  if (!driver) return 'Unassigned';
  if (typeof driver.userId === 'object' && driver.userId) {
    return (driver.userId as any).name || 'Driver';
  }
  return driver.licenseNumber || 'Driver';
};

export const ConsignmentDrawer: React.FC<ConsignmentDrawerProps> = ({
  delivery,
  isOpen,
  onClose,
  onStatusChanged,
  vehicles,
  drivers,
  onConsignmentDeleted,
  onFeedback,
}) => {
  const [displayedDelivery, setDisplayedDelivery] = useState<Delivery | null>(delivery);
  const [timeline, setTimeline] = useState<AuditEvent[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState<boolean>(false);
  const [currentStatus, setCurrentStatus] = useState<DeliveryStatus | null>(delivery?.status || null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Fleet assignment state
  const [assignVehicleId, setAssignVehicleId] = useState<string>('');
  const [assignDriverId, setAssignDriverId] = useState<string>('');
  const [isAssigningFleet, setIsAssigningFleet] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Delete confirmation state
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ConsignmentFormInput>({
    customerName: '',
    customerPhone: '',
    street: '',
    zone: 'Patia (Z-1)',
    postalCode: '751024',
    weightKg: '1',
    volumeM3: '0.01',
    serviceDurationMinutes: '10',
    priority: 'Standard',
    timeWindowStart: '09:00',
    timeWindowEnd: '17:00',
  });

  const populateEditForm = (d: Delivery) => {
    setEditForm({
      customerName: d.customer?.name || '',
      customerPhone: d.customer?.phone || '',
      street: d.address?.street || '',
      zone: d.address?.zone || 'Patia (Z-1)',
      postalCode: d.address?.postalCode || '751024',
      weightKg: d.weightKg != null ? String(d.weightKg) : '1',
      volumeM3: d.volumeM3 != null ? String(d.volumeM3) : '0.01',
      serviceDurationMinutes: d.serviceDurationMinutes != null ? String(d.serviceDurationMinutes) : '10',
      priority: d.priority || 'Standard',
      timeWindowStart: d.timeWindow?.start || '09:00',
      timeWindowEnd: d.timeWindow?.end || '17:00',
    });
  };

  useEffect(() => {
    setDisplayedDelivery(delivery);
    if (delivery) {
      setCurrentStatus(delivery.status);
      setStatusError(null);
      setEditError(null);
      setAssignError(null);
      setDeleteError(null);
      setIsConfirmingDelete(false);
      setIsEditing(false);
      populateEditForm(delivery);

      const currentVehId =
        typeof delivery.assignedVehicleId === 'object' && delivery.assignedVehicleId
          ? delivery.assignedVehicleId.id
          : (delivery.assignedVehicleId as string | undefined) || '';
      const currentDrvId =
        typeof delivery.assignedDriverId === 'object' && delivery.assignedDriverId
          ? delivery.assignedDriverId.id
          : (delivery.assignedDriverId as string | undefined) || '';

      const fallbackVeh =
        vehicles?.find((v) => v.availability === 'AVAILABLE')?.id || vehicles?.[0]?.id || '';
      const fallbackDrv =
        drivers?.find((d) => d.availability === 'AVAILABLE' || d.availability === 'ON_DUTY')?.id ||
        drivers?.[0]?.id ||
        '';

      setAssignVehicleId(currentVehId || fallbackVeh);
      setAssignDriverId(currentDrvId || fallbackDrv);
    }
  }, [delivery, vehicles, drivers]);

  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setEditError(null);
      setAssignError(null);
      setDeleteError(null);
      setIsConfirmingDelete(false);
    }
  }, [isOpen]);

  const handleStatusChange = async (newStatus: string) => {
    if (!displayedDelivery || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    setStatusError(null);
    try {
      await DeliveriesApi.updateStatus(displayedDelivery.id, { status: newStatus });
      const nextStatus = newStatus as DeliveryStatus;
      setCurrentStatus(nextStatus);
      setDisplayedDelivery((prev) => (prev ? { ...prev, status: nextStatus } : prev));
      if (!EDITABLE_STATUSES.includes(nextStatus)) {
        setIsEditing(false);
      }
      onFeedback?.({
        variant: 'success',
        badge: 'STATUS UPDATED',
        title: `Consignment ${displayedDelivery.orderReference} → ${nextStatus}`,
        message: `Lifecycle status transitioned from ${displayedDelivery.status} to ${nextStatus}.`,
        meta: [
          { label: 'Order Ref', value: displayedDelivery.orderReference },
          { label: 'New Status', value: nextStatus },
        ],
      });
      if (onStatusChanged) onStatusChanged();
    } catch (err: any) {
      const msg =
        err.friendlyMessage ||
        err.response?.data?.error?.message ||
        err.message ||
        'Failed to update delivery status';
      setStatusError(msg);
      onFeedback?.({
        variant: 'error',
        badge: 'STATUS UPDATE FAILED',
        title: `Cannot Update ${displayedDelivery.orderReference}`,
        message: msg,
        meta: [
          { label: 'Order Ref', value: displayedDelivery.orderReference },
          { label: 'Target Status', value: newStatus },
        ],
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAssignFleet = async () => {
    if (!displayedDelivery || isAssigningFleet) return;
    if (!assignVehicleId || !assignDriverId) {
      const msg = 'Please select both a vehicle and a driver to assign.';
      setAssignError(msg);
      return;
    }

    setIsAssigningFleet(true);
    setAssignError(null);
    try {
      const res = await DeliveriesApi.assign(displayedDelivery.id, {
        vehicleId: assignVehicleId,
        driverId: assignDriverId,
      });
      const updated = res.data;
      if (updated) {
        setDisplayedDelivery(updated);
      } else {
        setDisplayedDelivery((prev) =>
          prev
            ? {
                ...prev,
                status: 'ASSIGNED',
                assignedVehicleId: assignVehicleId,
                assignedDriverId: assignDriverId,
              }
            : prev
        );
      }
      setCurrentStatus('ASSIGNED');

      const matchedVehicle = vehicles?.find((v) => v.id === assignVehicleId);
      const matchedDriver = drivers?.find((d) => d.id === assignDriverId);
      const vehLabel = matchedVehicle ? matchedVehicle.vehicleId : assignVehicleId;
      const drvLabel = getDriverName(matchedDriver);

      onFeedback?.({
        variant: 'success',
        badge: 'ASSIGNED',
        title: `Fleet Assigned to ${displayedDelivery.orderReference}`,
        message: `Consignment assigned to ${vehLabel} and driver ${drvLabel}.`,
        meta: [
          { label: 'Order Ref', value: displayedDelivery.orderReference },
          { label: 'Vehicle', value: vehLabel },
          { label: 'Driver', value: drvLabel },
          { label: 'Status', value: 'ASSIGNED' },
        ],
      });
      if (onStatusChanged) onStatusChanged();
    } catch (err: any) {
      const code = err.response?.data?.error?.code || err.response?.data?.code;
      const msg =
        err.friendlyMessage ||
        err.response?.data?.error?.message ||
        err.message ||
        'Failed to assign fleet resources';
      setAssignError(msg);
      onFeedback?.({
        variant: 'error',
        badge: code ? `CONFLICT ${code}` : 'ASSIGNMENT FAILED',
        title: `Cannot Assign Fleet to ${displayedDelivery.orderReference}`,
        message: msg,
        meta: [
          { label: 'Order Ref', value: displayedDelivery.orderReference },
          ...(code ? [{ label: 'Error Code', value: code }] : []),
        ],
      });
    } finally {
      setIsAssigningFleet(false);
    }
  };

  const handleDeleteConsignment = async () => {
    if (!displayedDelivery || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    const orderRef = displayedDelivery.orderReference;
    try {
      await DeliveriesApi.delete(displayedDelivery.id);
      onConsignmentDeleted?.(orderRef);
      onClose();
    } catch (err: any) {
      const msg =
        err.friendlyMessage ||
        err.response?.data?.error?.message ||
        err.message ||
        'Failed to delete consignment';
      setDeleteError(msg);
      onFeedback?.({
        variant: 'error',
        badge: 'DELETE FAILED',
        title: `Cannot Delete ${orderRef}`,
        message: msg,
        meta: [{ label: 'Order Ref', value: orderRef }],
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleEdit = () => {
    if (!displayedDelivery) return;
    if (!isEditing) {
      populateEditForm(displayedDelivery);
      setEditError(null);
      setIsEditing(true);
    } else {
      setIsEditing(false);
      setEditError(null);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayedDelivery || isSavingEdit) return;
    setEditError(null);

    const { error, payload } = validateConsignmentForm(editForm, { requireOrderReference: false });
    if (error || !payload) {
      setEditError(error || 'Invalid consignment details.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await DeliveriesApi.update(displayedDelivery.id, {
        ...payload,
        address: {
          street: payload.address!.street,
          city: displayedDelivery.address?.city || 'Bhubaneswar',
          zone: payload.address!.zone,
          postalCode: payload.address!.postalCode,
        },
        customer: {
          ...payload.customer!,
          ...(displayedDelivery.customer?.email !== undefined ? { email: displayedDelivery.customer.email } : {}),
        },
      });
      if (res.data) {
        setDisplayedDelivery(res.data);
        setCurrentStatus(res.data.status);
      }
      setIsEditing(false);
      onFeedback?.({
        variant: 'success',
        badge: 'CONSIGNMENT UPDATED',
        title: `Saved Changes to ${displayedDelivery.orderReference}`,
        message: `Updated recipient, address, or cargo specification for ${displayedDelivery.orderReference}.`,
        meta: [
          { label: 'Order Ref', value: displayedDelivery.orderReference },
          { label: 'Weight', value: `${payload.weightKg?.toFixed(1) || displayedDelivery.weightKg} kg` },
          { label: 'Zone', value: payload.address?.zone || displayedDelivery.address?.zone || 'N/A' },
        ],
      });
      if (onStatusChanged) onStatusChanged();
    } catch (err: any) {
      const msg =
        err.friendlyMessage ||
        err.response?.data?.error?.message ||
        err.message ||
        'Failed to update consignment';
      setEditError(msg);
      onFeedback?.({
        variant: 'error',
        badge: 'UPDATE FAILED',
        title: `Cannot Save ${displayedDelivery.orderReference}`,
        message: msg,
        meta: [{ label: 'Order Ref', value: displayedDelivery.orderReference }],
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (delivery && isOpen) {
      const fetchDetails = async () => {
        setIsLoadingTimeline(true);
        try {
          const res = await DeliveriesApi.getById(delivery.id);
          if (isMounted && res.data) {
            if (res.data.timeline) setTimeline(res.data.timeline);
            if (res.data.delivery) setDisplayedDelivery(res.data.delivery);
          }
        } catch (e) {
          console.warn('Failed to load consignment timeline:', e);
        } finally {
          if (isMounted) {
            setIsLoadingTimeline(false);
          }
        }
      };
      fetchDetails();
    } else {
      setTimeline([]);
    }
    return () => {
      isMounted = false;
    };
  }, [delivery?.id, isOpen]);

  if (!displayedDelivery) return null;

  const effectiveStatus = currentStatus || displayedDelivery.status;
  const canEdit = EDITABLE_STATUSES.includes(effectiveStatus);
  const canDelete = DELETABLE_STATUSES.includes(effectiveStatus);
  const hasFleetOptions = Boolean(vehicles || drivers);
  const zoneOptions = PRESET_DELIVERY_ZONES.includes(editForm.zone)
    ? PRESET_DELIVERY_ZONES
    : [editForm.zone, ...PRESET_DELIVERY_ZONES];

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={displayedDelivery.orderReference}
      subtitle="Canonical Bhubaneswar Waybill Specification"
      width="md"
    >
      <div className="space-y-6 text-sm">
        {/* Status & Priority Row */}
        <div className="p-3 rounded-lg bg-surface-low border border-outline-variant space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wider block">
                Consignment Status
              </span>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge status={effectiveStatus} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wider block">
                  Handling Priority
                </span>
                <div className="mt-1">
                  <StatusBadge status={displayedDelivery.priority} />
                </div>
              </div>
              {canEdit && (
                <Button
                  size="sm"
                  variant={isEditing ? 'ghost' : 'outline'}
                  onClick={handleToggleEdit}
                  leftIcon={isEditing ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                >
                  {isEditing ? 'Cancel Edit' : 'Edit Consignment'}
                </Button>
              )}
            </div>
          </div>

          {/* Quick status transition dropdown/control */}
          <div className="pt-2 border-t border-outline-variant/60 flex items-center justify-between gap-2">
            <label htmlFor="status-select" className="text-xs text-on-surface-variant font-medium">
              Update Status:
            </label>
            <div className="flex items-center gap-2">
              <select
                id="status-select"
                disabled={isUpdatingStatus}
                value={effectiveStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="text-xs bg-surface-lowest border border-outline-variant rounded px-2 py-1 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              >
                <option value="DRAFT">DRAFT</option>
                <option value="READY">READY</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="FAILED">FAILED</option>
              </select>
              {isUpdatingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
            </div>
          </div>
          {statusError && (
            <div className="p-2 rounded bg-error-container/20 border border-error/30 text-error text-xs flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{statusError}</span>
            </div>
          )}
        </div>

        {/* Fleet Resource Assignment Card */}
        {canEdit && hasFleetOptions && (
          <div className="p-3.5 rounded-lg bg-white dark:bg-[#121417] border border-slate-200 dark:border-[#262A32] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-teal-400" />
                Fleet Resource Assignment
              </h4>
              {typeof displayedDelivery.batchId === 'object' && displayedDelivery.batchId?.code && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#0B0C0E] border border-slate-200 dark:border-[#262A32] text-slate-600 dark:text-zinc-300">
                  BATCH: {displayedDelivery.batchId.code}
                </span>
              )}
            </div>

            {assignError && (
              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 border-l-4 border-l-rose-600 dark:border-l-rose-500 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{assignError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                  Vehicle
                </label>
                <select
                  value={assignVehicleId}
                  onChange={(e) => setAssignVehicleId(e.target.value)}
                  disabled={isAssigningFleet}
                  className="w-full text-xs font-mono rounded-md border border-slate-300 dark:border-[#262A32] bg-slate-50 dark:bg-[#0B0C0E] px-2.5 py-1.5 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Select vehicle...</option>
                  {(vehicles || []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicleId} [{v.availability}] — {v.capacityKg}kg
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                  Driver
                </label>
                <select
                  value={assignDriverId}
                  onChange={(e) => setAssignDriverId(e.target.value)}
                  disabled={isAssigningFleet}
                  className="w-full text-xs rounded-md border border-slate-300 dark:border-[#262A32] bg-slate-50 dark:bg-[#0B0C0E] px-2.5 py-1.5 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Select driver...</option>
                  {(drivers || []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {getDriverName(d)} [{d.availability}]
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleAssignFleet}
                isLoading={isAssigningFleet}
                disabled={!assignVehicleId || !assignDriverId}
                leftIcon={<Truck className="w-3.5 h-3.5" />}
              >
                Assign Fleet
              </Button>
            </div>
          </div>
        )}

        {/* Inline Two-Step Consignment Deletion (DRAFT / READY only) */}
        {canDelete && (
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#0B0C0E] border border-slate-200 dark:border-[#262A32] space-y-2">
            {deleteError && (
              <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}
            {!isConfirmingDelete ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-600 dark:text-zinc-400">
                  Remove un-dispatched consignment from queue
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 dark:text-rose-400 dark:hover:text-rose-300"
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  Delete Consignment
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                  Permanently delete {displayedDelivery.orderReference}?
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsConfirmingDelete(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={handleDeleteConsignment}
                    isLoading={isDeleting}
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    Confirm Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Inline Edit Consignment Form */}
        {isEditing && canEdit ? (
          <form onSubmit={handleSaveEdit} className="p-4 rounded-xl border border-outline-variant bg-surface-low space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                Edit Consignment Details
              </h4>
              <span className="text-[11px] text-on-surface-variant font-mono">
                {displayedDelivery.orderReference}
              </span>
            </div>

            {editError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Customer Name"
                value={editForm.customerName}
                onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                required
              />
              <Input
                label="Customer Phone"
                value={editForm.customerPhone}
                onChange={(e) => setEditForm({ ...editForm, customerPhone: e.target.value })}
                placeholder="+91 94370 12345"
                required
              />
            </div>

            <Input
              label="Street Address"
              value={editForm.street}
              onChange={(e) => setEditForm({ ...editForm, street: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Zone</label>
                <select
                  value={editForm.zone}
                  onChange={(e) => setEditForm({ ...editForm, zone: e.target.value })}
                  className="w-full h-9 text-xs rounded-xl border border-outline-variant/60 bg-surface-lowest px-3 text-on-surface"
                >
                  {zoneOptions.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Postal Code (6 digits)"
                value={editForm.postalCode}
                onChange={(e) => setEditForm({ ...editForm, postalCode: e.target.value })}
                pattern="\d{6}"
                maxLength={6}
                placeholder="751024"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Weight (kg)"
                type="number"
                min={0.1}
                step="0.1"
                value={editForm.weightKg}
                onChange={(e) => setEditForm({ ...editForm, weightKg: e.target.value })}
                required
              />
              <Input
                label="Volume (m³)"
                type="number"
                min={0}
                step="0.001"
                value={editForm.volumeM3}
                onChange={(e) => setEditForm({ ...editForm, volumeM3: e.target.value })}
                required
              />
              <Input
                label="Service (min)"
                type="number"
                min={1}
                step="1"
                value={editForm.serviceDurationMinutes}
                onChange={(e) => setEditForm({ ...editForm, serviceDurationMinutes: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Priority</label>
                <select
                  value={editForm.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as DeliveryPriority })}
                  className="w-full h-9 text-xs rounded-xl border border-outline-variant/60 bg-surface-lowest px-3 text-on-surface"
                >
                  <option value="Standard">Standard</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Cold Chain">Cold Chain</option>
                </select>
              </div>
              <Input
                label="Window Start"
                type="time"
                value={editForm.timeWindowStart}
                onChange={(e) => setEditForm({ ...editForm, timeWindowStart: e.target.value })}
                required
              />
              <Input
                label="Window End"
                type="time"
                value={editForm.timeWindowEnd}
                onChange={(e) => setEditForm({ ...editForm, timeWindowEnd: e.target.value })}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/60">
              <Button type="button" size="sm" variant="ghost" onClick={handleToggleEdit} disabled={isSavingEdit}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                variant="primary"
                isLoading={isSavingEdit}
                leftIcon={<Check className="w-3.5 h-3.5" />}
              >
                Save Consignment
              </Button>
            </div>
          </form>
        ) : (
          <>
            {/* Consignee Card */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4 text-secondary" />
                Consignee Profile
              </h4>
              <div className="p-3.5 rounded-lg border border-outline-variant bg-surface-lowest space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-semibold text-on-surface block text-sm">
                      {displayedDelivery.customer?.name || 'Unnamed Consignee'}
                    </span>
                    {displayedDelivery.customer?.email && (
                      <span className="text-xs text-on-surface-variant block">
                        {displayedDelivery.customer.email}
                      </span>
                    )}
                  </div>
                  {displayedDelivery.customer?.phone && (
                    <a
                      href={`tel:${displayedDelivery.customer.phone}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary/10 text-secondary hover:bg-secondary/20 text-xs font-mono font-medium transition-colors"
                    >
                      <Phone className="w-3 h-3" />
                      {displayedDelivery.customer.phone}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Destination & Coordinates */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-secondary" />
                Delivery Destination
              </h4>
              <div className="p-3.5 rounded-lg border border-outline-variant bg-surface-lowest space-y-2">
                <p className="text-sm font-medium text-on-surface">{displayedDelivery.address?.street || 'No street specified'}</p>
                <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <span className="px-2 py-0.5 rounded bg-surface-low font-medium">
                    {displayedDelivery.address?.zone || 'Unassigned Zone'}
                  </span>
                  <span>Pincode: {displayedDelivery.address?.postalCode || 'N/A'}</span>
                </div>
                {displayedDelivery.location?.coordinates && displayedDelivery.location.coordinates.length >= 2 && (
                  <div className="pt-2 border-t border-outline-variant flex items-center justify-between text-xs font-mono text-on-surface-variant">
                    <span>GeoJSON Coordinates:</span>
                    <span className="text-secondary tabular-nums">
                      {displayedDelivery.location.coordinates[1].toFixed(5)}°N, {displayedDelivery.location.coordinates[0].toFixed(5)}°E
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Cargo Specification & SLA Window */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-outline-variant bg-surface-low">
                <span className="text-[11px] text-on-surface-variant font-medium block">
                  Consignment Payload
                </span>
                <div className="mt-1 font-mono font-bold text-base text-on-surface tabular-nums">
                  {(displayedDelivery.weightKg ?? 0).toFixed(1)} kg
                </div>
                <span className="text-[10px] text-on-surface-variant font-mono">
                  Volume: {(displayedDelivery.volumeM3 ?? 0.01).toFixed(3)} m³
                </span>
              </div>

              <div className="p-3 rounded-lg border border-outline-variant bg-surface-low">
                <span className="text-[11px] text-on-surface-variant font-medium block">
                  SLA Time Window
                </span>
                <div className="mt-1 font-mono font-bold text-base text-secondary flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>
                    {displayedDelivery.timeWindow?.start || '--:--'} - {displayedDelivery.timeWindow?.end || '--:--'}
                  </span>
                </div>
                <span className="text-[10px] text-on-surface-variant">
                  Service: {displayedDelivery.serviceDurationMinutes || 10} min dwell
                </span>
              </div>
            </div>
          </>
        )}

        {/* Immutable Audit Event Fulfillment Timeline */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-4 h-4 text-secondary" />
            Immutable Fulfillment Timeline
          </h4>

          {isLoadingTimeline ? (
            <div className="py-4 text-center">
              <Loader2 className="w-5 h-5 text-secondary animate-spin mx-auto" />
            </div>
          ) : timeline.length === 0 ? (
            <p className="text-xs text-on-surface-variant p-3 bg-surface-low rounded-md">
              No state transitions recorded yet.
            </p>
          ) : (
            <div className="space-y-3 relative pl-6 border-l-2 border-outline-variant">
              {timeline.map((event, idx) => (
                <div key={idx} className="relative group text-xs">
                  {/* Dot */}
                  <span className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-secondary ring-4 ring-white" />
                  <div className="p-2.5 rounded-md bg-surface-low border border-outline-variant/70 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-on-surface">{event.action}</span>
                      <span className="font-mono text-[10px] text-on-surface-variant">
                        {new Date(event.at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="text-[11px] text-on-surface-variant flex items-center justify-between">
                      <span>Actor: {typeof event.actorId === 'object' && event.actorId ? (event.actorId as any).name : 'System'} ({event.actorRole})</span>
                      <span className="font-mono text-[10px]">{event.type}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
};
