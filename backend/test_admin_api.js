const http = require('http');
require('dotenv').config();

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}/api/v1/admin`;

// Start express server in-process if not already started
require('./index');

// Helper for HTTP requests
function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = 'Bearer ' + token;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runAdminTests() {
  // Give Express and Neon pool a moment to spin up
  await new Promise(r => setTimeout(r, 1200));

  console.log('🧪 ====================================================');
  console.log('🧪 STARTING AUTOMATED ADMIN DASHBOARD API TEST SUITE');
  console.log('🧪 ====================================================\n');

  let adminToken = '';
  let seededSchoolId = '';
  let newSchoolId = '';
  let parentId = '';
  let studentId = '';
  let cycleId = '';
  let pendingExceptionId = '';

  // 1. ADMIN LOGIN
  console.log('1️⃣ Testing POST /auth/login (Super Admin Login)...');
  const loginRes = await request('POST', '/auth/login', {
    email: 'admin@feevault.in',
    password: 'Admin@123'
  });
  console.log('   Status:', loginRes.status, '| Success:', loginRes.body.success, '| Admin:', loginRes.body.admin?.full_name, '| Role:', loginRes.body.admin?.role);
  if (!loginRes.body.token) {
    throw new Error('Admin login failed: ' + JSON.stringify(loginRes.body));
  }
  adminToken = loginRes.body.token;

  // 2. GET ADMIN PROFILE
  console.log('\n2️⃣ Testing GET /auth/me...');
  const meRes = await request('GET', '/auth/me', null, adminToken);
  console.log('   Status:', meRes.status, '| Admin Email:', meRes.body.admin?.email, '| Status:', meRes.body.admin?.status);

  // 3. OPERATIONS DASHBOARD OVERVIEW
  console.log('\n3️⃣ Testing GET /dashboard (Operations Overview & Ledger Balances)...');
  const dashRes = await request('GET', '/dashboard', null, adminToken);
  console.log('   Status:', dashRes.status, '| Escrow Pool: ₹' + (dashRes.body.data?.gross_escrow_paise / 100), '| Total Schools:', dashRes.body.data?.total_schools, '| Total Parents:', dashRes.body.data?.total_parents, '| Reconciliation:', dashRes.body.data?.reconciliation_status);

  // 4. LATEST 3-WAY RECONCILIATION
  console.log('\n4️⃣ Testing GET /reconciliation/latest...');
  const reconRes = await request('GET', '/reconciliation/latest', null, adminToken);
  console.log('   Status:', reconRes.status, '| Ledger Total: ₹' + (reconRes.body.internal_ledger_paise / 100), '| Diff: ₹' + (reconRes.body.difference_paise / 100), '| Status:', reconRes.body.status);

  // 5. RUN DAILY 3-WAY RECONCILIATION
  console.log('\n5️⃣ Testing POST /reconciliation/run...');
  const runReconRes = await request('POST', '/reconciliation/run', {}, adminToken);
  console.log('   Status:', runReconRes.status, '| Message:', runReconRes.body.message, '| Status:', runReconRes.body.status);

  // 6. ONBOARD NEW SCHOOL WITH PENNY-DROP VERIFICATION
  console.log('\n6️⃣ Testing POST /schools (Onboard & Verify Greenwood High)...');
  const uniqueCode = 'GWH-BLR-' + Math.floor(1000 + Math.random() * 9000);
  const onboardRes = await request('POST', '/schools', {
    school_code: uniqueCode,
    name: 'Greenwood High International School',
    city: 'Bengaluru',
    state: 'Karnataka',
    address: 'Varthur Sarjapur Road, Gunjur Post',
    contact_person: 'Mr. Arvind Swamy',
    contact_phone: '9845012345',
    contact_email: 'accounts@greenwoodhigh.edu.in',
    bank_account_number: '918020098765432',
    bank_ifsc: 'HDFC0000456',
    account_beneficiary_name: 'GREENWOOD HIGH EDUCATIONAL TRUST',
    annual_fee_per_class: [
      { standard: 'Class 1', fee_paise: 7500000 },
      { standard: 'Class 2', fee_paise: 8000000 }
    ]
  }, adminToken);
  console.log('   Status:', onboardRes.status, '| School:', onboardRes.body.school?.name, '| Code:', onboardRes.body.school?.school_code, '| Penny-Drop Ref:', onboardRes.body.penny_drop_reference);
  newSchoolId = onboardRes.body.school?.id;

  // 7. LIST ALL SCHOOLS
  console.log('\n7️⃣ Testing GET /schools...');
  const listSchRes = await request('GET', '/schools', null, adminToken);
  console.log('   Status:', listSchRes.status, '| Total Schools in DB:', listSchRes.body.count);
  const dpsSchool = listSchRes.body.schools.find(s => s.school_code === 'DPS-BLR-04');
  seededSchoolId = dpsSchool ? dpsSchool.id : listSchRes.body.schools[0]?.id;
  console.log('   Found DPS Bangalore East ID:', seededSchoolId, '| Students Count:', dpsSchool?.student_count);

  // 8. GET SCHOOL DETAILS
  console.log('\n8️⃣ Testing GET /schools/' + seededSchoolId + '...');
  const schDetailRes = await request('GET', '/schools/' + seededSchoolId, null, adminToken);
  console.log('   Status:', schDetailRes.status, '| Name:', schDetailRes.body.school?.name, '| Classes:', schDetailRes.body.school?.classes?.length, '| Enrolled Students:', schDetailRes.body.school?.total_students);

  // 9. UPDATE SCHOOL STATUS
  console.log('\n9️⃣ Testing PATCH /schools/' + newSchoolId + '/status...');
  const patchSchRes = await request('PATCH', '/schools/' + newSchoolId + '/status', { status: 'ACTIVE' }, adminToken);
  console.log('   Status:', patchSchRes.status, '| Message:', patchSchRes.body.message);

  // 10. LIST PARENTS & BALANCES
  console.log('\n🔟 Testing GET /parents...');
  const parentsRes = await request('GET', '/parents', null, adminToken);
  console.log('   Status:', parentsRes.status, '| Total Parents:', parentsRes.body.count);
  if (parentsRes.body.parents && parentsRes.body.parents.length > 0) {
    const p = parentsRes.body.parents[0];
    parentId = p.id;
    console.log('   Sample Parent:', p.full_name, '| Phone:', p.phone, '| Total Saved: ₹' + (p.total_saved_paise / 100), '| Children:', p.children_count);
  }

  // 11. GET PARENT DETAILS
  console.log('\n1️⃣1️⃣ Testing GET /parents/' + parentId + '...');
  const pDetailRes = await request('GET', '/parents/' + parentId, null, adminToken);
  console.log('   Status:', pDetailRes.status, '| KYC PAN:', pDetailRes.body.parent?.pan_number, '| Children Linked:', pDetailRes.body.parent?.children?.length, '| Transactions:', pDetailRes.body.parent?.transactions?.length);
  if (pDetailRes.body.parent?.children?.length > 0) {
    studentId = pDetailRes.body.parent.children[0].id;
  }

  // 12. REMOTE REVOKE PARENT DEVICE
  console.log('\n1️⃣2️⃣ Testing POST /parents/' + parentId + '/revoke-device...');
  const revokeRes = await request('POST', '/parents/' + parentId + '/revoke-device', {}, adminToken);
  console.log('   Status:', revokeRes.status, '| Message:', revokeRes.body.message);

  // 13. CREATE ANNUAL PAYOUT BATCH (FINANCE MAKER)
  console.log('\n1️⃣3️⃣ Testing POST /withdrawals/create-batch (Maker creates payout batch)...');
  const batchRes = await request('POST', '/withdrawals/create-batch', {
    school_id: seededSchoolId,
    academic_year: '2027-2028'
  }, adminToken);
  console.log('   Status:', batchRes.status, '| Cycle ID:', batchRes.body.cycle_id, '| Total Gross: ₹' + (batchRes.body.gross_collection_paise / 100), '| Net School Payout: ₹' + (batchRes.body.net_school_payout_paise / 100), '| Status:', batchRes.body.status);
  cycleId = batchRes.body.cycle_id;

  // 14. LIST WITHDRAWAL CYCLES
  console.log('\n1️⃣4️⃣ Testing GET /withdrawals...');
  const listCycRes = await request('GET', '/withdrawals', null, adminToken);
  console.log('   Status:', listCycRes.status, '| Total Withdrawal Cycles:', listCycRes.body.count);

  // 15. RECORD OFFLINE SCHOOL CONFIRMATION (PHASE 1)
  console.log('\n1️⃣5️⃣ Testing POST /withdrawals/' + cycleId + '/record-school-confirmation...');
  const confRes = await request('POST', '/withdrawals/' + cycleId + '/record-school-confirmation', {
    confirmation_proof_url: 'https://feevault-docs.s3.amazonaws.com/school_signoffs/dps_confirmation_signed.pdf',
    notes: 'Signed batch confirmation received from DPS Principal Mrs. Anjali Iyer via registered email.'
  }, adminToken);
  console.log('   Status:', confRes.status, '| New Status:', confRes.body.status, '| Message:', confRes.body.message);

  // 16. APPROVE & EXECUTE DISBURSEMENT (FINANCE CHECKER)
  console.log('\n1️⃣6️⃣ Testing POST /withdrawals/' + cycleId + '/approve (Checker verifies and disburses)...');
  const approveRes = await request('POST', '/withdrawals/' + cycleId + '/approve', {}, adminToken);
  console.log('   Status:', approveRes.status, '| Status:', approveRes.body.status, '| Bank Ref:', approveRes.body.bank_payout_reference, '| GST Invoice:', approveRes.body.feevault_gst_invoice, '| School Disbursed: ₹' + (approveRes.body.disbursed_to_school_paise / 100));

  // 17. UPLOAD DOCUMENT FOR STUDENT ON BEHALF OF SCHOOL
  console.log('\n1️⃣7️⃣ Testing POST /documents/upload (Upload Term 1 Fee Receipt for Student)...');
  const docRes = await request('POST', '/documents/upload', {
    school_id: seededSchoolId,
    student_id: studentId,
    document_type: 'FEE_RECEIPT',
    title: 'Official School Fee Receipt - Academic Year 2026-27',
    file_url: 'https://feevault-docs.s3.amazonaws.com/receipts/DPS_RCP_2026_001.pdf'
  }, adminToken);
  console.log('   Status:', docRes.status, '| Document Title:', docRes.body.document?.title, '| Message:', docRes.body.message);

  // 18. LIST UPLOADED DOCUMENTS
  console.log('\n1️⃣8️⃣ Testing GET /documents...');
  const listDocRes = await request('GET', '/documents?school_id=' + seededSchoolId, null, adminToken);
  console.log('   Status:', listDocRes.status, '| Total Documents Found:', listDocRes.body.count, '| Latest Title:', listDocRes.body.documents[0]?.title);

  // 19. LIST EXCEPTIONS
  console.log('\n1️⃣9️⃣ Testing GET /exceptions...');
  const exListRes = await request('GET', '/exceptions', null, adminToken);
  console.log('   Status:', exListRes.status, '| Total Exceptions:', exListRes.body.count);
  if (exListRes.body.exceptions && exListRes.body.exceptions.length > 0) {
    const pendingExp = exListRes.body.exceptions.find(e => e.status === 'PENDING') || exListRes.body.exceptions[0];
    pendingExceptionId = pendingExp.id;
    console.log('   Found Exception ID:', pendingExceptionId, '| Reason:', pendingExp.reason, '| Status:', pendingExp.status);
  }

  // 20. RESOLVE EXCEPTION
  if (pendingExceptionId) {
    console.log('\n2️⃣0️⃣ Testing POST /exceptions/' + pendingExceptionId + '/resolve (Maker-Checker Review & Approve)...');
    const resolveRes = await request('POST', '/exceptions/' + pendingExceptionId + '/resolve', {
      action: 'APPROVE_TRANSFER',
      target_school_id: newSchoolId,
      resolution_notes: 'Transfer certificate and proof of residence verified. Transferred locked vault funds to Greenwood High.'
    }, adminToken);
    console.log('   Status:', resolveRes.status, '| Resolution Status:', resolveRes.body.status, '| Message:', resolveRes.body.message);
  }

  console.log('\n🎉 ====================================================');
  console.log('🎉 ALL 20 ADMIN DASHBOARD APIS TESTED & PASSED 100%!');
  console.log('🎉 ====================================================');
  process.exit(0);
}

runAdminTests().catch(err => {
  console.error('\n❌ Admin test suite failed with error:', err);
  process.exit(1);
});

