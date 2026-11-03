const express = require('express');
const router = express.Router();

const { authenticateAdmin } = require('../middleware/auth');

// Admin Controllers
const adminAuthCtrl = require('../controllers/adminAuthController');
const adminDashboardCtrl = require('../controllers/adminDashboardReconciliationController');
const adminSchoolCtrl = require('../controllers/adminSchoolController');
const adminParentCtrl = require('../controllers/adminParentController');
const adminWithdrawalCtrl = require('../controllers/adminWithdrawalController');
const adminDocumentsCtrl = require('../controllers/adminDocumentsController');
const adminExceptionsCtrl = require('../controllers/adminExceptionsController');

// -----------------------------------------------------------------------------
// 1. ADMIN AUTHENTICATION
// -----------------------------------------------------------------------------
router.post('/auth/login', adminAuthCtrl.adminLogin);
router.get('/auth/me', authenticateAdmin, adminAuthCtrl.getAdminProfile);

// -----------------------------------------------------------------------------
// 2. OPERATIONS DASHBOARD & RECONCILIATION
// -----------------------------------------------------------------------------
router.get('/dashboard', authenticateAdmin, adminDashboardCtrl.getDashboardOverview);
router.get('/reconciliation/latest', authenticateAdmin, adminDashboardCtrl.getReconciliationLatest);
router.post('/reconciliation/run', authenticateAdmin, adminDashboardCtrl.runDailyReconciliation);

// -----------------------------------------------------------------------------
// 3. SCHOOL ONBOARDING & MANAGEMENT (ADMIN ACTS FOR SCHOOL IN PHASE 1)
// -----------------------------------------------------------------------------
router.post('/schools', authenticateAdmin, adminSchoolCtrl.onboardSchool);
router.get('/schools', authenticateAdmin, adminSchoolCtrl.listSchools);
router.get('/schools/:id', authenticateAdmin, adminSchoolCtrl.getSchoolDetails);
router.patch('/schools/:id/status', authenticateAdmin, adminSchoolCtrl.updateSchoolStatus);

// -----------------------------------------------------------------------------
// 4. PARENT & STUDENT MANAGEMENT
// -----------------------------------------------------------------------------
router.get('/parents', authenticateAdmin, adminParentCtrl.listParents);
router.get('/parents/:id', authenticateAdmin, adminParentCtrl.getParentDetails);
router.post('/parents/:id/revoke-device', authenticateAdmin, adminParentCtrl.revokeParentDevice);

// -----------------------------------------------------------------------------
// 5. YEARLY WITHDRAWAL ENGINE (MAKER-CHECKER DISBURSEMENT)
// -----------------------------------------------------------------------------
router.post('/withdrawals/create-batch', authenticateAdmin, adminWithdrawalCtrl.createPayoutBatch);
router.get('/withdrawals', authenticateAdmin, adminWithdrawalCtrl.listWithdrawalCycles);
router.post('/withdrawals/:id/record-school-confirmation', authenticateAdmin, adminWithdrawalCtrl.recordSchoolConfirmation);
router.post('/withdrawals/:id/approve', authenticateAdmin, adminWithdrawalCtrl.approveAndDisburse);

// -----------------------------------------------------------------------------
// 6. SCHOOL DOCUMENT PUBLISHING (ADMIN ON BEHALF OF SCHOOL)
// -----------------------------------------------------------------------------
router.post('/documents/upload', authenticateAdmin, adminDocumentsCtrl.uploadDocument);
router.get('/documents', authenticateAdmin, adminDocumentsCtrl.listDocuments);

// -----------------------------------------------------------------------------
// 7. EXCEPTIONS & REFUND OVERRIDES
// -----------------------------------------------------------------------------
router.get('/exceptions', authenticateAdmin, adminExceptionsCtrl.listExceptions);
router.post('/exceptions/:id/resolve', authenticateAdmin, adminExceptionsCtrl.resolveException);

module.exports = router;

