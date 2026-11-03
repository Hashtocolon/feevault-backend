// ============================================================
// FeeVault Admin — Mock Data (Phase 1)
// All amounts in paise (₹1 = 100 paise) unless noted
// ============================================================

export const mockDashboard = {
  gross_escrow: 286400000,      // paise → ₹28.64 Cr
  accrued_interest: 4280000,    // paise → ₹42.80 L
  platform_fee: 1840000,        // paise → ₹18.40 L
  gst_liability: 331200,        // paise → ₹3.31 L
  total_schools: 128,
  active_parents: 12450,
  pending_exceptions: 4,
  recon_status: 'ZERO_MISMATCH',
  internal_ledger: 286400000,
  bank_statement: 286400000,
  escrow_pool: 286400000,
  monthly_flow: [
    { month: 'May', amount: 1240000000, pct: 42 },
    { month: 'Jun', amount: 1510000000, pct: 52 },
    { month: 'Jul', amount: 1780000000, pct: 60 },
    { month: 'Aug', amount: 2090000000, pct: 72 },
    { month: 'Sep', amount: 2340000000, pct: 80 },
    { month: 'Oct', amount: 2620000000, pct: 90 },
    { month: 'Nov', amount: 2864000000, pct: 100 },
  ],
  action_queue: [
    { id: 'AQ001', title: 'Annual Payout Batch · DPS East', desc: 'School sign-off recorded. Awaiting Finance Checker approval.', type: 'DISBURSE' },
    { id: 'AQ002', title: 'MoU Verification · Greenwood High', desc: 'Signed agreement & penny-drop verified bank details.', type: 'VERIFY' },
    { id: 'AQ003', title: 'Exception Refund · Parent #P-8821', desc: '₹12,400 refund request. School approved. Checker needed.', type: 'APPROVE' },
  ],
  system_health: [
    { name: 'Ledger Engine', status: 'HEALTHY', uptime: '99.98%' },
    { name: 'Escrow API', status: 'HEALTHY', uptime: '99.95%' },
    { name: 'Bank Webhook', status: 'HEALTHY', uptime: '100%' },
    { name: 'Audit Logger', status: 'HEALTHY', uptime: '99.99%' },
  ],
};

export const mockSchools = [
  {
    id: 'SCH001', code: 'DPS-BLR-04', name: 'Delhi Public School Bangalore East',
    city: 'Bengaluru', state: 'Karnataka', students: 450,
    target_fee: 6000000, penny_drop: 'VERIFIED', status: 'ACTIVE',
    contact: 'principal@dpsblr.edu.in', phone: '+91-80-2345-6789',
    bank: 'HDFC Bank', ifsc: 'HDFC0001234', account: '****5678',
    onboarded: '2026-06-15', mou_signed: true,
    classes: [
      { name: 'Class 1', students: 60, fee: 4500000 },
      { name: 'Class 2', students: 58, fee: 4800000 },
      { name: 'Class 3', students: 62, fee: 5200000 },
      { name: 'Class 4', students: 70, fee: 6000000 },
    ],
  },
  {
    id: 'SCH002', code: 'GWH-BLR-02', name: 'Greenwood High International School',
    city: 'Bengaluru', state: 'Karnataka', students: 280,
    target_fee: 7500000, penny_drop: 'VERIFIED', status: 'ACTIVE',
    contact: 'admin@greenwood.edu.in', phone: '+91-80-3456-7890',
    bank: 'ICICI Bank', ifsc: 'ICIC0002345', account: '****9012',
    onboarded: '2026-07-01', mou_signed: true,
    classes: [
      { name: 'Class 1', students: 90, fee: 7500000 },
      { name: 'Class 2', students: 95, fee: 8000000 },
    ],
  },
  {
    id: 'SCH003', code: 'RPS-HYD-01', name: 'Ryan Public School Hyderabad',
    city: 'Hyderabad', state: 'Telangana', students: 620,
    target_fee: 5500000, penny_drop: 'VERIFIED', status: 'ACTIVE',
    contact: 'finance@ryan.edu.in', phone: '+91-40-2345-6789',
    bank: 'Axis Bank', ifsc: 'UTIB0001234', account: '****3456',
    onboarded: '2026-07-15', mou_signed: true,
    classes: [],
  },
  {
    id: 'SCH004', code: 'BPS-CHN-05', name: 'Besant Montessori High School',
    city: 'Chennai', state: 'Tamil Nadu', students: 340,
    target_fee: 6800000, penny_drop: 'PENDING', status: 'SUSPENDED',
    contact: 'admin@besant.edu.in', phone: '+91-44-5678-9012',
    bank: 'SBI', ifsc: 'SBIN0001234', account: '****7890',
    onboarded: '2026-08-01', mou_signed: false,
    classes: [],
  },
  {
    id: 'SCH005', code: 'KVS-DEL-12', name: 'Kendriya Vidyalaya Sec-12 Delhi',
    city: 'New Delhi', state: 'Delhi', students: 890,
    target_fee: 3200000, penny_drop: 'VERIFIED', status: 'ACTIVE',
    contact: 'kv12delhi@kvs.gov.in', phone: '+91-11-2345-6789',
    bank: 'Union Bank', ifsc: 'UBIN0001234', account: '****1234',
    onboarded: '2026-09-01', mou_signed: true,
    classes: [],
  },
];

