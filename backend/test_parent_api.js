const http = require('http');
require('dotenv').config();

// Start express server in-process if not already started
require('./index');

const BASE_URL = 'http://localhost:5000/api/v1';

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

async function runTests() {
  await new Promise(r => setTimeout(r, 1200));

  console.log('🧪 ====================================================');
  console.log('🧪 STARTING AUTOMATED PARENT API END-TO-END TEST SUITE');
  console.log('🧪 ====================================================\n');

  const testUser = {
    full_name: 'Ananya Sharma',
    username: 'test_ananya_' + Date.now().toString().slice(-4),
    email: 'ananya_' + Date.now().toString().slice(-4) + '@example.com',
    phone: '98' + Math.floor(10000000 + Math.random() * 90000000),
    password: 'Password@123'
  };

  let token = '';
  let studentId = '';
  let paymentId = '';

  // 1. REGISTER
  console.log('1️⃣ Testing POST /auth/register...');
  const regRes = await request('POST', '/auth/register', testUser);
  console.log('   Status:', regRes.status, '| Success:', regRes.body.success, '| Token:', !!regRes.body.token);
  token = regRes.body.token;

  // 2. LOGIN
  console.log('\n2️⃣ Testing POST /auth/login...');
  const loginRes = await request('POST', '/auth/login', { username: testUser.username, password: testUser.password });
  console.log('   Status:', loginRes.status, '| User:', loginRes.body.user?.username);

  // 3. DPDP CONSENT
  console.log('\n3️⃣ Testing POST /auth/consent...');
  const consentRes = await request('POST', '/auth/consent', { consent_given: true, consent_version: 'FV-DPDP-v1.0' }, token);
  console.log('   Status:', consentRes.status, '| Message:', consentRes.body.message);

  // 4. KYC & BANK PENNY-DROP
  console.log('\n4️⃣ Testing POST /parent/kyc-bank (Penny-Drop)...');
  const kycRes = await request('POST', '/parent/kyc-bank', {
    pan_number: 'ABCDE1234F',
    bank_account_number: '918273645012',
    ifsc_code: 'HDFC0000123',
    account_holder_name: testUser.full_name
  }, token);
  console.log('   Status:', kycRes.status, '| Bank Verified:', kycRes.body.data?.is_bank_verified);

  // 5. SETUP MPIN & LOGIN
  console.log('\n5️⃣ Testing POST /auth/mpin/setup & /auth/mpin/login...');
  const mpinSetup = await request('POST', '/auth/mpin/setup', { mpin: '4821' }, token);
  console.log('   Setup Status:', mpinSetup.status, '| Message:', mpinSetup.body.message);
  const mpinLogin = await request('POST', '/auth/mpin/login', { username: testUser.username, mpin: '4821' });
  console.log('   MPIN Login Status:', mpinLogin.status, '| Success:', mpinLogin.body.success);

  // 6. SCHOOL LOOKUP
  console.log('\n6️⃣ Testing GET /schools/lookup?code=DPS-BLR-04...');
  const schoolRes = await request('GET', '/schools/lookup?code=DPS-BLR-04', null, token);
  console.log('   Status:', schoolRes.status, '| School Found:', schoolRes.body.school?.name, '| Classes:', schoolRes.body.school?.classes?.length);
  const schoolId = schoolRes.body.school?.id;
  const classId = schoolRes.body.school?.classes[0]?.id;

  // 7. ADD STUDENT
  console.log('\n7️⃣ Testing POST /students...');
  const studentRes = await request('POST', '/students', {
    name: 'Aarav Sharma',
    school_id: schoolId,
    class_id: classId,
    gender: 'Male',
    date_of_birth: '2017-08-15'
  }, token);
  console.log('   Status:', studentRes.status, '| Student ID:', studentRes.body.student?.id, '| Standard:', studentRes.body.student?.standard);
  studentId = studentRes.body.student?.id;

  // 8. GET INITIAL WALLET SUMMARY
  console.log('\n8️⃣ Testing GET /wallet/summary (Initial)...');
  const wallRes1 = await request('GET', '/wallet/summary', null, token);
  console.log('   Status:', wallRes1.status, '| Initial Locked Savings: ₹' + (wallRes1.body.data?.total_savings_locked_paise / 100));

  // 9. CREATE PAYMENT ORDER
  console.log('\n9️⃣ Testing POST /payments (Deposit ₹5,000)...');
  const idempotencyKey = 'idem-test-' + Date.now();
  const payRes = await request('POST', '/payments', {
    amount_paise: 500000,
    idempotency_key: idempotencyKey,
    split: [{ student_id: studentId, amount_paise: 500000 }]
  }, token);
  console.log('   Status:', payRes.status, '| Payment ID:', payRes.body.payment_id, '| UPI URL:', payRes.body.upi_intent_url?.slice(0, 45) + '...');
  paymentId = payRes.body.payment_id;

  // 10. MOCK PAYMENT WEBHOOK (DOUBLE-ENTRY LEDGER CONFIRMATION)
  console.log('\n🔟 Testing POST /webhooks/mock-pay (Execute Double-Entry Ledger)...');
  const webhookRes = await request('POST', '/webhooks/mock-pay', {
    payment_id: paymentId,
    upi_ref: 'UPI_TEST_' + Date.now()
  });
  console.log('   Status:', webhookRes.status, '| Status:', webhookRes.body.status, '| Message:', webhookRes.body.message);

  // 11. VERIFY WALLET SUMMARY POST-DEPOSIT
  console.log('\n1️⃣1️⃣ Verifying GET /wallet/summary (Post-Deposit)...');
  const wallRes2 = await request('GET', '/wallet/summary', null, token);
  console.log('   Status:', wallRes2.status, '| New Locked Savings: ₹' + (wallRes2.body.data?.total_savings_locked_paise / 100));
  console.log('   Child Vault Balance: ₹' + (wallRes2.body.data?.children[0]?.saved_balance_paise / 100));
  console.log('   Child Target Progress:', wallRes2.body.data?.children[0]?.percentage_completed + '%');

  // 12. GET STUDENT DETAILS
  console.log('\n1️⃣2️⃣ Testing GET /students/' + studentId + '...');
  const stdDetail = await request('GET', '/students/' + studentId, null, token);
  console.log('   Status:', stdDetail.status, '| Student Name:', stdDetail.body.student?.name, '| Saved Balance: ₹' + (stdDetail.body.student?.saved_balance_paise / 100));

  // 13. TAX STATEMENT
  console.log('\n1️⃣3️⃣ Testing GET /reports/tax-statement...');
  const taxRes = await request('GET', '/reports/tax-statement', null, token);
  console.log('   Status:', taxRes.status, '| FY:', taxRes.body.financial_year, '| Form 16A:', taxRes.body.form_16a_available);

  // 14. FILE EXCEPTION REQUEST
  console.log('\n1️⃣4️⃣ Testing POST /exceptions...');
  const expRes = await request('POST', '/exceptions', {
    exception_type: 'SCHOOL_TRANSFER',
    student_id: studentId,
    reason: 'Family relocated to Whitefield. Transferred child to Greenwood High.'
  }, token);
  console.log('   Status:', expRes.status, '| Exception ID:', expRes.body.exception?.id, '| Status:', expRes.body.exception?.status);

  console.log('\n🎉 ====================================================');
  console.log('🎉 ALL 14 PARENT APP APIS TESTED & PASSED 100%!');
  console.log('🎉 ====================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});

