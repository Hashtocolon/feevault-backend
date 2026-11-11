# ColdRoute Phase 1 (FTL) — Customer App API Specification

This document contains the verified API contracts for the Customer Mobile App, organized screen-by-screen.

---

## Screen 1: Splash & Welcome Screens
- **Status:** Static screens on client app.
- **APIs Needed:** None.

---

## Screen 2: Mobile Number Entry & OTP Verification

### 1. Send OTP (Initial & Resend)
- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/otp/send`
- **Description:** Sends a 6-digit OTP to a valid 10-digit Indian mobile number via SMS. Also used when customer taps **"Resend OTP"** after the cooldown timer expires.
- **Validations:**
  - `mobileNumber`: Must match Indian regex `^(\+91)?[6-9]\d{9}$` (10 digits starting with 6, 7, 8, or 9).
  - Rate limiting: Max 3 requests per 10 minutes per mobile number/IP.
- **Request Body:**
```json
{
  "mobileNumber": "+919876543210",
  "channel": "sms"
}
```
- **Response (202 Accepted):**
```json
{
  "otpSessionId": "otp_sess_98a72b",
  "expiresInSeconds": 300,
  "resendAvailableInSeconds": 30,
  "maskedDestination": "+91 98765 •••••"
}
```
- **Error Responses:**
  - `400 Bad Request`: `{"code": "INVALID_MOBILE", "message": "Enter a valid 10-digit Indian mobile number."}`
  - `429 Too Many Requests`: `{"code": "RATE_LIMITED", "message": "Too many OTP requests. Please wait 30 seconds."}`

---

### 2. Verify OTP
- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/otp/verify`
- **Description:** Verifies the 6-digit code. Validates if the user is a new user (routes to Profile Setup) or existing verified user (routes directly to Home Dashboard).
- **Validations:**
  - `code`: Exactly 6 numeric digits `^\d{6}$`.
  - `otpSessionId`: Valid and unexpired session reference.
- **Request Body:**
```json
{
  "mobileNumber": "+919876543210",
  "otpSessionId": "otp_sess_98a72b",
  "code": "123456",
  "deviceId": "dev_android_9021a"
}
```
- **Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "ref_88a91c...",
  "expiresIn": 3600,
  "user": {
    "id": "usr_c4819d",
    "mobileNumber": "+919876543210",
    "status": "active",
    "isProfileComplete": false,
    "hasConsent": false,
    "nextScreen": "profileSetup"
  }
}
```
> **Routing Logic for App:**
> - If `isProfileComplete: false` ➔ Navigate to **Profile Setup**.
> - If `isProfileComplete: true` and `hasConsent: true` ➔ Skip onboarding and navigate directly to **Home Dashboard**.

---

### 3. Refresh Auth Session Token
- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/refresh`
- **Description:** When the short-lived `accessToken` expires (e.g. after 1 hour), the mobile app silently calls this endpoint in the background with the long-lived `refreshToken` to get a fresh token pair without asking the user to log in again.
- **Validations:**
  - `refreshToken`: Must be a valid, unexpired, and non-revoked token hash matching the device session.
- **Request Body:**
```json
{
  "refreshToken": "ref_88a91c7a52b1...",
  "deviceId": "dev_android_9021a"
}
```
- **Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "ref_new_77b21e...",
  "expiresIn": 3600
}
```
- **Error Response:**
  - `401 Unauthorized`: `{"code": "SESSION_EXPIRED", "message": "Session expired. Please log in again with mobile OTP."}`

---

### 4. User Logout & Session Revocation
- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/logout`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > When the customer taps "Log Out", this API immediately destroys both the access token and refresh token in the backend database and disconnects push notifications, so nobody else can access the account from that device.
- **Request Body:**
```json
{
  "refreshToken": "ref_88a91c7a52b1...",
  "deviceId": "dev_android_9021a"
}
```
- **Response (204 No Content):**
  *(Empty body indicating session successfully terminated)*
- **Error Response:**
  - `401 Unauthorized`: Invalid or expired bearer token.

---

## Screen 3: Profile Setup (Business & Individual)

### 1. Fetch Current Customer Profile
- **Method:** `GET`
- **Endpoint:** `/api/v1/me`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Description:** Fetches the logged-in user profile, mobile number, verification status, and pre-fills the screen if returning.
- **Response (200 OK):**
```json
{
  "id": "usr_c4819d",
  "mobileNumber": "+919876543210",
  "email": "billing@acmecoldfoods.com",
  "displayName": "Arjun Sharma",
  "preferredLanguage": "kn",
  "accountType": "business",
  "isProfileComplete": false,
  "status": "active"
}
```

---

### 2. Verify GSTIN (Real-Time GSP Check)
- **Method:** `POST`
- **Endpoint:** `/api/v1/compliance/gstin/verify`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Description:** Verifies the 15-character GSTIN against the GST portal in real time. Auto-populates business legal name, PAN, and registered address.
- **Validations:**
  - `gstin`: Exactly 15 characters matching `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`.
- **Request Body:**
```json
{
  "gstin": "27AABCU9603R1ZX"
}
```
- **Response (200 OK):**
```json
{
  "isValid": true,
  "legalName": "Acme Cold Foods Private Limited",
  "tradeName": "Acme Cold Foods",
  "pan": "AABCU9603R",
  "status": "Active",
  "registeredAddress": {
    "line1": "Plot 42, Bhiwandi Logistics Corridor",
    "city": "Thane",
    "state": "Maharashtra",
    "pincode": "421302"
  }
}
```
- **Error Response:**
  - `400 Bad Request`: `{"code": "INVALID_GSTIN", "message": "GSTIN format is invalid or not found on the GST portal."}`

---

### 3. Save / Update Customer Profile
- **Method:** `POST`
- **Endpoint:** `/api/v1/customer/profile`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Description:** Saves the customer's identity, tax identifiers, food safety license, address, and preferred regional language. Uses the same schema for both Business and Individual (with GSTIN being optional for Individual).
- **Validations:**
  - `accountType`: Must be either `"business"` or `"individual"`.
  - `displayName`: 2 to 100 characters.
  - `email`: Valid RFC 5322 email address.
  - `preferredLanguage`: `"en"`, `"kn"`, `"hi"`, `"ta"`, `"te"`, `"mr"`, or `"gu"`.
  - `gstin`: Required if `accountType === "business"`, optional if `"individual"`.
  - `pan`: 10 characters `^[A-Z]{5}[0-9]{4}[A-Z]{1}$`.
  - `fssaiNumber`: Optional 14 numeric digits `^\d{14}$`.
- **Request Body:**
```json
{
  "accountType": "business",
  "displayName": "Arjun Sharma",
  "email": "billing@acmecoldfoods.com",
  "preferredLanguage": "kn",
  "companyName": "Acme Cold Foods Private Limited",
  "gstin": "27AABCU9603R1ZX",
  "pan": "AABCU9603R",
  "fssaiNumber": "10015022000001",
  "registeredAddress": {
    "line1": "Plot 42, Bhiwandi Logistics Corridor",
    "line2": "Near NH 48 Toll Plaza",
    "city": "Thane",
    "state": "Maharashtra",
    "pincode": "421302"
  },
  "billingPhone": "+919876543210"
}
```
- **Response (200 OK):**
```json
{
  "customerId": "cust_89b21a",
  "accountType": "business",
  "isProfileComplete": true,
  "gstinStatus": "verified",
  "fssaiStatus": "recorded",
  "nextScreen": "consentSetup"
}
```

---

## Screen 4: Privacy & Consent Setup (DPDP Act 2023 Compliance)

### 1. Fetch Active Consents Status
- **Method:** `GET`
- **Endpoint:** `/api/v1/consents`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Description:** Retrieves the list of platform policies, mandatory requirements, and the current consent status of the user.
- **Response (200 OK):**
```json
{
  "documentVersion": "v1.2",
  "consents": [
    { "purpose": "terms", "granted": true, "mandatory": true },
    { "purpose": "privacy", "granted": true, "mandatory": true },
    { "purpose": "telemetry", "granted": true, "mandatory": true },
    { "purpose": "whatsapp", "granted": true, "mandatory": false },
    { "purpose": "marketing", "granted": false, "mandatory": false }
  ]
}
```

---

### 2. Record Customer Consents (Main Submit)
- **Method:** `POST`
- **Endpoint:** `/api/v1/consents`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Description:** Stores the customer's consent choices along with timestamp, IP hash, and device ID to satisfy statutory audit requirements under the Digital Personal Data Protection (DPDP) Act 2023.
- **Validations:**
  - `termsAccepted`: Must be `true` (mandatory to access logistics services).
  - `privacyNoticeAccepted`: Must be `true` (acknowledgement of DPDP notice).
  - `telemetryConsent`: Must be `true` (mandatory for IoT temperature & GPS monitoring).
  - `deviceId`: Non-empty string identifying the registered device.
- **Request Body:**
```json
{
  "documentVersion": "v1.2",
  "termsAccepted": true,
  "privacyNoticeAccepted": true,
  "telemetryConsent": true,
  "whatsappUpdates": true,
  "marketingConsent": false,
  "deviceId": "dev_android_9021a"
}
```
- **Response (201 Created):**
```json
{
  "consentRecordId": "cnst_78a10b",
  "capturedAt": "2026-11-10T09:57:30Z",
  "allMandatoryAccepted": true,
  "nextScreen": "home"
}
```
- **Error Response:**
  - `400 Bad Request`: `{"code": "MANDATORY_CONSENT_REQUIRED", "message": "Terms, Privacy Policy, and Telemetry tracking must be accepted to proceed."}`

---

## Screen 5: Business Credit & Master Contract Terms (Optional for B2B)

### 1. Request Business Credit Limit & Upload KYC Docs
- **Method:** `POST`
- **Endpoint:** `/api/v1/customer/credit-request`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > Just like a postpaid corporate card. Large companies shipping cold-chain goods daily cannot pay via UPI/card for every single truck. They ask ColdRoute for a ₹5 Lakh credit limit with Net-30 days terms so they can pay one consolidated monthly invoice. This API submits their application and bank/KYC docs to the Admin Credit Queue for approval.
- **Validations:**
  - Customer must be `accountType === "business"`.
  - `requestedLimitMinor`: Integer in paise (e.g. `50000000` for ₹5,00,000).
  - `requestedPaymentTermsDays`: Standard slabs: `15`, `30`, `45`, or `60` days.
- **Request Body:**
```json
{
  "requestedLimitMinor": 50000000,
  "requestedPaymentTermsDays": 30,
  "businessTurnoverRange": "5cr_to_25cr",
  "documentIds": ["doc_incorp_cert_123", "doc_bank_stmt_456"]
}
```
- **Response (201 Created):**
```json
{
  "creditRequestId": "crd_req_9921",
  "status": "under_review",
  "requestedLimitFormatted": "₹5,00,000",
  "paymentTerms": "Net 30 Days",
  "message": "Application submitted to Admin Credit Queue. Decision turnaround: 24 hours."
}
```

---

### 2. Link Existing Master Rate Contract
- **Method:** `POST`
- **Endpoint:** `/api/v1/contracts/link`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > Like applying an enterprise discount code. If a large brand (e.g. Amul or Havmor) has signed an annual agreement with ColdRoute offline for discounted ₹35/km rates instead of the standard ₹50/km, they enter their contract number here. The app automatically locks in their negotiated pricing and committed reefer trucks.
- **Request Body:**
```json
{
  "contractNumber": "CNT-2026-SOUTH-001"
}
```
- **Response (200 OK):**
```json
{
  "contractId": "cnt_4410",
  "contractNumber": "CNT-2026-SOUTH-001",
  "status": "active",
  "rateCardName": "South Region FTL Special Tariffs",
  "slaProfile": "Deep Frozen & Chilled Grade A",
  "validTill": "2027-03-31T23:59:59Z"
}
```

---

## Screen 6: Home Dashboard Overview

> **Note:** Customer sees ONLY their own booked trucks. The backend automatically filters all shipment data using the logged-in customer's account ID. No other company's data is ever visible.

