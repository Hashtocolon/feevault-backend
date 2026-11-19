
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import * as path from 'path';
import * as fs from 'fs';

interface ClaimsQuery {
  status?: string;
  page?: number;
  limit?: number;
}

interface CreateClaimBody {
  shipmentId: string;
  claimCategory: string;
  claimValueMinor: number | string;
  evidenceType: string;
  issueDescription: string;
  incidentDatetime: string;
}

@Injectable()
export class ClaimsService {
  private readonly uploadDirectory = path.join(
    process.cwd(),
    'uploads',
    'claims',
  );

  private readonly allowedCategories = [
    'temperature_excursion',
    'physical_shortage',
    'cargo_damage',
    'delay',
    'other',
  ];

  private readonly allowedEvidenceTypes = [
    'photos_and_probe',
    'temperature_log',
    'handover_evidence',
    'invoice',
  ];

  constructor(private readonly db: DatabaseService) {
    fs.mkdirSync(this.uploadDirectory, { recursive: true });
  }

  private async getCustomerId(userId: string): Promise<string> {
    const result = await this.db.getPool().query(
      `SELECT id FROM customer_profiles WHERE user_id = $1 LIMIT 1`,
      [userId],
    );

    if (!result.rows.length) {
      throw new NotFoundException('Customer profile not found');
    }

    return result.rows[0].id;
  }

  private formatAmount(amount: number): string {
    return `₹${(amount / 100).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    })}`;
  }

  private getStatusBadge(status: string): string {
    const labels: Record<string, string> = {
      draft: 'DRAFT',
      under_review: 'UNDER REVIEW',
      evidence_requested: 'EVIDENCE REQUESTED',
      approved: 'APPROVED',
      rejected: 'REJECTED',
      settled: 'SETTLED',
    };

    return labels[status] || status.toUpperCase();
  }

