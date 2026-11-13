
const db = require('../config/db');

// =====================================================
// SCREEN 7 - API 4
// GET /api/v1/customer/saved-locations
// Fetch saved locations for logged-in customer
// =====================================================

exports.getSavedLocations = async (req, res, next) => {
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

        const result = await db.query(
            `
            SELECT
                sl.id,
                sl.label,
                sl.location_type AS type,
                sl.address,
                sl.pincode,
                sl.contact_person AS "contactPerson",
                sl.contact_phone AS "contactPhone",
                NULLIF(
                    CONCAT_WS(
                        ' · ',
                        NULLIF(sl.gate_dock_number, ''),
                        NULLIF(sl.access_instructions, '')
                    ),
                    ''
                ) AS "accessNotes"
            FROM customer_profiles cp
            LEFT JOIN saved_locations sl
                ON sl.customer_id = cp.id
                AND sl.is_active = TRUE
            WHERE cp.user_id = $1
            ORDER BY sl.created_at DESC NULLS LAST
            `,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'CUSTOMER_PROFILE_NOT_FOUND',
                message: 'Customer profile not found.'
            });
        }

        const locations = result.rows
            .filter(row => row.id !== null)
            .map(row => ({
                id: row.id,
                label: row.label,
                type: row.type,
                address: row.address,
                pincode: row.pincode,
                contactPerson: row.contactPerson,
                contactPhone: row.contactPhone,
                accessNotes: row.accessNotes
            }));

        return res.status(200).json({
            locations
        });

    } catch (error) {
        console.error('[CUSTOMER] Saved locations error:', error);
        next(error);
    }
};
