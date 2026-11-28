
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';
import { RenewComplianceDto } from './dto/renew-compliance.dto';

const DOCUMENTS = [
  {
    code: 'FITNESS_CERTIFICATE',
    name: 'Commercial Fitness Certificate (Form 38)',
    mandatory: true,
  },
  {
    code: 'NATIONAL_PERMIT',
    name: 'All-India National Goods Permit (Form 48)',
    mandatory: true,
  },
  {
    code: 'COMMERCIAL_INSURANCE',
    name: 'Commercial Vehicle Comprehensive Insurance',
    mandatory: true,
  },
  {
    code: 'CARRIER_LEGAL_LIABILITY',
    name: 'Transit Cargo Carrier Legal Liability Insurance',
    mandatory: true,
  },
  {
    code: 'POLLUTION_UNDER_CONTROL',
    name: 'Pollution Under Control (PUC)',
    mandatory: true,
  },
  {
    code: 'NABL_REEFER_CALIBRATION',
    name: 'NABL Reefer Temperature Sensor Calibration Certificate',
    mandatory: true,
  },
  {
    code: 'CONTAINER_PEST_HYGIENE',
    name: 'Food-Grade Container Pest & Sanitization Certificate',
    mandatory: true,
  },
  {
    code: 'DRIVING_LICENSE',
    name: 'Commercial Transport Driving License (DL - Trans)',
    mandatory: true,
  },
  {
    code: 'POLICE_VERIFICATION',
    name: 'Driver Police Verification Certificate (PVC)',
    mandatory: false,
  },
];

@Injectable()
export class DriverComplianceService {
  constructor(private readonly db: DatabaseService) {}

  // Get logged-in user's database scope
  private getUserScope(user: any) {
    const userId = user?.id || user?.userId || user?.sub;
    const role = String(user?.role || '').toUpperCase();

    if (!userId) {
      throw new ForbiddenException('User ID not found in token');
    }

    if (role === 'DRIVER' || role === 'OWNER_CUM_DRIVER') {
      return {
        column: 'driver_user_id',
        userId: String(userId),
      };
    }

    if (role === 'FLEET_OWNER') {
      return {
        column: 'fleet_owner_user_id',
        userId: String(userId),
      };
    }

    throw new ForbiddenException(
      'Only Driver, Fleet Owner and Owner-Cum-Driver can access compliance',
    );
  }

