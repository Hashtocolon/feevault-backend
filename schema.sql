-- =====================================================================
-- ColdRoute Phase 1 (FTL) — Production PostgreSQL Database Schema
-- Target: Render PostgreSQL (Free & Production Tiers)
-- Description: Complete relational schema matching all 20 screens of 
--              the Customer Mobile App, live IoT telemetry, e-PODs,
--              DPDP compliance, statutory E-Way Bills, and claims.
-- =====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 2. CUSTOM DOMAIN ENUMS
-- =====================================================================

CREATE TYPE user_role AS ENUM (
    'customer',
    'driver',
    'ops_admin',
    'finance_admin',
    'dispute_manager'
);

CREATE TYPE company_entity_type AS ENUM (
    'individual',
    'proprietorship',
    'pvt_ltd',
    'public_ltd',
    'llp',
    'partnership'
);

CREATE TYPE hiring_model_type AS ENUM (
    'on_call',
    'dedicated_monthly',
    'annual_contract'
);

CREATE TYPE vehicle_class_code AS ENUM (
    'tata_407_14ft',
    'eicher_20ft',
    'bharatbenz_24ft',
    'multi_axle_32ft'
);

CREATE TYPE temp_band_type AS ENUM (
    'deep_frozen',        -- -25°C to -18°C (Ice cream, seafood, meat)
    'chilled',            -- +2°C to +8°C (Dairy, vaccines, biologics)
    'controlled_ambient', -- +15°C to +25°C (Chocolates, pharma)
    'ultra_low'           -- -70°C (Special biologics/dry ice)
);

CREATE TYPE dietary_flag_type AS ENUM (
    'vegetarian',
    'non_vegetarian',
    'jain',
    'halal'
);

CREATE TYPE booking_status_type AS ENUM (
    'draft',
    'searching',
    'assigned',
    'pre_cooling',
    'at_pickup',
    'loading',
    'in_transit',
    'at_checkpoint',
    'at_delivery',
    'delivered',
    'disputed',
    'cancelled',
    'failed_delivery'
);

CREATE TYPE epod_outcome_type AS ENUM (
    'full_acceptance',
    'partial_acceptance',
    'excursion_claim',
    'full_rejection'
);

CREATE TYPE claim_status_type AS ENUM (
    'draft',
    'under_review',
    'evidence_requested',
    'approved',
    'rejected',
    'settled'
);

CREATE TYPE ticket_status_type AS ENUM (
    'open',
    'in_progress',
    'awaiting_customer',
    'resolved',
    'closed'
);

CREATE TYPE document_category_type AS ENUM (
    'invoices',
    'lorry_receipts',
    'proof_of_delivery',
    'eway_bills',
    'temperature_reports',
    'compliance',
    'other'
);

CREATE TYPE hygiene_grade_type AS ENUM (
    'grade_a',
    'grade_b',
    'grade_c'
);

-- =====================================================================
-- 3. CORE IDENTITY & AUTHENTICATION
-- =====================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mobile_number VARCHAR(15) UNIQUE NOT NULL, -- e.g. +919876543210
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(150),
    role user_role NOT NULL DEFAULT 'customer',
    preferred_language VARCHAR(5) DEFAULT 'en', -- en, hi, mr, kn, etc.
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE auth_otps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mobile_number VARCHAR(15) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    channel VARCHAR(10) DEFAULT 'sms',
    attempts_count INT DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 4. CUSTOMER PROFILE, KYC & BUSINESS ENTITY
-- =====================================================================

CREATE TABLE customer_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(200) NOT NULL,
    trade_name VARCHAR(200),
    entity_type company_entity_type NOT NULL DEFAULT 'pvt_ltd',
    pan_number VARCHAR(10),
    
    -- GSTIN Verification
    gstin VARCHAR(15) UNIQUE,
    is_gstin_verified BOOLEAN DEFAULT FALSE,
    gstin_verified_at TIMESTAMPTZ,
    gstin_legal_name VARCHAR(200),
    gstin_state_code VARCHAR(2),
    
    -- FSSAI Food Safety Licensing
    fssai_license_number VARCHAR(14),
    is_fssai_verified BOOLEAN DEFAULT FALSE,
    fssai_verified_at TIMESTAMPTZ,
    
    -- Pharma Gating Drug License (CDSCO Schedule C/C1)
    drug_license_number VARCHAR(50),
    is_drug_license_approved BOOLEAN DEFAULT FALSE,
    drug_license_doc_url TEXT,
    
    registered_address TEXT,
    pincode VARCHAR(6),
    city VARCHAR(100),
    state VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DPDP Act 2023 Statutory Consents