  private validateFiles(files: Express.Multer.File[]): void {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one evidence file is required');
    }

    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
    ];

    for (const file of files) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          'Only PDF, JPG and PNG evidence files are allowed',
        );
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new BadRequestException(
          'Each evidence file must be 10 MB or smaller',
        );
      }
    }
  }

  private getRelativeFilePath(file: Express.Multer.File): string {
    return path
      .relative(process.cwd(), file.path)
      .replace(/\\/g, '/');
  }

  private async getClaim(
    customerId: string,
    claimId: string,
  ) {
    const result = await this.db.getPool().query(
      `
      SELECT
        c.*,
        b.booking_ref
      FROM claims c
      INNER JOIN bookings b ON b.id = c.booking_id
      WHERE c.customer_id = $1
        AND (c.claim_code = $2 OR c.id::text = $2)
      LIMIT 1
      `,
      [customerId, claimId],
    );

    if (!result.rows.length) {
      throw new NotFoundException('Claim not found');
    }

    return result.rows[0];
  }

  // ==================================================
  // API 1: GET /claims
  // FETCH ACTIVE AND HISTORICAL CLAIMS
  // ==================================================

  async getClaims(userId: string, query: ClaimsQuery) {
    const pool = this.db.getPool();
    const customerId = await this.getCustomerId(userId);

    const allowedStatuses = [
      'all',
      'under_review',
      'approved',
      'rejected',
      'settled',
    ];

    const status = query.status || 'all';

    if (!allowedStatuses.includes(status)) {
      throw new BadRequestException('Invalid claim status');
    }

    const page = Math.max(
      1,
      Math.floor(Number(query.page) || 1),
    );

    const limit = Math.min(
      100,
      Math.max(1, Math.floor(Number(query.limit) || 20)),
    );

    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      `
      SELECT
        COUNT(*)::int AS all,
        COUNT(*) FILTER (
          WHERE status = 'under_review'
        )::int AS under_review,
        COUNT(*) FILTER (
          WHERE status = 'approved'
        )::int AS approved,
        COUNT(*) FILTER (
          WHERE status = 'rejected'
        )::int AS rejected,
        COUNT(*) FILTER (
          WHERE status = 'settled'
        )::int AS settled
      FROM claims
      WHERE customer_id = $1
      `,
      [customerId],
    );

    const conditions = ['c.customer_id = $1'];
    const values: any[] = [customerId];

    if (status !== 'all') {
      values.push(status);
      conditions.push(`c.status = $${values.length}`);
    }

    const whereClause = conditions.join(' AND ');

    const totalResult = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM claims c
      WHERE ${whereClause}
      `,
      values,
    );

    const totalRecords = Number(totalResult.rows[0].total);

    const claimsResult = await pool.query(
      `
      SELECT
        c.id,
        c.claim_code,
        c.claim_category,
        c.claim_value_minor,
        c.issue_description,
        c.status,
        c.is_within_24hr_window,
        c.filed_at,
        c.booking_id,
        b.booking_ref
      FROM claims c
      INNER JOIN bookings b ON b.id = c.booking_id
      WHERE ${whereClause}
      ORDER BY c.filed_at DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
      `,
      [...values, limit, offset],
    );

    const counts = countResult.rows[0];

    return {
      countByStatus: {
        all: Number(counts.all),
        under_review: Number(counts.under_review),
        approved: Number(counts.approved),
        rejected: Number(counts.rejected),
        settled: Number(counts.settled),
      },

      pagination: {
        page,
        limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
      },

      claims: claimsResult.rows.map((claim: any) => ({
        claimId: claim.claim_code,
        shipmentRef: claim.booking_ref,
        status: claim.status,
        statusBadge: this.getStatusBadge(claim.status),
        issueLabel: claim.issue_description,
        claimCategory: claim.claim_category,
        claimValueMinor: Number(claim.claim_value_minor),
        claimValueFormatted: this.formatAmount(
          Number(claim.claim_value_minor),
        ),
        filedAt: claim.filed_at,
        isWithin24HrWindow: claim.is_within_24hr_window,
        submissionFlag: claim.is_within_24hr_window
          ? 'on_time'
          : 'late_submission',
        lastUpdatedAt: claim.filed_at,
      })),
    };
  }

  // ==================================================
  // API 2: POST /claims
  // SUBMIT NEW CLAIM
  // ==================================================

  async createClaim(
    userId: string,
    body: CreateClaimBody,
    files: Express.Multer.File[],
  ) {
    const pool = this.db.getPool();

    if (!body.shipmentId?.trim()) {
      throw new BadRequestException('Shipment ID is required');
    }

    if (!body.claimCategory ||
        !this.allowedCategories.includes(body.claimCategory)) {
      throw new BadRequestException('Invalid claim category');
    }

    if (!this.allowedEvidenceTypes.includes(body.evidenceType)) {
      throw new BadRequestException('Invalid evidence type');
    }

    const claimValue = Number(body.claimValueMinor);

    if (!Number.isSafeInteger(claimValue) || claimValue <= 0) {
      throw new BadRequestException(
        'Claim value must be a positive integer in paise',
      );
    }

    if (!body.issueDescription?.trim()) {
      throw new BadRequestException('Issue description is required');
    }

    const incidentDate = new Date(body.incidentDatetime);

    if (
      !body.incidentDatetime ||
      Number.isNaN(incidentDate.getTime())
    ) {
      throw new BadRequestException(
        'Valid incidentDatetime is required',
      );
    }

    this.validateFiles(files);

    const customerId = await this.getCustomerId(userId);

    const bookingResult = await pool.query(
      `
      SELECT id, booking_ref
      FROM bookings
      WHERE booking_ref = $1
        AND customer_id = $2
      LIMIT 1
      `,
      [body.shipmentId.trim(), customerId],
    );

    if (!bookingResult.rows.length) {
      throw new NotFoundException(
        'Shipment not found for this customer',
      );
    }

    const booking = bookingResult.rows[0];

    // Get e-POD submission time for the 24-hour claim window.
    const epodResult = await pool.query(
      `
      SELECT submitted_at
      FROM epods
      WHERE booking_id = $1
      LIMIT 1
      `,
      [booking.id],
    );

    if (!epodResult.rows.length) {
      throw new BadRequestException(
        'Claim cannot be submitted because e-POD is not available',
      );
    }

    const epodSubmittedAt = new Date(
      epodResult.rows[0].submitted_at,
    );

    const now = new Date();

    const elapsedMilliseconds =
      now.getTime() - epodSubmittedAt.getTime();

    const isWithin24HrWindow =
      elapsedMilliseconds >= 0 &&
      elapsedMilliseconds <= 24 * 60 * 60 * 1000;

    const claimCode =
      `CLM-${new Date().getFullYear()}-${Date.now()}-${Math.floor(
        1000 + Math.random() * 9000,
      )}`;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const claimResult = await client.query(
        `
        INSERT INTO claims (
          claim_code,
          booking_id,
          customer_id,
          claim_category,
          claim_value_minor,
          evidence_type,
          issue_description,
          incident_datetime,
          status,
          is_within_24hr_window
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'under_review', $9)
        RETURNING *
        `,
        [
          claimCode,
          booking.id,
          customerId,
          body.claimCategory,
          claimValue,
          body.evidenceType,
          body.issueDescription.trim(),
          incidentDate.toISOString(),
          isWithin24HrWindow,
        ],
      );

      const claim = claimResult.rows[0];

      for (const file of files) {
        const relativePath = this.getRelativeFilePath(file);

        await client.query(
          `
          INSERT INTO claim_evidence_files (
            claim_id,
            label,
            file_url,
            file_source
          )
          VALUES ($1, $2, $3, 'customer_upload')
          `,
          [
            claim.id,
            file.originalname,
            relativePath,
          ],
        );
      }

      await client.query('COMMIT');

      return {
        claimId: claim.claim_code,
        shipmentRef: booking.booking_ref,
        status: claim.status,
        claimCategory: claim.claim_category,
        claimValueMinor: Number(claim.claim_value_minor),
        claimValueFormatted: this.formatAmount(
          Number(claim.claim_value_minor),
        ),
        filedAt: claim.filed_at,
        isWithin24HrWindow,
        submissionFlag: isWithin24HrWindow
          ? 'on_time'
          : 'late_submission',
        evidencePackUrl:
          `${process.env.API_BASE_URL || 'http://localhost:5000'}` +
          `/api/v1/claims/${claim.claim_code}/evidence`,
        message: isWithin24HrWindow
          ? 'Claim submitted. Our disputes team will review within 2 business days.'
          : 'Claim submitted after the 24-hour window and flagged as late_submission.',
      };
    } catch (error) {
      await client.query('ROLLBACK');

      // Remove uploaded files if the database transaction fails.
      for (const file of files) {
        if (file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }

      throw error;
    } finally {
      client.release();
    }
  }

  // ==================================================
  // API 3: GET /claims/:claimId/evidence
  // VIEW EVIDENCE PACK
  // ==================================================

  async getEvidencePack(userId: string, claimId: string) {
    const pool = this.db.getPool();
    const customerId = await this.getCustomerId(userId);

    const claim = await this.getClaim(customerId, claimId);

    const evidenceResult = await pool.query(
      `
      SELECT
        id,
        label,
        file_url,
        file_source,
        uploaded_at
      FROM claim_evidence_files
      WHERE claim_id = $1
      ORDER BY uploaded_at ASC
      `,
      [claim.id],
    );

    const evidenceFiles = evidenceResult.rows.map((file: any) => ({
      fileId: file.id,
      label: file.label,
      source: file.file_source,
      fileUrl: file.file_url,
      uploadedAt: file.uploaded_at,
    }));

    // Automatically attach documents from the Documents Vault.
    const documentsResult = await pool.query(
      `
      SELECT
        id,
        doc_name,
        file_url,
        generated_at
      FROM shipment_documents
      WHERE booking_id = $1
        AND doc_type IN (
          'temp_audit_certificate',
          'epod'
        )
      ORDER BY generated_at ASC
      `,
      [claim.booking_id],
    );

    for (const doc of documentsResult.rows) {
      evidenceFiles.push({
        fileId: doc.id,
        label: doc.doc_name,
        source: 'system_auto',
        fileUrl: doc.file_url,
        uploadedAt: doc.generated_at,
      });
    }

    // Attach the e-POD PDF if it exists.
    const epodResult = await pool.query(
      `
      SELECT epod_pdf_url, submitted_at
      FROM epods
      WHERE booking_id = $1
      LIMIT 1
      `,
      [claim.booking_id],
    );

    if (
      epodResult.rows.length &&
      epodResult.rows[0].epod_pdf_url
    ) {
      const epod = epodResult.rows[0];

      const alreadyAttached = evidenceFiles.some(
        (file: any) => file.fileUrl === epod.epod_pdf_url,
      );

      if (!alreadyAttached) {
        evidenceFiles.push({
          fileId: `epod-${claim.booking_id}`,
          label: 'e-POD (Signed by Consignee)',
          source: 'system_auto',
          fileUrl: epod.epod_pdf_url,
          uploadedAt: epod.submitted_at,
        });
      }
    }

    return {
      claimId: claim.claim_code,
      shipmentRef: claim.booking_ref,
      evidenceFiles,
    };
  }

  // ==================================================
  // API 4: POST /claims/:claimId/remarks
  // ADD REMARK / APPEAL UPDATE
  // ==================================================

  async addRemark(
    userId: string,
    claimId: string,
    remark: string,
    files: Express.Multer.File[],
  ) {
    if (!remark?.trim()) {
      throw new BadRequestException('Remark is required');
    }

    const pool = this.db.getPool();
    const customerId = await this.getCustomerId(userId);

    const claim = await this.getClaim(customerId, claimId);

    if (files?.length) {
      this.validateFiles(files);
    }

    const attachmentPaths = (files || []).map((file) =>
      this.getRelativeFilePath(file),
    );

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `
        INSERT INTO claim_remarks (
          claim_id,
          sender_type,
          remark_text,
          attachments
        )
        VALUES ($1, 'customer', $2, $3)
        `,
        [
          claim.id,
          remark.trim(),
          attachmentPaths,
        ],
      );

      // Store additional files in the claim evidence list too.
      for (const file of files || []) {
        await client.query(
          `
          INSERT INTO claim_evidence_files (
            claim_id,
            label,
            file_url,
            file_source
          )
          VALUES ($1, $2, $3, 'customer_upload')
          `,
          [
            claim.id,
            file.originalname,
            this.getRelativeFilePath(file),
          ],
        );
      }

      const countResult = await client.query(
        `
        SELECT COUNT(*)::int AS total
        FROM claim_evidence_files
        WHERE claim_id = $1
        `,
        [claim.id],
      );

      await client.query('COMMIT');

      return {
        claimId: claim.claim_code,
        status: claim.status,
        message:
          'Update submitted successfully. Dispute team will review within 2 business days.',
        totalFilesReceived: Number(countResult.rows[0].total),
        nextUpdateDue: 'Within 2 business days',
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      await client.query('ROLLBACK');

      for (const file of files || []) {
        if (file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }

      throw error;
    } finally {
      client.release();
    }
  }
}