export const mockParents = [
  {
    id: 'PAR001', name: 'Ananya Krishnan', email: 'ananya.k@gmail.com',
    phone: '+91-98765-43210', vault_balance: 1240000, kyc_status: 'VERIFIED',
    device_id: 'DEVICE-UUID-001', created_at: '2026-06-20',
    children: [
      { id: 'STU001', name: 'Aarav Krishnan', class: 'Class 4', school: 'DPS-BLR-04', fee: 6000000 },
    ],
    transactions: [
      { id: 'TXN001', type: 'DEPOSIT', amount: 500000, date: '2026-10-15', status: 'SUCCESS' },
      { id: 'TXN002', type: 'DISBURSEMENT', amount: 250000, date: '2026-10-01', status: 'SUCCESS' },
      { id: 'TXN003', type: 'DEPOSIT', amount: 300000, date: '2026-09-18', status: 'SUCCESS' },
    ],
  },
  {
    id: 'PAR002', name: 'Rajesh Sharma', email: 'rajesh.s@outlook.com',
    phone: '+91-87654-32109', vault_balance: 890000, kyc_status: 'VERIFIED',
    device_id: 'DEVICE-UUID-002', created_at: '2026-07-05',
    children: [
      { id: 'STU002', name: 'Priya Sharma', class: 'Class 1', school: 'GWH-BLR-02', fee: 7500000 },
    ],
    transactions: [
      { id: 'TXN004', type: 'DEPOSIT', amount: 400000, date: '2026-10-12', status: 'SUCCESS' },
    ],
  },
  {
    id: 'PAR003', name: 'Meena Pillai', email: 'meena.p@yahoo.com',
    phone: '+91-76543-21098', vault_balance: 2150000, kyc_status: 'PENDING',
    device_id: 'DEVICE-UUID-003', created_at: '2026-07-20',
    children: [
      { id: 'STU003', name: 'Kiran Pillai', class: 'Class 2', school: 'GWH-BLR-02', fee: 8000000 },
    ],
    transactions: [],
  },
  {
    id: 'PAR004', name: 'Suresh Patel', email: 'suresh.p@gmail.com',
    phone: '+91-65432-10987', vault_balance: 560000, kyc_status: 'FAILED',
    device_id: null, created_at: '2026-08-10',
    children: [],
    transactions: [],
  },
  {
    id: 'PAR005', name: 'Lakshmi Nair', email: 'lakshmi.n@gmail.com',
    phone: '+91-54321-09876', vault_balance: 3400000, kyc_status: 'VERIFIED',
    device_id: 'DEVICE-UUID-005', created_at: '2026-08-22',
    children: [
      { id: 'STU004', name: 'Arjun Nair', class: 'Class 3', school: 'DPS-BLR-04', fee: 5200000 },
      { id: 'STU005', name: 'Diya Nair', class: 'Class 1', school: 'DPS-BLR-04', fee: 4500000 },
    ],
    transactions: [
      { id: 'TXN005', type: 'DEPOSIT', amount: 1000000, date: '2026-10-05', status: 'SUCCESS' },
      { id: 'TXN006', type: 'DEPOSIT', amount: 800000, date: '2026-09-10', status: 'SUCCESS' },
    ],
  },
];

