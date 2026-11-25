# Quick Task 261125-rdw: Fix PWA Install Button Popup Going Out of Screen on PC - Context

**Gathered:** 2026-11-25
**Status:** Ready for planning

<domain>
## Task Boundary

Fix the PWA installation popup so it stays strictly within the PC / desktop viewport boundaries, does not overflow or clip off-screen at any display scaling or zoom level, and is styled as a compact bottom-right card with safe bounds.

</domain>

<decisions>
## Implementation Decisions

### Popup Placement & Dimensions on PC
- **Placement**: Compact bottom-right card (`!fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50`).
- **Width**: Responsive clamping with `w-[calc(100vw-2rem)] sm:w-80 sm:max-w-xs`.
- **Positioning Fix**: Prevent `.glass-floating` CSS class collision (which declared `position: relative` after `@tailwind utilities`, inadvertently overriding `fixed`). Use explicit `!fixed` or remove relative positioning conflict so the element is guaranteed fixed to the viewport at all times.

### Viewport Clamping & Layout Protection
- **Overflow & Safe Bounds**: Apply `box-border overflow-hidden pointer-events-auto` and explicit margins so the modal/card never extends outside viewport borders regardless of Windows display scaling (125%, 150%) or browser zoom.
- **Visual Polish**: Keep Hallmark dark obsidian styling (`dark:bg-obsidian-900/95 bg-white/95 backdrop-blur-xl border border-outline-variant/70 dark:border-obsidian-750/90 shadow-2xl rounded-2xl`).

### Agent Discretion
- Ensure unit tests in `PwaInstallPrompt.test.tsx` and `App.test.tsx` pass without regressions.
- Retain the iOS guide flow and dismiss behavior (`sessionStorage`).

</decisions>
