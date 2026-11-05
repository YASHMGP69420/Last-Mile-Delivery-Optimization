# SmartRoute Driver HUD / Driver Cockpit Guide

## 1. Overview & Mobile-First Philosophy

The **Driver HUD** (Driver Cockpit) is a dedicated, map-centric mobile interface engineered for last-mile delivery couriers operating in the field. Unlike administrative dashboards, the Driver HUD is optimized for:
- Large touch targets and high-contrast sunlight visibility.
- Minimal data entry to prevent distracted driving.
- Rapid turn-by-turn navigation via Leaflet OSM and one-click Google Maps handoff.
- Authoritative server-side shift attendance tracking.
- Pre-trip roadworthiness vehicle safety checklists.
- Electronic Proof of Delivery (POD) capture (signatures, photos, notes, OTP).
- Offline emergency assistance.

---

## 2. Navigation Architecture

The Driver HUD operates with a persistent 5-tab mobile bottom navigation bar:

```
[ Cockpit ]    [ My Route ]    [ Orders ]    [ Vehicle ]    [ Profile ]
  /driver      /driver/route  /driver/del.. /driver/veh..  /driver/prof..
```

| Navigation Tab | Route | Primary Field Operations |
| :--- | :--- | :--- |
| **Cockpit** | `/driver` | Shift clock-in/out, daily KPIs, vehicle check badge, active route banner |
| **My Route** | `/driver/route` | Interactive Leaflet road map, next stop card, Google Maps launcher, stop drawer |
| **Orders** | `/driver/deliveries` | Manifest tabs (All, Pending, In Transit, Completed, Failed), customer call button |
| **Vehicle** | `/driver/vehicle-check` | Pre-trip 8-point inspection checklist, odometer & fuel/battery readings |
| **Profile** | `/driver/profile` | Driver credentials, lifetime on-time percentage, incident hotline, appearance toggle |

---

## 3. Daily Courier Workflow

### Phase 1: Shift Clock-In & Pre-Trip Vehicle Inspection
1. Log in to SmartRoute with driver credentials.
2. Navigate to **Cockpit** (`/driver`).
3. Click **Clock In & Start Shift**.
4. Review the **Assigned Vehicle** card. If the pre-trip check is pending, tap **Perform Pre-Trip Check**.
5. Inspect the vehicle across the 8 safety points:
   - *Brakes* (Critical)
   - *Tyres* (Critical)
   - *Headlights & Brake Lights* (Critical)
   - *Commercial Registration Documents* (Critical)
   - *Turn Indicators, Mirrors, Horn, Body Condition*
6. Enter current odometer reading and battery SoC / fuel percentage.
7. Tap **Submit Pre-Trip Safety Sign-off**.
   > **Safety Rule**: If any critical item is marked `ATTENTION`, the vehicle is automatically suspended to `MAINTENANCE` and blocked from departure.

### Phase 2: Route Execution & Turn-by-Turn Navigation
1. Once your dispatcher assigns a batch, the **Active Dispatched Route** card appears on the Cockpit.
2. Tap **Start / Resume Route** to enter `/driver/route`.
3. The interactive map renders the sequenced delivery path starting from the Rasulgarh Hub.
4. For the current active stop, tap **Google Maps** to launch external GPS turn-by-turn navigation on your mobile device.
5. Upon reaching the customer address, tap **Mark Arrived**.

### Phase 3: Proof of Delivery (POD) & Exception Handling
1. Tap **Verify POD** to enter `/driver/deliveries/:id`.
2. Enter the recipient name.
3. If an OTP is configured, enter the 4-digit customer SMS code.
4. Tap **Digital Signature** to capture the customer's on-glass signature.
5. Tap **Attach Doorstep Photo** for visual handover proof.
6. Tap **Confirm Proof of Delivery (POD)**. The delivery status is updated to `COMPLETED` and the map automatically navigates to the next sequenced consignment.
7. **If Delivery Fails**: Select the **Report Delivery Exception** tab, select the reason (e.g., `CUSTOMER_UNAVAILABLE`, `WRONG_ADDRESS`), enter mandatory field notes, and submit. The dispatcher is notified immediately.

### Phase 4: Incident Reporting & Emergency Hotline
- If a breakdown, waterlogging obstruction, or accident occurs, open `/driver/support`.
- Offline emergency numbers (Police 112, Ambulance 108, Hub Dispatch +91 674 258 0100) are always accessible without mobile data.
- Submit an incident report with severity level to alert dispatch.

### Phase 5: Ending Shift
1. Return to the Cockpit (`/driver`).
2. Tap **End Shift**.
3. If all consignments are completed, shift clocks out immediately.
4. If incomplete deliveries remain, a **Handover Notes** prompt requires documenting relief driver details before clock-out is permitted.
