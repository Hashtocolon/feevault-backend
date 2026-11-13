
const VALID_TEMP_BANDS = [
    'deep_frozen',
    'chilled',
    'controlled_ambient',
    'ultra_low'
];

const VALID_DIETARY_FLAGS = [
    'vegetarian',
    'non_vegetarian',
    'jain',
    'halal'
];

// =====================================================
// SCREEN 8 - API 2
// POST /api/v1/cargo/compatibility-check
// Cargo Compatibility & Food Segregation Check
// =====================================================

exports.checkCargoCompatibility = async (req, res, next) => {
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

        const { cargoLines, tempBandId } = req.body;

        // Validate cargo lines
        if (!Array.isArray(cargoLines) || cargoLines.length === 0) {
            return res.status(400).json({
                error: 'INVALID_CARGO_LINES',
                message: 'At least one cargo line is required.'
            });
        }

        // Validate temperature band
        if (!VALID_TEMP_BANDS.includes(tempBandId)) {
            return res.status(400).json({
                error: 'INVALID_TEMP_BAND',
                message: 'Please select a valid temperature band.'
            });
        }

        // Validate every cargo line
        for (let i = 0; i < cargoLines.length; i++) {
            const cargo = cargoLines[i];

            if (
                !cargo ||
                typeof cargo.category !== 'string' ||
                !cargo.category.trim() ||
                typeof cargo.description !== 'string' ||
                !cargo.description.trim() ||
                typeof cargo.packagingType !== 'string' ||
                !cargo.packagingType.trim() ||
                !Number.isInteger(cargo.quantityCartons) ||
                cargo.quantityCartons <= 0 ||
                typeof cargo.weightKg !== 'number' ||
                !Number.isFinite(cargo.weightKg) ||
                cargo.weightKg <= 0 ||
                !Number.isSafeInteger(cargo.declaredValueMinor) ||
                cargo.declaredValueMinor < 0 ||
                !VALID_DIETARY_FLAGS.includes(cargo.dietaryFlag) ||
                !Array.isArray(cargo.allergens) ||
                !cargo.allergens.every(
                    item => typeof item === 'string'
                )
            ) {
                return res.status(400).json({
                    error: 'INVALID_CARGO_LINE',
                    message: `Please check the required fields in cargo line ${i + 1}.`
                });
            }
        }

        // Calculate cargo totals
        const totalWeightKg = Number(
            cargoLines.reduce(
                (total, cargo) => total + cargo.weightKg,
                0
            ).toFixed(2)
        );

        const totalCartons = cargoLines.reduce(
            (total, cargo) => total + cargo.quantityCartons,
            0
        );

        const totalDeclaredValueMinor = cargoLines.reduce(
            (total, cargo) => total + cargo.declaredValueMinor,
            0
        );

        // Format value from paise to Indian Rupees
        const totalDeclaredValueFormatted =
            new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 0
            }).format(totalDeclaredValueMinor / 100);

        // Identify cargo categories
        const categories = cargoLines.map(cargo =>
            cargo.category.toLowerCase()
        );

        // Pharma cargo identification
        const isPharmaCargo = categories.some(
            category => category === 'pharma'
        );

        // Segregation rule:
        // Raw non-vegetarian cargo cannot travel together
        // with unpackaged vegetarian cargo.
        //
        // Raw is identified by the category or description.
        // Unpackaged is identified through packagingType.
        const hasRawNonVeg = cargoLines.some(cargo => {
            const category = cargo.category.toLowerCase();
            const description = cargo.description.toLowerCase();

            return (
                cargo.dietaryFlag === 'non_vegetarian' &&
                (
                    category.includes('raw') ||
                    description.includes('raw')
                )
            );
        });

        const hasUnpackagedVeg = cargoLines.some(cargo => {
            const packaging = cargo.packagingType.toLowerCase().trim();

            return (
                cargo.dietaryFlag === 'vegetarian' &&
                ['unpackaged', 'loose', 'none'].includes(packaging)
            );
        });

        // Block incompatible cargo combinations
        if (hasRawNonVeg && hasUnpackagedVeg) {
            return res.status(200).json({
                isCompatible: false,
                reason: 'Raw non-veg and unpackaged veg items cannot be co-loaded. Please separate into two trips.'
            });
        }

        // Pharma statutory gating
        const pharmaGating = {
            isPharmaCargo,
            isBookingBlocked: isPharmaCargo,
            requiredDocuments: isPharmaCargo
                ? [
                    'Form 20B/21B Wholesale Drug License',
                    'GDP Cold-Chain Packaging Certificate'
                ]
                : [],
            notice: isPharmaCargo
                ? "Booking is blocked until the shipper's drug license is verified by Admin Ops."
                : null
        };

        // Dairy + seafood segregation warning
        const hasDairy = categories.some(category =>
            category.includes('dairy')
        );

        const hasSeafood = categories.some(category =>
            category.includes('seafood')
        );

        const warnings = [];

        if (hasDairy && hasSeafood) {
            warnings.push({
                type: 'secondary_packaging_required',
                message: 'Seafood must be in hermetically sealed secondary packaging to co-load with dairy. FSSAI Chapter 2 compliant.'
            });
        }

        // Successful compatibility response
        return res.status(200).json({
            isCompatible: true,
            segregationStatus: 'cleared',
            totalWeightKg,
            totalCartons,
            totalDeclaredValueMinor,
            totalDeclaredValueFormatted,
            pharmaGating,
            warnings
        });

    } catch (error) {
        console.error('[CARGO] Compatibility check error:', error);
        next(error);
    }
};