### 1. Dashboard KPI & Spend Summary
- **Method:** `GET`
- **Endpoint:** `/api/v1/dashboard/summary`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > When the customer opens the app, this single API powers all the top stat cards — how many reefer trucks are currently on the road, how much was spent this month, how much corporate credit limit is still remaining, and whether there are any urgent alerts like a temperature spike, a truck still searching for a driver, or a delivery waiting for receiver OTP.
- **Response (200 OK):**
```json
{
  "activeShipmentsCount": 8,
  "activeShipmentsTrend": {
    "changeCount": 2,
    "direction": "up",
    "comparedTo": "last_week"
  },
  "spendThisMonthMinor": 48200000,
  "spendThisMonthFormatted": "₹4.82L",
  "spendChangeTrend": {
    "changePercentage": 8.4,
    "direction": "down",
    "comparedTo": "last_month"
  },
  "onTimeCompliancePercentage": 98.6,
  "onTimeTrend": {
    "changePercentage": 1.2,
    "direction": "up",
    "comparedTo": "this_month"
  },
  "creditSummary": {
    "hasCreditLine": true,
    "creditLimitMinor": 50000000,
    "utilisedCreditMinor": 32000000,
    "availableCreditMinor": 18000000,
    "utilisedPercentage": 64,
    "utilisedFormatted": "₹3.2L",
    "limitFormatted": "₹5L",
    "availableFormatted": "₹1.8L"
  },
  "alerts": {
    "searchingVehiclesCount": 1,
    "preCoolingInProgressCount": 1,
    "temperatureAlertsCount": 0,
    "pendingPodOtpCount": 2
  }
}
```

---

### 2. Active Shipments Live Cards
- **Method:** `GET`
- **Endpoint:** `/api/v1/shipments/active`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > Powers the "Active Shipments in Motion" carousel/list on the Home Screen. The customer can instantly see each of their moving reefer trucks — the route, current live temperature (e.g. -18.4°C), short temperature badge (e.g. FROZEN -18°C), fine-grained checkpoint status (e.g. • AT TOLL CHECKPOINT), human-readable ETA (e.g. Today, 06:30 PM), and quick action buttons for Live Tracking and Consignee Share Link without needing to leave the dashboard.
- **Query Parameters:**
  - `limit` (optional, default: `5`) — Number of most urgent active trips to show.
- **Response (200 OK):**
```json
{
  "totalActiveCount": 5,
  "shipments": [
    {
      "id": "shp_8471a",
      "shipmentNumber": "CR-2024-MUM-00847",
      "origin": "Mumbai (Bhiwandi)",
      "destination": "Bangalore (Electronic City)",
      "tempBandBadge": "FROZEN -18°C",
      "currentTempC": -18.4,
      "tempStatus": "safe",
      "status": "in_transit",
      "statusLabel": "IN TRANSIT",
      "eta": "2026-11-10T18:30:00Z",
      "etaFormatted": "Today, 06:30 PM",
      "telematics": {
        "dataFreshnessSeconds": 12,
        "isDualSyncActive": true,
        "digitalSealNumber": "SL-4471",
        "isSealLocked": true
      },
      "driver": {
        "name": "Ramesh Kumar",
        "vehicleNumber": "MH 01 AB 1234",
        "vehicleClass": "Tata 407 14ft",
        "phoneMasked": "+91 98XXX XX234",
        "hygieneGrade": "A"
      },
      "consigneeShareUrl": "https://crte.in/t/abc123",
      "actions": ["live_tracking", "consignee_link"]
    },
    {
      "id": "shp_9124b",
      "shipmentNumber": "CR-2024-PUN-00912",
      "origin": "Pune (Chakan)",
      "destination": "Hyderabad (HITEC City)",
      "tempBandBadge": "CHILLED +2°C TO +8°C",
      "currentTempC": 4.2,
      "tempStatus": "safe",
      "status": "in_transit",
      "statusLabel": "AT TOLL CHECKPOINT",
      "eta": "2026-11-11T09:00:00Z",
      "etaFormatted": "Tomorrow, 09:00 AM",
      "telematics": {
        "dataFreshnessSeconds": 15,
        "isDualSyncActive": true,
        "digitalSealNumber": "SL-9921",
        "isSealLocked": true
      },
      "driver": {
        "name": "Sanjay Patil",
        "vehicleNumber": "MH 12 CD 5678",
        "vehicleClass": "Eicher Pro 20ft",
        "phoneMasked": "+91 97XXX XX890",
        "hygieneGrade": "A"
      },
      "consigneeShareUrl": "https://crte.in/t/xyz789",
      "actions": ["live_tracking", "consignee_link"]
    }
  ]
}
```

**Frontend Display Rules for Active Shipment Cards:**
- `totalActiveCount` powers the header link: **"View all (5) →"**
- `statusLabel: "AT TOLL CHECKPOINT"` renders the cyan checkpoint badge; `"IN TRANSIT"` renders the green badge
- `tempBandBadge` renders the pill tag next to temperature (e.g. `FROZEN -18°C` / `CHILLED +2°C TO +8°C`)
- `etaFormatted` renders the human-readable text (`ETA: Today, 06:30 PM`)
- `actions: ["live_tracking", "consignee_link"]` renders the two buttons: **Live Tracking** and **Consignee Link** (`consigneeShareUrl` can be copied/shared immediately)

---

## Screen 7: Booking Wizard — Step 1 (Hiring Model & Route)

### 1. Fetch Available Hiring Models (Dynamic)
- **Method:** `GET`
- **Endpoint:** `/api/v1/master/hiring-models`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > Returns only the hiring models this specific customer is eligible for based on their account type and contract status. If a customer has no master contract, "Annual Rate Contract" will be disabled with a reason. This is dynamic so the business can add, remove, or restrict options without releasing an app update.
- **Response (200 OK):**
```json
{
  "hiringModels": [
    {
      "id": "on_call",
      "label": "On-Call Spot FTL",
      "description": "Dedicated single trip",
      "enabled": true
    },
    {
      "id": "dedicated_monthly",
      "label": "Dedicated Monthly",
      "description": "Vehicle on contract",
      "enabled": true
    },
    {
      "id": "annual_contract",
      "label": "Annual Rate Contract",
      "description": "Pre-negotiated enterprise tariff",
      "enabled": false,
      "reason": "No active master contract linked. Please link a contract in Account Settings."
    }
  ]
}
```

---

### 2. Check Serviceability (Pickup → Drop Corridor)
- **Method:** `GET`
- **Endpoint:** `/api/v1/master/serviceability`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > When the customer enters a pickup and delivery address, the app immediately checks if ColdRoute operates a cold-chain reefer corridor between those two cities. If the route is live, it shows the estimated distance and transit time below the address field. If the route is not yet served, it shows "Not Serviceable" before the customer completes the whole form.
- **Query Parameters:**
  - `originPincode`: e.g. `421302`
  - `destinationPincode`: e.g. `560100`
  - `serviceType`: `"FTL"`
- **Response (200 OK):**
```json
{
  "isServiceable": true,
  "corridorName": "Mumbai – Bangalore NH 48",
  "estimatedDistanceKm": 980,
  "estimatedTransitHours": 24,
  "availableVehicleClasses": ["tata_407_14ft", "eicher_20ft", "bharatbenz_24ft"]
}
```
- **Error Response:**
  - `200 OK` with `"isServiceable": false` and `"reason": "No reefer fleet currently available on this corridor."`

---

### 3. Fetch Reefer Vehicle Classes
- **Method:** `GET`
- **Endpoint:** `/api/v1/master/vehicle-classes`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > Populates the reefer vehicle size dropdown on Step 1. Shows all available truck types with payload capacity so the customer can choose the right size for their cargo weight.
- **Response (200 OK):**
```json
{
  "vehicleClasses": [
    { "id": "tata_407_14ft", "label": "Tata 407 (14ft)", "payloadTons": 4 },
    { "id": "eicher_20ft", "label": "Eicher Pro (20ft)", "payloadTons": 7 },
    { "id": "bharatbenz_24ft", "label": "BharatBenz (24ft)", "payloadTons": 10 },
    { "id": "multi_axle_32ft", "label": "Multi-Axle (32ft)", "payloadTons": 18 }
  ]
}
```

---

### 4. Fetch Customer Saved Locations
- **Method:** `GET`
- **Endpoint:** `/api/v1/customer/saved-locations`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > Every time the customer books a truck, they don't retype their warehouse address from scratch. This API fetches their saved pickup and drop addresses (like "Bhiwandi Cold Storage", "Bangalore Metro Dock") so they can tap and auto-fill in one click.
- **Response (200 OK):**
```json
{
  "locations": [
    {
      "id": "loc_001",
      "label": "Bhiwandi Cold Storage (Primary)",
      "type": "warehouse",
      "address": "Plot 42, Bhiwandi Logistics Corridor, Thane, MH - 421302",
      "pincode": "421302",
      "contactPerson": "Suresh Nair",
      "contactPhone": "+919876500001",
      "accessNotes": "Dock Gate #4 · Access 24x7"
    }
  ]
}
```

---

### 5. Address Search Autocomplete (Third-Party Integration)
- **Provider:** Google Maps Places API (third-party — not a ColdRoute backend API)
- **SDK:** Google Places SDK for Android / iOS (React Native package: `react-native-google-places-autocomplete`)
- **Why It Is Needed (Simple Words):**
  > When the customer types a new address that is not in their saved locations (e.g. a new delivery point), the app shows address suggestions in real time as they type. This is powered by Google Maps Places API. The selected address gives the app a full formatted address string and a pincode which is then used to call the serviceability check.
- **Key Fields Returned from Google Places:**
  - `formattedAddress` — Full address string
  - `pincode` — Extracted from `postal_code` component
  - `latitude` / `longitude` — For map pin display
- **Note:** A Google Maps API key with `Places` and `Geocoding` permissions must be configured by the mobile developer in the app environment.

---

## Screen 8: Booking Wizard — Step 2 (Cargo Lines & Temperature SLA)

### 1. Fetch Temperature SLA Bands
- **Method:** `GET`
- **Endpoint:** `/api/v1/master/temp-bands`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > Populates the 4 temperature SLA option cards (Deep Frozen, Chilled, Controlled Ambient, Ultra Low Cryo). Dynamic so the backend can disable a band (e.g. Ultra Low Cryo) for corridors where that capability is not available, without releasing an app update.
- **Response (200 OK):**
```json
{
  "tempBands": [
    {
      "id": "deep_frozen",
      "label": "Deep Frozen",
      "rangeMin": -25,
      "rangeMax": -18,
      "unit": "celsius",
      "examples": "Ice Cream, Seafood, Frozen Meat",
      "enabled": true
    },
    {
      "id": "chilled",
      "label": "Chilled",
      "rangeMin": 2,
      "rangeMax": 8,
      "unit": "celsius",
      "examples": "Dairy, Cheese, Butter, Vaccines",
      "enabled": true
    },
    {
      "id": "controlled_ambient",
      "label": "Controlled Ambient",
      "rangeMin": 15,
      "rangeMax": 25,
      "unit": "celsius",
      "examples": "Chocolates, Confectionery",
      "enabled": true
    },
    {
      "id": "ultra_low",
      "label": "Ultra Low Cryo",
      "rangeMin": -70,
      "rangeMax": -70,
      "unit": "celsius",
      "examples": "Dry Ice, Special Biologics",
      "enabled": false,
      "reason": "Not available on this corridor"
    }
  ]
}
```

---

### 2. Cargo Compatibility & Food Segregation Check
- **Method:** `POST`
- **Endpoint:** `/api/v1/cargo/compatibility-check`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > When a customer adds more than one cargo line (e.g. Ice Cream AND Seafood AND Dairy in the same truck), the backend checks if these can legally and safely travel together under FSSAI food safety rules. If items are incompatible, it warns the customer before they proceed — preventing cargo rejection, contamination claims, and FSSAI violations.
- **Cargo Line Fields (Confirmed — all required on screen):**

| Field | Type | Required? | Purpose |
| :--- | :--- | :--- | :--- |
| `category` | `string` | **Yes** | Cargo type (e.g. `"frozen_dairy_desserts"`, `"frozen_seafood"`) |
| `description` | `string` | **Yes** | Product name (e.g. "Belgian Chocolate & Vanilla Tubs 500ml") |
| `packagingType` | `string` | **Yes** | `"insulated_cartons"`, `"euro_pallets"`, `"hdpe_crates"` — Needed for driver loading prep and claims |
| `quantityCartons` | `integer` | **Yes** | Number of cartons/units |
| `weightKg` | `number` | **Yes** | Gross cargo weight in kilograms |
| `declaredValueMinor` | `integer` | **Yes** | Declared value in paise (e.g. `48000000` = ₹4,80,000) |
| `dietaryFlag` | `string` | **Yes** | `"vegetarian"`, `"non_vegetarian"`, `"jain"`, `"halal"` |
| `allergens` | `string[]` | **Yes** | e.g. `["milk"]`, `["shellfish"]`, `["nuts"]` |

