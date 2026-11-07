import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center">
        <div
          className={clsx(
            'relative transform overflow-hidden rounded-3xl bg-surface-lowest text-left shadow-2xl transition-all w-full border border-outline-variant/60 max-h-[88dvh] flex flex-col',
            widthClasses[maxWidth]
          )}
        >
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-outline-variant/40 bg-surface-lowest">
            <div>
              <h3 className="text-base font-semibold leading-6 text-on-surface">{title}</h3>
              {subtitle && <p className="mt-0.5 text-xs text-on-surface-variant">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-on-surface-variant hover:bg-surface-low hover:text-on-surface transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 sm:px-6 py-4 flex-1 min-h-0 overflow-y-auto bg-surface-lowest overscroll-contain">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="shrink-0 flex items-center justify-end gap-3 px-5 sm:px-6 py-3 bg-surface-low/50 border-t border-outline-variant/40">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