CREATE TABLE dpdp_consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
    consent_version VARCHAR(10) DEFAULT 'v1.2',
    
    -- Mandatory statutory operational processing
    service_fulfillment_granted BOOLEAN DEFAULT TRUE,
    iot_telematics_tracking_granted BOOLEAN DEFAULT TRUE,
    statutory_tax_invoicing_granted BOOLEAN DEFAULT TRUE,
    
    -- Optional revocable processing
    marketing_promotions_granted BOOLEAN DEFAULT FALSE,
    behavioral_analytics_granted BOOLEAN DEFAULT FALSE,
    
    ip_address VARCHAR(45),
    user_agent TEXT,
    consented_at TIMESTAMPTZ DEFAULT NOW(),
    optional_withdrawn_at TIMESTAMPTZ
);

-- DPDP Data Portability & Right to be Forgotten Requests
CREATE TABLE dpdp_data_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
    request_type VARCHAR(30) NOT NULL, -- 'data_export' | 'erasure_request'
    status VARCHAR(30) DEFAULT 'processing', -- 'processing', 'completed', 'cooling_period'
    cooling_period_ends_at TIMESTAMPTZ,
    export_download_url TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- =====================================================================
-- 5. COMMERCIALS, CREDIT & CONTRACTS
-- =====================================================================

CREATE TABLE credit_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'frozen'
    credit_limit_minor BIGINT DEFAULT 0, -- stored in paise (₹5,00,000 = 50000000)
    utilised_credit_minor BIGINT DEFAULT 0,
    payment_terms VARCHAR(20) DEFAULT 'Net 30', -- 'Net 30', 'Net 15', 'Advance'
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE master_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
    contract_ref VARCHAR(50) UNIQUE NOT NULL, -- e.g. 'CTR-2026-ACME-01'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    committed_volume_trips INT DEFAULT 0,
    remaining_volume_trips INT DEFAULT 0,
    rate_card_json JSONB, -- lane rates, per-km slab, detention rates
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 6. SAVED DEPOTS, LOCATIONS & STOPS
-- =====================================================================

CREATE TABLE saved_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL, -- e.g. "Bhiwandi Cold Storage (Primary)"
    location_type VARCHAR(20) DEFAULT 'warehouse', -- 'warehouse', 'plant', 'dock', 'cold_store'
    address TEXT NOT NULL,
    pincode VARCHAR(6) NOT NULL,
    contact_person VARCHAR(100) NOT NULL,
    contact_phone VARCHAR(15) NOT NULL,
    gate_dock_number VARCHAR(50),
    access_instructions TEXT,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 7. FLEET, VEHICLES & DRIVERS (SHARED WITH DRIVER APP)
-- =====================================================================

CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    full_name VARCHAR(150) NOT NULL,
    mobile_number VARCHAR(15) UNIQUE NOT NULL,
    license_number VARCHAR(30) UNIQUE NOT NULL,
    hygiene_grade hygiene_grade_type DEFAULT 'grade_a',
    average_rating NUMERIC(2, 1) DEFAULT 5.0,
    trips_completed INT DEFAULT 0,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_number VARCHAR(20) UNIQUE NOT NULL, -- e.g. 'MH 01 AB 1234'
    vehicle_class vehicle_class_code NOT NULL,
    payload_capacity_kg INT NOT NULL,
    min_temp_c NUMERIC(4, 1) DEFAULT -25.0,
    max_temp_c NUMERIC(4, 1) DEFAULT 25.0,
    reefer_unit_brand VARCHAR(50), -- Carrier, Thermo King, etc.
    has_door_sensor BOOLEAN DEFAULT TRUE,
    primary_tracker_imei VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 8. BOOKINGS & TRIP LIFECYCLE
