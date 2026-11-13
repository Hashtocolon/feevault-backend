const express = require('express');
const router = express.Router();

const dashboardController = require('../controllers/dashboardController');
const { authenticateToken } = require('../middlewares/auth');

router.get(
  '/dashboard/summary',
  authenticateToken,
  dashboardController.getDashboardSummary
);

router.get(
  '/shipments/active',
  authenticateToken,
  dashboardController.getActiveShipments
);

module.exports = router;