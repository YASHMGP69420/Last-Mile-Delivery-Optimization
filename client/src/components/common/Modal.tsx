import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

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
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

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
      if (!isOpen || !dialogRef.current) return;
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        if (backdropRef.current) {
          gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: 'power2.out' });
        }
        gsap.fromTo(
          dialogRef.current,
          { opacity: 0, scale: 0.93, y: 16 },
          { opacity: 1, scale: 1, y: 0, duration: 0.34, ease: 'back.out(1.6)', clearProps: 'transform' }
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
    '2xl': 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label={title}>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center">
        <div
          ref={dialogRef}
          className={clsx(
            'glass-floating relative overflow-hidden rounded-3xl text-left shadow-2xl w-full max-h-[88dvh] flex flex-col',
            widthClasses[maxWidth]
          )}
        >
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-outline-variant/40 bg-transparent">
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
          <div className="px-5 sm:px-6 py-4 flex-1 min-h-0 overflow-y-auto smooth-scroll bg-surface-lowest overscroll-contain">
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
