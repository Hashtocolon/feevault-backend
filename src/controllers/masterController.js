
const db = require('../config/db');

// =====================================================
// SCREEN 7 - API 1
// GET /api/v1/master/hiring-models
// Fetch available hiring models for the customer
// =====================================================

exports.getAvailableHiringModels = async (req, res, next) => {
    try {
        const userId = req.user?.userId;

        console.log('[MASTER] User ID:', userId);
        console.log('[MASTER] User Role:', req.user?.role);

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

        // Find customer profile and check active annual contract
        const result = await db.query(
            `
            SELECT
                cp.id AS customer_id,
                EXISTS (
                    SELECT 1
                    FROM master_contracts mc
                    WHERE mc.customer_id = cp.id
                    AND mc.status = 'active'
                    AND mc.start_date <= CURRENT_DATE
                    AND mc.end_date >= CURRENT_DATE
                    AND mc.remaining_volume_trips > 0
                ) AS has_active_contract
            FROM customer_profiles cp
            WHERE cp.user_id = $1
            LIMIT 1
            `,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'CUSTOMER_PROFILE_NOT_FOUND',
                message: 'Please complete your customer profile before accessing hiring models.'
            });
        }

        const hasActiveContract =
            result.rows[0].has_active_contract === true;

        const hiringModels = [
            {
                id: 'on_call',
                label: 'On-Call Spot FTL',
                description: 'Dedicated single trip',
                enabled: true
            },
            {
                id: 'dedicated_monthly',
                label: 'Dedicated Monthly',
                description: 'Vehicle on contract',
                enabled: true
            },
            {
                id: 'annual_contract',
                label: 'Annual Rate Contract',
                description: 'Pre-negotiated enterprise tariff',
                enabled: hasActiveContract,
                ...(
                    hasActiveContract
                        ? {}
                        : {
                            reason: 'No active master contract linked. Please link a contract in Account Settings.'
                        }
                )
            }
        ];

        return res.status(200).json({
            hiringModels
        });

    } catch (error) {
        console.error('[MASTER] Hiring models error:', error);
        next(error);
    }
};


// =====================================================
// SCREEN 7 - API 2
// GET /api/v1/master/serviceability
// Check pickup and destination corridor serviceability
// =====================================================

exports.checkServiceability = async (req, res, next) => {
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

        const {
            originPincode,
            destinationPincode,
            serviceType
        } = req.query;

        // Validate required query parameters
        if (!originPincode || !destinationPincode || !serviceType) {
            return res.status(400).json({
                error: 'MISSING_PARAMETERS',
                message: 'originPincode, destinationPincode and serviceType are required.'
            });
        }

        // Validate Indian PIN codes
        if (
            !/^[1-9][0-9]{5}$/.test(originPincode) ||
            !/^[1-9][0-9]{5}$/.test(destinationPincode)
        ) {
            return res.status(400).json({
                error: 'INVALID_PINCODE',
                message: 'Please provide valid 6-digit Indian PIN codes.'
            });
        }

        if (serviceType.toUpperCase() !== 'FTL') {
            return res.status(400).json({
                error: 'INVALID_SERVICE_TYPE',
                message: 'Currently only FTL service is supported.'
            });
        }

        // TEMPORARY TEST CONFIGURATION
        // This corridor uses the example values from the API specification.
        // Replace with approved database-driven corridor configuration
        // before production deployment.

        const supportedCorridors = [
            {
                originPincode: '421302',
                destinationPincode: '560100',
                serviceType: 'FTL',
                corridorName: 'Mumbai – Bangalore NH 48',
                estimatedDistanceKm: 980,
                estimatedTransitHours: 24,
                availableVehicleClasses: [
                    'tata_407_14ft',
                    'eicher_20ft',
                    'bharatbenz_24ft'
                ]
            }
        ];

        const corridor = supportedCorridors.find(item =>
            item.originPincode === originPincode &&
            item.destinationPincode === destinationPincode &&
            item.serviceType === serviceType.toUpperCase()
        );

        // Corridor not available
        if (!corridor) {
            return res.status(200).json({
                isServiceable: false,
                reason: 'No reefer fleet currently available on this corridor.'
            });
        }

        // Corridor available
        return res.status(200).json({
            isServiceable: true,
            corridorName: corridor.corridorName,
            estimatedDistanceKm: corridor.estimatedDistanceKm,
            estimatedTransitHours: corridor.estimatedTransitHours,
            availableVehicleClasses: corridor.availableVehicleClasses
        });

    } catch (error) {
        console.error('[MASTER] Serviceability error:', error);
        next(error);
    }
};

exports.getVehicleClasses = async (req, res, next) => {
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

        const vehicleClasses = [
            {
                id: 'tata_407_14ft',
                label: 'Tata 407 (14ft)',
                payloadTons: 4
            },
            {
                id: 'eicher_20ft',
                label: 'Eicher Pro (20ft)',
                payloadTons: 7
            },
            {
                id: 'bharatbenz_24ft',
                label: 'BharatBenz (24ft)',
                payloadTons: 10
            },
            {
                id: 'multi_axle_32ft',
                label: 'Multi-Axle (32ft)',
                payloadTons: 18
            }
        ];

        return res.status(200).json({
            vehicleClasses
        });

    } catch (error) {
        console.error('[MASTER] Vehicle classes error:', error);
        next(error);
    }
};



// =====================================================
// SCREEN 7 - API 4
// GET /api/v1/customer/saved-locations
// Fetch saved locations of logged-in customer
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
                cp.id AS customer_id,
                sl.id AS id,
                sl.label AS label,
                sl.location_type AS type,
                sl.address AS address,
                sl.pincode AS pincode,
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

        // Customer profile not found
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'CUSTOMER_PROFILE_NOT_FOUND',
                message: 'Customer profile not found.'
            });
        }

        // Remove the empty LEFT JOIN row when no locations exist
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

// =====================================================
// SCREEN 8 - API 1
// GET /api/v1/master/temp-bands
// Fetch Temperature SLA Bands
// =====================================================

exports.getTemperatureBands = async (req, res, next) => {
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

        const tempBands = [
            {
                id: 'deep_frozen',
                label: 'Deep Frozen',
                rangeMin: -25,
                rangeMax: -18,
                unit: 'celsius',
                examples: 'Ice Cream, Seafood, Frozen Meat',
                enabled: true
            },
            {
                id: 'chilled',
                label: 'Chilled',
                rangeMin: 2,
                rangeMax: 8,
                unit: 'celsius',
                examples: 'Dairy, Cheese, Butter, Vaccines',
                enabled: true
            },
            {
                id: 'controlled_ambient',
                label: 'Controlled Ambient',
                rangeMin: 15,
                rangeMax: 25,
                unit: 'celsius',
                examples: 'Chocolates, Confectionery',
                enabled: true
            },
            {
                id: 'ultra_low',
                label: 'Ultra Low Cryo',
                rangeMin: -70,
                rangeMax: -70,
                unit: 'celsius',
                examples: 'Dry Ice, Special Biologics',
                enabled: false,
                reason: 'Not available on this corridor'
            }
        ];

        return res.status(200).json({
            tempBands
        });

    } catch (error) {
        console.error('[MASTER] Temperature bands error:', error);
        next(error);
    }
};
