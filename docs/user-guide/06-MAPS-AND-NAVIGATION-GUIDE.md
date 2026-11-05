# SmartRoute – Maps & Google Maps Navigation Guide

This guide explains how map rendering, geocoding, waypoint markers, and external Google Maps navigation links work across SmartRoute.

---

## 1. Map Canvas & Tile Providers

SmartRoute features an embedded, interactive GIS map canvas powered by **Leaflet** and **React-Leaflet**:

* **Tile Provider Hierarchy**:
  1. **Primary**: Geoapify Vector/Raster Tiles (`https://maps.geoapify.com/v1/tile/osm-bright/...`) using high-contrast urban styling.
  2. **Automatic Fallback**: OpenStreetMap standard tile servers (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`).
* **Map Controls**:
  - Pan and scroll-to-zoom.
  - Automatic `FitBounds`: Automatically centers and scales the viewport to encompass all stops and connecting polylines.
  - Interactive Popups: Clicking any waypoint pin reveals the stop sequence number, customer name, order reference, and street address.

---

## 2. Geocoding & Coordinate Normalization

All delivery locations use standard WGS-84 geographic coordinates:

* **GeoJSON Standard**: `coordinates: [longitude, latitude]` (e.g., `[85.8245, 20.2961]`).
* **Normalization**: The backend MatrixBuilder normalizes coordinates to 5 decimal places ($\approx 1.1\text{ meter}$ precision).
* **Missing Geocodes**: If a consignment CSV row lacks geographic coordinates, the backend geocoder attempts to resolve the address or falls back safely to the canonical depot location.

---

## 3. Road Polyline Visualization

* **Baseline Route**: Displays straight or greedily ordered segments connecting depot to stops.
* **Optimized Route**: Renders a closed-loop blue polyline (`#2563eb`) starting from the depot, progressing through all stops in sequence order, and returning to the depot.

---

## 4. Google Maps Turn-by-Turn Deep Links

SmartRoute bridges the gap between algorithmic route planning and real-world driver navigation by generating standards-compliant Google Maps Universal URLs:

### Single Stop Navigation
Used in the Driver Handheld App (`/driver`) to navigate to the immediate next destination:
```text
https://www.google.com/maps/dir/?api=1&destination=LATITUDE,LONGITUDE&travelmode=driving
```
* Example: `https://www.google.com/maps/dir/?api=1&destination=20.3245,85.8189&travelmode=driving`
* Launches the native Google Maps app on Android / iOS or the Google Maps web interface on desktop.

### Full Route Tour Navigation
Used in the Route Optimizer cockpit (`/admin/optimizer`) via the **"Open in Google Maps"** button:
```text
https://www.google.com/maps/dir/?api=1&origin=DEPOT_LAT,DEPOT_LNG&destination=DEPOT_LAT,DEPOT_LNG&waypoints=STOP1_LAT,STOP1_LNG|STOP2_LAT,STOP2_LNG|...&travelmode=driving
```

> [!NOTE]
> **Waypoint Limitations**: Google Maps URLs accept up to 10 waypoints in standard browser links. For larger batches ($>10$ stops), SmartRoute automatically chunks stops or generates sequential leg links.