- **Request Body:**
```json
{
  "cargoLines": [
    {
      "category": "frozen_dairy_desserts",
      "description": "Belgian Chocolate & Vanilla Tubs (500ml)",
      "packagingType": "insulated_cartons",
      "quantityCartons": 240,
      "weightKg": 2800,
      "declaredValueMinor": 48000000,
      "dietaryFlag": "vegetarian",
      "allergens": ["milk"]
    },
    {
      "category": "frozen_seafood",
      "description": "Vannamei IQF Prawns (Export Grade)",
      "packagingType": "corrugated_master_boxes",
      "quantityCartons": 120,
      "weightKg": 1800,
      "declaredValueMinor": 72000000,
      "dietaryFlag": "non_vegetarian",
      "allergens": ["shellfish"]
    }
  ],
  "tempBandId": "deep_frozen"
}
```
- **Response (200 OK):**
```json
{
  "isCompatible": true,
  "segregationStatus": "cleared",
  "totalWeightKg": 4600,
  "totalCartons": 360,
  "totalDeclaredValueMinor": 120000000,
  "totalDeclaredValueFormatted": "₹12,00,000",
  "pharmaGating": {
    "isPharmaCargo": false,
    "isBookingBlocked": false,
    "requiredDocuments": [],
    "notice": null
  },
  "warnings": [
    {
      "type": "secondary_packaging_required",
      "message": "Seafood must be in hermetically sealed secondary packaging to co-load with dairy. FSSAI Chapter 2 compliant."
    }
  ]
}
```
- **Pharma Gating Rule [NEW]:**
  - If any cargo item has category `"pharma"`, the backend returns `"isPharmaCargo": true, "isBookingBlocked": true` and lists required statutory documents: `["Form 20B/21B Wholesale Drug License", "GDP Cold-Chain Packaging Certificate"]`.
  - The booking cannot be confirmed until the shipper's drug license is verified by Admin Ops, complying with CDSCO Schedule C/C1 regulations.
- **Error Response:**
  - `200 OK` with `"isCompatible": false` and `"reason": "Raw non-veg and unpackaged veg items cannot be co-loaded. Please separate into two trips."`

---

## Screen 9: Booking Wizard — Step 3 (Statutory & E-Way Bill)

### 1. Verify Consignee GSTIN
- **Method:** `POST`
- **Endpoint:** `/api/v1/compliance/gstin/verify`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > When the customer enters the receiver's GSTIN, this checks the government GST portal in real-time to confirm the consignee company is active and auto-fills their trade name and registered state.
- **Request Body:**
```json
{
  "gstin": "29AABCM8821K1ZZ"
}
```
- **Response (200 OK):**
```json
{
  "isValid": true,
  "legalName": "Metro Cash & Carry India Private Limited",
  "tradeName": "Metro Wholesale",
  "status": "Active",
  "stateCode": "29",
  "stateName": "Karnataka"
}
```

---

### 2. Verify Existing 12-Digit E-Way Bill
- **Method:** `POST`
- **Endpoint:** `/api/v1/compliance/ewaybill/verify`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > If the customer already generated an E-Way Bill on the government portal, they type the 12-digit number here. This API validates that the E-Way bill is active, not expired, and matches the route so the truck isn't stopped or fined at state highway border checkpoints.
- **Request Body:**
```json
{
  "ewayBillNumber": "531498204410"
}
```
- **Response (200 OK):**
```json
{
  "isValid": true,
  "ewayBillNumber": "531498204410",
  "status": "active",
  "generatedDate": "2026-11-10T08:00:00Z",
  "validUpto": "2026-11-15T23:59:59Z",
  "fromGstin": "27AABCU9603R1ZX",
  "toGstin": "29AABCM8821K1ZZ",
  "totalValueMinor": 120000000,
  "partBStatus": "pending_vehicle_update",
  "message": "Part-B will be updated automatically with assigned reefer vehicle registration."
}
```

---

### 3. Auto-Generate E-Way Bill Part-A
- **Method:** `POST`
- **Endpoint:** `/api/v1/compliance/ewaybill/generate`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > If the customer selects "Generate via App", they don't have to visit the government E-Way portal manually. ColdRoute takes the invoice number, date, value, and GSTINs and creates E-Way Bill Part-A automatically through an authorized GST Suvidha Provider (GSP).
- **Request Body:**
```json
{
  "consignorGstin": "27AABCU9603R1ZX",
  "consigneeGstin": "29AABCM8821K1ZZ",
  "invoiceNumber": "INV-2024-ACME-4091",
  "invoiceDate": "2026-11-10",
  "invoiceValueMinor": 120000000,
  "fromPincode": "421302",
  "toPincode": "560100",
  "approximateDistanceKm": 980
}
```
- **Response (201 Created):**
```json
{
  "ewayBillNumber": "531498204410",
  "status": "part_a_generated",
  "validUpto": "2026-11-15T23:59:59Z",
  "message": "Part-A generated successfully. Part-B will be attached upon driver dispatch."
}
```

---

### Note on Statutory Lorry Receipt (LR) & Consignee Mobile:
- **Auto-LR:** The Lorry Receipt (LR) is automatically generated by the backend when the booking is confirmed in Step 4. No manual API call is needed in Step 3.
- **Consignee Mobile for Handover:** Captured directly on this screen (`+91 98450 11234`) and submitted in the final booking payload. Used to send the 4-digit handover delivery OTP to the destination store manager.

---

## Screen 10: Booking Wizard — Step 4 (Guaranteed Tariff Quote & Confirm Dispatch)

### 1. Generate Guaranteed Itemized Quote (with 15-Minute Price Lock)
- **Method:** `POST`
- **Endpoint:** `/api/v1/quotes/generate`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > When the customer finishes Steps 1, 2, and 3 and taps "View Instant Quote", this API calculates the transparent cost breakdown and returns a cryptographic `quoteToken` with a live 15-minute price lock countdown (`expiresInSeconds: 900`). The rates cannot surge or change while this timer runs on the customer's screen.
- **Request Body:**
```json
{
  "originPincode": "421302",
  "destinationPincode": "560100",
  "vehicleClassId": "eicher_20ft",
  "tempBandId": "deep_frozen",
  "totalWeightKg": 4600,
  "intermediateStopsCount": 0
}
```
- **Response (200 OK):**
```json
{
  "quoteId": "qte_9821a",
  "quoteToken": "tok_lock_7810b42f",
  "expiresInSeconds": 900,
  "currency": "INR",
  "lineItems": [
    { "label": "Base FTL Freight (~980 km)", "amountMinor": 2850000, "formatted": "₹28,500" },
    { "label": "Reefer Cooling Fuel Surcharge (-18°C)", "amountMinor": 480000, "formatted": "₹4,800" },
    { "label": "Pre-Cooling & Dual IoT Hardware Fee", "amountMinor": 120000, "formatted": "₹1,200" },
    { "label": "FASTag National Tolls (Pass-through)", "amountMinor": 245000, "formatted": "₹2,450" },
    { "label": "GST @ 18% (Input Tax Credit)", "amountMinor": 665100, "formatted": "₹6,651" }
  ],
  "totalAmountMinor": 4360100,
  "totalAmountFormatted": "₹43,601"
}
```

---

### 2. Confirm Booking & Trigger Driver Dispatch Wave
- **Method:** `POST`
- **Endpoint:** `/api/v1/bookings/create`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > When the customer taps "Confirm & Dispatch Reefer 🚀", this API saves the entire shipment record, binds the locked price, creates the official booking ID and Lorry Receipt (LR) number, and starts the 90-second animated radar screen to match a nearby verified driver.
- **Request Body:**
```json
{
  "quoteId": "qte_9821a",
  "quoteToken": "tok_lock_7810b42f",
  "hiringModel": "on_call",
  "pickup": {
    "address": "Acme Bhiwandi Warehouse, Mumbai",
    "pincode": "421302",
    "contactPerson": "Suresh Nair",
    "contactPhone": "+919876500001",
    "pickupDate": "2026-11-12",
    "timeWindow": "12:00 PM – 03:00 PM",
    "accessInstructions": "Dock Gate #4 · Access 24x7"
  },
  "drop": {
    "address": "Metro Cash & Carry, Electronic City, Bangalore",
    "pincode": "560100",
    "consigneeGstin": "29AABCM8821K1ZZ",
    "consigneeName": "Anand Deshmukh",
    "consigneePhone": "+919845011234"
  },
  "intermediateStops": [],
  "tempBandId": "deep_frozen",
  "cargoLines": [
    {
      "category": "frozen_dairy_desserts",
      "description": "Belgian Chocolate & Vanilla Tubs (500ml)",
      "packagingType": "insulated_cartons",
      "quantityCartons": 240,
      "weightKg": 2800,
      "declaredValueMinor": 48000000,
      "dietaryFlag": "vegetarian",
      "allergens": ["milk"]
    }
  ],
  "statutory": {
    "invoiceNumber": "INV-2024-ACME-4091",
    "invoiceDate": "2026-11-10",
    "invoiceValueMinor": 120000000,
    "ewayBillOption": "existing",
    "ewayBillNumber": "531498204410"
  },
  "payment": {
    "terms": "business_credit"
  },
  "termsAccepted": true
}
```
- **Response (201 Created):**
```json
{
  "bookingId": "bk_8471a",
  "bookingNumber": "CR-2024-MUM-00847",
  "lrNumber": "LR-2024-847",
  "status": "searching_driver",
  "dispatchWave": {
    "waveNumber": 1,
    "timerSeconds": 90,
    "eligibleDriversCount": 3
  },
  "nextScreen": "searching"
}
```

---

## Screen 11: Finding Vehicle / Searching Screen (Wave Dispatch Radar)

### 1. Check Dispatch & Driver Assignment Status (Polling / WebSocket)
- **Method:** `GET`
- **Endpoint:** `/api/v1/bookings/{bookingId}/dispatch-status`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > While the animated radar is pulsing and the 90-second countdown runs on screen, the mobile app calls this endpoint every 3–4 seconds to check if a driver has accepted the job. When a driver accepts, this API immediately returns the driver's name, photo, reefer truck registration, hygiene grade, and initial pre-cooling status, triggering the app to navigate to the Confirmation Screen.
- **Response While Searching (200 OK):**
```json
{
  "bookingId": "bk_8471a",
  "status": "searching_driver",
  "currentWave": 1,
  "timeRemainingSeconds": 68,
  "eligibleDriversCount": 3,
  "assignedDriver": null
}
```
- **Response When Driver Accepts (200 OK):**
```json
{
  "bookingId": "bk_8471a",
  "status": "driver_assigned",
  "assignedDriver": {
    "name": "Ramesh Kumar",
    "phoneMasked": "+91 98XXX XX234",
    "photoUrl": "https://cdn.coldroute.in/drivers/rk_avatar.jpg",
    "vehicleNumber": "MH 01 AB 1234",
    "vehicleClass": "Tata 407 14ft Reefer",
    "hygieneGrade": "A",
    "rating": 4.9,
    "tripsCompleted": 420
  },
  "preCooling": {
    "status": "in_progress",
    "currentTempC": -14.8,
    "targetTempC": -18.0,
    "etaMinutes": 12
  },
  "nextScreen": "confirmation"
}
```

---

### 2. Cancel Booking & Instant Full Refund (If No Driver Responds or Customer Cancels)
- **Method:** `POST`
- **Endpoint:** `/api/v1/bookings/{bookingId}/cancel`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > Powers the red "Cancel & Refund" button on the Searching screen. If 90 seconds pass with no driver response or the customer changes their mind before a truck is dispatched, this cancels the broadcast immediately and performs a 100% full refund / credit limit reversal with zero cancellation fee.
- **Request Body:**
```json
{
  "reason": "no_driver_available_timeout"
}
```
- **Response (200 OK):**
```json
{
  "bookingId": "bk_8471a",
  "status": "cancelled",
  "cancellationFeeMinor": 0,
  "refundAmountMinor": 4360100,
  "refundAmountFormatted": "₹43,601",
  "refundStatus": "instant_credit_reversal",
  "message": "Booking cancelled with zero fee. Full credit limit restored."
}
```

---

### 3. Escalate to Manual Ops Desk Allocation
- **Method:** `POST`
- **Endpoint:** `/api/v1/bookings/{bookingId}/escalate-ops`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > Powers the "Manual Ops Assign" button. If the automatic wave dispatch fails to find a driver within 90 seconds, the customer can tap this button to push their booking into the Admin 24/7 Operations Desk priority queue. A human fleet coordinator then manually calls and assigns a dedicated reefer operator.
- **Request Body:**
```json
{
  "notes": "Customer requested manual fleet assignment after wave 1 timeout."
}
```
- **Response (200 OK):**
```json
{
  "bookingId": "bk_8471a",
  "status": "escalated_to_ops",
  "queuePriority": "high",
  "opsDeskContact": "+91 1800 266 3768",
  "message": "Booking forwarded to 24/7 Ops Desk. A fleet coordinator will assign a reefer within 15 minutes."
}
```

