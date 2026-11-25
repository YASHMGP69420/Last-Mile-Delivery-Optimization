# Quick Task Summary: Fix PWA Install Button Popup Going Out of Screen on PC

**Task:** `261125-rdw-fix-pwa-install-prompt-going-out-of-scre`  
**Date:** 2026-11-25  
**Status:** Completed  

---

## 1. Overview
Resolved the issue where the PWA installation popup card was extending beyond the viewport or clipping off-screen on PC/desktop displays.

### Root Cause
1. **CSS Specificity Conflict with `.glass-floating`**:
   `PwaInstallPrompt.tsx` included the utility class `glass-floating`, which in `index.css` defines `position: relative;`. Because `index.css` helper classes are defined after Tailwind's `@tailwind utilities`, the `position: relative` rule overrode Tailwind's `fixed` class. As a result, the prompt was rendered in normal document flow rather than fixed viewport coordinates, causing it to shift out of view when scrolling or sizing.
2. **Desktop Dimension Bounds**:
   The prompt was styled with `w-[calc(100vw-2rem)] max-w-sm` (up to 384px) at `bottom-4 right-4` without desktop-specific clamping or box-sizing protection, leading to horizontal margin issues at certain display scaling factors or zoom levels.

---

## 2. Changes Made
- **`client/src/components/common/PwaInstallPrompt.tsx`**:
  - Enforced `!fixed` (`position: fixed !important`) to guarantee that no ancestor or helper class can override viewport locking.
  - Replaced the `.glass-floating` class with explicit Hallmark glassmorphism styles (`dark:bg-obsidian-900/95 bg-white/95 backdrop-blur-xl border border-outline-variant/70 dark:border-obsidian-750/90 shadow-2xl`).
  - Clamped desktop dimensions to a sleek compact width: `w-[calc(100vw-2rem)] sm:w-80 max-w-[320px]`.
  - Added desktop-safe spacing: `bottom-4 right-4 sm:bottom-6 sm:right-6`.
  - Added `box-border overflow-hidden pointer-events-auto` and title `truncate` with `shrink-0` on the dismiss button to protect against content overflow at any DPI scaling.

---

## 3. Verification
- `npm run test:unit --workspace=client -- src/components/common/__tests__/PwaInstallPrompt.test.tsx`: 5/5 passing (84ms).
- `npm run test --workspace=client` (`tsc --noEmit`): Clean, 0 errors.
- `npm run test:unit --workspace=client`: All 32 test suites, 185 tests passing green.
- `npm run build --workspace=client`: Production build succeeded in 1.50s.