-- =====================================================================

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_ref VARCHAR(30) UNIQUE NOT NULL, -- e.g. 'CR-2024-MUM-00847'
    customer_id UUID NOT NULL REFERENCES customer_profiles(id),
    hiring_model hiring_model_type NOT NULL DEFAULT 'on_call',
    contract_id UUID REFERENCES master_contracts(id),
    
    -- Vehicle & Temp SLA Specification
    vehicle_class vehicle_class_code NOT NULL,
    temp_band temp_band_type NOT NULL,
    sla_min_temp_c NUMERIC(4, 1) NOT NULL,
    sla_max_temp_c NUMERIC(4, 1) NOT NULL,
    target_setpoint_c NUMERIC(4, 1) NOT NULL,
    
    -- Origin Pickup
    origin_city VARCHAR(100) NOT NULL,
    origin_address TEXT NOT NULL,
    origin_pincode VARCHAR(6) NOT NULL,
    origin_lat NUMERIC(10, 7),
    origin_lng NUMERIC(10, 7),
    origin_contact_name VARCHAR(100) NOT NULL,
    origin_contact_phone VARCHAR(15) NOT NULL,
    origin_access_instructions TEXT,
    pickup_window_start TIMESTAMPTZ NOT NULL,
    pickup_window_end TIMESTAMPTZ NOT NULL,
    
    -- Destination Delivery
    destination_city VARCHAR(100) NOT NULL,
    destination_address TEXT NOT NULL,
    destination_pincode VARCHAR(6) NOT NULL,
    destination_lat NUMERIC(10, 7),
    destination_lng NUMERIC(10, 7),
    destination_contact_name VARCHAR(100) NOT NULL,
    destination_contact_phone VARCHAR(15) NOT NULL,
    destination_gate_dock VARCHAR(50),
    scheduled_delivery_eta TIMESTAMPTZ,
    
    -- Lifecycle State
    status booking_status_type DEFAULT 'searching',
    sub_status_label VARCHAR(50) DEFAULT 'SEARCHING REEFER', -- e.g. '• AT TOLL CHECKPOINT'
    
    -- Driver & Vehicle Assignment
    assigned_driver_id UUID REFERENCES drivers(id),
    assigned_vehicle_id UUID REFERENCES vehicles(id),
    assigned_at TIMESTAMPTZ,
    
    -- Statutory Compliance Papers
    lr_number VARCHAR(30) UNIQUE, -- Auto-generated Autonomous Lorry Receipt (e.g. 'LR-2024-847')
    eway_bill_number VARCHAR(30),
    eway_bill_status VARCHAR(20) DEFAULT 'generated', -- 'generated', 'verified', 'exempt'
    eway_bill_valid_until TIMESTAMPTZ,
    consignee_gstin VARCHAR(15),
    
    -- Telematics Security & Locks
    digital_seal_number VARCHAR(30), -- e.g. '#SL-4471'
    is_seal_locked BOOLEAN DEFAULT TRUE,
    is_precooling_passed BOOLEAN DEFAULT FALSE,
    precooling_verified_temp_c NUMERIC(4, 1),
    precooling_verified_at TIMESTAMPTZ,
    
    -- Consignee Handover & Delivery Verification
    delivery_otp_hash VARCHAR(255) NOT NULL, -- 4-digit handover OTP
    share_token VARCHAR(100) UNIQUE NOT NULL, -- Token for no-login web portal
    share_token_expires_at TIMESTAMPTZ NOT NULL,
    
    -- Route & Geometry
    total_distance_km NUMERIC(7, 2),
    route_polyline_encoded TEXT, -- Encoded route waypoints for Google Maps
    
    -- Financials (in Paise)
    fare_base_minor BIGINT NOT NULL DEFAULT 0,
    fare_reefer_surcharge_minor BIGINT NOT NULL DEFAULT 0,
    fare_multistop_minor BIGINT NOT NULL DEFAULT 0,
    fare_tolls_minor BIGINT NOT NULL DEFAULT 0,
    fare_gst_minor BIGINT NOT NULL DEFAULT 0,
    fare_total_minor BIGINT NOT NULL DEFAULT 0,
    free_detention_minutes INT DEFAULT 60,
    detention_rate_per_hour_minor BIGINT DEFAULT 50000, -- ₹500/hr
    
    payment_method VARCHAR(30) DEFAULT 'business_credit',
    payment_status VARCHAR(20) DEFAULT 'authorized',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Multi-Stop Waypoints (Up to 5 stops)
CREATE TABLE booking_stops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    sequence_no INT NOT NULL,
    stop_label VARCHAR(10) NOT NULL, -- 'A1', 'A2', 'B1', 'B2'
    stop_type VARCHAR(10) NOT NULL,  -- 'pickup', 'drop'
    address TEXT NOT NULL,
    pincode VARCHAR(6) NOT NULL,
    contact_name VARCHAR(100) NOT NULL,
    contact_phone VARCHAR(15) NOT NULL,
    gate_dock_number VARCHAR(50),
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    scheduled_arrival TIMESTAMPTZ,
    actual_arrival TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- =====================================================================
