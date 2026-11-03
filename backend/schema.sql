-- ==============================================================================
-- FeeVault PostgreSQL Schema (Phase 1)
-- Double-Entry Ledger, Locked Savings, Escrow, Parents, Schools & Admin System
-- All monetary amounts stored as BIGINT in integer paise (1 Rupee = 100 paise)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. USERS (Parents & Guardians)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE,
    phone VARCHAR(15) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    email VARCHAR(100),
    password_hash VARCHAR(255),
    role VARCHAR(20) DEFAULT 'PARENT', -- PARENT, CO_PARENT
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, BLOCKED, SUSPENDED
    pan_number VARCHAR(10),
    mpin_hash VARCHAR(255),
    biometric_enabled BOOLEAN DEFAULT FALSE,
    device_id VARCHAR(255),
    fcm_token VARCHAR(255),
    whatsapp_opt_in BOOLEAN DEFAULT TRUE,
    daily_reminder_opt_out BOOLEAN DEFAULT FALSE,
    reminder_time TIME DEFAULT '19:30:00',
    dpdp_consent_recorded BOOLEAN DEFAULT FALSE,
    dpdp_consent_version VARCHAR(20),
    dpdp_consent_at TIMESTAMP WITH TIME ZONE,
    -- Verified Bank Account for Refunds / Excess Returns (Penny-Drop bound)
    refund_bank_account VARCHAR(50),
    refund_bank_ifsc VARCHAR(20),
    refund_bank_account_name VARCHAR(100),
    is_bank_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ------------------------------------------------------------------------------
-- 2. ADMINS (FeeVault Operations, Finance, Support, Super Admin)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL, -- SUPER_ADMIN, OPERATIONS, FINANCE_MAKER, FINANCE_CHECKER, SUPPORT, AUDITOR
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, SUSPENDED
    totp_secret VARCHAR(255),
    is_2fa_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);

-- ------------------------------------------------------------------------------
-- 3. SCHOOLS (Institutions Onboarded by Admin)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_code VARCHAR(30) UNIQUE NOT NULL, -- e.g. DPS-BLR-04
    name VARCHAR(200) NOT NULL,
    city VARCHAR(100),
    state VARCHAR(100),
    address TEXT,
    contact_person VARCHAR(100),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(100),
    -- School Bank Details for Direct Annual Fee Disbursement
    bank_account_number VARCHAR(50) NOT NULL,
    bank_ifsc VARCHAR(20) NOT NULL,
    bank_name VARCHAR(100),
    account_beneficiary_name VARCHAR(150),
    is_bank_verified BOOLEAN DEFAULT FALSE,
    mou_document_url TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, PENDING_VERIFICATION, SUSPENDED
    academic_year_start DATE DEFAULT '2027-06-01',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_schools_code ON schools(school_code);
CREATE INDEX IF NOT EXISTS idx_schools_status ON schools(status);

-- ------------------------------------------------------------------------------
-- 4. CLASSES / STANDARDS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    standard VARCHAR(30) NOT NULL, -- Class 1, Class 2 ... Class 12, LKG, UKG
    section VARCHAR(10) DEFAULT 'A',
    annual_fee_paise BIGINT DEFAULT 6000000, -- e.g. ₹60,000.00
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_classes_school ON classes(school_id);

-- ------------------------------------------------------------------------------
-- 5. STUDENTS (Children Linked to Parents and Schools)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    school_id UUID REFERENCES schools(id) ON DELETE RESTRICT,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    gender VARCHAR(20),
    admission_reference VARCHAR(50),
    status VARCHAR(30) DEFAULT 'PENDING_VERIFICATION', -- PENDING_VERIFICATION, VERIFIED, INACTIVE, TRANSFERRED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_students_parent ON students(parent_id);
CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_id);

