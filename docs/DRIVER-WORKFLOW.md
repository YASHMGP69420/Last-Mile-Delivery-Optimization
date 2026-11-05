# SmartRoute Driver Operational Workflow & Field Guide

```
+-----------------------------------------------------------------------+
|                       DAILY DRIVER FIELD WORKFLOW                     |
+-----------------------------------------------------------------------+
                                  |
                                  v
                      +-----------------------+
                      | 1. Login & Shift Start|
                      |   Clock In on Cockpit |
                      +-----------------------+
                                  |
                                  v
                      +-----------------------+
                      | 2. Pre-Trip Checklist |
                      |  8-Point Safety Check |
                      +-----------------------+
                                  |
                     Pass? -------+------- Critical Failure?
                       |                           |
                       v                           v
             +--------------------+      +--------------------+
             | 3. Receive Route   |      | Vehicle Grounded   |
             | Batch Assigned     |      | Status=MAINTENANCE |
             +--------------------+      | Dispatch Alerted   |
                       |                 +--------------------+
                       v
             +--------------------+
             | 4. Field Navigation|
             | Leaflet Map / GMaps|
             +--------------------+
                       |
                       v
             +--------------------+
             | 5. Arrive at Stop  |
             | Mark Arrived       |
             +--------------------+
                       |
             Successful? -+-- Unreachable / Refused?
                 |                       |
                 v                       v
      +---------------------+   +---------------------+
      | 6. Proof of Delivery|   | 7. Report Failure   |
      | Recipient, OTP, POD |   | Dropdown Reason &   |
      | Signature & Photo   |   | Mandatory Notes     |
      +---------------------+   +---------------------+
                 |                       |
                 +-----------+-----------+
                             |
                             v
                  [ Next Sequenced Stop ]
                             |
                   All Stops Resolved?
                             |
                             v
                +-------------------------+
                | 8. Return to Depot      |
                | Clock Out & End Shift   |
                +-------------------------+
```

## Step-by-Step Instructions

1. **Start Shift**: Open the app, navigate to **Cockpit**, tap **Clock In & Start Shift**.
2. **Safety Inspection**: Before driving, inspect brakes, tyres, headlights, indicators, mirrors, horn, cargo latching, and vehicle documents.
   - If all components are in good condition, submit as `PASS`.
   - If brakes, tyres, or lights are compromised, mark `ATTENTION`. The system will ground the vehicle immediately for your safety.
3. **Review Assigned Route**: When dispatched, tap **Start / Resume Route**. Follow the numbered markers sequenced by the optimization algorithm.
4. **Navigate to Customer**: Tap **Google Maps** on the active stop card to initiate voice-guided navigation.
5. **Mark Arrived**: When arriving at the address, tap **Mark Arrived**.
6. **Capture Proof of Delivery (POD)**:
   - Ask for customer name.
   - Enter SMS OTP (if applicable).
   - Have the customer sign on the mobile glass screen.
   - Take a doorstep verification photo.
   - Tap **Confirm Proof of Delivery**.
7. **Report Exception (if customer is unreachable)**:
   - Attempt a phone call by tapping the green telephone icon.
   - If unreachable after 2 attempts, select **Report Delivery Exception**.
   - Choose the appropriate reason code and enter brief explanatory notes.
8. **End Shift**: When returning to Rasulgarh Hub, tap **End Shift**. If consignments were handed over to a relief driver, enter handover notes.