---

## Screen 12: Booking Confirmation (Driver Assigned & Pre-Cooling Progress)

### 1. Fetch Confirmed Booking & Driver Details
- **Method:** `GET`
- **Endpoint:** `/api/v1/bookings/{bookingId}/confirmation`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > When the customer enters the confirmation screen (or reloads the app), this API fetches the assigned driver's profile (name, photo, vehicle registration, hygiene grade, rating), current pre-cooling sensor progress, pickup ETA, and the auto-generated Lorry Receipt (LR) number.
- **Response (200 OK):**
```json
{
  "bookingId": "bk_8471a",
  "bookingNumber": "CR-2024-MUM-00847",
  "lrNumber": "LR-2024-847",
  "status": "driver_assigned",
  "pickupEtaMinutes": 28,
  "driver": {
    "name": "Ramesh Kumar",
    "photoUrl": "https://cdn.coldroute.in/drivers/rk_avatar.jpg",
    "vehicleNumber": "MH 01 AB 1234",
    "vehicleClass": "Tata 407 14ft",
    "hygieneGrade": "A",
    "rating": 4.9,
    "completedTripsCount": 420
  },
  "preCooling": {
    "status": "in_progress",
    "currentTempC": -14.8,
    "targetTempC": -18.0,
    "etaMinutes": 12,
    "chamberStatus": "loading_locked_until_target_met"
  }
}
```

---

### 2. Generate Agora RTC Token for In-App Voice Call (📞 Call Button)
- **Method:** `POST`
- **Endpoint:** `/api/v1/trips/{bookingId}/agora/token`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > Powers the "📞 Call" button on the driver card using Agora Voice SDK. It starts a private VoIP call directly inside the mobile app over internet data (like a WhatsApp or Uber audio call). Neither the driver nor the customer ever sees each other's real personal phone number (complying with DPDP privacy laws).
- **Request Body:**
```json
{}
```
- **Response (200 OK):**
```json
{
  "agoraAppId": "a1b2c3d4e5f6789012345678abcdef01",
  "channelName": "call_trip_CR2024MUM00847",
  "rtcToken": "006a1b2c3d4e5f6...agora_jwt_token...",
  "uid": 100234,
  "peerUid": 200456,
  "expiresInSeconds": 3600
}
```

---

### 3. Fetch In-App Chat Message History (💬 Chat Button)
- **Method:** `GET`
- **Endpoint:** `/api/v1/trips/{bookingId}/chat/messages`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > When the customer taps the "💬 Chat" button on the driver card, this API opens the in-app chat modal and retrieves all past text messages between the customer and the driver for this trip.
- **Response (200 OK):**
```json
{
  "tripId": "bk_8471a",
  "messages": [
    {
      "messageId": "msg_001",
      "sender": "driver",
      "senderName": "Ramesh Kumar",
      "text": "Namaste sir, pre-cooling is at -15°C now. Reaching gate in 25 mins.",
      "sentAt": "2026-11-11T09:12:00Z"
    }
  ]
}
```

---

### 4. Send In-App Chat Message to Driver (💬 Chat Button)
- **Method:** `POST`
- **Endpoint:** `/api/v1/trips/{bookingId}/chat/send`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > When the customer types a message and hits send, this API delivers the text message to the Driver Mobile App and triggers a push notification on the driver's phone.
- **Request Body:**
```json
{
  "text": "Please report to loading bay #4, security has your vehicle pass ready."
}
```
- **Response (201 Created):**
```json
{
  "messageId": "msg_002",
  "status": "delivered",
  "sentAt": "2026-11-11T09:18:00Z"
}
```

---


## Screen 13: My Shipments (Consignments List & Filters)

> **What the user sees:** A filterable, paginated list of all shipments with tabs (All, In Transit, Scheduled, Delivered, Disputed), live temperature badge, pre-cooling badge, claim badge, and quick action buttons (Track Live, Details, View Claim).

---

### API 1: Fetch Filtered Shipments List

- **Method:** `GET`
- **Endpoint:** `/api/v1/shipments`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > Powers the entire My Shipments screen. When the customer opens this screen or taps a filter tab (e.g., "In Transit (2)"), the app calls this API with the selected filter. The backend returns only the shipments matching that filter — with live temperature, pre-cooling status, and claim info — so the customer sees an up-to-date list without refreshing manually.
- **Query Parameters:**

| Param | Type | Example | Notes |
|---|---|---|---|
| `status` | string | `in_transit` | `all` \| `in_transit` \| `scheduled` \| `delivered` \| `disputed` \| `cancelled` |
| `search` | string | `CR-2024-MUM` | Optional. Searches booking ref, LR number, origin, destination |
| `dateRange` | string | `30d` | `30d` \| `90d` \| `all` |
| `page` | integer | `1` | For pagination |
| `limit` | integer | `20` | Records per page |

- **Response (200 OK):**
```json
{
  "countsByStatus": {
    "all": 6,
    "in_transit": 2,
    "scheduled": 1,
    "delivered": 2,
    "disputed": 1,
    "cancelled": 0
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalRecords": 6,
    "totalPages": 1
  },
  "shipments": [
    {
      "shipmentId": "shp_001",
      "bookingRef": "CR-2024-MUM-00847",
      "lrNumber": "LR-2024-847",
      "origin": "Mumbai (Bhiwandi)",
      "destination": "Bangalore (Electronic City)",
      "pickupDate": "2026-11-11",
      "cargoDescription": "Frozen Ice Cream",
      "tempBandLabel": "Target: -18°C",
      "currentTempC": -18.4,
      "tempStatus": "safe",
      "status": "in_transit",
      "isPreCoolingActive": false,
      "claim": null,
      "actions": ["track_live"]
    },
    {
      "shipmentId": "shp_002",
      "bookingRef": "CR-2024-PUN-00912",
      "lrNumber": "LR-2024-912",
      "origin": "Pune (Chakan)",
      "destination": "Hyderabad (HITEC City)",
      "pickupDate": "2026-11-11",
      "cargoDescription": "Vaccines & Biologics",
      "tempBandLabel": "Target: +2°C to +8°C",
      "currentTempC": 4.2,
      "tempStatus": "safe",
      "status": "in_transit",
      "isPreCoolingActive": false,
      "claim": null,
      "actions": ["track_live"]
    },
    {
      "shipmentId": "shp_003",
      "bookingRef": "CR-2024-DEL-00789",
      "lrNumber": "LR-2024-789",
      "origin": "Delhi (Kundli)",
      "destination": "Ahmedabad (Sanand)",
      "pickupDate": "2026-11-12",
      "pickupTimeLabel": "Tomorrow 10:00 AM",
      "cargoDescription": "Dairy Butter",
      "tempBandLabel": null,
      "currentTempC": null,
      "tempStatus": null,
      "status": "scheduled",
      "isPreCoolingActive": true,
      "claim": null,
      "actions": ["details"]
    },
    {
      "shipmentId": "shp_004",
      "bookingRef": "CR-2024-BLR-00659",
      "lrNumber": "LR-2024-659",
      "origin": "Bangalore",
      "destination": "Kochi Harbor",
      "pickupDate": "2026-11-09",
      "cargoDescription": null,
      "tempBandLabel": null,
      "currentTempC": null,
      "tempStatus": null,
      "status": "disputed",
      "isPreCoolingActive": false,
      "claim": {
        "claimId": "clm_001",
        "status": "filed",
        "amountMinor": 2850000,
        "amountFormatted": "₹28,500",
        "isWithin24HrWindow": true,
        "note": "Excursion Claim filed within 24-hr window"
      },
      "actions": ["view_claim"]
    }
  ]
}
```

**Frontend Rendering Rules (from response fields):**
- `isPreCoolingActive: true` → show **"PRE-COOLING ACTIVE"** green badge (scheduled shipments only)
- `claim` not null + `status: "disputed"` → show **"DISPUTED"** red badge and claim amount chip
- `tempStatus: "safe"` → show temperature in green; `"excursion_reported"` → show in red
- `actions: ["track_live"]` → show **"Track Live ↗"** button
- `actions: ["view_claim"]` → show **"View Claim"** button (pink/red)
- `actions: ["details"]` → show **"Details"** button (outlined)

---

### API 2: Export Shipments Report (CSV)

- **Method:** `GET`
- **Endpoint:** `/api/v1/shipments/export`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > The customer's finance or audit team needs a downloadable record of all shipments with temperature logs, LR numbers, and billing amounts. This API generates a CSV report on the backend and returns a secure, time-limited download URL so the file can be opened in Excel or uploaded to ERP systems.
- **Query Parameters:**

| Param | Type | Example | Notes |
|---|---|---|---|
| `status` | string | `all` | Same filter options as List API |
| `dateRange` | string | `90d` | `30d` \| `90d` \| `all` |
| `format` | string | `csv` | Fixed as `csv` for Phase 1 |

- **Response (200 OK):**
```json
{
  "downloadUrl": "https://cdn.coldroute.in/exports/shp_export_20261111_abc123.csv?token=xyz&expires=1800",
  "fileName": "ColdRoute_Shipments_Export_20261111.csv",
  "generatedAt": "2026-11-11T09:30:00Z",
  "expiresInSeconds": 1800
}
```

---


## Screen 14: Live Telematics & Dual-Layer IoT (Track Live Screen)

> **What the user sees:** A real-time map with the truck's live position on the full planned route, dual-layer IoT health panel (GeoTracker BLE + Driver GPS), live chamber temperature with historical chart, emergency excursion controls, and a consignee share link button.

---

### API 1: Get Live Trip Snapshot

- **Method:** `GET`
- **Endpoint:** `/api/v1/trips/{bookingId}/live`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > When the customer opens the Track Live screen, the app calls this first to get a complete snapshot of the current trip state — truck GPS coordinates, speed, chamber temperature, IoT sync status, digital seal lock, and ETA. This is the initial data load before the live stream takes over.
- **Response (200 OK):**
```json
{
  "bookingRef": "CR-2024-MUM-00847",
  "tripStatus": "en_route",
  "lastUpdatedSecondsAgo": 12,
  "truck": {
    "lat": 18.5204,
    "lng": 73.8567,
    "speedKmh": 54,
    "headingDeg": 142,
    "distanceRemainingKm": 84,
    "etaLabel": "ETA 06:30 PM",
    "highwayLabel": "NH 48 · 84 km to Bangalore"
  },
  "iot": {
    "source": "dual",
    "primaryGeoTracker": {
      "type": "ble_hardware",
      "signal": "4G LTE",
      "chamberTempC": -18.4,
      "status": "active"
    },
    "driverMobileGps": {
      "speedKmh": 54,
      "syncStatus": "synced"
    },
    "mismatchWatchdog": "normal",
    "digitalSeal": {
      "sealId": "SL-4471",
      "status": "locked"
    }
  },
  "tempSla": {
    "minC": -25,
    "maxC": -18,
    "label": "-18°C TO -25°C SLA",
    "currentTempC": -18.4,
    "complianceStatus": "nominal",
    "complianceLabel": "Continuous cooling nominal"
  }
}
```

---

### API 2: Subscribe to Live Trip Updates (Real-Time Stream)

- **Method:** `GET` (Server-Sent Events) or `WebSocket`
- **Endpoint:** `/api/v1/trips/{bookingId}/live/stream`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > After the initial snapshot loads, the app keeps this connection open. Every 10–15 seconds the backend pushes a small update packet with the new truck GPS position and temperature — so the map truck icon moves in real time and the "12 secs ago · Live" counter resets. This avoids the app having to poll the server constantly.
- **Stream Event Payload (pushed every ~12 seconds):**
```json
{
  "event": "trip_update",
  "data": {
    "lat": 18.5301,
    "lng": 73.8420,
    "speedKmh": 56,
    "chamberTempC": -18.3,
    "distanceRemainingKm": 83,
    "etaLabel": "ETA 06:28 PM",
    "lastUpdatedSecondsAgo": 0,
    "mismatchWatchdog": "normal",
    "digitalSeal": { "sealId": "SL-4471", "status": "locked" }
  }
}
```
- **On trip completion, server pushes:**
```json
{ "event": "trip_completed", "data": { "deliveredAt": "2026-11-11T18:32:00Z" } }
```

---

### API 3: Get Planned Route Polyline (Map Route Display)

