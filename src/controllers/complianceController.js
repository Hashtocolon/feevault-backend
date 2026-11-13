
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// =====================================================
// SCREEN 9 - API 1
// POST /api/v1/compliance/gstin/verify
// Verify Consignee GSTIN
// Shared endpoint for Screen 3 and Screen 9
// =====================================================

exports.verifyConsigneeGstin = async (req, res, next) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({
                error: 'UNAUTHORIZED',
                message: 'Customer authentication is required.'
            });
        }

        if (req.user.role !== 'customer') {
            return res.status(403).json({
                error: 'CUSTOMER_ACCESS_REQUIRED',
                message: 'This API is available to customer accounts only.'
            });
        }

        const gstin =
            typeof req.body?.gstin === 'string'
                ? req.body.gstin.trim().toUpperCase()
                : '';

        // Validate GSTIN format
        if (!GSTIN_REGEX.test(gstin)) {
            return res.status(400).json({
                code: 'INVALID_GSTIN',
                message: 'GSTIN format is invalid. Please enter a valid 15-character GSTIN.'
            });
        }

        // Real-time verification requires an authorized GST
        // Suvidha Provider (GSP) integration.
        //
        // Provider API URL, authentication method and response
        // mapping must come from the company's approved GSP.
        // Do not return a fake successful verification.

        return res.status(503).json({
            code: 'GST_PROVIDER_NOT_CONFIGURED',
            message: 'GSTIN format is valid, but real-time verification is unavailable until an authorized GST provider is configured.'
        });

    } catch (error) {
        console.error('[COMPLIANCE] GSTIN verification error:', error);
        next(error);
    }
};

// =====================================================
// SCREEN 9 - API 2
// POST /api/v1/compliance/ewaybill/verify
// Verify Existing E-Way Bill
// =====================================================

exports.verifyExistingEwayBill = async (req, res, next) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({
                error: 'UNAUTHORIZED',
                message: 'Customer authentication is required.'
            });
        }

        if (req.user.role !== 'customer') {
            return res.status(403).json({
                error: 'CUSTOMER_ACCESS_REQUIRED',
                message: 'This API is available to customer accounts only.'
            });
        }

        const ewayBillNumber =
            typeof req.body?.ewayBillNumber === 'string'
                ? req.body.ewayBillNumber.trim()
                : '';

        // Validate 12-digit E-Way Bill number
        if (!/^\d{12}$/.test(ewayBillNumber)) {
            return res.status(400).json({
                code: 'INVALID_EWAY_BILL_NUMBER',
                message: 'E-Way Bill number must contain exactly 12 digits.'
            });
        }

        // Real verification requires an authorized
        // GST Suvidha Provider (GSP) integration.
        // Do not return fake active/valid bill details.

        return res.status(503).json({
            code: 'EWAYBILL_PROVIDER_NOT_CONFIGURED',
            message: 'E-Way Bill number format is valid, but real-time verification is unavailable until an authorized GST provider is configured.'
        });

    } catch (error) {
        console.error('[COMPLIANCE] E-Way Bill verification error:', error);
        next(error);
    }
};
