# SmartRoute – Troubleshooting Guide

This guide documents common issues, error codes, root causes, and verified recovery procedures for SmartRoute.

---

## 1. Authentication & Session Issues

### Error: `401 INVALID_CREDENTIALS`
* **Symptom**: "Invalid email or password" error banner on login screen.
* **Cause**: Incorrect password, or user account not seeded.
* **Resolution**:
  1. For local development, click the **Admin**, **Dispatcher**, or **Driver** quick-login shortcut buttons.
  2. Verify credentials: Admin (`admin@example.com` / `admin123`), Dispatcher (`manager@example.com` / `manager123`), Driver (`driver@example.com` / `driver123`).
  3. Re-run seed script: `npm --prefix server run seed`.

### Error: `403 FORBIDDEN`
* **Symptom**: "Access forbidden: insufficient role permissions".
* **Cause**: A Driver attempted to access an Admin/Fleet Manager endpoint, or a Dispatcher attempted Admin user provisioning.
* **Resolution**: Log out and authenticate with the appropriate role (`ADMIN` for user creation, `FLEET_MANAGER` or `ADMIN` for routes and fleet operations).

---

## 2. Route Optimization & Planning Issues

### Error: `400 NO_DELIVERIES_TO_OPTIMIZE`
* **Symptom**: "Batch contains no eligible deliveries for route optimization".
* **Cause**: Selected delivery batch has 0 consignments, or all deliveries in the batch are already terminal (`COMPLETED` or `FAILED`).
* **Resolution**: Navigate to **Operational Batches**, open the batch, and add consignments in `DRAFT` or `READY` status.

### Error: `400 NO_VEHICLES_AVAILABLE`
* **Symptom**: "No eligible fleet vehicles found for route optimization".
* **Cause**: All registered vehicles are in `RETIRED` or `MAINTENANCE` status.
* **Resolution**: Go to **Fleets**, edit a vehicle, and set its availability back to `AVAILABLE`.

### Error: `All deliveries exceeded fleet capacity constraints`
* **Symptom**: Optimization completes with 0 routes and all consignments listed in `unassignedDeliveries`.
* **Cause**: Parcel weights exceed the maximum capacity of all available vehicles (e.g., a 1500 kg consignment assigned to an 80 kg bike).
* **Resolution**: Add larger capacity vehicles (e.g., 1000 kg Van or Truck) in Fleet Management or reduce package weights.

---

## 3. Map & Navigation Issues

### Map Shows Blank Grid / Tiles Not Loading
* **Symptom**: Map canvas shows light gray background or missing tile images.
* **Cause**: Geoapify API key expired or network blocked.
* **Resolution**:
  1. SmartRoute includes an automatic fallback to standard OpenStreetMap tiles (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`).
  2. Ensure client has internet connectivity to reach tile servers.
  3. Verify `VITE_GEOAPIFY_TILE_API_KEY` in `client/.env`.

### Stops Not Showing on Map
* **Symptom**: Optimization succeeds, but pins do not appear on map.
* **Cause**: Geocode coordinates were missing or improperly structured.
* **Resolution**: All stop coordinates are normalized by SmartRoute to `[longitude, latitude]`. Check that consignment CSVs provide valid numerical decimal degrees (e.g., `lat: 20.2961, lng: 85.8645`).

---

## 4. Database & Backend Service Issues

### Error: `MongoServerError: connect ECONNREFUSED 127.0.0.1:27017`
* **Symptom**: Backend crashes on startup or health check fails with 503.
* **Cause**: Local MongoDB service is stopped.
* **Resolution**:
  - Windows: Run `Start-Service -Name MongoDB` in PowerShell.
  - Linux/Mac: Run `sudo systemctl start mongod` or `brew services start mongodb-community`.
  - Check `http://localhost:5004/api/v1/health/ready` to verify `database: CONNECTED`.