export const mockEscrow = {
  gross_escrow: 286400000,
  composition: [
    { label: 'DPS Bangalore East', amount: 109200000, pct: 38.1 },
    { label: 'Ryan Public Hyderabad', amount: 74624000, pct: 26.1 },
    { label: 'Greenwood High', amount: 51552000, pct: 18.0 },
    { label: 'KV Delhi', amount: 34368000, pct: 12.0 },
    { label: 'Others (124 schools)', amount: 16656000, pct: 5.8 },
  ],
  accrued_interest: 4280000,
  platform_revenue: 1840000,
  gst_liability: 331200,
  interest_rate: 6.85,
  bank: 'ICICI Pooled Escrow Account',
  account_no: 'ICICI-ESCROW-7892',
  last_sync: '2026-11-03T07:50:00Z',
};

export const mockReconciliation = {
  last_run: '2026-11-03T02:00:00Z',
  status: 'ZERO_MISMATCH',
  internal_ledger: 286400000,
  bank_statement: 286400000,
  escrow_pool: 286400000,
  mismatches: [],
  history: [
    { date: '2026-11-03', status: 'ZERO_MISMATCH', delta: 0 },
    { date: '2026-11-02', status: 'ZERO_MISMATCH', delta: 0 },
    { date: '2026-11-01', status: 'RESOLVED', delta: 150000 },
    { date: '2026-10-31', status: 'ZERO_MISMATCH', delta: 0 },
    { date: '2026-10-30', status: 'ZERO_MISMATCH', delta: 0 },
    { date: '2026-10-29', status: 'MISMATCH', delta: 500000 },
  ],
};

export const mockPayouts = [
  {
    id: 'BATCH001', school: 'DPS Bangalore East', school_code: 'DPS-BLR-04',
    amount: 109200000, term: 'Annual Payout FY 2026-27',
    maker: 'ops_team@feevault.in', status: 'SCHOOL_CONFIRMED',
    created_at: '2026-11-01', school_confirmed_at: '2026-11-02',
    students: 450, utr: null,
  },
  {
    id: 'BATCH002', school: 'Greenwood High', school_code: 'GWH-BLR-02',
    amount: 51552000, term: 'Q3 Disbursement',
    maker: 'ops_team@feevault.in', status: 'PENDING_SCHOOL',
    created_at: '2026-11-02', school_confirmed_at: null,
    students: 280, utr: null,
  },
  {
    id: 'BATCH003', school: 'Ryan Public Hyderabad', school_code: 'RPS-HYD-01',
    amount: 74624000, term: 'Annual Payout FY 2026-27',
    maker: 'finance@feevault.in', status: 'DISBURSED',
    created_at: '2026-10-20', school_confirmed_at: '2026-10-22',
    students: 620, utr: 'ICICI202610201234567',
  },
];

