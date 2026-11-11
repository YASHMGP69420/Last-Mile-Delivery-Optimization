---
type: quick
slug: smartroute-favicon
date: 2026-11-10
status: executing
---

# Quick Task: SmartRoute Brand Favicon

Replace the leftover Vite purple lightning-bolt favicon (`client/public/favicon.svg`) and manifest icon reference with the official SmartRoute emblem (emerald rounded-square badge `#10b981` → `#059669` with crisp white `Route` glyph matching `AdminHeader`, `DriverHeader`, and `LoginPage`).

## Tasks
1. Replace `client/public/favicon.svg` with the clean SmartRoute SVG emblem.
2. Update `client/public/manifest.json` so maskable/PWA icons also resolve to `favicon.svg` with `#059669` theme color.
3. Add `apple-touch-icon` and `theme-color` meta tags to `client/index.html`.
4. Verify via `npm --prefix client run build` (confirming `dist/favicon.svg` is emitted cleanly) and commit + push directly to `origin/master`.
