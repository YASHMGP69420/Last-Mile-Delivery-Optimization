# SmartRoute Frontend Component Guidelines & Design System

## 1. Directory Structure (`client/src/`)

```
client/src/
├── api/
│   └── client.ts             # Axios client with JWT interceptor & typed API endpoints
├── context/
│   └── AuthContext.tsx       # Auth provider, role flags, session renewal, demo profiles
├── types/
│   └── index.ts              # TypeScript domain interfaces matching backend models
├── components/
│   ├── common/               # Shared primitive UI components
│   │   ├── Button.tsx        # Styled button (primary, secondary, outline, danger, ghost, loading)
│   │   ├── Input.tsx         # Text/number inputs with label, icons, and error handling
│   │   ├── Modal.tsx         # Accessible overlay modal with title and action footer
│   │   ├── StatusBadge.tsx   # Stitch-colored status pills (DRAFT, READY, ASSIGNED, COMPLETED, etc.)
│   │   └── Drawer.tsx        # Slide-over drawer panel with header and custom widths
│   ├── layout/               # App layout shells
│   │   ├── AdminLayout.tsx   # Desktop shell (Sidebar + Header + Canvas)
│   │   ├── AdminSidebar.tsx  # Deep navy `#14243A` command sidebar with hub badge & nav items
│   │   ├── AdminHeader.tsx   # Sticky header with breadcrumb, live IST clock, system health
│   │   ├── DriverLayout.tsx  # Mobile-responsive driver container shell
│   │   ├── DriverHeader.tsx  # Driver mobile header with duty toggle and vehicle badge
│   │   └── DriverBottomNav.tsx # Mobile bottom navigation tabs
│   └── deliveries/           # Milestone 1 feature components
│       ├── ManifestTable.tsx # High-density 10-column parcel table with bulk selection
│       ├── BatchComposerPanel.tsx # Drawer with payload gauge and vehicle/driver allocation
│       ├── CsvImportModal.tsx # PapaParse drag-and-drop dry-run validator with error CSV download
│       └── ConsignmentDrawer.tsx # Waybill inspector with immutable AuditEvent fulfillment timeline
├── pages/
│   ├── LoginPage.tsx         # Stitch command login with quick-fill demo buttons
│   ├── DeliveriesPage.tsx    # Master delivery manifest operations page
│   ├── BatchesPage.tsx       # Operational clusters & dispatch runs overview
│   └── DriverHomePage.tsx    # Driver active shift dashboard & next stop card
├── App.tsx                   # React Router route definitions & role guards
├── main.tsx                  # Vite React 18 DOM mount point
└── index.css                 # Tailwind directives & Inter typography base styles
```

---

## 2. Design Tokens & Google Stitch Aesthetic Mapping

| Token Name | Hex Code | Utility / Context | Tailwind Class |
|---|---|---|---|
| `primary` | `#14243A` | Deep Navy: Command bars, primary sidebar, master headers | `bg-primary`, `text-primary` |
| `primary-hover` | `#1E3557` | Hover state for primary buttons and nav items | `hover:bg-primary-hover` |
| `secondary` | `#0051D5` | Electric Blue: Interactive buttons, active vectors, selection rings | `bg-secondary`, `text-secondary` |
| `surface` | `#FAF8FF` | Ergonomic low-glare dashboard canvas background | `bg-surface` |
| `surface-lowest` | `#FFFFFF` | Card shells, table row backgrounds, modal bodies, slide-overs | `bg-surface-lowest` |
| `surface-low` | `#F2F3FF` | Table header bars, bento sub-panels, input accents | `bg-surface-low` |
| `outline-variant` | `#C5C6CD` / `#E2E8F0` | Subtle card dividers and table grid rules | `border-outline-variant` |
| `on-surface` | `#131B2E` | High-contrast dark text for headings and primary metrics | `text-on-surface` |
| `on-surface-variant` | `#44474D` | Subheaders, meta tags, table header labels | `text-on-surface-variant` |
| `success` | `#16A34A` | Completed deliveries, active GPS, valid dry-run status | `bg-success`, `text-success` |
| `warning` | `#F59E0B` | Delayed deliveries, approaching SLA window alerts | `bg-warning`, `text-warning` |
| `error` | `#BA1A1A` | Exceptions, unassigned payload alerts, failed CSV rows | `bg-error`, `text-error` |

---

## 3. Typography & Tabular Figures (`tnum`)

- **Font Family:** `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Tabular Figures Rule:** All dynamic metrics (cargo weights in `kg`, volumes in `m³`, GPS coordinates, time windows, and tracking IDs) **must** utilize the class `tabular-nums` / `font-mono` to prevent layout jitter during data updates.

---

## 4. Component Usage Guidelines

### `ManifestTable`
- Provides 10 columns: Checkbox, Order Reference, Consignee & Phone, Destination Address & Zone, Weight (kg), Volume (m³), Time Window, Priority, Status, Actions.
- When rows are selected, renders an automatic bulk command bar displaying count, aggregated cargo payload weight, and a direct trigger to open `BatchComposerPanel`.

### `BatchComposerPanel`
- Evaluates total weight against the assigned vehicle's `capacityKg`.
- Visual progress bar transitions:
  - `< 80%`: Blue (`bg-secondary`)
  - `80% - 100%`: Amber (`bg-amber-500`)
  - `> 100%`: Red (`bg-red-500`) with overload warning.

### `CsvImportModal`
- Powered by client-side PapaParse.
- Two-phase execution:
  1. Dry-run mode (`dryRun: true`): Parses file without writing to DB, validates required headers, formats, and duplicates.
  2. If errors occur, displays a row-level error table with line numbers and enables the "Download Error CSV" button.
  3. Commit mode (`dryRun: false`): Only enabled when errors are 0 and valid rows $> 0$. Commits deliveries to `DRAFT` status.

### `ConsignmentDrawer`
- Shows complete waybill attributes: consignee contact (with clickable `tel:` links), street address, GeoJSON coordinates, and package dimensions.
- Displays an immutable, reverse-chronological timeline of `AuditEvent` entries showing every state transition with actor names, roles, and timestamps.
