export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function getScrollBehavior(preferred: ScrollBehavior = 'smooth'): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : preferred;
}

export function isInsideLeafletMap(element: Element | null): boolean {
  return Boolean(element?.closest('.leaflet-container'));
}

export function smoothScrollToTop(
  container?: HTMLElement | null,
  behavior: ScrollBehavior = 'smooth'
): void {
  if (typeof window === 'undefined') return;
  const resolved = getScrollBehavior(behavior);
  if (container) {
    container.scrollTo({ top: 0, behavior: resolved });
  } else {
    window.scrollTo({ top: 0, left: 0, behavior: resolved });
  }
}

function resolveHashTarget(hash: string): HTMLElement | null {
  if (!hash.startsWith('#') || hash.length <= 1) return null;
  const rawId = hash.slice(1);
  let decodedId = rawId;
  try {
    decodedId = decodeURIComponent(rawId);
  } catch {
    return null;
  }
  if (!decodedId) return null;
  return document.getElementById(decodedId);
}

export function smoothScrollToElement(
  target: HTMLElement | string,
  options?: { block?: ScrollLogicalPosition; behavior?: ScrollBehavior }
): boolean {
  if (typeof document === 'undefined') return false;
  const element = typeof target === 'string' ? resolveHashTarget(target) : target;
  if (!element || isInsideLeafletMap(element)) return false;

  element.scrollIntoView({
    behavior: getScrollBehavior(options?.behavior ?? 'smooth'),
    block: options?.block ?? 'start',
    inline: 'nearest',
  });
  return true;
}