-- 9. CARGO LINES & FOOD SAFETY SEGREGATION
-- =====================================================================

CREATE TABLE cargo_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- 'frozen_dairy_desserts', 'seafood', 'pharma', etc.
    description TEXT NOT NULL,
    packaging_type VARCHAR(50) NOT NULL, -- 'insulated_cartons', 'euro_pallets', 'crates'
    quantity_cartons INT NOT NULL,
    weight_kg NUMERIC(8, 2) NOT NULL,
    declared_value_minor BIGINT NOT NULL, -- in paise
    dietary_flag dietary_flag_type NOT NULL DEFAULT 'vegetarian',
    allergens TEXT[], -- e.g. ARRAY['milk', 'shellfish', 'nuts']
    handling_instructions TEXT,
    assigned_pickup_stop_id UUID REFERENCES booking_stops(id),
    assigned_drop_stop_id UUID REFERENCES booking_stops(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 10. REAL-TIME IOT TELEMATICS & AUDIT TRAIL
-- =====================================================================

CREATE TABLE telematics_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    chamber_temp_c NUMERIC(4, 1) NOT NULL,
    probe_temp_c NUMERIC(4, 1),
    humidity_percent NUMERIC(4, 1),
    speed_kmh NUMERIC(5, 1) DEFAULT 0,
    heading_deg NUMERIC(5, 1),
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    iot_source VARCHAR(20) DEFAULT 'dual', -- 'ble_hardware', 'driver_mobile', 'dual'
    is_mismatch_detected BOOLEAN DEFAULT FALSE,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Door Sensor Open / Close Log
CREATE TABLE door_sensor_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    opened_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,
    duration_minutes NUMERIC(5, 1),
    location_label VARCHAR(150),
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    event_type VARCHAR(30) DEFAULT 'loading', -- 'loading', 'authorized_inspection', 'unloading', 'unplanned'
    temp_at_open_c NUMERIC(4, 1),
    temp_at_close_c NUMERIC(4, 1),
    is_authorized BOOLEAN DEFAULT TRUE
);

-- =====================================================================
-- 11. DELIVERY HANDOVER, E-POD & FAILED DELIVERY
-- =====================================================================

CREATE TABLE epods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    outcome epod_outcome_type NOT NULL,
    receiver_name VARCHAR(150) NOT NULL,
    receiver_designation VARCHAR(100) NOT NULL,
    otp_verified BOOLEAN NOT NULL DEFAULT TRUE,
    handover_core_temp_c NUMERIC(4, 1),
    carton_count_received INT NOT NULL DEFAULT 0,
    carton_count_rejected INT NOT NULL DEFAULT 0,
    rejection_reason TEXT,
    data_logger_serial_number VARCHAR(50),
    receiver_remarks TEXT,
    cargo_disposition_instruction VARCHAR(100), -- 'Return to Bhiwandi Origin Depot'
    signature_image_url TEXT,
    epod_pdf_url TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE epod_evidence_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    epod_id UUID NOT NULL REFERENCES epods(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    caption VARCHAR(100),
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Failed Delivery Emergency Decisions (Step 8)
CREATE TABLE failed_delivery_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    driver_reported_reason VARCHAR(100) NOT NULL, -- 'dock_closed', 'receiver_absent', 'otp_refused'
    reported_at TIMESTAMPTZ DEFAULT NOW(),
    customer_decision VARCHAR(30), -- 'alternate_contact', 'retry_later', 'return_to_origin'
    alternate_contact_name VARCHAR(100),
    alternate_contact_phone VARCHAR(15),
    alternate_gate_dock VARCHAR(50),
    retry_scheduled_time TIMESTAMPTZ,
    waiting_charges_approved BOOLEAN DEFAULT FALSE,
    return_fare_minor BIGINT DEFAULT 0,
    resolved_at TIMESTAMPTZ
);

-- Post-Trip 5-Star & Hygiene Rating (Step 9)
CREATE TABLE trip_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customer_profiles(id),
    driver_id UUID REFERENCES drivers(id),
    rating_stars INT CHECK (rating_stars >= 1 AND rating_stars <= 5),
    hygiene_grade_observed hygiene_grade_type DEFAULT 'grade_a',
    tags TEXT[],
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 12. DOCUMENTS VAULT (PAPERWORK & CERTIFICATES)
-- =====================================================================

