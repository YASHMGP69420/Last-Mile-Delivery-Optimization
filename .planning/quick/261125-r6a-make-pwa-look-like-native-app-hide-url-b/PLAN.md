---
phase: quick
plan: 261125-r6a-make-pwa-look-like-native-app-hide-url-b
type: execute
wave: 1
depends_on: []
files_modified:
  - client/index.html
  - client/public/manifest.json
  - client/src/index.css
  - client/src/hooks/usePwaInstall.ts
  - client/src/components/common/PwaInstallPrompt.tsx
  - client/src/components/common/__tests__/PwaInstallPrompt.test.tsx
  - client/src/App.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "index.html links manifest.json via <link rel='manifest' href='/manifest.json' /> enabling browser PWA install criteria"
    - "index.html includes mobile-web-app-capable and apple-mobile-web-app-capable standalone meta tags to eliminate the browser URL bar on iOS and Android"
    - "index.html viewport specifies viewport-fit=cover and device scale bounds for edge-to-edge full-screen native presentation"
    - "manifest.json specifies id, scope '/', start_url '/', display 'standalone', and display_override ['window-controls-overlay', 'standalone', 'minimal-ui']"
    - "CSS incorporates env(safe-area-inset-*) and overscroll-behavior-y: none for notch and edge-to-edge immersion"
    - "PwaInstallPrompt provides a one-click native installation trigger with beforeinstallprompt handling and iOS Add-to-Home-Screen guidance"
    - "All unit tests pass and verify the PWA installation workflow"
  artifacts:
    - client/index.html
    - client/public/manifest.json
    - client/src/index.css
    - client/src/hooks/usePwaInstall.ts
    - client/src/components/common/PwaInstallPrompt.tsx
    - client/src/components/common/__tests__/PwaInstallPrompt.test.tsx
  key_links:
    - "PwaInstallPrompt rendered in App.tsx"
---

<objective>
Configure SmartRoute for native-app PWA installation, hiding the browser URL bar and enabling full-screen edge-to-edge standalone display across Android, iOS, Windows, macOS, and Linux.

Purpose: Eliminate the browser address bar and web browser chrome so users experience SmartRoute as an authentic, full-screen installed desktop/mobile application.
Output: Updated index.html, calibrated manifest.json, safe-area CSS rules, PWA install prompt hook/component, and test suite.
</objective>

<execution_context>
@~/.gemini/antigravity/gsd-core/workflows/execute-plan.md
@~/.gemini/antigravity/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@client/index.html
@client/public/manifest.json
@client/src/index.css
@client/src/App.tsx
</context>

<tasks>
<task id="1" name="Update index.html with PWA manifest and standalone meta tags">
In `client/index.html`:
1. Link the manifest: `<link rel="manifest" href="/manifest.json" />`.
2. Add standalone mobile web app meta tags:
   - `<meta name="mobile-web-app-capable" content="yes" />`
   - `<meta name="apple-mobile-web-app-capable" content="yes" />`
   - `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />`
   - `<meta name="apple-mobile-web-app-title" content="SmartRoute" />`
   - `<meta name="application-name" content="SmartRoute" />`
3. Update viewport to `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />`.
4. Configure dual light/dark `theme-color` meta tags.
</task>

<task id="2" name="Calibrate manifest.json for standalone chromeless presentation">
In `client/public/manifest.json`:
1. Set `"id": "/"` and `"scope": "/"` so navigation within the app never escapes the PWA scope.
2. Set `"start_url": "/"` with `"display": "standalone"`.
3. Set `"display_override": ["window-controls-overlay", "standalone", "minimal-ui"]`.
4. Set `"background_color": "#090D14"` and `"theme_color": "#059669"`.
5. Add app shortcuts for "Driver Cockpit" and "Dispatch Batches".
</task>

<task id="3" name="Add safe-area insets and overscroll protection in index.css">
In `client/src/index.css`:
1. Add safe-area padding rules for notched phones:
   `padding-top: env(safe-area-inset-top);`
   `padding-bottom: env(safe-area-inset-bottom);`
2. Add `overscroll-behavior-y: none;` on `:root` and `html` to prevent browser rubber-banding/pull-to-refresh while in app mode.
</task>

<task id="4" name="Build PwaInstallPrompt component and hook">
1. Create `client/src/hooks/usePwaInstall.ts`:
   - Listens for `beforeinstallprompt` event and saves the deferred prompt.
   - Detects standalone mode via `matchMedia('(display-mode: standalone)')` and `navigator.standalone`.
   - Exposes `isInstallable`, `isStandalone`, `isIOS`, and `installApp()`.
2. Create `client/src/components/common/PwaInstallPrompt.tsx`:
   - Renders a sleek floating prompt or banner in the bottom-right corner when in a browser (hidden when already installed/standalone).
   - Shows "Install App" button which triggers native OS install dialog, or iOS instructions tooltip.
3. Mount `PwaInstallPrompt` in `client/src/App.tsx`.
</task>

<task id="5" name="Verify with unit tests and typecheck">
1. Create `client/src/components/common/__tests__/PwaInstallPrompt.test.tsx` verifying prompt appearance, click handler, and dismissal.
2. Run `npm run test --workspace=client` (tsc --noEmit) and `npm run test:unit --workspace=client`.
</task>
</tasks>