- **Method:** `GET`
- **Endpoint:** `/api/v1/trips/{bookingId}/route`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > The map must show the full planned road route from origin (Mumbai) to destination (Bangalore) as a dotted/solid line, with a green origin dot, orange destination dot, and the truck icon placed at the current GPS position on that route. This API returns the pre-computed route waypoints (in Google Maps Directions format) so the app can draw the route path without calling Google Maps Directions API live every time.
- **Response (200 OK):**
```json
{
  "origin": {
    "label": "Mumbai (Bhiwandi)",
    "lat": 19.2813,
    "lng": 73.0529
  },
  "destination": {
    "label": "Bangalore (Electronic City)",
    "lat": 12.8456,
    "lng": 77.6603
  },
  "encodedPolyline": "qnkpBk{pvMhBzF...{truncated Google Encoded Polyline}",
  "waypoints": [
    { "lat": 19.2813, "lng": 73.0529, "label": "Mumbai (Bhiwandi)" },
    { "lat": 18.5204, "lng": 73.8567, "label": "Pune (Bypass)" },
    { "lat": 16.7050, "lng": 74.2433, "label": "Kolhapur" },
    { "lat": 15.3647, "lng": 75.1240, "label": "Dharwad" },
    { "lat": 12.8456, "lng": 77.6603, "label": "Bangalore (Electronic City)" }
  ],
  "totalDistanceKm": 984,
  "estimatedDurationMinutes": 870,
  "mapRenderingHints": {
    "originMarkerColor": "green",
    "destinationMarkerColor": "orange",
    "routeLineStyle": "dashed",
    "truckIconOverlay": true
  }
}
```
> **Note:** `encodedPolyline` follows Google Maps Encoded Polyline Algorithm format. The frontend decodes this to draw the route line. The truck icon position comes from API 1 (`lat`, `lng`) and is overlaid on this route in the app.

---

### API 4: Get Temperature History Log (Chart Data)

- **Method:** `GET`
- **Endpoint:** `/api/v1/trips/{bookingId}/temperature-log`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > The temperature line chart on the screen (showing readings from 02:00 PM to Now) is powered by this API. It returns a time-series array of temperature readings recorded by the IoT sensor throughout the trip so the customer can see if the temperature stayed within SLA range the entire time.
- **Query Parameters:**

| Param | Type | Example | Notes |
|---|---|---|---|
| `from` | ISO timestamp | `2026-11-11T08:00:00Z` | Start of chart window |
| `to` | ISO timestamp | `2026-11-11T17:08:00Z` | End (defaults to now) |
| `resolution` | string | `5min` | `1min` \| `5min` \| `15min` |

- **Response (200 OK):**
```json
{
  "sla": { "minC": -25, "maxC": -18 },
  "readings": [
    { "timestamp": "2026-11-11T14:00:00Z", "tempC": -18.5 },
    { "timestamp": "2026-11-11T14:05:00Z", "tempC": -18.4 },
    { "timestamp": "2026-11-11T14:10:00Z", "tempC": -18.3 },
    { "timestamp": "2026-11-11T17:08:00Z", "tempC": -18.4 }
  ],
  "excursionEvents": [],
  "chartMeta": {
    "xAxisLabels": ["02:00 PM", "03:30 PM", "05:08 PM (Now)"],
    "yAxisMinC": -26,
    "yAxisMaxC": -16
  }
}
```

---

### API 5: Get Trip Milestones Timeline

- **Method:** `GET`
- **Endpoint:** `/api/v1/trips/{bookingId}/milestones`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > Powers the "Trip Milestones" section at the bottom of the screen. Shows the customer a step-by-step verified trail of what has happened (Pre-Cooling Verified, Cargo Loaded & Sealed, In Transit checkpoint) and what is still pending (Delivery Dock Handover). Each milestone is timestamped and recorded by the system when triggered.
- **Response (200 OK):**
```json
{
  "milestones": [
    {
      "id": "pre_cooling_verified",
      "label": "Pre-Cooling Verified (-18.4°C)",
      "status": "completed",
      "completedAt": "2026-11-10T00:00:00Z",
      "detail": null
    },
    {
      "id": "cargo_loaded_sealed",
      "label": "Cargo Loaded & Sealed (#SL-4471)",
      "status": "completed",
      "completedAt": "2026-11-10T09:30:00Z",
      "detail": "Loading probe: 18.2°C · 240 Cartons"
    },
    {
      "id": "in_transit_checkpoint",
      "label": "In Transit · Pune Bypass",
      "status": "completed",
      "completedAt": "2026-11-10T13:15:00Z",
      "detail": "Speed 54 km/h · Temp stable"
    },
    {
      "id": "delivery_dock_handover",
      "label": "Electronic City Dock Handover (ETA 06:30 PM)",
      "status": "pending",
      "completedAt": null,
      "detail": "Consignee 4-digit OTP required for sign off"
    }
  ]
}
```

---

### API 6: Trigger Emergency / Excursion Action

- **Method:** `POST`
- **Endpoint:** `/api/v1/trips/{bookingId}/excursion-action`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > In case of a thermal spike or breakdown, the customer sees 4 emergency buttons: "Continue Trip", "Divert to Cold Store", "Call 24/7 NOC", and "Emergency SOS". When the customer taps any of these, this API fires and immediately alerts the ColdRoute operations team with the customer's decision so they can dispatch the appropriate fleet response — reroute to nearest cold store, dispatch NOC engineer, or escalate to emergency response.
- **Request Body:**
```json
{
  "action": "divert_cold_store",
  "customerNote": "Temperature warning on sensor. Please reroute to nearest cold store."
}
```
- **`action` values:** `continue_trip` | `divert_cold_store` | `call_24x7_noc` | `emergency_sos`
- **Response (200 OK):**
```json
{
  "actionId": "act_00123",
  "action": "divert_cold_store",
  "status": "acknowledged",
  "message": "Operations team notified. NOC will call you within 3 minutes.",
  "estimatedResponseMinutes": 3,
  "caseRef": "NOC-2026-00891"
}
```

---

### API 7: Generate Consignee Share Link

- **Method:** `POST`
- **Endpoint:** `/api/v1/trips/{bookingId}/share-link`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > When the customer taps the "Consignee Link" button (top-right), this API generates a secure, no-login shareable URL. The customer sends this link via WhatsApp or SMS to the consignee at the destination. When the consignee opens the link, they can see the live truck position, estimated arrival time, and get the 4-digit OTP delivery confirmation screen — without needing to download the app or log in.
- **Request Body:**
```json
{
  "consigneeMobile": "+919988776655",
  "notifyViaSms": true,
  "notifyViaWhatsapp": true
}
```
- **Response (201 Created):**
```json
{
  "shareUrl": "https://track.coldroute.in/t/CR-2024-MUM-00847?token=abc123xyz",
  "shortUrl": "https://crte.in/t/abc123",
  "expiresAt": "2026-11-12T18:30:00Z",
  "smsSent": true,
  "whatsappSent": true
}
```
> **Note:** The `shareUrl` powers **Screen 15 (Consignee Portal)**. The token inside the URL grants read-only, no-login access to the consignee-facing delivery confirmation flow.

---


## Screen 15: Consignee e-POD Portal (No App / No Login Required)

> **What the user sees:** A token-based browser page (not inside the app) shared with the consignee via WhatsApp/SMS. Shows a 4-digit OTP the consignee gives the driver, a Handover Temperature Audit (probe vs chamber sensor readings), and 4 mandatory Receiver Outcome choices with proof upload.

> [!IMPORTANT]
> This screen has **no JWT auth header** — it is accessed via a secure, time-limited `token` query param generated by the Share Link API (Screen 14, API 7). The nav bar shown in the prototype does NOT appear in the real consignee portal — the consignee has no app account.

---

### API 1: Load Consignee Portal (Token-Based, No Login)

- **Method:** `GET`
- **Endpoint:** `/api/v1/consignee/portal`
- **Auth:** No `Authorization` header. Uses `?token=<shareToken>` query param.
- **Why It Is Needed (Simple Words):**
  > When the consignee taps the WhatsApp/SMS link, their phone browser opens this URL. The backend validates the token, finds the matching booking, and returns all the data the consignee portal needs — the 4-digit OTP, booking reference, driver name, destination dock name, and the latest handover temperature readings from both the probe and the chamber sensor — all without requiring any login.
- **Request:**
```
GET /api/v1/consignee/portal?token=abc123xyz
```
- **Response (200 OK):**
```json
{
  "portalStatus": "active",
  "bookingRef": "CR-2024-MUM-00847",
  "destinationLabel": "Electronic City Dock",
  "driverName": "Ramesh Kumar",
  "deliveryOtp": "8492",
  "otpValidityNote": "Valid for CR 2024 MUM 00847 · Electronic City Dock",
  "handoverTempAudit": {
    "status": "in_spec",
    "handoverProbeReadingC": -18.2,
    "chamberSensorReadingC": -18.4,
    "slaMinC": -25,
    "slaMaxC": -18
  },
  "outcomeOptions": [
    {
      "code": "full_acceptance",
      "label": "Full Acceptance",
      "description": "100% cartons received in spec with OTP",
      "iconType": "check_green",
      "proofRequired": ["otp", "photo"]
    },
    {
      "code": "partial_acceptance",
      "label": "Partial Acceptance",
      "description": "Accept good units, reject damaged/warm",
      "iconType": "warning_yellow",
      "proofRequired": ["otp", "photo", "damaged_unit_count"]
    },
    {
      "code": "excursion_claim",
      "label": "Excursion Claim",
      "description": "Log probe deviation & 24-hr claim flag",
      "iconType": "alert_red",
      "proofRequired": ["otp", "photo", "probe_reading"]
    },
    {
      "code": "full_rejection",
      "label": "Full Rejection",
      "description": "Refusal of cargo & immediate Ops alert",
      "iconType": "cross_red",
      "proofRequired": ["otp", "photo", "rejection_reason"]
    }
  ],
  "tokenExpiresAt": "2026-11-12T18:30:00Z"
}
```

---

### API 2: Verify Delivery OTP

- **Method:** `POST`
- **Endpoint:** `/api/v1/consignee/portal/verify-otp`
- **Auth:** `?token=<shareToken>` query param (no login header).
- **Why It Is Needed (Simple Words):**
  > The consignee tells the driver the 4-digit OTP. The driver enters it on their Driver App. This API verifies that the OTP matches the booking — confirming the right truck arrived at the right dock. Only after OTP is verified does the backend unlock the Receiver Outcome submission. This prevents the driver from self-signing a fake delivery.
- **Request Body:**
```json
{
  "otp": "8492"
}
```
- **Response (200 OK — OTP matched):**
```json
{
  "verified": true,
  "verifiedAt": "2026-11-11T18:28:00Z",
  "message": "OTP verified. Please choose the Receiver Outcome."
}
```
- **Response (400 Bad Request — wrong OTP):**
```json
{
  "verified": false,
  "attemptsRemaining": 2,
  "message": "Incorrect OTP. Please try again."
}
```

---

### API 3: Submit Receiver Outcome (e-POD)

- **Method:** `POST`
- **Endpoint:** `/api/v1/consignee/portal/outcome`
- **Auth:** `?token=<shareToken>` query param (no login header).
- **Why It Is Needed (Simple Words):**
  > After the consignee chooses one of the 4 outcome options and uploads photo proof, this API records the official electronic Proof of Delivery (e-POD). It immediately triggers the right backend action for each outcome — close the trip for Full Acceptance, flag a partial shortage for Partial Acceptance, raise a 24-hr excursion claim for Excursion Claim, or fire an Ops emergency alert for Full Rejection. This e-POD record is legally binding and replaces the paper POD.
- **Request Body:**
```json
{
  "outcome": "full_acceptance",
  "otpVerified": true,
  "receiverName": "Anand Deshmukh",
  "receiverDesignation": "Store Manager",
  "cartonCountReceived": 240,
  "cartonCountRejected": 0,
  "handoverProductCoreTempC": -18.2,
  "rejectionReason": null,
  "dataLoggerSerialNumber": null,
  "receiverRemarks": null,
  "cargoDispositionInstruction": null,
  "proofPhotos": [
    "https://cdn.coldroute.in/uploads/epod/photo_001.jpg",
    "https://cdn.coldroute.in/uploads/epod/photo_002.jpg"
  ],
  "signatureImageUrl": "https://cdn.coldroute.in/uploads/epod/sig_001.png",
  "submittedAt": "2026-11-11T18:30:00Z"
}
```

**Field usage by outcome:**

