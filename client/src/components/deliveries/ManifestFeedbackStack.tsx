import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

export type ManifestFeedbackVariant = 'success' | 'error' | 'warning' | 'info';

export interface ManifestFeedbackMeta {
  label: string;
  value: string;
}

export interface ManifestFeedbackItem {
  id: string;
  variant: ManifestFeedbackVariant;
  badge: string;
  title: string;
  message: string;
  meta?: ManifestFeedbackMeta[];
  sticky?: boolean;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface ManifestFeedbackStackProps {
  items: ManifestFeedbackItem[];
  onDismiss: (id: string) => void;
}

const DEFAULT_AUTO_DISMISS_MS = 5500;

const VARIANT_STYLES: Record<
  ManifestFeedbackVariant,
  {
    leftAccent: string;
    badgeClasses: string;
    iconColor: string;
    progressColor: string;
    Icon: React.FC<{ className?: string }>;
  }
> = {
  success: {
    leftAccent: 'border-l-emerald-600 dark:border-l-teal-400',
    badgeClasses:
      'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:bg-teal-400/10 dark:text-teal-300 dark:border-teal-400/25',
    iconColor: 'text-emerald-600 dark:text-teal-400',
    progressColor: 'bg-emerald-600 dark:bg-teal-400',
    Icon: CheckCircle2,
  },
  error: {
    leftAccent: 'border-l-rose-600 dark:border-l-rose-500',
    badgeClasses:
      'bg-rose-500/10 text-rose-700 border-rose-500/25 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
    iconColor: 'text-rose-600 dark:text-rose-400',
    progressColor: 'bg-rose-600 dark:bg-rose-500',
    Icon: AlertTriangle,
  },
  warning: {
    leftAccent: 'border-l-amber-500',
    badgeClasses:
      'bg-amber-500/10 text-amber-700 border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    progressColor: 'bg-amber-500',
    Icon: AlertTriangle,
  },
  info: {
    leftAccent: 'border-l-sky-500',
    badgeClasses:
      'bg-sky-500/10 text-sky-700 border-sky-500/25 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30',
    iconColor: 'text-sky-600 dark:text-sky-400',
    progressColor: 'bg-sky-500',
    Icon: Info,
  },
};

interface ManifestFeedbackCardProps {
  item: ManifestFeedbackItem;
  onDismiss: (id: string) => void;
}

const ManifestFeedbackCard: React.FC<ManifestFeedbackCardProps> = ({ item, onDismiss }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const isSticky =
    item.sticky !== undefined
      ? item.sticky
      : item.variant === 'error' || item.variant === 'warning';

  const totalDurationMs = item.durationMs ?? DEFAULT_AUTO_DISMISS_MS;
  const remainingMsRef = useRef<number>(totalDurationMs);
  const [isPaused, setIsPaused] = useState(false);
  const [progressPct, setProgressPct] = useState(100);

  useGSAP(
    () => {
      if (!cardRef.current) return;
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          cardRef.current,
          { opacity: 0, x: 24, y: 12, scale: 0.96 },
          {
            opacity: 1,
            x: 0,
            y: 0,
            scale: 1,
            duration: 0.3,
            ease: 'back.out(1.4)',
            clearProps: 'transform',
          }
        );
      });
      return () => mm.revert();
    },
    { scope: cardRef, dependencies: [] }
  );

  useEffect(() => {
    if (isSticky || isPaused) return;

    let lastTime = performance.now();
    const intervalId = window.setInterval(() => {
      const now = performance.now();
      const elapsed = now - lastTime;
      lastTime = now;

      remainingMsRef.current = Math.max(0, remainingMsRef.current - elapsed);
      setProgressPct((remainingMsRef.current / totalDurationMs) * 100);

      if (remainingMsRef.current <= 0) {
        window.clearInterval(intervalId);
        onDismissRef.current(item.id);
      }
    }, 50);

    return () => window.clearInterval(intervalId);
  }, [isSticky, isPaused, item.id, totalDurationMs]);

  const style = VARIANT_STYLES[item.variant];
  const IconComponent = style.Icon;
  const isAssertive = item.variant === 'error' || item.variant === 'warning';

  return (
    <div
      ref={cardRef}
      role={isAssertive ? 'alert' : 'status'}
      aria-live={isAssertive ? 'assertive' : 'polite'}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setIsPaused(false);
        }
      }}
      className={clsx(
        'pointer-events-auto rounded-lg border shadow-2xl overflow-hidden',
        'bg-white dark:bg-[#121417] border-slate-200 dark:border-[#262A32] border-l-4',
        style.leftAccent
      )}
    >
      <div className="p-3.5 space-y-2.5">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5 min-w-0">
            <IconComponent className={clsx('w-4 h-4 shrink-0 mt-0.5', style.iconColor)} />
            <div className="min-w-0 space-y-1">
              <span
                className={clsx(
                  'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border',
                  style.badgeClasses
                )}
              >
                {item.badge}
              </span>
              <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100 leading-snug">
                {item.title}
              </h4>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(item.id)}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-[#1D2128] transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body Message */}
        <p className="text-xs text-slate-700 dark:text-zinc-200 leading-relaxed pl-6">
          {item.message}
        </p>

        {/* Compact Monospace Metadata Strip */}
        {item.meta && item.meta.length > 0 && (
          <div className="ml-6 bg-slate-50 dark:bg-[#0B0C0E] border border-slate-200/80 dark:border-[#262A32] rounded px-2.5 py-2 grid grid-cols-2 gap-x-3 gap-y-1">
            {item.meta.map((entry, idx) => (
              <div key={`${entry.label}-${idx}`} className="min-w-0 flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-semibold">
                  {entry.label}
                </span>
                <span className="text-[11px] font-mono tabular-nums font-semibold text-slate-900 dark:text-zinc-100 truncate">
                  {entry.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Footer CTAs */}
        {(isSticky || (item.actionLabel && item.onAction)) && (
          <div className="ml-6 pt-1 flex items-center justify-end gap-2">
            {item.actionLabel && item.onAction && (
              <button
                type="button"
                onClick={() => {
                  item.onAction?.();
                  onDismiss(item.id);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-[#262A32] dark:text-zinc-100 dark:hover:bg-[#323844] transition-colors"
              >
                <span>{item.actionLabel}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
            {isSticky && (
              <button
                type="button"
                onClick={() => onDismiss(item.id)}
                className="px-2.5 py-1 rounded text-[11px] font-semibold border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-[#262A32] dark:text-zinc-200 dark:hover:bg-[#1D2128] transition-colors"
              >
                Acknowledge
              </button>
            )}
          </div>
        )}
      </div>

      {/* Auto-Dismiss Progress Accent Bar */}
      {!isSticky && (
        <div className="h-0.5 w-full bg-slate-100 dark:bg-[#1B1E24]">
          <div
            className={clsx('h-full transition-[width] duration-75 ease-linear', style.progressColor)}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
    </div>
  );
};

export const ManifestFeedbackStack: React.FC<ManifestFeedbackStackProps> = ({
  items,
  onDismiss,
}) => {
  if (items.length === 0) return null;

  return (
    <div
      aria-label="Manifest operation notifications"
      className="fixed bottom-5 right-5 z-[70] flex flex-col gap-3 w-[calc(100vw-2rem)] max-w-md pointer-events-none"
    >
      {items.map((item) => (
        <ManifestFeedbackCard key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
};