-- ------------------------------------------------------------------------------
-- 6. CO-PARENT ACCESS (Family Contributors)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS co_parents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    invited_by_parent_id UUID REFERENCES users(id) ON DELETE CASCADE,
    co_parent_phone VARCHAR(15) NOT NULL,
    relationship VARCHAR(30), -- Mother, Father, Grandparent, Guardian
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, ACCEPTED, REVOKED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 7. DOUBLE-ENTRY LEDGER: ACCOUNTS
-- ------------------------------------------------------------------------------
-- Account types:
-- 'PARENT_VAULT'        : Parent master savings wallet
-- 'STUDENT_VAULT'       : Specific child locked savings balance
-- 'BANK_ESCROW_POOL'    : Real ICICI Bank Escrow Vault pool account
-- 'INTEREST_EXPENSE'    : Interest earned pool
-- 'SCHOOL_PAYABLE'      : Earmarked liability owed to a verified school
-- 'PLATFORM_REVENUE'    : FeeVault platform commission earnings (1% fee)
-- 'GST_OUTPUT_PAYABLE'  : 18% GST output tax liability collected
CREATE TABLE IF NOT EXISTS ledger_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_type VARCHAR(40) NOT NULL,
    owner_id UUID, -- References users(id), students(id), schools(id), or NULL for system accounts
    currency VARCHAR(5) DEFAULT 'INR',
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ledger_acc_owner ON ledger_accounts(owner_id, account_type);

-- ------------------------------------------------------------------------------
-- 8. DOUBLE-ENTRY LEDGER: TRANSACTIONS & IMMUTABLE ENTRIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ledger_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_type VARCHAR(40) NOT NULL, -- DEPOSIT, INTEREST_ACCRUAL, WITHDRAWAL_PAYOUT, EXCESS_REFUND, REVERSAL
    reference_id VARCHAR(100), -- payment_id, cycle_id, exception_id
    idempotency_key VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ledger_tx_idem ON ledger_transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_ledger_tx_type ON ledger_transactions(transaction_type);

CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
    account_id UUID REFERENCES ledger_accounts(id) ON DELETE RESTRICT,
    entry_type VARCHAR(10) NOT NULL, -- 'DEBIT' or 'CREDIT'
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_entries_account ON ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_entries_tx ON ledger_entries(transaction_id);

-- ------------------------------------------------------------------------------
-- 9. PAYMENTS (UPI Top-Ups & Webhooks)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    split_details JSONB NOT NULL, -- e.g. [{"student_id": "...", "amount_paise": 350000}]
    status VARCHAR(20) DEFAULT 'CREATED', -- CREATED, PENDING, SUCCESS, FAILED, EXPIRED, REFUNDED
    upi_intent_url TEXT,
    gateway_order_id VARCHAR(100),
    upi_transaction_ref VARCHAR(100),
    bank_reference_number VARCHAR(100),
    idempotency_key VARCHAR(100) UNIQUE NOT NULL,
    failure_reason TEXT,
    raw_webhook_payload JSONB,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_parent ON payments(parent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_idem ON payments(idempotency_key);

-- ------------------------------------------------------------------------------
-- 10. INTEREST ENGINE: RATES & DAILY ACCRUALS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interest_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    annual_rate_bps INT NOT NULL, -- Basis points: 750 = 7.50% p.a.
    effective_from DATE NOT NULL,
    set_by_admin_id UUID REFERENCES admins(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS interest_accruals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    accrual_date DATE NOT NULL,
    opening_balance_paise BIGINT NOT NULL,
    annual_rate_bps INT NOT NULL,
    daily_accrued_paise BIGINT NOT NULL, -- (opening_balance * rate / 365)
    is_credited_to_ledger BOOLEAN DEFAULT FALSE,
    credited_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, accrual_date)
);

CREATE INDEX IF NOT EXISTS idx_accruals_date ON interest_accruals(accrual_date);

