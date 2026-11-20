import { useEffect, useRef } from 'react';

export interface RealtimeCatchupOptions {
  /**
   * Debounce delay in milliseconds before invoking the catchup callback.
   * Prevents duplicate API storms when visibility, focus, and reconnect fire together.
   * Default: 350ms
   */
  debounceMs?: number;
  /**
   * Whether catchup listeners are enabled.
   * Default: true
   */
  enabled?: boolean;
}

/**
 * Ensures production-grade multi-device synchronization across mobile, tablet, and desktop:
 * Automatically triggers a debounced catch-up refresh whenever:
 * 1. The device wakes up or the browser tab becomes active (`visibilitychange` -> `visible`).
 * 2. The browser window or app regains focus (`focus`).
 * 3. The device regains network connectivity after being offline (`online`).
 * 4. Socket.IO reconnects after connection drop or server reload (`smartroute:reconnect`).
 */
export function useRealtimeCatchup(
  onCatchup: () => void | Promise<void>,
  options: RealtimeCatchupOptions = {}
): void {
  const { debounceMs = 350, enabled = true } = options;
  const onCatchupRef = useRef(onCatchup);
  onCatchupRef.current = onCatchup;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const triggerCatchup = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          onCatchupRef.current();
        } catch (err) {
          console.warn('[useRealtimeCatchup] Catchup handler threw error:', err);
        }
      }, debounceMs);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        triggerCatchup();
      }
    };

    const handleFocus = () => {
      triggerCatchup();
    };

    const handleOnline = () => {
      triggerCatchup();
    };

    const handleSocketReconnect = () => {
      triggerCatchup();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    window.addEventListener('smartroute:reconnect', handleSocketReconnect);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('smartroute:reconnect', handleSocketReconnect);
    };
  }, [debounceMs, enabled]);
}