  // Calculate expiry status
  private calculateStatus(expiryDate: string | Date | null) {
    if (!expiryDate) {
      return {
        daysRemaining: null,
        status: 'EXPIRED',
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);

    const daysRemaining = Math.ceil(
      (expiry.getTime() - today.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    if (daysRemaining < 0) {
      return {
        daysRemaining,
        status: 'EXPIRED',
      };
    }

    if (daysRemaining <= 15) {
      return {
        daysRemaining,
        status: 'DUE_SOON',
      };
    }

    return {
      daysRemaining,
      status: 'VALID',
    };
  }

  // API 38.1 - Compliance Calendar
  async getComplianceCalendar(user: any) {
    console.log('API 38.1 - Compliance Calendar Called');

    const scope = this.getUserScope(user);

    const result = await this.db.query(
      `
      SELECT DISTINCT ON (document_code)
        id,
        document_code,
        document_name,
        vehicle_number,
        certificate_number,
        expiry_date,
        is_mandatory,
        document_url,
        verification_status
      FROM driver_compliance_documents
      WHERE ${scope.column} = $1
      ORDER BY document_code, uploaded_at DESC
      `,
      [scope.userId],
    );

    const rows = result.rows;

    // Always return all nine master documents
    const documents = DOCUMENTS.map((master) => {
      const record = rows.find(
        (row) => row.document_code === master.code,
      );

      const expiry = record?.expiry_date
        ? new Date(record.expiry_date)
            .toISOString()
            .slice(0, 10)
        : null;

      const calculated = this.calculateStatus(expiry);

      const verificationStatus =
        record?.verification_status || 'NOT_SUBMITTED';

      let status: string;

      if (!record) {
        status = 'NOT_SUBMITTED';
      } else if (
        verificationStatus === 'PENDING_VERIFICATION'
      ) {
        status = 'PENDING_VERIFICATION';
      } else if (verificationStatus !== 'VERIFIED') {
        status = verificationStatus;
      } else {
        status = calculated.status;
      }

      return {
        documentCode: master.code,
        documentName: master.name,
        certificateNumber:
          record?.certificate_number || null,
        expiryDate: expiry,
        daysRemaining: calculated.daysRemaining,
        status,
        isMandatory: master.mandatory,
        documentUrl: record?.document_url || null,
      };
    });

    // Mandatory documents determine dispatch lock
    const mandatoryDocuments = documents.filter(
      (doc) => doc.isMandatory,
    );

    const blockedDocuments = mandatoryDocuments.filter(
      (doc) =>
        doc.status === 'EXPIRED' ||
        doc.status === 'PENDING_VERIFICATION' ||
        doc.status === 'NOT_SUBMITTED',
    );

    const actionRequired = documents.some(
      (doc) =>
        doc.status === 'EXPIRED' ||
        doc.status === 'DUE_SOON' ||
        doc.status === 'PENDING_VERIFICATION' ||
        doc.status === 'NOT_SUBMITTED',
    );

    const vehicleNumber =
      rows.find((row) => row.vehicle_number)
        ?.vehicle_number || null;

    return {
      success: true,
      data: {
        vehicleNumber,

        overallComplianceStatus: actionRequired
          ? 'ACTION_REQUIRED'
          : 'COMPLIANT',

        isDispatchLocked: blockedDocuments.length > 0,

        lockoutReason:
          blockedDocuments.length > 0
            ? blockedDocuments
                .map((doc) => doc.documentCode)
                .join(', ')
            : null,

        documents,
      },
    };
  }

  // API 38.2 - Renew Compliance Document
  async renewComplianceDocument(
    dto: RenewComplianceDto,
    file: Express.Multer.File,
    user: any,
  ) {
    const scope = this.getUserScope(user);

    if (!file) {
      throw new BadRequestException(
        'documentFile is required',
      );
    }

    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only PDF, JPG and PNG files are allowed',
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException(
        'Maximum document file size is 10MB',
      );
    }

    const document = DOCUMENTS.find(
      (item) => item.code === dto.documentCode,
    );

    if (!document) {
      throw new BadRequestException(
        'Invalid documentCode',
      );
    }

    if (!dto.certificateNumber?.trim()) {
      throw new BadRequestException(
        'certificateNumber is required',
      );
    }

    const expiryDate = new Date(
      `${dto.newExpiryDate}T00:00:00`,
    );

    if (Number.isNaN(expiryDate.getTime())) {
      throw new BadRequestException(
        'Invalid newExpiryDate',
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (expiryDate <= today) {
      throw new BadRequestException(
        'newExpiryDate must be a future date',
      );
    }

    const userId = String(scope.userId);

    const driverUserId =
      scope.column === 'driver_user_id'
        ? userId
        : null;

    const fleetOwnerUserId =
      scope.column === 'fleet_owner_user_id'
        ? userId
        : null;

    const result = await this.db.query(
      `
      INSERT INTO driver_compliance_documents (
        document_code,
        document_name,
        driver_user_id,
        fleet_owner_user_id,
        certificate_number,
        expiry_date,
        is_mandatory,
        document_file,
        document_mime_type,
        verification_status,
        uploaded_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, 'PENDING_VERIFICATION', NOW(), NOW()
      )
      RETURNING
        document_code,
        certificate_number,
        expiry_date,
        verification_status
      `,
      [
        document.code,
        document.name,
        driverUserId,
        fleetOwnerUserId,
        dto.certificateNumber.trim(),
        dto.newExpiryDate,
        document.mandatory,
        Buffer.from(file.buffer),
        file.mimetype,
      ],
    );

    const saved = result.rows[0];

    return {
      success: true,
      message:
        'Renewal document uploaded successfully. Submitted for Ops verification.',

      data: {
        documentCode: saved.document_code,
        certificateNumber: saved.certificate_number,

        newExpiryDate: new Date(saved.expiry_date)
          .toISOString()
          .slice(0, 10),

        verificationStatus:
          saved.verification_status,

        turnaroundTimeHours: 2,
      },
    };
  }
}