CREATE TABLE shipment_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customer_profiles(id),
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    doc_name VARCHAR(150) NOT NULL,
    doc_type VARCHAR(50) NOT NULL, -- 'lorry_receipt', 'eway_bill', 'temp_audit_certificate', 'epod', 'tax_invoice', 'customer_upload'
    category document_category_type NOT NULL DEFAULT 'other',
    file_format VARCHAR(10) DEFAULT 'pdf',
    file_url TEXT NOT NULL,
    telematics_hash VARCHAR(100), -- SHA-256 tamper-evident telematics hash
    is_customer_uploaded BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'ready', -- 'ready', 'pending'
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 13. CLAIMS, DISPUTES & EVIDENCE PACKS (24-HR EXCURSION WINDOW)
-- =====================================================================

CREATE TABLE claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_code VARCHAR(30) UNIQUE NOT NULL, -- e.g. 'CLM-2024-0082'
    booking_id UUID NOT NULL REFERENCES bookings(id),
    customer_id UUID NOT NULL REFERENCES customer_profiles(id),
    claim_category VARCHAR(50) NOT NULL, -- 'temperature_excursion', 'physical_shortage', 'cargo_damage', etc.
    claim_value_minor BIGINT NOT NULL, -- in paise (e.g. ₹28,500 = 2850000)
    evidence_type VARCHAR(50), -- 'photos_and_probe', 'temperature_log', etc.
    issue_description TEXT NOT NULL,
    incident_datetime TIMESTAMPTZ NOT NULL,
    status claim_status_type DEFAULT 'under_review',
    is_within_24hr_window BOOLEAN DEFAULT TRUE,
    filed_at TIMESTAMPTZ DEFAULT NOW(),
    settled_at TIMESTAMPTZ
);

CREATE TABLE claim_evidence_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    file_url TEXT NOT NULL,
    file_source VARCHAR(20) DEFAULT 'customer_upload', -- 'customer_upload', 'system_auto'
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE claim_remarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL, -- 'customer', 'dispute_agent'
    remark_text TEXT NOT NULL,
    attachments TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 14. 24/7 SUPPORT & OPS DESK TICKETING
-- =====================================================================

CREATE TABLE support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_code VARCHAR(30) UNIQUE NOT NULL, -- e.g. 'TK-1208'
    customer_id UUID NOT NULL REFERENCES customer_profiles(id),
    booking_id UUID REFERENCES bookings(id),
    issue_category VARCHAR(50) NOT NULL, -- 'shipment_status', 'invoice_correction', 'temperature_query', etc.
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    status ticket_status_type DEFAULT 'in_progress',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ticket_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL, -- 'customer', 'agent'
    sender_name VARCHAR(150) NOT NULL,
    message_text TEXT NOT NULL,
    attachments TEXT[],
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- In-App Direct Driver-Shipper Chat Messages
CREATE TABLE trip_chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL, -- 'customer', 'driver'
    sender_id UUID NOT NULL REFERENCES users(id),
    message_text TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 15. PERFORMANCE OPTIMIZED INDEXES (PRODUCTION READINESS)
-- =====================================================================

-- Quick lookups on customer active shipments & dashboard
CREATE INDEX idx_bookings_customer_status ON bookings(customer_id, status);
CREATE INDEX idx_bookings_booking_ref ON bookings(booking_ref);
CREATE INDEX idx_bookings_lr_number ON bookings(lr_number);
CREATE INDEX idx_bookings_share_token ON bookings(share_token);

-- Fast time-series temperature graph generation
CREATE INDEX idx_telematics_booking_time ON telematics_snapshots(booking_id, recorded_at DESC);

-- Documents vault search and category filters
CREATE INDEX idx_documents_customer_category ON shipment_documents(customer_id, category);
CREATE INDEX idx_documents_booking ON shipment_documents(booking_id);

-- Claims & Support lookups
CREATE INDEX idx_claims_customer ON claims(customer_id, status);
CREATE INDEX idx_support_customer ON support_tickets(customer_id, status);

-- Audit and DPDP lookups
CREATE INDEX idx_dpdp_customer ON dpdp_consents(customer_id);

-- =====================================================================
-- SCHEMA COMPLETED SUCCESSFULLY
-- =====================================================================

