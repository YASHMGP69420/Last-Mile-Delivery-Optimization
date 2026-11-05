# SmartRoute – Frequently Asked Questions (FAQ)

### Q1: Does SmartRoute require an active internet connection to optimize routes?
**A**: No. While Geoapify is used as the primary external routing matrix provider when online with a valid key, SmartRoute embeds an autonomous, mathematical `simulatedTrafficService`. If Geoapify is unreachable, times out, or has an invalid key, the system automatically falls back to an exact Haversine model with a 1.35x urban road curvature factor, ensuring 100% offline development and zero blocked pipelines.

### Q2: What optimization algorithm does SmartRoute use?
**A**: SmartRoute uses a multi-tier pipeline:
1. **Tiered Best-Fit Decreasing (BFD)** bin packing for capacity allocation with EV propulsion preference.
2. **Greedy Nearest Neighbor (NN)** starting from the depot for initial TSP tour construction.
3. **Bounded 2-Opt Local Search** to untangle crossed edges. It strictly guarantees the mathematical invariant $D_{\text{optimized}} \le D_{\text{baseline}}$.

### Q3: How are fuel and carbon savings computed?
**A**: Each vehicle specifies its propulsion type (Electric, Diesel, Petrol) and consumption rate (`kmPerLitre` or `energyKWhPerKm`). When 2-Opt reduces total route distance and prioritizes EV allocation, SmartRoute computes exact savings in Indian Rupees (₹) and kilograms of $\text{CO}_2$ avoided using calibrated fuel prices (Diesel: ₹92.50/L, Petrol: ₹103.00/L, EV: ₹8.50/kWh).

### Q4: Can a single vehicle be assigned to multiple drivers simultaneously?
**A**: No. SmartRoute strictly enforces **1:1 Vehicle-Driver Mutual Exclusivity** at both the database level (unique indexes and Mongoose pre-save hooks) and the REST API controller level. Assigning a vehicle to Driver B automatically detaches Driver A and sets the former asset back to `AVAILABLE`.

### Q5: How do drivers navigate in the real world?
**A**: The driver app generates Universal Google Maps Navigation deep-links (`https://www.google.com/maps/dir/?api=1&destination=LAT,LNG&travelmode=driving`). Tapping "Navigate in Google Maps" opens the driver's native Google Maps app with live traffic and voice turn-by-turn guidance.

### Q6: How does Proof of Delivery (POD) prevent delivery disputes?
**A**: Every completed delivery requires:
1. Recipient verification OTP.
2. HTML5 touch signature saved as base64 PNG data.
3. Optional parcel doorstep photo evidence.
4. Tamper-verified GPS coordinates and ISO timestamp captured at the moment of submission.
5. Cold-chain seal temperature confirmation checkbox for refrigerated consignments.

### Q7: How do I switch themes?
**A**: Click the Theme Toggle in the top navigation bar (`AdminHeader`) or in the Driver Mobile Header. You can choose **Light**, **Dark**, or **Auto** (which follows your operating system's dark/light mode preference).