export const mockDocuments = [
  {
    id: 'DOC001', school_code: 'DPS-BLR-04', school: 'Delhi Public School Bangalore East',
    type: 'MOU', filename: 'DPS-BLR-04_MOU_FY2627.pdf',
    uploaded_by: 'admin@feevault.in', uploaded_at: '2026-06-15', status: 'ACTIVE',
  },
  {
    id: 'DOC002', school_code: 'GWH-BLR-02', school: 'Greenwood High International',
    type: 'BANK_MANDATE', filename: 'GWH-BLR-02_Mandate_Q3.pdf',
    uploaded_by: 'ops@feevault.in', uploaded_at: '2026-10-10', status: 'ACTIVE',
  },
  {
    id: 'DOC003', school_code: 'DPS-BLR-04', school: 'Delhi Public School Bangalore East',
    type: 'SCHOOL_CONFIRMATION', filename: 'DPS-BLR-04_Annual_Confirmation.pdf',
    uploaded_by: 'admin@feevault.in', uploaded_at: '2026-11-02', status: 'ACTIVE',
  },
  {
    id: 'DOC004', school_code: 'RPS-HYD-01', school: 'Ryan Public School Hyderabad',
    type: 'MOU', filename: 'RPS-HYD-01_MOU_FY2627.pdf',
    uploaded_by: 'admin@feevault.in', uploaded_at: '2026-07-20', status: 'ACTIVE',
  },
];

export const mockExceptions = [
  {
    id: 'EXC001', parent: 'Ananya Krishnan', parent_id: 'PAR001',
    school: 'DPS Bangalore East', type: 'REFUND_REQUEST',
    amount: 1240000, reason: 'School transfer — child relocated to Mumbai. Full refund requested.',
    status: 'PENDING', created_at: '2026-11-01', sla_hours: 48,
    hours_elapsed: 32,
  },
  {
    id: 'EXC002', parent: 'Rajesh Sharma', parent_id: 'PAR002',
    school: 'Greenwood High', type: 'EARLY_WITHDRAWAL',
    amount: 500000, reason: 'Medical emergency — family financial hardship. Partial withdrawal requested.',
    status: 'PENDING', created_at: '2026-11-02', sla_hours: 48,
    hours_elapsed: 12,
  },
  {
    id: 'EXC003', parent: 'Lakshmi Nair', parent_id: 'PAR005',
    school: 'DPS Bangalore East', type: 'TRANSFER_TO_SCHOOL',
    amount: 250000, reason: 'Parent opted for early disbursal for term-1 fees.',
    status: 'APPROVED', created_at: '2026-10-28', sla_hours: 48,
    hours_elapsed: 48,
  },
  {
    id: 'EXC004', parent: 'Suresh Patel', parent_id: 'PAR004',
    school: 'Besant Montessori', type: 'REFUND_REQUEST',
    amount: 560000, reason: 'KYC failed permanently. Full refund of deposited amount.',
    status: 'REJECTED', created_at: '2026-10-25', sla_hours: 48,
    hours_elapsed: 72,
  },
];

export const mockFinance = {
  commission_pct: 1.0,
  gst_pct: 18.0,
  tds_applicable: true,
  tds_pct: 10.0,
  current_quarter: 'Q3 FY 2026-27',
  revenue: [
    { month: 'Aug 26', commission: 280000, gst: 50400, tds: 28000 },
    { month: 'Sep 26', commission: 340000, gst: 61200, tds: 34000 },
    { month: 'Oct 26', commission: 410000, gst: 73800, tds: 41000 },
    { month: 'Nov 26', commission: 180000, gst: 32400, tds: 18000 },
  ],
  gstr1_status: 'PENDING FILING',
  form16a_ready: false,
};

