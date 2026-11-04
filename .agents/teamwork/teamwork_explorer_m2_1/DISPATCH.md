## 2026-11-04T10:10:52Z
You are teamwork_explorer_m2_1, the M2 Mapping & Matrix Services Explorer.

**Working Directory**: c:\Users\Yash\Documents\ChatGPT\Last Mile Delivery Optimization\.agents\teamwork\teamwork_explorer_m2_1\
**Parent Conversation ID**: 5d522c47-7e56-40f7-90ed-36c6e7d271c1

**Your Mission**:
Investigate, map requirements, and design the complete technical implementation specification for the Mapping and Distance Matrix subsystem of Milestone 2.

**Mandatory Inputs to Read**:
1. `c:\Users\Yash\Documents\ChatGPT\Last Mile Delivery Optimization\.agents\teamwork\ORIGINAL_REQUEST.md` (Verbatim user requirements)
2. `c:\Users\Yash\Documents\ChatGPT\Last Mile Delivery Optimization\PROJECT.md` (Master architecture, Feature Inventory items 11-14, Code Layout, Interface Contracts)
3. `c:\Users\Yash\Documents\ChatGPT\Last Mile Delivery Optimization\docs\ALGORITHMS_GUIDE.md` (Distance matrix calculations, simulated traffic models, haversine & curvature adjustments)
4. `c:\Users\Yash\Documents\ChatGPT\Last Mile Delivery Optimization\docs\API_CONTRACTS.md` (Service layer contracts)
5. `server/src/seed/seedBhubaneswar.js` (Canonical geographical coordinates: Rasulgarh hub at 20.2961, 85.8645, and 5 delivery clusters: Saheed Nagar, Patia/KIIT, Khandagiri, Nayapalli, Old Town).

**Scope & Technical Requirements to Design**:
1. `server/src/services/mapping/googleMapsService.js`:
   - Google Distance Matrix API client with timeout, error handling, and quota backoff.
   - Fallback: When `GOOGLE_MAPS_API_KEY` is unset or API call fails, transparently fall back to `simulatedTrafficService.js`.
   - In-memory distance cache with TTL to eliminate redundant queries for identical coordinate pairs.
2. `server/src/services/mapping/simulatedTrafficService.js`:
   - Exact Haversine formula for spherical distance (Earth radius R = 6371 km).
   - Urban road curvature factor: multiply great-circle distance by 1.35x.
   - Base speed: 25 km/h for urban Bhubaneswar traffic.
   - 5 Realistic Traffic Scenarios with exact multipliers:
     - `FREE_FLOW`: 1.0x (duration = baseDuration * 1.0)
     - `MORNING_RUSH`: 1.8x (duration = baseDuration * 1.8)
     - `EVENING_PEAK`: 2.2x (duration = baseDuration * 2.2)
     - `MONSOON_RAIN`: 1.5x (duration = baseDuration * 1.5)
     - `WEEKEND`: 1.1x (duration = baseDuration * 1.1)
   - Function signatures matching `IMappingService.getDistanceMatrix(origins, destinations, options)`.
3. In-memory matrix cache:
   - Key: normalized coordinate hash `lat,lng:lat,lng:scenario`.
   - TTL: 1 hour.
   - Eviction / memory bounds to avoid leaks.
4. Unit and integration test specifications:
   - Define exact test cases for Haversine accuracy, curvature multiplier, 5 traffic scenario multipliers, cache hits vs misses, and fallback on missing API key.
