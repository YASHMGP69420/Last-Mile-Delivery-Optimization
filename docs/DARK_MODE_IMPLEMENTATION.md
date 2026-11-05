# SmartRoute – Dark & Light Mode Theme Implementation

**Feature Overview**:
SmartRoute features a complete, centralized Dark Mode / Light Mode / System-Default theming system supporting daylight dispatch operations and low-glare nighttime delivery execution.

---

## 1. Architecture & Design Tokens

Theme state is managed through a centralized React Context:
* **Context**: `client/src/context/ThemeContext.tsx`
* **Modes**:
  1. `light`: High-contrast daylight theme.
  2. `dark`: Low-glare night cockpit theme with deep slate surfaces.
  3. `system`: Automatically matches OS color-scheme preference (`prefers-color-scheme: dark`).
* **Storage**: Preference is stored in `localStorage.getItem('smartroute-theme')`.
* **DOM Application**: Updates `document.documentElement` class list (`dark`) and sets `data-theme="dark" | "light"`.

### CSS Token Mapping (`client/src/index.css` & `client/tailwind.config.js`):

```css
:root, [data-theme="light"] {
  --color-surface-canvas: #FAF8FF;
  --color-surface-lowest: #FFFFFF;
  --color-surface-low: #F4F6FB;
  --color-surface-container: #EAEDF8;
  --color-on-surface: #111827;
  --color-on-surface-variant: #4B5563;
  --color-outline-variant: #E5E7EB;
}

.dark, [data-theme="dark"] {
  --color-surface-canvas: #0B0F19;
  --color-surface-lowest: #111827;
  --color-surface-low: #1F2937;
  --color-surface-container: #263345;
  --color-on-surface: #F9FAFB;
  --color-on-surface-variant: #9CA3AF;
  --color-outline-variant: #374151;
}
```

---

## 2. Component Integration

The `<ThemeToggle />` component is deployed across:
1. **Admin Header** (`AdminHeader.tsx`): 3-option segmented pill toggle in the navigation header.
2. **Driver Mobile Header** (`DriverHeader.tsx`): Single-tap icon-only toggle designed for one-handed mobile switching.
3. **Login Screen** (`LoginPage.tsx`): Floating corner toggle allowing users to choose their theme prior to logging in.
4. **All Interactive Surfaces**: Tables, Modals, Drawers, Inputs, and Badges automatically adapt based on CSS variable inheritance.