export const mockAuditLogs = [
  { id: 'LOG001', actor: 'admin@feevault.in', action: 'ADMIN_LOGIN', entity: 'admin_auth', ip: '103.45.12.89', ts: '2026-11-03T07:32:00Z', result: 'SUCCESS' },
  { id: 'LOG002', actor: 'admin@feevault.in', action: 'SCHOOL_ONBOARD', entity: 'DPS-BLR-04', ip: '103.45.12.89', ts: '2026-11-03T07:35:12Z', result: 'SUCCESS' },
  { id: 'LOG003', actor: 'ops@feevault.in', action: 'PAYOUT_BATCH_CREATE', entity: 'BATCH001', ip: '103.45.12.90', ts: '2026-11-01T10:00:00Z', result: 'SUCCESS' },
  { id: 'LOG004', actor: 'finance@feevault.in', action: 'BATCH_APPROVE', entity: 'BATCH003', ip: '103.45.12.91', ts: '2026-10-22T14:30:00Z', result: 'SUCCESS' },
  { id: 'LOG005', actor: 'support@feevault.in', action: 'DEVICE_REVOKE', entity: 'PAR004', ip: '103.45.12.92', ts: '2026-10-24T09:15:00Z', result: 'SUCCESS' },
  { id: 'LOG006', actor: 'compliance@feevault.in', action: 'EXCEPTION_RESOLVE', entity: 'EXC003', ip: '103.45.12.93', ts: '2026-10-28T16:00:00Z', result: 'SUCCESS' },
  { id: 'LOG007', actor: 'admin@feevault.in', action: 'RECON_RUN', entity: 'RECON', ip: '103.45.12.89', ts: '2026-11-03T02:00:00Z', result: 'SUCCESS' },
  { id: 'LOG008', actor: 'finance@feevault.in', action: 'DOCUMENT_UPLOAD', entity: 'DOC001', ip: '103.45.12.91', ts: '2026-06-15T11:20:00Z', result: 'SUCCESS' },
];

export const mockTeam = [
  { id: 'USR001', name: 'Vikram Anand', email: 'admin@feevault.in', role: 'SUPER_ADMIN', status: 'ACTIVE', last_login: '2026-11-03T07:32:00Z' },
  { id: 'USR002', name: 'Priti Kapoor', email: 'ops@feevault.in', role: 'OPS', status: 'ACTIVE', last_login: '2026-11-03T06:10:00Z' },
  { id: 'USR003', name: 'Rajan Mehta', email: 'finance@feevault.in', role: 'FINANCE_MAKER', status: 'ACTIVE', last_login: '2026-11-02T15:00:00Z' },
  { id: 'USR004', name: 'Deepa Nair', email: 'checker@feevault.in', role: 'FINANCE_CHECKER', status: 'ACTIVE', last_login: '2026-11-02T16:30:00Z' },
  { id: 'USR005', name: 'Arun Sinha', email: 'support@feevault.in', role: 'SUPPORT', status: 'ACTIVE', last_login: '2026-11-01T09:00:00Z' },
  { id: 'USR006', name: 'Kavitha Iyer', email: 'compliance@feevault.in', role: 'COMPLIANCE_AUDITOR', status: 'INACTIVE', last_login: '2026-10-28T12:00:00Z' },
];

export const mockSettings = {
  commission_pct: 1.0,
  gst_pct: 18.0,
  sla_hours: 48,
  min_deposit: 100000,
  max_deposit: 50000000,
  interest_rate: 6.85,
  auto_recon: true,
  two_fa: false,
  ip_whitelist: ['103.45.12.89', '103.45.12.90'],
};

// Helpers
export const fmt = (paise) => {
  const rupees = paise / 100;
  if (rupees >= 10000000) return `₹${(rupees / 10000000).toFixed(2)} Cr`;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(2)} L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}K`;
  return `₹${rupees.toLocaleString('en-IN')}`;
};

export const fmtFull = (paise) => {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
};

export const roleLabels = {
  SUPER_ADMIN: 'Super Admin',
  OPS: 'Ops Manager',
  FINANCE_MAKER: 'Finance Maker',
  FINANCE_CHECKER: 'Finance Checker',
  SUPPORT: 'Support',
  COMPLIANCE_AUDITOR: 'Compliance Auditor',
};

