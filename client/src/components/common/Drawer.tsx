import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'md',
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
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-primary/40 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
          <div
            className={clsx(
              'pointer-events-auto w-screen transform transition-transform ease-in-out duration-300 bg-surface-lowest shadow-2xl border-l border-outline-variant flex flex-col',
              widthClasses[width]
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-surface-low">
              <div>
                <h2 className="text-base font-semibold text-on-surface">{title}</h2>
                {subtitle && <p className="text-xs text-on-surface-variant mt-0.5">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="relative flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="px-6 py-4 bg-surface-low border-t border-outline-variant flex justify-end gap-3">
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
