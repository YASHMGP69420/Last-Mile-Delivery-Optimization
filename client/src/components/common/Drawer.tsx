import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

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
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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

  useGSAP(
    () => {
      if (!isOpen || !panelRef.current) return;
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        if (backdropRef.current) {
          gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: 'power2.out' });
        }
        gsap.fromTo(
          panelRef.current,
          { x: 42, opacity: 0.4 },
          { x: 0, opacity: 1, duration: 0.32, ease: 'power3.out', clearProps: 'transform' }
        );
      });
      return () => mm.revert();
    },
    { dependencies: [isOpen] }
  );

  if (!isOpen) return null;

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 overflow-hidden">
        {/* Backdrop */}
        <div
          ref={backdropRef}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          onClick={onClose}
        />

        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
          <div
            ref={panelRef}
            className={clsx(
              'pointer-events-auto w-screen glass-floating shadow-2xl flex flex-col',
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
            <div className="relative flex-1 overflow-y-auto smooth-scroll overscroll-contain px-6 py-5 space-y-6">
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
