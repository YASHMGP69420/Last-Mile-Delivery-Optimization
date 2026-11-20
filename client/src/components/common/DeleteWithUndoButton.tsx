import React, { useState, useEffect, useRef } from 'react';
import { Trash2, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';

export interface DeleteWithUndoButtonProps {
  onDelete: () => void | Promise<void>;
  onUndo?: () => void;
  countdownSeconds?: number;
  itemDescription?: string;
  buttonLabel?: string;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'danger' | 'ghost' | 'outline' | 'icon';
  className?: string;
  undoClassName?: string;
  disabled?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
  showToast?: boolean;
}

export const DeleteWithUndoButton: React.FC<DeleteWithUndoButtonProps> = ({
  onDelete,
  onUndo,
  countdownSeconds = 3,
  itemDescription,
  buttonLabel = 'Delete',
  title = 'Delete item',
  size = 'md',
  variant = 'danger',
  className,
  undoClassName,
  disabled = false,
  isLoading = false,
  icon,
  showToast = true,
}) => {
  const [isPending, setIsPending] = useState(false);
  const [countdown, setCountdown] = useState(countdownSeconds);
  const [isExecuting, setIsExecuting] = useState(false);

  const timerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const toastIdRef = useRef<string | number | null>(null);

  const cleanup = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (toastIdRef.current !== null) {
      toast.dismiss(toastIdRef.current);
      toastIdRef.current = null;
    }
  };

  useEffect(() => {
    return cleanup;
  }, []);

  const handleUndo = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    cleanup();
    setIsPending(false);
    setCountdown(countdownSeconds);
    toast.info('Deletion cancelled');
    onUndo?.();
  };

  const handleStartDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (disabled || isLoading || isExecuting) return;

    if (countdownSeconds <= 0) {
      setIsExecuting(true);
      Promise.resolve(onDelete()).finally(() => {
        setIsExecuting(false);
      });
      return;
    }

    setIsPending(true);
    setCountdown(countdownSeconds);

    if (showToast) {
      const desc = itemDescription ? ` "${itemDescription}"` : '';
      toastIdRef.current = toast.warning(`Deleting${desc} in ${countdownSeconds}s...`, {
        duration: countdownSeconds * 1000,
        action: {
          label: 'Undo',
          onClick: handleUndo,
        },
      });
    }

    intervalRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (intervalRef.current !== null) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    timerRef.current = window.setTimeout(async () => {
      cleanup();
      setIsPending(false);
      setIsExecuting(true);
      try {
        await onDelete();
      } finally {
        setIsExecuting(false);
      }
    }, countdownSeconds * 1000);
  };

  if (isPending) {
    return (
      <button
        type="button"
        onClick={handleUndo}
        className={clsx(
          'inline-flex items-center justify-center font-semibold rounded-lg transition-colors select-none animate-pulse',
          'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 hover:bg-amber-500/30',
          size === 'sm' ? 'text-xs px-2.5 py-1 gap-1.5' : 'text-xs px-3.5 py-1.5 gap-2',
          undoClassName
        )}
        title="Click to undo deletion"
        aria-label="Undo delete"
      >
        <RotateCcw className="w-3.5 h-3.5 shrink-0" />
        <span>Undo ({countdown}s)</span>
      </button>
    );
  }

  const accessibleName = buttonLabel || title || 'Delete';

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleStartDelete}
        disabled={disabled || isLoading || isExecuting}
        className={clsx(
          'p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
          'hover:bg-red-50 dark:hover:bg-rose-500/10 text-red-600 dark:text-rose-400',
          className
        )}
        title={title}
        aria-label={accessibleName}
      >
        {isExecuting || isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          icon || <Trash2 className="w-3.5 h-3.5" />
        )}
      </button>
    );
  }

  const baseStyles =
    'spring-press inline-flex items-center justify-center font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-obsidian-900 disabled:opacity-60 disabled:cursor-not-allowed select-none';

  const variants = {
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    ghost: 'text-error hover:text-error hover:bg-red-50 focus:ring-red-500',
    outline: 'border border-red-500/30 text-red-600 hover:bg-red-50 dark:text-rose-400 dark:hover:bg-rose-500/10',
  };

  const sizes = {
    sm: 'text-xs px-3.5 py-1.5 gap-1.5',
    md: 'text-xs px-5 py-2.5 gap-2',
    lg: 'text-sm px-6 py-3 gap-2.5',
  };

  return (
    <button
      type="button"
      onClick={handleStartDelete}
      disabled={disabled || isLoading || isExecuting}
      className={clsx(baseStyles, variants[variant], sizes[size], className)}
      title={title}
      aria-label={accessibleName}
    >
      {isExecuting || isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          <span className="inline-flex shrink-0">{icon || <Trash2 className="w-3.5 h-3.5" />}</span>
          <span>{buttonLabel}</span>
        </>
      )}
    </button>
  );
};
