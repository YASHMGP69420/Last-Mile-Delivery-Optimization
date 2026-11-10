import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  isInsideLeafletMap,
  smoothScrollToElement,
  smoothScrollToTop,
} from '../../utils/smoothScroll';

export const ScrollManager: React.FC = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash && hash.length > 1) {
      const rafId = window.requestAnimationFrame(() => {
        smoothScrollToElement(hash);
      });
      return () => window.cancelAnimationFrame(rafId);
    }

    const primaryContainer = document.querySelector<HTMLElement>(
      '[data-scroll-container="primary"]'
    );
    if (primaryContainer) {
      smoothScrollToTop(primaryContainer, 'auto');
    }
    smoothScrollToTop(null, 'auto');
    return undefined;
  }, [pathname, hash]);

  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as Element | null;
      const anchor = target?.closest<HTMLAnchorElement>('a[href^="#"]');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.length <= 1) return;
      if (anchor.hasAttribute('data-no-smooth-scroll') || isInsideLeafletMap(anchor)) {
        return;
      }

      if (smoothScrollToElement(href)) {
        event.preventDefault();
        window.history.replaceState(null, '', href);
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, []);

  return null;
};