| Field | Full Acceptance | Partial Acceptance | Excursion Claim | Full Rejection |
|---|---|---|---|---|
| `otpVerified` | ✅ Required | ✅ Required | ✅ Required | ✅ Required |
| `receiverName` | ✅ Required | ✅ Required | ✅ Required | ✅ Required |
| `receiverDesignation` | ✅ Required | ✅ Required | ✅ Required | ✅ Required |
| `cartonCountReceived` | ✅ Required | ✅ Required | ✅ Required | — |
| `cartonCountRejected` | — | ✅ Required | — | — |
| `handoverProductCoreTempC` | ✅ Required | — | — | — |
| `rejectionReason` | — | ✅ Required (dropdown) | — | ✅ Required (free text) |
| `dataLoggerSerialNumber` | — | — | ✅ Required | — |
| `receiverRemarks` | — | — | ✅ Required | — |
| `cargoDispositionInstruction` | — | — | — | ✅ Required (dropdown) |
| `proofPhotos` | ✅ Required | ✅ Required | ✅ Required | ✅ Required |
| `signatureImageUrl` | ✅ Required | ✅ Required | ✅ Required | ✅ Required |
```
- **`outcome` values:** `full_acceptance` | `partial_acceptance` | `excursion_claim` | `full_rejection`
- **Response (201 Created):**
```json
{
  "epodId": "epod_00456",
  "bookingRef": "CR-2024-MUM-00847",
  "outcome": "full_acceptance",
  "status": "recorded",
  "epodPdfUrl": "https://cdn.coldroute.in/epod/CR-2024-MUM-00847_epod.pdf",
  "tripClosed": true,
  "claimFiled": false,
  "opsAlerted": false,
  "message": "Delivery confirmed. e-POD has been sent to your registered email."
}
```

**Backend action triggered by each outcome:**

| Outcome | `tripClosed` | `claimFiled` | `opsAlerted` |
|---|---|---|---|
| `full_acceptance` | `true` | `false` | `false` |
| `partial_acceptance` | `true` | `false` | `true` (shortage alert) |
| `excursion_claim` | `true` | `true` | `true` |
| `full_rejection` | `false` | `false` | `true` (emergency) |

---

### API 4: Failed Delivery Resolution Decision (Customer Action)

- **Method:** `POST`
- **Endpoint:** `/api/v1/trips/{bookingId}/failed-delivery-decision`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > When the driver reaches the destination dock but delivery cannot proceed (e.g. receiver warehouse closed, store manager unreachable, wrong dock address, or OTP refused), the driver flags "Delivery Stalled" on their app. Because cold-chain cargo cannot sit unattended, this API presents the customer with 3 immediate emergency options:
  > 1. `alternate_contact` — Provide a backup receiver phone number or gate instructions.
  > 2. `retry_later` — Authorize waiting at the dock (hourly detention rate applied while chiller continues running).
  > 3. `return_to_origin` — Order driver to turn around and return cargo to origin depot (return freight terms applied).
- **Request Body:**
```json
{
  "decision": "alternate_contact",
  "alternateContact": {
    "name": "Kavita Rao (Asst. Warehouse Head)",
    "phone": "+919876543219",
    "gateDockNumber": "Dock #2 East Wing"
  },
  "customerNotes": "Spoke to regional head, gate 2 is open for night offloading."
}
```
- **`decision` values:** `alternate_contact` | `retry_later` | `return_to_origin`
- **Response (200 OK):**
```json
{
  "bookingRef": "CR-2024-MUM-00847",
  "decision": "alternate_contact",
  "status": "instructions_dispatched",
  "driverNotified": true,
  "opsTicketRef": "OPS-FLD-9921",
  "message": "Instructions sent to driver and 24/7 Operations Desk. Reefer temperature monitoring remains active."
}
```

---

### API 5: Rate Trip & Driver Hygiene (★★★★★)

- **Method:** `POST`
- **Endpoint:** `/api/v1/trips/{bookingId}/rating`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > After successful delivery and e-POD generation, the app prompts the customer with a 5-star trip review dialog. Shippers rate the overall trip (1–5 stars), rate the reefer vehicle hygiene/cleanliness (Grade A/B/C), select positive or negative tags, and leave remarks. This maintains ColdRoute's verified hygiene standards and affects the driver's dispatch priority.
- **Request Body:**
```json
{
  "ratingStars": 5,
  "hygieneGradeObserved": "grade_a",
  "tags": [
    "temp_maintained_perfectly",
    "clean_odour_free_reefer",
    "prompt_otp_handover"
  ],
  "feedback": "Chamber was immaculate at -18.4°C. Ramesh arrived exactly on scheduled dock time."
}
```
- **Response (201 Created):**
```json
{
  "bookingRef": "CR-2024-MUM-00847",
  "ratingRecorded": true,
  "ratingStars": 5,
  "message": "Thank you for your rating! Your feedback helps us maintain verified Grade A cold-chain standards."
}
```

---


## Screen 16: Temperature Analytics

> **What the user sees:** Full-trip temperature line chart with SLA breach limits, compliance percentage, Mean Kinetic Temperature (MKT), min/max stats, door sensor open/close event log with location tags, and a certified export button.

---

### API 1: Get Full Trip Temperature Analytics

- **Method:** `GET`
- **Endpoint:** `/api/v1/trips/{bookingId}/analytics/temperature`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > Powers the main temperature graph and all the stats on this screen. Unlike the live temp view on Screen 14 (which shows the last few hours), this API returns the **complete trip temperature data** from pre-cooling start to delivery — with compliance percentage, breach limits, min/max/MKT values, and a time-series array for drawing the full chart. This is used for post-trip audit, insurance claims, and FSSAI compliance reporting.
- **Query Parameters:**

| Param | Type | Example | Notes |
|---|---|---|---|
| `resolution` | string | `15min` | `1min` \| `5min` \| `15min` \| `1hr` |
| `includeHumidity` | boolean | `true` | Include humidity readings if sensor supports it |

- **Response (200 OK):**
```json
{
  "bookingRef": "CR-2024-MUM-00847",
  "compliancePercent": 99.8,
  "breachCount": 0,
  "totalExcursionMinutes": 0,
  "sla": {
    "upperBreachLimitC": -15.0,
    "lowerBreachLimitC": -25.0,
    "chamberSetpointC": -18.0,
    "label": "-18°C TO -25°C SLA"
  },
  "stats": {
    "minTempC": -19.2,
    "maxTempC": -17.8,
    "mktC": -18.4,
    "avgHumidityPercent": 78.4
  },
  "chartMeta": {
    "xAxisStart": "2026-11-10T08:00:00Z",
    "xAxisEnd": "2026-11-11T18:30:00Z",
    "yAxisMinC": -26,
    "yAxisMaxC": -14,
    "lines": [
      { "id": "upper_breach", "labelKey": "Upper Breach Limit", "valueC": -15.0, "style": "dashed_red" },
      { "id": "setpoint", "labelKey": "Chamber Setpoint", "valueC": -18.0, "style": "dashed_green" },
      { "id": "lower_breach", "labelKey": "Lower Breach Limit", "valueC": -25.0, "style": "dashed_blue" },
      { "id": "actual_temp", "labelKey": "Actual Temperature", "style": "solid_green" }
    ]
  },
  "readings": [
    {
      "timestamp": "2026-11-10T08:00:00Z",
      "tempC": -18.5,
      "humidityPercent": 78.2,
      "gpsLat": 19.2813,
      "gpsLng": 73.0529,
      "locationLabel": "Bhiwandi Depot"
    },
    {
      "timestamp": "2026-11-10T08:15:00Z",
      "tempC": -18.4,
      "humidityPercent": 78.5,
      "gpsLat": 19.2900,
      "gpsLng": 73.0600,
      "locationLabel": null
    },
    {
      "timestamp": "2026-11-11T18:30:00Z",
      "tempC": -18.3,
      "humidityPercent": 77.9,
      "gpsLat": 12.8456,
      "gpsLng": 77.6603,
      "locationLabel": "Electronic City Dock"
    }
  ],
  "excursionEvents": []
}
```

> **MKT Note:** Mean Kinetic Temperature (MKT) is a WHO/GDP pharmaceutical standard metric that accounts for the cumulative thermal effect on cargo over time. Including this makes the platform pharma-grade and suitable for vaccines, biologics, and temperature-sensitive medicines.

> **GPS on readings:** Each temperature reading includes `gpsLat`, `gpsLng`, and `locationLabel` (when available) so the frontend can correlate any temperature spike with the truck's exact location at that moment — critical for insurance and excursion investigations.

---

### API 2: Get Door Sensor & Excursion Event Log

- **Method:** `GET`
- **Endpoint:** `/api/v1/trips/{bookingId}/analytics/door-log`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > Every time the reefer door was opened during the trip, the IoT sensor records it. This API returns that full log with timestamps, location, duration, and the type of door opening (Loading, Authorized inspection, Unplanned). The customer uses this to verify that no unauthorized door opening happened during transit — a key requirement for pharmaceutical and FSSAI audits.
- **Response (200 OK):**
```json
{
  "bookingRef": "CR-2024-MUM-00847",
  "totalDoorOpenings": 2,
  "unplannedOpenings": 0,
  "breachCount": 0,
  "doorEvents": [
    {
      "eventId": "door_001",
      "openedAt": "2026-11-10T09:12:00Z",
      "closedAt": "2026-11-10T09:30:00Z",
      "durationMinutes": 18,
      "locationLabel": "Bhiwandi Bay",
      "eventType": "loading",
      "eventTypeBadge": "LOADING",
      "tempAtOpenC": -18.2,
      "tempAtCloseC": -18.0,
      "isAuthorized": true
    },
    {
      "eventId": "door_002",
      "openedAt": "2026-11-10T14:45:00Z",
      "closedAt": "2026-11-10T14:47:30Z",
      "durationMinutes": 2.5,
      "locationLabel": "Highway RTO Security",
      "eventType": "authorized_inspection",
      "eventTypeBadge": "AUTHORIZED",
      "tempAtOpenC": -18.3,
      "tempAtCloseC": -18.4,
      "isAuthorized": true
    }
  ]
}
```

**`eventType` values:** `loading` | `authorized_inspection` | `unloading` | `unplanned`

---

### API 3: Export Certified Temperature Report (PDF)

- **Method:** `GET`
- **Endpoint:** `/api/v1/trips/{bookingId}/analytics/export`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > The customer's quality manager or regulatory team needs a certified, tamper-evident PDF of the full temperature log to submit to FSSAI inspectors, insurance companies, or pharma clients. This API generates that official PDF report on the backend — with the temperature chart, compliance stats, MKT value, door log, and a ColdRoute digital certification stamp — and returns a secure download link.
- **Query Parameters:**

| Param | Type | Example | Notes |
|---|---|---|---|
| `format` | string | `pdf` | Fixed as `pdf` for Phase 1 |
| `includeChart` | boolean | `true` | Include temperature graph image in PDF |
| `includeDoorLog` | boolean | `true` | Include door sensor event log in PDF |

- **Response (200 OK):**
```json
{
  "reportId": "rpt_00234",
  "bookingRef": "CR-2024-MUM-00847",
  "downloadUrl": "https://cdn.coldroute.in/reports/CR-2024-MUM-00847_temp_cert.pdf?token=xyz&expires=3600",
  "fileName": "ColdRoute_TempCertificate_CR-2024-MUM-00847.pdf",
  "certificationStamp": "ColdRoute Certified · IoT Verified · Tamper-Evident",
  "generatedAt": "2026-11-11T10:22:00Z",
  "expiresInSeconds": 3600
}
```

---


## Screen 17: Documents Vault (App-Wide & Trip Scoped)

> **What the user sees:** The complete compliance, freight paperwork, and proof-of-delivery vault across all shipments. Features category filter tabs (All documents, Invoices, Lorry receipts, Proof of delivery, E-way bills, Temperature reports), a search bar ("Search document or shipment..."), a shipment dropdown filter ("All shipments" or specific shipment), document cards/rows with status badges (Available, Verified, Signed), one-click "↓ Download" buttons, and an "↑ Upload document" button at the top.

---

### API 1: Fetch Documents List (Global & Filtered)

- **Method:** `GET`
- **Endpoint:** `/api/v1/documents`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > Powers the main Documents Vault screen. The customer can filter documents by category tab (e.g. "Proof of delivery" or "Invoices"), search by keyword or shipment number (e.g. "CR-2048"), or select a specific shipment from the dropdown. The API returns all matching records across all historical and active shipments, with their verification status and direct download links.
- **Query Parameters:**

| Param | Type | Example | Notes |
|---|---|---|---|
| `category` | string | `proof_of_delivery` | `all` \| `invoices` \| `lorry_receipts` \| `proof_of_delivery` \| `eway_bills` \| `temperature_reports` |
| `shipmentId` | string | `CR-2048` | Optional. Filter by specific booking/shipment reference |
| `search` | string | `INV-2048` | Text search across document titles, shipment IDs, and reference numbers |
| `page` | integer | `1` | Pagination |
| `limit` | integer | `20` | Records per page |

- **Response (200 OK):**
```json
{
  "countsByCategory": {
    "all": 5,
    "invoices": 1,
    "lorry_receipts": 1,
    "proof_of_delivery": 1,
    "eway_bills": 1,
    "temperature_reports": 1
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalRecords": 5,
    "totalPages": 1
  },
  "documents": [
    {
      "docId": "doc_inv_2048",
      "docName": "Tax Invoice · INV-2048",
      "shipmentNumber": "CR-2048",
      "category": "invoices",
      "typeLabel": "Invoice",
      "generatedDateFormatted": "10 Nov 2026",
      "generatedAt": "2026-11-10T19:00:00Z",
      "statusBadge": "Available",
      "statusCode": "available",
      "badgeColor": "green",
      "fileFormat": "pdf",
      "telematicsHash": null,
      "isCustomerUploaded": false
    },
    {
      "docId": "doc_lr_2048",
      "docName": "Lorry Receipt · LR-2048",
      "shipmentNumber": "CR-2048",
      "category": "lorry_receipts",
      "typeLabel": "LR",
      "generatedDateFormatted": "10 Nov 2026",
      "generatedAt": "2026-11-10T09:00:00Z",
      "statusBadge": "Available",
      "statusCode": "available",
      "badgeColor": "green",
      "fileFormat": "pdf",
      "telematicsHash": null,
      "isCustomerUploaded": false
    },
    {
      "docId": "doc_ewb_781204",
      "docName": "E-way Bill · EWB-781204",
      "shipmentNumber": "CR-2048",
      "category": "eway_bills",
      "typeLabel": "E-way bill",
      "generatedDateFormatted": "10 Nov 2026",
      "generatedAt": "2026-11-10T09:05:00Z",
      "statusBadge": "Verified",
      "statusCode": "verified",
      "badgeColor": "cyan",
      "fileFormat": "pdf",
      "telematicsHash": null,
      "isCustomerUploaded": false
    },
    {
      "docId": "doc_temp_2038",
      "docName": "Temperature excursion report",
      "shipmentNumber": "CR-2038",
      "category": "temperature_reports",
      "typeLabel": "Temperature",
      "generatedDateFormatted": "07 Nov 2026",
      "generatedAt": "2026-11-07T18:00:00Z",
      "statusBadge": "Available",
      "statusCode": "available",
      "badgeColor": "green",
      "fileFormat": "pdf",
      "telematicsHash": "sha256:8f2a1c0d4e9b...",
      "isCustomerUploaded": false
    },
    {
      "docId": "doc_pod_2038",
      "docName": "Digital proof of delivery",
      "shipmentNumber": "CR-2038",
      "category": "proof_of_delivery",
      "typeLabel": "POD",
      "generatedDateFormatted": "07 Nov 2026",
      "generatedAt": "2026-11-07T17:45:00Z",
      "statusBadge": "Signed",
      "statusCode": "signed",
      "badgeColor": "teal",
      "fileFormat": "pdf",
      "telematicsHash": null,
      "isCustomerUploaded": false
    }
  ]
}
```

> **Note on Trip Scoping:** When opening documents from a single trip screen (e.g. Screen 12 or 14), the app can call `GET /api/v1/documents?shipmentId=CR-2048` to get only documents for that specific consignment.

---

### API 2: Get Document Download URL

- **Method:** `GET`
- **Endpoint:** `/api/v1/documents/{docId}/download`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > When the customer clicks "↓ Download" next to any document row, this API generates a secure, time-limited presigned URL (valid for 1 hour). The customer can save or view the PDF on their device without exposing raw backend storage links.
- **Response (200 OK):**
```json
{
  "docId": "doc_inv_2048",
  "docName": "Tax Invoice · INV-2048",
  "downloadUrl": "https://cdn.coldroute.in/docs/INV-2048.pdf?token=sec_abc123&expires=3600",
  "fileName": "ColdRoute_TaxInvoice_INV-2048.pdf",
  "expiresInSeconds": 3600,
  "generatedAt": "2026-11-11T10:50:00Z"
}
```

---

### API 3: Upload Customer Document

- **Method:** `POST`
- **Endpoint:** `/api/v1/documents/upload`
- **Headers:** `Authorization: Bearer <accessToken>`, `Content-Type: multipart/form-data`
- **Why It Is Needed (Simple Words):**
  > Powers the "↑ Upload document" button at the top of the Documents Vault. Allows shippers to upload their own trade papers (e.g., FSSAI license, marine insurance certificates, customs passes, commercial invoices) and optionally tag them to a specific shipment.
- **Request Body (multipart/form-data):**

| Field | Type | Required | Notes |
|---|---|---|---|
| `file` | File | ✅ Yes | PDF, JPG, PNG — max 10 MB |
| `docLabel` | string | ✅ Yes | E.g., "Transit Insurance Certificate" |
| `category` | string | ✅ Yes | `invoices` \| `lorry_receipts` \| `proof_of_delivery` \| `eway_bills` \| `temperature_reports` \| `other` |
| `shipmentId` | string | Optional | Link document to a specific shipment (e.g. `CR-2048`) |

- **Response (201 Created):**
```json
{
  "docId": "doc_cust_0091",
  "docName": "Transit Insurance Certificate",
  "shipmentNumber": "CR-2048",
  "statusBadge": "Available",
  "statusCode": "available",
  "uploadedAt": "2026-11-11T10:52:00Z",
  "fileUrl": "https://cdn.coldroute.in/uploads/customer/doc_cust_0091.pdf"
}
```

---


## Screen 18: Claims & Disputes

> **What the user sees:** A list of active and historical claims with status badges (Under Review, Approved, Rejected), a 24-hour excursion claim warning banner, a "+ Raise Claim" button, claim value, issue description, and a "View Evidence Pack" button per claim.

> [!IMPORTANT]
> **Post-Trip 24-Hour Excursion Claim Window:** Claims for temperature deviation, thawing, or physical shortage must be registered within 24 hours of e-POD generation. The backend enforces this window — claims submitted after 24 hours are automatically flagged as `late_submission`.

---

### API 1: Fetch Claims List (Active & Historical)

- **Method:** `GET`
- **Endpoint:** `/api/v1/claims`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > When the customer opens the Claims & Disputes screen, this API returns all their claims — both active ones (Under Review) and historical ones (Approved, Rejected, Settled). It also returns the count badge ("1 UNDER REVIEW") shown at the top of the list so the customer can see at a glance how many claims are pending action.
- **Query Parameters:**

| Param | Type | Example | Notes |
|---|---|---|---|
| `status` | string | `under_review` | `all` \| `under_review` \| `approved` \| `rejected` \| `settled` |
| `page` | integer | `1` | Pagination |
| `limit` | integer | `20` | Records per page |

- **Response (200 OK):**
```json
{
  "countByStatus": {
    "all": 1,
    "under_review": 1,
    "approved": 0,
    "rejected": 0,
    "settled": 0
  },
  "claims": [
    {
      "claimId": "CLM-2024-0082",
      "shipmentRef": "CR-2024-BLR-00650",
      "status": "under_review",
      "statusBadge": "UNDER REVIEW",
      "issueLabel": "Temperature spike above 14°C at delivery dock",
      "claimCategory": "temperature_excursion",
      "claimValueMinor": 2850000,
      "claimValueFormatted": "₹28,500",
      "filedAt": "2026-11-10T10:00:00Z",
      "isWithin24HrWindow": true,
      "lastUpdatedAt": "2026-11-11T09:00:00Z"
    }
  ]
}
```

---

### API 2: Submit New Claim Pack (Raise 24-Hour SLA Claim)

- **Method:** `POST`
- **Endpoint:** `/api/v1/claims`
- **Headers:** `Authorization: Bearer <accessToken>`, `Content-Type: multipart/form-data`
- **Why It Is Needed (Simple Words):**
  > When the customer taps "+ Raise Claim", fills the modal, and taps "Submit Claim Pack", this API records the formal SLA compensation claim. It accepts the shipment reference, claim category, claim value, the customer's written description of the issue, the incident date/time, and all evidence files (IoT logger export, photos, invoice). The backend then timestamps the claim, checks if it's within the 24-hour window, and routes it to the ColdRoute disputes team for review.

> [!NOTE]
> **2 fields added beyond the prototype modal:**
> - `issueDescription` — free-text field for the customer to describe the issue in their own words. Required to populate the `issueLabel` shown in the claims list.
> - `incidentDatetime` — when the excursion occurred. Backend auto-suggests this from trip telemetry, but customer can confirm or correct it.

- **Request Body (multipart/form-data):**

| Field | Type | Required | Notes |
|---|---|---|---|
| `shipmentId` | string | ✅ Yes | Selected from dropdown — links to booking |
| `claimCategory` | string | ✅ Yes | `temperature_excursion` \| `physical_shortage` \| `cargo_damage` \| `delay` \| `other` |
| `claimValueMinor` | integer | ✅ Yes | In paise — e.g. 3500000 for ₹35,000 |
| `evidenceType` | string | ✅ Yes | Selected from dropdown: `photos_and_probe`, `temperature_log`, `handover_evidence`, `invoice` |
| `issueDescription` | string | ✅ Yes | Free text — customer's description of the incident |
| `incidentDatetime` | ISO timestamp | ✅ Yes | When the excursion/damage occurred |
| `evidenceFiles` | File[] | ✅ Yes | PDF/JPG/PNG — logger file, photos, invoice — max 10 MB each |

- **Response (201 Created):**
```json
{
  "claimId": "CLM-2024-0083",
  "shipmentRef": "CR-2024-MUM-00847",
  "status": "under_review",
  "claimCategory": "temperature_excursion",
  "claimValueMinor": 3500000,
  "claimValueFormatted": "₹35,000",
  "filedAt": "2026-11-11T10:32:00Z",
  "isWithin24HrWindow": true,
  "evidencePackUrl": "https://cdn.coldroute.in/claims/CLM-2024-0083/evidence_pack.zip",
  "message": "Claim submitted. Our disputes team will review within 2 business days."
}
```

**`claimCategory` display labels:**

| Code | Display Label |
|---|---|
| `temperature_excursion` | Temperature Excursion / Thawing |
| `physical_shortage` | Physical Shortage |
| `cargo_damage` | Cargo Damage |
| `delay` | Delivery Delay |
| `other` | Other |

---

### API 3: View Evidence Pack

- **Method:** `GET`
- **Endpoint:** `/api/v1/claims/{claimId}/evidence`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > When the customer taps "View Evidence Pack" on a claim card, this API returns all the evidence files and auto-attached system data for that claim — the customer-uploaded files (photos, logger export, invoice) plus the system-auto-attached documents (temperature certificate, e-POD, trip telemetry snapshot). The customer can review exactly what has been submitted to the disputes team.
- **Response (200 OK):**
```json
{
  "claimId": "CLM-2024-0082",
  "shipmentRef": "CR-2024-BLR-00650",
  "evidenceFiles": [
    {
      "fileId": "ev_001",
      "label": "IoT Logger Export",
      "source": "customer_upload",
      "fileUrl": "https://cdn.coldroute.in/claims/CLM-2024-0082/logger_export.pdf",
      "uploadedAt": "2026-11-10T10:05:00Z"
    },
    {
      "fileId": "ev_002",
      "label": "Delivery Dock Photo",
      "source": "customer_upload",
      "fileUrl": "https://cdn.coldroute.in/claims/CLM-2024-0082/dock_photo.jpg",
      "uploadedAt": "2026-11-10T10:05:00Z"
    },
    {
      "fileId": "ev_003",
      "label": "Temperature Audit Certificate",
      "source": "system_auto",
      "fileUrl": "https://cdn.coldroute.in/docs/CR-2024-BLR-00650_temp_cert.pdf",
      "uploadedAt": "2026-11-10T09:00:00Z"
    },
    {
      "fileId": "ev_004",
      "label": "e-POD (Signed by Consignee)",
      "source": "system_auto",
      "fileUrl": "https://cdn.coldroute.in/epod/CR-2024-BLR-00650_epod.pdf",
      "uploadedAt": "2026-11-10T09:00:00Z"
    }
  ]
}
```

**`source` values:**
- `customer_upload` → files the customer uploaded when raising the claim
- `system_auto` → documents the backend automatically attached from the Documents Vault (Temp Certificate, e-POD, telemetry snapshot)

---

### API 4: Add Claim Remark / Send Appeal Update

- **Method:** `POST`
- **Endpoint:** `/api/v1/claims/{claimId}/remarks`
- **Headers:** `Authorization: Bearer <accessToken>`, `Content-Type: multipart/form-data`
- **Why It Is Needed (Simple Words):**
  > Powers the "Claim details" modal when the customer types in "Add a remark / appeal note" and taps "Send update". Allows shippers to respond to queries from the dispute team, submit additional context or evidence files when status is "Evidence requested", or file an appeal if they disagree with a decision.
- **Request Body (multipart/form-data):**

| Field | Type | Required | Notes |
|---|---|---|---|
| `remark` | string | ✅ Yes | The context or explanation typed by customer |
| `additionalFiles` | File[] | Optional | Additional photos, lab test reports, or temperature logs |

- **Response (200 OK):**
```json
{
  "claimId": "CLM-2024-0082",
  "status": "under_review",
  "message": "Update submitted successfully. Dispute team will review within 2 business days.",
  "totalFilesReceived": 4,
  "nextUpdateDue": "Within 2 business days",
  "updatedAt": "2026-11-11T11:05:00Z"
}
```

---


## Screen 19: Account & Settings

> **What the user sees:** Verified company and profile details (User Name, Company Name, GSTIN, FSSAI License, Approved Credit Line with Net terms), DPDP Statutory Data Rights (Consent withdrawal, Data export, Account & PII erasure), Language selector, Alert notification preferences, 24/7 Support contact, and Logout.

---

### API 1: Fetch Account & Business Settings Profile

- **Method:** `GET`
- **Endpoint:** `/api/v1/customer/account`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > When the customer opens the Account & Settings tab, this API returns their complete corporate profile: contact name, legal entity name, GSTIN and FSSAI numbers with verification badges, active credit limit with payment terms (e.g. ₹5,00,000 Net 30), and current DPDP consent status.
- **Response (200 OK):**
```json
{
  "profile": {
    "customerId": "cust_001",
    "fullName": "Arjun Sharma",
    "mobileNumber": "+919876543210",
    "email": "arjun.sharma@acmecoldfoods.com",
    "preferredLanguage": "en"
  },
  "business": {
    "companyName": "Acme Cold Foods Pvt Ltd",
    "isGstinVerified": true,
    "gstin": "27AABCU9603R1ZX",
    "isFssaiVerified": true,
    "fssaiLicense": "10015022000001",
    "verificationBadge": "GSTIN & FSSAI VERIFIED"
  },
  "credit": {
    "status": "approved",
    "creditLimitMinor": 50000000,
    "creditLimitFormatted": "₹5,00,000",
    "paymentTerms": "Net 30",
    "creditAvailableMinor": 38500000,
    "creditAvailableFormatted": "₹3,85,000"
  },
  "notifications": {
    "whatsappEnabled": true,
    "smsEnabled": true,
    "emailEnabled": true,
    "excursionAlertsEnabled": true
  },
  "dpdp": {
    "consentVersion": "v1.2",
    "consentedAt": "2026-11-01T10:00:00Z",
    "optionalConsentsGranted": true
  },
  "appMeta": {
    "currentVersion": "v1.0.4",
    "supportPhone": "+911800266300",
    "supportEmail": "noc@coldroute.in",
    "termsUrl": "https://coldroute.in/terms",
    "privacyPolicyUrl": "https://coldroute.in/privacy"
  }
}
```

---

### API 2: Update App Preferences & Notifications

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/customer/preferences`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > Allows the customer to change their regional language (English, Hindi, Marathi, Kannada, etc.) and toggle communication preferences for WhatsApp, SMS, and temperature excursion notifications without altering their core KYC or business profile.
- **Request Body:**
```json
{
  "preferredLanguage": "hi",
  "whatsappEnabled": true,
  "smsEnabled": true,
  "excursionAlertsEnabled": true
}
```
- **Response (200 OK):**
```json
{
  "status": "updated",
  "preferredLanguage": "hi",
  "whatsappEnabled": true,
  "smsEnabled": true,
  "excursionAlertsEnabled": true,
  "updatedAt": "2026-11-11T10:35:00Z"
}
```

