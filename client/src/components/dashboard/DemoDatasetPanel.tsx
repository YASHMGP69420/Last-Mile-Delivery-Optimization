import React, { useEffect, useRef, useState } from 'react';
import {
  Database,
  Download,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Copy,
  Check,
  KeyRound,
} from 'lucide-react';
import { DemoDataApi, DemoDriverCredential } from '../../api/client';
import { Button } from '../common/Button';

interface DemoDatasetPanelProps {
  onDataChanged?: () => void | Promise<void>;
}

interface DemoCounts {
  users: number;
  drivers: number;
  vehicles: number;
  deliveries: number;
  batches: number;
  routes: number;
  total: number;
}

/**
 * Isolated, Admin-only prebuilt Demo Dataset controller (`isDemoData: true`).
 * Designed as a standalone module so it can be removed in one step before final launch.
 */
export const DemoDatasetPanel: React.FC<DemoDatasetPanelProps> = ({ onDataChanged }) => {
  const [hasDemoData, setHasDemoData] = useState(false);
  const [counts, setCounts] = useState<DemoCounts>({
    users: 0,
    drivers: 0,
    vehicles: 0,
    deliveries: 0,
    batches: 0,
    routes: 0,
    total: 0,
  });
  const [driverCredentials, setDriverCredentials] = useState<DemoDriverCredential[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'IMPORT' | 'DELETE' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadStatus = async () => {
    try {
      const res = await DemoDataApi.getStatus();
      if (res.data) {
        setHasDemoData(res.data.hasDemoData);
        setCounts(res.data.counts);
        setDriverCredentials(res.data.driverCredentials ?? []);
      }
    } catch {
      // Non-blocking on initial render
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopy = async (key: string, value: string | null) => {
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        return;
      }
      setCopiedKey(key);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedKey(null);
      }, 1500);
    } catch {
      // Clipboard API may be blocked in non-secure contexts
    }
  };

  const handleImport = async () => {
    setBusy('IMPORT');
    setFeedback(null);
    setConfirmDelete(false);
    try {
      const res = await DemoDataApi.importDemoData();
      if (res.data) {
        setHasDemoData(res.data.hasDemoData);
        setCounts(res.data.counts);
        setDriverCredentials(res.data.driverCredentials ?? []);
      }
      setFeedback({
        type: 'success',
        text: 'Loaded prebuilt Bhubaneswar demo dataset (10 consignments, 4 vehicles, 3 drivers, 1 batch).',
      });
      await onDataChanged?.();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text:
          err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Failed to import prebuilt demo dataset.',
      });
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    setBusy('DELETE');
    setFeedback(null);
    try {
      const res = await DemoDataApi.deleteDemoData();
      if (res.data?.status) {
        setHasDemoData(res.data.status.hasDemoData);
        setCounts(res.data.status.counts);
        setDriverCredentials(res.data.status.driverCredentials ?? []);
      } else {
        setHasDemoData(false);
        setDriverCredentials([]);
      }
      setConfirmDelete(false);
      setFeedback({
        type: 'success',
        text:
          res.message ||
          'All tagged demo data removed. Real users, consignments, vehicles, and drivers remain intact.',
      });
      await onDataChanged?.();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text:
          err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Failed to delete demo dataset.',
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="panel-card rounded-xl p-4 border border-outline-variant/60 dark:border-obsidian-750 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-surface-low dark:bg-obsidian-800 border border-outline-variant/60 dark:border-obsidian-700 flex items-center justify-center text-primary dark:text-emerald-400 shrink-0">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface dark:text-white">
                Prebuilt Demo Dataset (Temporary Admin Utility)
              </h3>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-[4px] border border-outline-variant/80 dark:border-obsidian-750 bg-surface-low dark:bg-obsidian-850 border-l-[3px] ${
                  hasDemoData
                    ? 'border-l-amber-500 text-on-surface dark:text-amber-200'
                    : 'border-l-primary text-on-surface dark:text-zinc-200'
                }`}
              >
                {loading
                  ? 'Checking...'
                  : hasDemoData
                  ? `Demo Active (${counts.deliveries} deliveries, ${counts.vehicles} vehicles, ${counts.drivers} drivers)`
                  : 'Clean Production Baseline (0 demo records)'}
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant dark:text-slate-400 mt-0.5">
              {hasDemoData
                ? 'Demo Showcase Profiles (demo.admin, demo.manager, demo.driver1..3) and sample Bhubaneswar records are tagged isDemoData: true and cleanly removed by Delete Demo Data.'
                : 'Import tagged sample Bhubaneswar operations data for walkthroughs, or purge only demo records without touching real users or consignments.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            disabled={loading || hasDemoData || busy !== null}
            isLoading={busy === 'IMPORT'}
            leftIcon={<Download className="w-3.5 h-3.5 text-primary" />}
            onClick={handleImport}
          >
            Import Demo Data
          </Button>

          {!confirmDelete ? (
            <Button
              size="sm"
              variant="danger"
              disabled={loading || !hasDemoData || busy !== null}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => setConfirmDelete(true)}
            >
              Delete Demo Data
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 rounded-lg px-2 py-1">
              <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <Button
                size="sm"
                variant="danger"
                isLoading={busy === 'DELETE'}
                onClick={handleDelete}
              >
                Confirm Delete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy !== null}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
              : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {hasDemoData && driverCredentials.length > 0 && (
        <div className="rounded-lg border border-outline-variant/60 dark:border-obsidian-750 bg-surface-low dark:bg-obsidian-850 overflow-hidden">
          <div className="px-3 py-2 border-b border-outline-variant/60 dark:border-obsidian-750 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <div className="flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-primary dark:text-emerald-400 shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface dark:text-white">
                Demo Driver Credentials (Use Password Sign-In)
              </span>
            </div>
            <span className="text-[11px] text-on-surface-variant dark:text-slate-400">
              Use Password Sign-In on the login page to inspect the <code className="font-mono">/driver</code> handheld view.
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-outline-variant/50 dark:border-obsidian-750 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant dark:text-slate-400">
                  <th className="py-2 px-3">Driver</th>
                  <th className="py-2 px-3">Email</th>
                  <th className="py-2 px-3">Password</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40 dark:divide-obsidian-800">
                {driverCredentials.map((cred) => {
                  const emailKey = `email-${cred.id}`;
                  const passKey = `pass-${cred.id}`;
                  return (
                    <tr key={cred.id} className="hover:bg-surface-container/40 dark:hover:bg-obsidian-800/40">
                      <td className="py-2 px-3 align-middle">
                        <div className="font-medium text-on-surface dark:text-white">
                          {cred.name}
                        </div>
                        {(cred.licenseNumber || cred.vehicleId) && (
                          <div className="text-[10px] font-mono text-on-surface-variant dark:text-slate-400 mt-0.5">
                            {[cred.licenseNumber, cred.vehicleId].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 align-middle">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] text-on-surface dark:text-zinc-200 select-all">
                            {cred.email}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(emailKey, cred.email)}
                            title="Copy email"
                            aria-label={`Copy email for ${cred.name}`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-outline-variant/60 dark:border-obsidian-700 bg-surface dark:bg-obsidian-800 text-[10px] font-medium text-on-surface-variant dark:text-slate-300 hover:text-on-surface dark:hover:text-white transition-colors"
                          >
                            {copiedKey === emailKey ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-2 px-3 align-middle">
                        {cred.password ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] text-on-surface dark:text-emerald-300 select-all">
                              {cred.password}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(passKey, cred.password)}
                              title="Copy password"
                              aria-label={`Copy password for ${cred.name}`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-outline-variant/60 dark:border-obsidian-700 bg-surface dark:bg-obsidian-800 text-[10px] font-medium text-on-surface-variant dark:text-slate-300 hover:text-on-surface dark:hover:text-white transition-colors"
                            >
                              {copiedKey === passKey ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-500" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] italic text-on-surface-variant dark:text-slate-500">
                            Unavailable
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
