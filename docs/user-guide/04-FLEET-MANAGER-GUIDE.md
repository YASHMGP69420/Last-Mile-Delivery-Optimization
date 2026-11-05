# SmartRoute – Fleet Manager & Dispatcher Guide

This guide is designed for Dispatchers and Fleet Managers (`FLEET_MANAGER` and `ADMIN` roles). It walks through daily operations: creating deliveries, composing batches, managing fleet assets, optimizing routes, and dispatching vehicles.

---

## 1. Daily Operational Workflow

```mermaid
flowchart LR
    A[1. Ingest Deliveries\n(Manual or Bulk CSV)] --> B[2. Compose Batch\n(Date & Hub Cluster)]
    B --> C[3. Pair Fleet & Drivers\n(1:1 Mutual Exclusivity)]
    C --> D[4. Run 2-Opt Optimization\n(EV Preference & TSP)]
    D --> E[5. Review Savings & Dispatched\n(Push to Driver App)]
```

---

## 2. Ingesting Deliveries

### Method A: Single Consignment Creation
1. Navigate to **Deliveries Manifest** (`/admin/deliveries`).
2. Click **New Delivery** in the top action bar.
3. Fill in the required fields:
   - **Order Reference**: Unique tracking identifier (e.g., `#BBSR-1092`).
   - **Customer Name & Phone**: e.g., `Ananya Sen`, `+91 94370 88888`.
   - **Street Address & Zone**: e.g., `Plot 45, Infocity Avenue, Patia (Z-1)`.
   - **Weight (kg)**: Consignment payload weight (must be $> 0$).
   - **Priority**: Select between `Standard`, `Urgent`, or `Cold Chain`.
   - **Time Window**: e.g., `09:00` to `12:00`.
4. Click **Create Delivery**.

### Method B: Bulk CSV Manifest Import
1. In the Deliveries page, click **Import CSV**.
2. Click **Load Sample CSV** to inspect expected column headers:
   ```csv
   orderReference,customerName,customerPhone,street,zone,city,postalCode,lat,lng,weightKg,priority,timeWindowStart,timeWindowEnd
   #BBSR-201,Rajesh Dash,+91 94370 11111,Plot 12 Forest Park,Saheed Nagar (Z-3),Bhubaneswar,751009,20.2745,85.8321,12.5,Standard,09:00,13:00
   ```
3. Upload a file or paste plaintext CSV directly into the editor.
4. Toggle **Dry Run Only** to validate syntax and coordinate constraints without database writes.
5. Uncheck Dry Run and click **Commit CSV Import** to persist the consignments in `DRAFT` status.

---

## 3. Creating & Managing Operational Batches

1. Navigate to **Operational Batches** (`/admin/batches`).
2. Click **New Batch**.
3. Enter:
   - **Batch Code**: e.g., `BBSR-EXP-02`.
   - **Batch Name**: e.g., `Morning Suburban Express Dispatch`.
   - **Operating Date**: Today's delivery schedule.
   - **Depot**: Select canonical hub (e.g., `Rasulgarh Logistics Hub`).
4. Select the eligible delivery consignments to include in this dispatch run.
5. Click **Create Delivery Batch**.

---

## 4. Vehicle & Driver Management

### Registering Fleet Vehicles
1. Navigate to **Fleets** (`/admin/fleets`).
2. Click **Register Vehicle** and configure:
   - **License Plate**: e.g., `OD-02-AX-9901`.
   - **Make / Model**: e.g., `Tata Ace Gold Diesel`.
   - **Vehicle Type**: `Van`, `Truck`, or `Bike`.
   - **Capacity (kg)**: Payload limit (e.g., `750` kg).
   - **Fuel Type**: `Electric`, `Diesel`, or `Petrol`.
   - **Efficiency**: `kmPerLitre` for combustion or `energyKWhPerKm` for EV.
3. Click **Register Vehicle**.

### Bulk CSV Vehicle Import
1. In the Fleets tab, click **Import CSV**.
2. Expected columns: `vehicleId,makeModel,type,capacityKg,fuelType,kmPerLitre`.
3. Perform dry-run validation and commit vehicles.

### Driver Onboarding & Vehicle Assignment
1. Navigate to **Drivers** (`/admin/drivers`).
2. Click **Onboard Driver** to register credentials, commercial driving license number, and mobile contact.
3. Use **Import CSV** for bulk driver onboarding with format:
   `name,email,phone,licenseNumber,password`
4. **1:1 Vehicle Mutual Exclusivity**:
   - Click the **Assign Vehicle** button next to an active driver.
   - Select an available vehicle.
   - The system automatically links the driver to the vehicle and updates vehicle availability to `ASSIGNED`.
   - Reassigning or unassigning automatically returns the former vehicle to `AVAILABLE` status.

---

## 5. Executing Route Optimization & Dispatch

1. Navigate to **Route Optimizer** (`/admin/optimizer`).
2. In the top action bar, select your target **Delivery Batch** from the dropdown.
3. Review the un-optimized stop sequence on the left control panel.
4. Select optimization preferences:
   - **Strategy Preset**: `Balanced`, `Fastest`, `Economical`, or `Custom`.
   - **Traffic Scenario**: `Morning Rush` (1.8x), `Evening Peak` (2.2x), `Free Flow` (1.0x), `Monsoon Rain` (1.5x), or `Weekend` (1.1x).
   - **Vehicle Propulsion Preference**: `EV Preferred` or `Cost Optimal`.
   - **Max Iterations**: Default `1000`.
5. Click **Run AI Optimization**.
6. Review the results:
   - **Interactive Map**: Sequenced numbered waypoint pins and connecting road polylines.
   - **Impact Metrics Bar**: Total distance reduction (%), fuel savings in ₹, and $\text{CO}_2$ avoided.
   - **Route Comparison**: Click **Compare** to view side-by-side tables comparing baseline Nearest Neighbor against optimized 2-Opt.
7. Click **Dispatch Route**:
   - Confirm selected vehicle and paired driver.
   - Click **Confirm Dispatch**.
   - The route transitions to `DISPATCHED`, deliveries lock into `ASSIGNED`, and the route is pushed to the driver's mobile view.
