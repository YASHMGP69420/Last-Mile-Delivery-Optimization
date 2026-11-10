import React, { useRef, DependencyList } from 'react';
import { useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
  /** Disable transform animations (e.g. full-bleed Leaflet map routes) */
  skipTransform?: boolean;
}

/**
 * GPU-accelerated GSAP route switch wrapper.
 * Automatically clears transform on completion so fixed-position modals/drawers are never trapped.
 */
export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  className = '',
  skipTransform = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useGSAP(
    () => {
      if (!containerRef.current || skipTransform) return;

      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          containerRef.current,
          { opacity: 0, y: 12, scale: 0.988 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.28,
            ease: 'power3.out',
            clearProps: 'transform',
          }
        );
      });

      return () => mm.revert();
    },
    { scope: containerRef, dependencies: [pathname, skipTransform] }
  );

  return (
    <div ref={containerRef} key={pathname} className={className}>
      {children}
    </div>
  );
};

/**
 * Staggered bouncy/spongy entrance hook for KPI strips, dashboard cards, and list items.
 */
export function useStaggerEntrance(
  containerRef: React.RefObject<HTMLElement | null>,
  selector: string = '.gsap-stagger',
  deps: DependencyList = []
) {
  useGSAP(
    () => {
      if (!containerRef.current) return;
      const targets = containerRef.current.querySelectorAll(selector);
      if (!targets || targets.length === 0) return;

      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          targets,
          { opacity: 0, y: 16, scale: 0.97 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.42,
            stagger: 0.045,
            ease: 'back.out(1.4)',
            clearProps: 'transform',
          }
        );
      });

      return () => mm.revert();
    },
    { scope: containerRef, dependencies: [...deps] }
  );
}