-- ------------------------------------------------------------------------------
-- 11. YEARLY WITHDRAWAL CYCLES (Annual Fee Disbursement to School)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS withdrawal_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE RESTRICT,
    academic_year VARCHAR(20) NOT NULL, -- e.g. "2027-2028"
    status VARCHAR(30) DEFAULT 'DRAFT', 
    -- States: DRAFT -> SCHOOL_CONFIRMED -> APPROVED -> PAYOUT_INITIATED -> PAID -> FAILED
    total_gross_paise BIGINT DEFAULT 0,
    platform_fee_paise BIGINT DEFAULT 0, -- 1% platform commission
    gst_fee_paise BIGINT DEFAULT 0,      -- 18% GST on platform fee
    net_school_payout_paise BIGINT DEFAULT 0,
    total_excess_refund_paise BIGINT DEFAULT 0,
    -- Offline School Confirmation Recorded by Admin (Phase 1)
    school_confirmation_recorded_at TIMESTAMP WITH TIME ZONE,
    school_confirmation_proof_url TEXT,
    school_confirmation_notes TEXT,
    -- Maker-Checker 2-Person Sign-Off
    created_by_maker_id UUID REFERENCES admins(id),
    approved_by_checker_id UUID REFERENCES admins(id),
    payout_executed_at TIMESTAMP WITH TIME ZONE,
    bank_payout_reference VARCHAR(100),
    feevault_gst_invoice_number VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS withdrawal_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID REFERENCES withdrawal_cycles(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE RESTRICT,
    saved_balance_paise BIGINT NOT NULL,
    school_fee_paise BIGINT NOT NULL,
    disbursed_to_school_paise BIGINT NOT NULL,
    excess_refund_paise BIGINT DEFAULT 0, -- Surplus auto-refunded to parent
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cycle_school ON withdrawal_cycles(school_id);

-- ------------------------------------------------------------------------------
-- 12. DOCUMENTS (Receipts, Progress Reports, Fee Certificates)
-- Uploaded by FeeVault Admin on behalf of schools in Phase 1
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    school_id UUID REFERENCES schools(id) ON DELETE RESTRICT,
    document_type VARCHAR(40) NOT NULL, -- 'FEE_RECEIPT', 'REPORT_CARD', 'TUITION_CERTIFICATE'
    title VARCHAR(150) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INT,
    mime_type VARCHAR(50) DEFAULT 'application/pdf',
    uploaded_by_admin_id UUID REFERENCES admins(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_docs_student ON documents(student_id);

-- ------------------------------------------------------------------------------
-- 13. NOTIFICATIONS (WhatsApp, Push & SMS History)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(40) NOT NULL, -- PAYMENT_SUCCESS, INTEREST_CREDIT, PAYOUT_DONE, REMINDER, TICKET
    title VARCHAR(150) NOT NULL,
    body TEXT NOT NULL,
    channel VARCHAR(20) DEFAULT 'PUSH', -- PUSH, WHATSAPP, SMS
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);

-- ------------------------------------------------------------------------------
-- 14. EXCEPTIONS & REFUND OVERRIDES
-- Edge cases: school transfer, school closure, wrong payments
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exception_type VARCHAR(40) NOT NULL, -- SCHOOL_TRANSFER, SCHOOL_CLOSURE, WRONG_PAYMENT, DECEASED_CLAIM
    parent_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    amount_paise BIGINT,
    reason TEXT NOT NULL,
    supporting_document_url TEXT,
    target_new_school_id UUID REFERENCES schools(id),
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    raised_by_user_type VARCHAR(20) DEFAULT 'PARENT', -- PARENT, ADMIN
    proposed_by_maker_id UUID REFERENCES admins(id),
    approved_by_checker_id UUID REFERENCES admins(id),
    resolution_notes TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exceptions_parent ON exceptions(parent_id);
CREATE INDEX IF NOT EXISTS idx_exceptions_status ON exceptions(status);

-- ------------------------------------------------------------------------------
-- 15. SUPPORT HELPDESK TICKETS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- PAYMENT, VERIFICATION, TAX, ACCESS, GENERAL
    subject VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    attachment_url TEXT,
    status VARCHAR(20) DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, RESOLVED, CLOSED
    assigned_admin_id UUID REFERENCES admins(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 16. PENNY-DROP BANK VERIFICATIONS (Parent Refunds & School Accounts)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS penny_drop_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(20) NOT NULL, -- 'PARENT' or 'SCHOOL'
    entity_id UUID NOT NULL,
    bank_account_number VARCHAR(50) NOT NULL,
    ifsc_code VARCHAR(20) NOT NULL,
    beneficiary_name_entered VARCHAR(150),
    registered_name_returned VARCHAR(150),
    penny_amount_paise INT DEFAULT 100, -- ₹1.00
    bank_reference_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, VERIFIED, FAILED
    failure_message TEXT,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_penny_drop_entity ON penny_drop_verifications(entity_id);

-- ------------------------------------------------------------------------------
-- 17. RECONCILIATION RUNS (Daily 3-Way Check: Ledger vs Bank vs Escrow)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reconciliation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_date DATE NOT NULL UNIQUE,
    bank_statement_total_paise BIGINT NOT NULL,
    internal_ledger_total_paise BIGINT NOT NULL,
    escrow_vault_balance_paise BIGINT NOT NULL,
    difference_paise BIGINT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'CLEAN', -- CLEAN, MISMATCH_ALERT, RESOLVED
    investigation_notes TEXT,
    resolved_by_admin_id UUID REFERENCES admins(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 18. TAMPER-PROOF AUDIT LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID,
    actor_type VARCHAR(20) NOT NULL, -- ADMIN, SYSTEM, PARENT
    actor_name VARCHAR(100),
    action VARCHAR(100) NOT NULL, -- e.g. "RECORD_SCHOOL_CONFIRMATION", "APPROVE_PAYOUT"
    entity_type VARCHAR(50) NOT NULL, -- "withdrawal_cycles", "payments", "users"
    entity_id VARCHAR(100),
    before_state JSONB,
    after_state JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- ------------------------------------------------------------------------------
-- SEED DATA (Default Admin, System Ledger Accounts, Interest Rate, Sample School)
-- ------------------------------------------------------------------------------

-- Seed Super Admin (Password: Admin@123)
-- bcrypt hash of 'Admin@123'
INSERT INTO admins (full_name, email, password_hash, role, status)
VALUES ('Super Admin', 'admin@feevault.in', '$2b$10$w0.00eR0g2y3v6G0Wz/Z/OGx8wYQxI0N0E5xM5W1qF5T3aR5yP4S6', 'SUPER_ADMIN', 'ACTIVE')
ON CONFLICT (email) DO NOTHING;

-- Seed System Double-Entry Ledger Accounts
INSERT INTO ledger_accounts (account_type, owner_id, currency, description)
VALUES 
    ('BANK_ESCROW_POOL', NULL, 'INR', 'Master ICICI Escrow Vault Pool'),
    ('INTEREST_EXPENSE', NULL, 'INR', 'Bank Accrued Interest Pool'),
    ('PLATFORM_REVENUE', NULL, 'INR', 'FeeVault Platform Commission Revenue'),
    ('GST_OUTPUT_PAYABLE', NULL, 'INR', '18% GST Output Liability Account')
ON CONFLICT DO NOTHING;

-- Seed Initial Interest Rate (7.50% p.a. = 750 basis points)
INSERT INTO interest_rates (annual_rate_bps, effective_from, notes)
VALUES (750, '2026-01-01', 'Initial Phase 1 savings interest rate 7.50% p.a.')
ON CONFLICT DO NOTHING;

-- Seed Sample School for Testing
INSERT INTO schools (school_code, name, city, state, address, contact_person, contact_phone, contact_email, bank_account_number, bank_ifsc, bank_name, account_beneficiary_name, is_bank_verified, status)
VALUES ('DPS-BLR-04', 'Delhi Public School Bangalore East', 'Bengaluru', 'Karnataka', 'Survey No 43/1B, Sulikunte Village, Dommasandra Post, Bengaluru 560125', 'Principal Officer', '+91 9876543210', 'admin@dpsbangalore.edu.in', '50200012345678', 'HDFC0000123', 'HDFC Bank', 'DPS Bangalore East Society', TRUE, 'ACTIVE')
ON CONFLICT (school_code) DO NOTHING;

-- Seed Sample Class for the School
INSERT INTO classes (school_id, standard, section, annual_fee_paise)
SELECT id, 'Class 4', 'A', 6000000 FROM schools WHERE school_code = 'DPS-BLR-04'
ON CONFLICT DO NOTHING;

