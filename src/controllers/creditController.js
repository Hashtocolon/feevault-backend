const db = require('../config/db');

const getUserId = (req) => {
  return req.user?.userId || req.user?.id;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


// =====================================================
// API 1: POST /api/v1/customer/credit-request
// =====================================================

exports.createCreditRequest = async (req, res, next) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authentication required.'
      });
    }

    const {
      requestedLimitMinor,
      requestedPaymentTermsDays,
      businessTurnoverRange,
      documentIds
    } = req.body || {};

    // Validate requested credit limit
    if (
      !Number.isSafeInteger(requestedLimitMinor) ||
      requestedLimitMinor <= 0
    ) {
      return res.status(400).json({
        code: 'INVALID_CREDIT_LIMIT',
        message: 'requestedLimitMinor must be a positive integer in paise.'
      });
    }

    // Validate payment terms
    const allowedTerms = [15, 30, 45, 60];

    if (!allowedTerms.includes(requestedPaymentTermsDays)) {
      return res.status(400).json({
        code: 'INVALID_PAYMENT_TERMS',
        message: 'Payment terms must be 15, 30, 45, or 60 days.'
      });
    }

    // Validate turnover range
    if (
      typeof businessTurnoverRange !== 'string' ||
      !businessTurnoverRange.trim() ||
      businessTurnoverRange.length > 50
    ) {
      return res.status(400).json({
        code: 'INVALID_TURNOVER_RANGE',
        message: 'A valid business turnover range is required.'
      });
    }

    // Validate document IDs
    if (
      !Array.isArray(documentIds) ||
      documentIds.length === 0 ||
      !documentIds.every(
        id => typeof id === 'string' && UUID_REGEX.test(id)
      )
    ) {
      return res.status(400).json({
        code: 'INVALID_DOCUMENT_IDS',
        message: 'Provide at least one valid uploaded document ID.'
      });
    }

    const uniqueDocumentIds = [...new Set(documentIds)];

    // Find customer profile and account type
    const profileResult = await db.query(
      `SELECT id, entity_type
       FROM customer_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({
        code: 'CUSTOMER_PROFILE_NOT_FOUND',
        message: 'Customer profile not found.'
      });
    }

    const profile = profileResult.rows[0];

    // Only business customers can request credit
    if (profile.entity_type === 'individual') {
      return res.status(403).json({
        code: 'BUSINESS_ACCOUNT_REQUIRED',
        message: 'Only business customers can request a credit limit.'
      });
    }

    // Verify that all uploaded documents belong to this customer
    const documentsResult = await db.query(
      `SELECT id
       FROM shipment_documents
       WHERE customer_id = $1
         AND id = ANY($2::uuid[])`,
      [profile.id, uniqueDocumentIds]
    );

    if (documentsResult.rows.length !== uniqueDocumentIds.length) {
      return res.status(400).json({
        code: 'INVALID_OR_UNAUTHORIZED_DOCUMENT',
        message: 'One or more documents were not found or do not belong to this customer.'
      });
    }

    // Save credit request
    const result = await db.query(
      `INSERT INTO credit_requests (
        customer_id,
        requested_limit_minor,
        requested_payment_terms_days,
        business_turnover_range,
        document_ids,
        status
      )
      VALUES ($1, $2, $3, $4, $5::uuid[], 'under_review')
      RETURNING id, status, created_at`,
      [
        profile.id,
        requestedLimitMinor,
        requestedPaymentTermsDays,
        businessTurnoverRange.trim(),
        uniqueDocumentIds
      ]
    );

    const creditRequest = result.rows[0];

    const formattedAmount = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(requestedLimitMinor / 100);

    return res.status(201).json({
      creditRequestId: creditRequest.id,
      status: creditRequest.status,
      requestedLimitFormatted: formattedAmount,
      paymentTerms: `Net ${requestedPaymentTermsDays} Days`,
      message: 'Application submitted to Admin Credit Queue. Decision turnaround: 24 hours.'
    });

  } catch (error) {
    next(error);
  }
};


// =====================================================
// API 2: POST /api/v1/contracts/link
// =====================================================

exports.linkMasterContract = async (req, res, next) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authentication required.'
      });
    }

    const { contractNumber } = req.body || {};

    if (
      typeof contractNumber !== 'string' ||
      !contractNumber.trim()
    ) {
      return res.status(400).json({
        code: 'INVALID_CONTRACT_NUMBER',
        message: 'Contract number is required.'
      });
    }

    // Find customer profile
    const profileResult = await db.query(
      `SELECT id, entity_type
       FROM customer_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({
        code: 'CUSTOMER_PROFILE_NOT_FOUND',
        message: 'Customer profile not found.'
      });
    }

    const profile = profileResult.rows[0];

    if (profile.entity_type === 'individual') {
      return res.status(403).json({
        code: 'BUSINESS_ACCOUNT_REQUIRED',
        message: 'Only business customers can link a master contract.'
      });
    }

    // Find contract belonging to this customer
    const contractResult = await db.query(
      `SELECT
         id,
         contract_ref,
         status,
         start_date,
         end_date,
         rate_card_json
       FROM master_contracts
       WHERE contract_ref = $1
         AND customer_id = $2
       LIMIT 1`,
      [contractNumber.trim(), profile.id]
    );

    if (contractResult.rows.length === 0) {
      return res.status(404).json({
        code: 'CONTRACT_NOT_FOUND',
        message: 'Contract not found for this customer.'
      });
    }

    const contract = contractResult.rows[0];

    if (
      contract.status !== 'active' ||
      new Date(contract.end_date) < new Date() ||
      new Date(contract.start_date) > new Date()
    ) {
      return res.status(400).json({
        code: 'CONTRACT_NOT_ACTIVE',
        message: 'This contract is not currently active.'
      });
    }

    const rateCard =
      contract.rate_card_json &&
      typeof contract.rate_card_json === 'object'
        ? contract.rate_card_json
        : {};

    return res.status(200).json({
      contractId: contract.id,
      contractNumber: contract.contract_ref,
      status: contract.status,
      rateCardName:
        rateCard.rateCardName ||
        rateCard.name ||
        null,
      slaProfile:
        rateCard.slaProfile ||
        null,
      validTill: contract.end_date
    });

  } catch (error) {
    next(error);
  }
};