---

### API 3: Withdraw Optional DPDP Consents

- **Method:** `POST`
- **Endpoint:** `/api/v1/compliance/dpdp/withdraw-consent`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > Powers the "🔓 Withdraw Optional Consents" button. Under the Digital Personal Data Protection (DPDP) Act 2023, customers have the legal right to revoke non-essential processing consents (such as promotional messaging or behavioral analytics) at any time, while keeping active shipments and statutory billing intact.
- **Request Body:**
```json
{
  "withdrawAnalytics": true,
  "withdrawMarketing": true,
  "reason": "Requested via Settings screen"
}
```
- **Response (200 OK):**
```json
{
  "status": "withdrawn",
  "optionalConsentsActive": false,
  "statutoryConsentActive": true,
  "receiptRef": "DPDP-WDR-2026-00412",
  "effectiveAt": "2026-11-11T10:35:00Z",
  "message": "Optional marketing & analytics consents revoked successfully. Statutory service logs remain active for tax & transit compliance."
}
```

---

### API 4: Download Platform Data (DPDP Data Portability)

- **Method:** `POST`
- **Endpoint:** `/api/v1/compliance/dpdp/export-data`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > Powers the "📦 Download My Platform Data (JSON/CSV)" button. Under DPDP Act 2023 data portability mandates, the user can request a complete, machine-readable export of all their personal data, booking history, ledger records, and telemetry archives.
- **Request Body:**
```json
{
  "format": "zip_json_csv",
  "deliveryChannel": "email_link"
}
```
- **Response (202 Accepted):**
```json
{
  "requestId": "export_dpdp_8921",
  "status": "processing",
  "message": "Your complete platform data archive is being assembled. A secure, password-protected download link will be emailed to arjun.sharma@acmecoldfoods.com within 15 minutes.",
  "expiresInHours": 24
}
```

