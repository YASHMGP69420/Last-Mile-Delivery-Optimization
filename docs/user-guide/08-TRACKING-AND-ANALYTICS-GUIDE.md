# SmartRoute – Tracking, Telemetry & Analytics Guide

This guide details how live fleet tracking, GPS telemetry synchronization, operations analytics, and executive KPI reporting work in SmartRoute.

---

## 1. Live Telemetry & Tracking Cockpit (`/admin/tracking`)

The Live Telemetry cockpit provides dispatchers with a real-time GIS map and active vehicle directory:

### Key Capabilities:
* **Active Vehicle Directory**:
  - Displays all registered vehicles categorized by availability: `AVAILABLE`, `ASSIGNED`, `IN_TRANSIT`, `MAINTENANCE`.
  - Shows assigned driver names, vehicle make/models, battery/fuel status, and capacity utilization.
* **Interactive GIS Map**:
  - Live vehicle location markers color-coded by operational status:
    - 🟢 **Green**: Available / Idle in cluster.
    - 🔵 **Blue**: Assigned to dispatched route.
    - 🟠 **Amber**: Currently in transit between stops.
    - 🔴 **Red**: Maintenance or out of service.
* **Cluster Density Analysis**:
  - Displays active distribution concentration across key urban zones (e.g., Patia Z-1, Jaydev Vihar Z-2, Saheed Nagar Z-3, Rasulgarh Hub).

---

## 2. Operations Analytics Dashboard (`/admin/analytics`)

The Operations Analytics dashboard computes executive KPIs from persistent MongoDB records:

### 6 Executive KPI Tiles:
1. **Total Deliveries**: Count of all parcels managed across batches.
2. **Success Completion Rate**:
   $$\text{Completion Rate (\%)} = \left(\frac{\text{Deliveries}_{\text{COMPLETED}}}{\text{Deliveries}_{\text{TOTAL}}}\right) \times 100$$
3. **On-Time SLA Delivery Rate**:
   $$\text{On-Time Rate (\%)} = \left(\frac{\text{Deliveries delivered within timeWindow}}{\text{Deliveries}_{\text{COMPLETED}}}\right) \times 100$$
4. **Fleet Fuel Cost Savings (₹)**: Cumulative monetary savings achieved through 2-Opt local search distance reduction and EV preference allocation.
5. **Tailpipe $\text{CO}_2$ Avoided (kg)**: Environmental carbon offset computed from EV route legs and reduced kilometer traversal.
6. **Active Fleet Vehicles**: Count of operational assets currently in service.

### Visual Breakdowns:
* **Urban Zone Distribution**: Bar chart comparing parcel volume across Bhubaneswar distribution zones.
* **Propulsion Mix**: Pie chart illustrating proportion of fleet operating on Electric (EV) vs Diesel vs Petrol.
* **CSV Report Export**: Click **Export Analytics CSV** in the top action bar to download a full CSV report of completed deliveries and operational metrics for external BI analysis.
