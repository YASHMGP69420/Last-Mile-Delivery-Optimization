# SmartRoute Driver HUD / Cockpit REST API Documentation

All Driver endpoints require an `Authorization: Bearer <TOKEN>` header with role `DRIVER` (or `ADMIN`/`FLEET_MANAGER` in simulation mode).

Base Path: `/api/v1/driver-hud`

---

## 1. Cockpit Dashboard

### `GET /api/v1/driver-hud/dashboard`
Returns driver profile, active shift status, assigned vehicle, active route summary, and today's metrics.

**Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "driver": {
      "id": "65e01234567890abcdef1111",
      "name": "Subrat Nayak",
      "licenseNumber": "OD-02-LIC-44821",
      "phone": "+91 98610 99999",
      "availability": "ON_DUTY",
      "rating": 4.9
    },
    "shift": {
      "id": "65e01234567890abcdef2222",
      "status": "IN_PROGRESS",
      "startTime": "08:15",
      "endTime": "18:00",
      "breakMinutes": 0
    },
    "vehicle": {
      "id": "65e01234567890abcdef3333",
      "registrationNumber": "OD-02-EV-1001",
      "type": "Van",
      "fuelType": "Electric",
      "status": "AVAILABLE"
    },
    "checklistCompleted": true,
    "activeRoute": {
      "id": "65e01234567890abcdef4444",
      "routeCode": "RT-BBSR-EXP-01",
      "status": "DISPATCHED",
      "totalStops": 15,
      "completedStops": 6,
      "remainingStops": 9
    },
    "metrics": {
      "assignedDeliveries": 15,
      "completedDeliveries": 6,
      "remainingStops": 9,
      "failedDeliveries": 0,
      "todayDistanceKm": 24.8,
      "currentRouteEta": "45 mins"
    }
  }
}
```

---

## 2. Shift & Attendance Tools

### `POST /api/v1/driver-hud/shifts/start`
Clocks in the driver, sets `DriverShift.status = 'IN_PROGRESS'`, and transitions driver to `ON_DUTY`.

### `POST /api/v1/driver-hud/shifts/break`
Toggles driver break state.
**Request Body**:
```json
{
  "onBreak": true,
  "breakDurationMinutes": 15
}
```

### `POST /api/v1/driver-hud/shifts/end`
Clocks out driver and marks shift `COMPLETED`. If incomplete deliveries remain on the active route, `handoverNotes` of at least 5 characters is mandatory.
**Request Body**:
```json
{
  "handoverNotes": "Handed over 3 remaining packages to relief driver at hub depot"
}
```

---

## 3. Pre-Trip Vehicle Safety Inspection

### `POST /api/v1/driver-hud/vehicle-check`
Submits 8-point roadworthiness check.
**Request Body**:
```json
{
  "vehicleId": "65e01234567890abcdef3333",
  "odometerReadingKm": 14250,
  "fuelOrBatteryLevelPercent": 92,
  "items": {
    "brakes": { "status": "PASS" },
    "tyres": { "status": "PASS" },
    "lights": { "status": "PASS" },
    "indicators": { "status": "PASS" },
    "mirrors": { "status": "PASS" },
    "horn": { "status": "PASS" },
    "bodyCondition": { "status": "PASS" },
    "documents": { "status": "PASS" }
  },
  "overallNotes": "Vehicle clean, tyres at 36 PSI"
}
```
> **Safety Guard**: Marking `brakes`, `tyres`, or `lights` as `NEEDS_ATTENTION` automatically transitions the vehicle to `MAINTENANCE` and triggers a high-severity alert to the Fleet Manager.

---

## 4. Route Navigation & Delivery Management

### `GET /api/v1/driver-hud/route`
Returns the driver's active route geometry, depot coordinates, road polyline coordinates, and populated stop consignments. Protected by Driver BOLA validation.

### `GET /api/v1/driver-hud/deliveries`
Query parameter: `status` (`ALL`, `PENDING`, `IN_TRANSIT`, `COMPLETED`, `FAILED`).
Returns all consignments assigned to the driver's active route.

### `GET /api/v1/driver-hud/deliveries/:id`
Returns single consignment details. Access restricted to the assigned driver.

### `POST /api/v1/driver-hud/deliveries/:id/arrived`
Marks courier arrival at customer doorstep. Updates delivery status to `OUT_FOR_DELIVERY` and route stop status to `ARRIVED`.

### `POST /api/v1/driver-hud/deliveries/:id/complete`
Submits Electronic Proof of Delivery (POD) and completes consignment.
**Request Body**:
```json
{
  "recipientName": "Ananya Patnaik",
  "otp": "4821",
  "signatureSvg": "<svg>signature_coordinates</svg>",
  "photoUrl": "https://smartroute.io/pod/photo1.jpg",
  "handoverNotes": "Handed directly to recipient at flat 402"
}
```

### `POST /api/v1/driver-hud/deliveries/:id/fail`
Reports delivery failure with mandatory reason code and notes.
**Request Body**:
```json
{
  "failureReason": "CUSTOMER_UNAVAILABLE",
  "failureNotes": "Door locked, attempted 2 phone calls with no response"
}
```

---

## 5. Field Incidents & Profile

### `POST /api/v1/driver-hud/incidents`
Reports roadside breakdown or route obstruction.
**Request Body**:
```json
{
  "category": "ROUTE_OBSTRUCTION",
  "severity": "HIGH",
  "description": "Rasulgarh underpass flooded; road impassable. Requesting alternate route.",
  "locationCoordinates": { "lat": 20.2961, "lng": 85.8645 }
}
```

### `GET /api/v1/driver-hud/profile`
Returns driver credentials, commercial license, assigned depot, and lifetime statistics:
- `totalCompletedDeliveries`
- `totalFailedDeliveries`
- `onTimeDeliveryPercentage`
- `completedRuns`
- `preTripInspectionsCompleted`