---

### API 5: Request Account & PII Erasure (Right to be Forgotten)

- **Method:** `POST`
- **Endpoint:** `/api/v1/compliance/dpdp/erasure-request`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > Powers the red "⚠️ Request Account & PII Erasure" button. Under the DPDP Act 2023, a customer can submit a formal request to purge their personal identification data. The backend checks for active in-transit shipments or unpaid credit dues before opening a formal 30-day statutory cooling and compliance erasure case.
- **Request Body:**
```json
{
  "confirmationText": "ERASE_MY_ACCOUNT",
  "reason": "Corporate account consolidation",
  "otp": "491823"
}
```
- **Response (200 OK):**
```json
{
  "ticketId": "DPDP-ERA-2026-0099",
  "status": "pending_verification",
  "activeShipmentBlockers": 0,
  "unpaidBalanceMinor": 0,
  "coolingPeriodDays": 30,
  "scheduledPurgeDate": "2026-12-11T10:35:00Z",
  "statutoryRetentionNotice": "Under GST Act 2017 & Carriage by Road Act 2007, financial invoices and e-POD records will be preserved for 7 years in immutable cold storage, with all personal identifiers anonymized.",
  "message": "Erasure request registered. Confirmation SMS sent to registered mobile."
}
```

---

## Screen 20: Help & Support (Ops Desk & Ticketing)

> **What the user sees:** Accessed from Home Screen ("Get support") or Settings. Shows a list of active and past support tickets with status tags (`In progress`, `Awaiting you`, `Resolved`), a 24/7 Operations Desk card with one-touch "Call operations" button and email, a "+ New ticket" button opening a ticket creation modal, and Quick Help FAQs.

---

### API 1: Fetch Help & Support Overview

- **Method:** `GET`
- **Endpoint:** `/api/v1/support/overview`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > When the customer opens the Help & Support screen, this API loads everything needed: the list of their recent support tickets (with count of open issues, e.g. "2 open"), direct emergency helpline numbers for the 24/7 cold-chain control desk, and contact email for general billing and paperwork queries.
- **Response (200 OK):**
```json
{
  "openTicketsCount": 2,
  "supportTickets": [
    {
      "ticketId": "TK-1208",
      "displayCode": "#TK-1208",
      "title": "Temperature data query",
      "shipmentNumber": "CR-2048",
      "status": "in_progress",
      "statusLabel": "In progress",
      "badgeColor": "orange",
      "lastUpdatedFormatted": "Updated 10 Nov, 10:45 AM",
      "updatedAt": "2026-11-10T10:45:00Z"
    },
    {
      "ticketId": "TK-1192",
      "displayCode": "#TK-1192",
      "title": "Invoice correction",
      "shipmentNumber": "CR-2038",
      "status": "awaiting_customer",
      "statusLabel": "Awaiting you",
      "badgeColor": "blue",
      "lastUpdatedFormatted": "Updated 08 Nov, 03:20 PM",
      "updatedAt": "2026-11-08T15:20:00Z"
    },
    {
      "ticketId": "TK-1168",
      "displayCode": "#TK-1168",
      "title": "Booking confirmation",
      "shipmentNumber": "CR-2029",
      "status": "resolved",
      "statusLabel": "Resolved",
      "badgeColor": "green",
      "lastUpdatedFormatted": "Closed 02 Nov",
      "updatedAt": "2026-11-02T16:00:00Z"
    }
  ],
  "contactChannels": {
    "operationsDesk": {
      "label": "24/7 operations desk",
      "description": "For active shipment emergencies",
      "phoneNumber": "+911800266300",
      "phoneDisplay": "1800-266-300 (Toll Free)"
    },
    "supportEmail": {
      "label": "General queries & documents",
      "email": "support@coldroute.in"
    }
  },
  "quickHelpFaqs": [
    {
      "id": "faq_01",
      "question": "How do I download the minute-by-minute temperature report?",
      "answerUrl": "https://coldroute.in/help/temp-reports"
    },
    {
      "id": "faq_02",
      "question": "What is the 24-hour excursion claim deadline?",
      "answerUrl": "https://coldroute.in/help/claims-window"
    }
  ]
}
```

---

### API 2: Create Support Ticket

- **Method:** `POST`
- **Endpoint:** `/api/v1/support/tickets`
- **Headers:** `Authorization: Bearer <accessToken>`, `Content-Type: multipart/form-data`
- **Why It Is Needed (Simple Words):**
  > Powers the "Create support ticket" modal. When the customer has an issue, they select the relevant shipment from a dropdown (e.g., `CR-2048`), choose the issue category (e.g., `Shipment status`, `Invoice correction`, `Temperature query`), write a description, and optionally attach photos or invoices. Submitting routes the ticket to ColdRoute's 24/7 customer ops queue.
- **Request Body (multipart/form-data):**

| Field | Type | Required | Notes |
|---|---|---|---|
| `shipmentNumber` | string | Optional | Linked shipment (e.g. `CR-2048` or empty for general account query) |
| `issueCategory` | string | ✅ Yes | `shipment_status` \| `temperature_query` \| `invoice_correction` \| `booking_issue` \| `other` |
| `description` | string | ✅ Yes | Free text detailing the problem |
| `attachments` | File[] | Optional | Photos, invoices, or screenshots (max 3 files, 10MB each) |

- **Response (201 Created):**
```json
{
  "ticketId": "TK-1209",
  "displayCode": "#TK-1209",
  "shipmentNumber": "CR-2048",
  "issueCategory": "shipment_status",
  "status": "in_progress",
  "statusLabel": "In progress",
  "createdAt": "2026-11-11T10:55:00Z",
  "estimatedResponseMinutes": 15,
  "message": "Ticket created. An operations specialist will review and respond within 15 minutes."
}
```

---

### API 3: Get Ticket Conversation & Reply

- **Method:** `GET`
- **Endpoint:** `/api/v1/support/tickets/{ticketId}`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Why It Is Needed (Simple Words):**
  > When a customer taps on an existing ticket card (especially one marked `Awaiting you`), this API fetches the entire message history between the customer and the ColdRoute support agent. It allows both parties to chat, share updates, and mark the issue as resolved.
- **Response (200 OK):**
```json
{
  "ticketId": "TK-1192",
  "displayCode": "#TK-1192",
  "title": "Invoice correction",
  "shipmentNumber": "CR-2038",
  "status": "awaiting_customer",
  "statusLabel": "Awaiting you",
  "messages": [
    {
      "senderType": "customer",
      "senderName": "Arjun Sharma",
      "text": "GSTIN number mentioned on INV-2038 has a typo in the last two digits. Please reissue with 27AABCU9603R1ZX.",
      "sentAt": "2026-11-08T14:10:00Z"
    },
    {
      "senderType": "agent",
      "senderName": "Pooja V (ColdRoute Billing Desk)",
      "text": "Hello Arjun, we have verified your GST certificate. Could you please confirm if the billing address remains Bhiwandi depot?",
      "sentAt": "2026-11-08T15:20:00Z"
    }
  ]
}
```
- **Companion Endpoint to Reply:**
  - `POST /api/v1/support/tickets/{ticketId}/messages` — `{ "text": "Yes, Bhiwandi depot is confirmed." }`

---
