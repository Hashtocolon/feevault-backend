const express = require('express');
const router = express.Router();

const { authenticateParent } = require('../middleware/auth');

// Controllers
const authCtrl = require('../controllers/parentAuthController');
const schoolStudentCtrl = require('../controllers/parentSchoolStudentController');
const walletPaymentCtrl = require('../controllers/parentWalletPaymentController');
const reportsExceptionsCtrl = require('../controllers/parentReportsExceptionsController');

// -----------------------------------------------------------------------------
// 1. AUTHENTICATION & SECURITY ROUTES
// -----------------------------------------------------------------------------
router.post('/auth/register', authCtrl.register);
router.post('/auth/login', authCtrl.login);
router.post('/auth/forgot-password', authCtrl.forgotPassword);
router.post('/auth/reset-password', authCtrl.resetPassword);
router.post('/auth/consent', authenticateParent, authCtrl.submitConsent);
router.post('/auth/mpin/setup', authenticateParent, authCtrl.setupMpin);
router.post('/auth/mpin/login', authCtrl.loginMpin);

// -----------------------------------------------------------------------------
// 2. KYC & REFUND BANK BINDING
// -----------------------------------------------------------------------------
router.post('/parent/kyc-bank', authenticateParent, authCtrl.saveKycAndBank);
router.get('/parent/kyc-bank', authenticateParent, authCtrl.getKycAndBank);

// -----------------------------------------------------------------------------
// 3. SCHOOLS & STUDENTS
// -----------------------------------------------------------------------------
router.get('/schools/lookup', authenticateParent, schoolStudentCtrl.lookupSchool);
router.post('/students', authenticateParent, schoolStudentCtrl.addStudent);
router.get('/students', authenticateParent, schoolStudentCtrl.listStudents);
router.get('/students/:id', authenticateParent, schoolStudentCtrl.getStudentDetails);

// -----------------------------------------------------------------------------
// 4. WALLET & PAYMENTS
// -----------------------------------------------------------------------------
router.get('/wallet/summary', authenticateParent, walletPaymentCtrl.getWalletSummary);
router.post('/payments', authenticateParent, walletPaymentCtrl.createPayment);
router.get('/payments/:id/status', authenticateParent, walletPaymentCtrl.getPaymentStatus);
router.post('/webhooks/mock-pay', walletPaymentCtrl.mockPaySuccess);

// -----------------------------------------------------------------------------
// 5. TAX STATEMENTS & EXCEPTIONS
// -----------------------------------------------------------------------------
router.get('/reports/tax-statement', authenticateParent, reportsExceptionsCtrl.getTaxStatement);
router.post('/exceptions', authenticateParent, reportsExceptionsCtrl.fileException);
router.get('/exceptions', authenticateParent, reportsExceptionsCtrl.listExceptions);

module.exports = router;

