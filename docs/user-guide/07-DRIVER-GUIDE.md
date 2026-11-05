# SmartRoute – Delivery Driver User Guide

This guide is written in straightforward language for delivery drivers operating the SmartRoute Mobile Application (`/driver`).

---

## 1. Logging In

1. Open your smartphone browser and go to:
   `http://localhost:5174/login`
2. Enter your driver credentials:
   - **Email**: `driver@example.com`
   - **Password**: `driver123`
   - *Or tap the **Driver** quick-login button*.
3. The app will immediately open your **Driver Home & Shift Screen**.

---

## 2. Driver Header & Status Controls

At the top of the mobile screen, you will see:
* **Duty Status Pill**: Tap **On Duty / Off Duty** to signal dispatch that you are ready to receive or execute routes.
* **Vehicle Badge**: Shows your assigned delivery vehicle (e.g., `Tata Ace EV` or `Mahindra Treo`).
* **Battery / Fuel Indicator**: Shows vehicle charge percentage.
* **Theme Toggle (Sun/Moon icon)**: Tap to toggle between high-visibility daylight mode and dark night mode to reduce glare during evening shifts.

---

## 3. Navigating to Your Next Stop

1. Your current target delivery is pinned prominently on the **Active Stop Card**.
2. Review the recipient details:
   - **Customer Name & Phone**: Tap the phone icon to call the customer directly if needed.
   - **Delivery Address**: Street, zone, and landmarks.
   - **Order Reference**: Package barcode / reference number (e.g., `#BBSR-024`).
   - **Priority**: Displays if the package is Standard, Urgent, or Cold Chain.
3. Tap **"Navigate in Google Maps"**:
   - Google Maps opens with turn-by-turn driving directions to the customer's exact location.
4. Drive to the destination.

---

## 4. Completing a Delivery (Proof of Delivery - POD)

When you arrive at the customer location:
1. Return to SmartRoute and tap **"Mark as Delivered"**.
2. The **Proof of Delivery Modal** will open with verification requirements:
   * **Customer OTP**: Request the 4-digit secret OTP sent to the customer's phone and type it in.
   * **Digital Signature**: Hand your phone to the recipient to sign on the interactive signature canvas, or sign on their behalf.
   * **Photo Evidence**: Click **Choose File** to attach a photo of the parcel placed safely at the doorstep.
   * **Cold Chain Check**: If the parcel is marked Cold Chain, check the box confirming package seal temperature integrity.
3. Tap **"Confirm Delivery"**:
   - The delivery status updates to `COMPLETED`.
   - The app automatically advances to your next stop in sequence!

---

## 5. Reporting Delivery Exceptions (Failed Deliveries)

If you cannot deliver a package (e.g., customer is not home, gate locked, address wrong):
1. On the active stop card, tap **"Report Issue"**.
2. The **Delivery Exception Modal** opens.
3. Select the actual reason from the dropdown:
   - `CUSTOMER_UNAVAILABLE` (Customer not at address / phone unanswered)
   - `WRONG_ADDRESS` (Address does not exist or incorrect location)
   - `ACCESS_RESTRICTED` (Gated community access denied)
   - `DAMAGED_PACKAGE` (Packaging damaged in transit)
   - `TIME_EXPIRED` (Business hours closed)
   - `VEHICLE_BREAKDOWN` (Vehicle mechanical or flat tire issue)
   - `OTHER`
4. Add brief explanatory notes in the text box.
5. Tap **"Submit Exception"**:
   - The package is marked `FAILED` with your reason code and notes.
   - Dispatch is alerted, and the app advances to your next reachable stop.

---

## 6. Ending Your Shift & Logging Out

1. When all stops are completed, your screen displays:
   `All Route Stops Completed! Returning to Rasulgarh Depot.`
2. Return to the central depot and unload any undelivered packages.
3. Tap the **Profile / Settings** icon in the bottom navigation bar and tap **Logout**.
