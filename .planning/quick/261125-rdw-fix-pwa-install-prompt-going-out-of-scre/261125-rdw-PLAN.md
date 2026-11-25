---
phase: quick
plan: 261125-rdw-fix-pwa-install-prompt-going-out-of-scre
type: execute
wave: 1
depends_on: []
files_modified:
  - client/src/components/common/PwaInstallPrompt.tsx
  - client/src/components/common/__tests__/PwaInstallPrompt.test.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "PwaInstallPrompt has guaranteed fixed viewport positioning that cannot be overridden by CSS helper classes"
    - "PwaInstallPrompt width and margins are strictly clamped so it never extends beyond the PC/desktop screen at any DPI scaling or browser zoom"
    - "PwaInstallPrompt uses compact styling (max 320px width on desktop) in bottom-right corner (sm:bottom-6 sm:right-6)"
    - "All unit tests pass and verify rendering, install action, and dismissal"
  artifacts:
    - client/src/components/common/PwaInstallPrompt.tsx
    - client/src/components/common/__tests__/PwaInstallPrompt.test.tsx
  key_links:
    - "PwaInstallPrompt rendered in App.tsx"
---

<objective>
Fix the PWA install prompt card going out of the screen on PC / desktop displays by resolving CSS positioning conflicts, clamping maximum width, and ensuring safe viewport margins across all DPI scaling levels.

Purpose: Prevent the install prompt from overflowing or clipping outside the viewport on PC, keeping it neatly docked in the bottom-right corner.
Output: Updated PwaInstallPrompt.tsx and verified test suite.
</objective>

<execution_context>
@~/.gemini/antigravity/gsd-core/workflows/execute-plan.md
@~/.gemini/antigravity/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261125-rdw-fix-pwa-install-prompt-going-out-of-scre/261125-rdw-CONTEXT.md
@client/src/components/common/PwaInstallPrompt.tsx
@client/src/components/common/__tests__/PwaInstallPrompt.test.tsx
</context>

<tasks>
<task id="1" name="Fix positioning and viewport bounds on PwaInstallPrompt">
In `client/src/components/common/PwaInstallPrompt.tsx`:
1. Resolve the `position: relative` override caused by the `.glass-floating` class in `index.css`:
   - Replace or augment with explicit `fixed !important` (or Tailwind `!fixed`) so the prompt is always locked to viewport coordinates rather than parent flow.
2. Clamp dimensions for desktop:
   - Use `bottom-4 right-4 sm:bottom-6 sm:right-6` for safe spacing from window borders.
   - Use `w-[calc(100vw-2rem)] sm:w-80 max-w-[320px]` so it remains a sleek, compact card on desktop and never expands off screen.
   - Add `box-border overflow-hidden pointer-events-auto` and `m-0` to eliminate unintended edge offsets.
3. Optimize internal spacing and typography so title, description, and buttons fit cleanly inside the 320px card without horizontal wrapping quirks.
</task>

<task id="2" name="Verify with unit tests, typecheck, and build">
1. Run `npm run test:unit --workspace=client -- src/components/common/__tests__/PwaInstallPrompt.test.tsx` to verify all test suites pass.
2. Run `npm run test --workspace=client` (tsc --noEmit) to confirm zero TypeScript errors.
3. Run `npm run build --workspace=client` to ensure production build succeeds.
</task>
</tasks>
