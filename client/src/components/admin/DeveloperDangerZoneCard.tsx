import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { AdminApi } from '../../api/client';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { toast } from 'sonner';

interface DeveloperDangerZoneCardProps {
  onPurged?: () => void | Promise<void>;
}

export const DeveloperDangerZoneCard: React.FC<DeveloperDangerZoneCardProps> = ({ onPurged }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [countdown, setCountdown] = useState(3);
  const [isPurging, setIsPurging] = useState(false);

  // Countdown timer for Step 2
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (isModalOpen && step === 2 && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isModalOpen, step, countdown]);

  const handleOpenModal = () => {
    setStep(1);
    setCountdown(3);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isPurging) return;
    setIsModalOpen(false);
    setStep(1);
    setCountdown(3);
  };

  const handleProceedToStep2 = () => {
    setStep(2);
    setCountdown(3);
  };

  const handleExecutePurge = async () => {
    setIsPurging(true);
    try {
      await AdminApi.purgeAllOperationalData(true);
      toast.success('Database operational data successfully purged and reset');
      handleCloseModal();
      if (onPurged) {
        await onPurged();
      }
    } catch (err: any) {
      const msg = err?.friendlyMessage || err?.response?.data?.message || err?.message || 'Failed to purge database';
      toast.error(msg);
    } finally {
      setIsPurging(false);
    }
  };

  const operationalCollections = [
    'Deliveries & Consignments',
    'Delivery Batches & Schedulers',
    'Routes & Stop Assignments',
    'Fleet Vehicles & Vehicle Assignments',
    'Drivers & Driver User Logins',
    'Driver Shifts & Incident Reports',
    'Vehicle Checklists & Maintenance Records',
    'Live GPS Telemetry Pings & Alerts',
  ];

  return (
    <>
      <div className="rounded-xl border-2 border-red-500/60 bg-red-950/20 dark:bg-red-950/30 p-6 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-red-500/20 text-red-500 border border-red-500/30">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                Developer Danger Zone
              </span>
              <span className="text-xs text-red-400/90 font-medium bg-red-900/30 px-2 py-0.5 rounded">
                Dev & Admin Controls
              </span>
            </div>
            <h3 className="text-base font-bold text-red-500 dark:text-red-400">
              Hard Reset & Database Purge (Development / Testing)
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              Permanently deletes all operational data across deliveries, batches, fleet vehicles, drivers, route assignments, shifts, incidents, checklists, and live telemetry. Active administrator accounts and your current session will be preserved.
            </p>
          </div>
          <div className="flex-shrink-0">
            <button
              type="button"
              onClick={handleOpenModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold text-xs sm:text-sm shadow-md transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Purge All Operational Data
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={step === 1 ? 'Hard Reset & Database Purge' : 'Final Danger Confirmation'}
        subtitle={step === 1 ? 'Step 1 of 2: Review affected operational collections' : 'Step 2 of 2: Safety countdown lock'}
        maxWidth="lg"
        footer={
          step === 1 ? (
            <div className="flex items-center justify-end gap-3 w-full">
              <Button variant="ghost" onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleProceedToStep2}
                className="bg-red-600 hover:bg-red-700 text-white border-none"
              >
                Proceed to Final Confirmation
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={isPurging}>
                Back to Step 1
              </Button>
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={handleCloseModal} disabled={isPurging}>
                  Cancel
                </Button>
                <button
                  type="button"
                  onClick={handleExecutePurge}
                  disabled={countdown > 0 || isPurging}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm text-white transition-all shadow-md ${
                    countdown > 0 || isPurging
                      ? 'bg-red-400 dark:bg-red-900/60 opacity-60 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700 active:bg-red-800 animate-pulse'
                  }`}
                >
                  {isPurging ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Purging Operational Data...
                    </>
                  ) : countdown > 0 ? (
                    `Unlocking in ${countdown}s...`
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Confirm Database Purge
                    </>
                  )}
                </button>
              </div>
            </div>
          )
        }
      >
        {step === 1 ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-red-500/15 border border-red-500/30 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-red-700 dark:text-red-300 space-y-1">
                <p className="font-semibold">Irreversible Hard Reset Warning</p>
                <p>
                  This action permanently wipes all operational databases and driver login credentials. No text typing is required, but please review the affected collections below before proceeding.
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Operational Collections Being Purged:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {operationalCollections.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 p-2 rounded border border-red-500/20 bg-red-500/5 text-xs text-slate-700 dark:text-slate-200"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>
                <strong>Administrator Account Safety:</strong> Active administrator accounts (<code>ADMIN</code>) and your current session will be strictly preserved.
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-red-500/20 border-2 border-red-500/40 text-center space-y-3">
              <div className="inline-flex p-3 rounded-full bg-red-500/20 text-red-500">
                <ShieldAlert className="w-8 h-8 text-red-500" />
              </div>
              <h4 className="text-base font-bold text-red-600 dark:text-red-400">
                Are you absolutely sure you want to purge all operational data?
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">
                Once confirmed, all deliveries, batches, vehicles, drivers, route assignments, and telemetry data will be immediately and irrevocably wiped from the database.
              </p>
              {countdown > 0 ? (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  Safety countdown active: {countdown}s remaining
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-bold shadow-sm">
                  ✓ Safety lock released — you may now confirm purge
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default DeveloperDangerZoneCard;
