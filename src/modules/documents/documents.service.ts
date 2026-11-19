
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { createReadStream, ReadStream } from 'fs';

const ALLOWED_CATEGORIES = [
  'invoices',
  'lorry_receipts',
  'proof_of_delivery',
  'eway_bills',
  'temperature_reports',
  'other',
] as const;

type DocumentCategory = (typeof ALLOWED_CATEGORIES)[number];

interface DocumentsQuery {
  category?: string;
  shipmentId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface UploadDocumentBody {
  docLabel?: string;
  category?: string;
  shipmentId?: string;
}

@Injectable()
export class DocumentsService {
  private readonly uploadDirectory = path.join(
    process.cwd(),
    'uploads',
    'documents',
  );

  private readonly expirySeconds = 60 * 60;

  private readonly downloadSecret =
    process.env.DOCUMENT_DOWNLOAD_SECRET ||
    'change-this-secret-before-production';

  private readonly apiBaseUrl = (
    process.env.API_BASE_URL || 'http://localhost:5000'
  ).replace(/\/$/, '');

  constructor(private readonly db: DatabaseService) {
    fs.mkdirSync(this.uploadDirectory, { recursive: true });
  }

  // --------------------------------------------------
  // GET CUSTOMER PROFILE
  // --------------------------------------------------

  private async getCustomer(userId: string): Promise<string> {
    const pool = this.db.getPool();

    const result = await pool.query(
      `
      SELECT id
      FROM customer_profiles
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Customer profile not found');
    }

    return result.rows[0].id;
  }

  // --------------------------------------------------
  // DOCUMENT STATUS
  // --------------------------------------------------

  private getStatus(status: string | null | undefined) {
    const normalizedStatus = (status || 'ready').toLowerCase();

    switch (normalizedStatus) {
      case 'verified':
        return {
          statusBadge: 'Verified',
          statusCode: 'verified',
          badgeColor: 'success',
        };

      case 'signed':
        return {
          statusBadge: 'Signed',
          statusCode: 'signed',
          badgeColor: 'success',
        };

      case 'pending':
        return {
          statusBadge: 'Pending',
          statusCode: 'pending',
          badgeColor: 'warning',
        };

      case 'failed':
        return {
          statusBadge: 'Failed',
          statusCode: 'failed',
          badgeColor: 'danger',
        };

      case 'ready':
      default:
        return {
          statusBadge: 'Available',
          statusCode: 'available',
          badgeColor: 'success',
        };
    }
  }

  // --------------------------------------------------
  // DOCUMENT TYPE LABEL
  // --------------------------------------------------

  private getTypeLabel(docType: string): string {
    const labels: Record<string, string> = {
      lorry_receipt: 'Lorry Receipt',
      eway_bill: 'E-Way Bill',
      temp_audit_certificate: 'Temperature Certificate',
      epod: 'Proof of Delivery',
      tax_invoice: 'Tax Invoice',
      customer_upload: 'Customer Uploaded Document',
    };

    return (
      labels[docType] ||
      docType.replace(/_/g, ' ').replace(/\b\w/g, (char) =>
        char.toUpperCase(),
      )
    );
  }

  // --------------------------------------------------
  // SIGNED DOWNLOAD TOKEN
  // --------------------------------------------------

  private signDownload(docId: string, expires: number): string {
    const payload = `${docId}:${expires}`;

    return crypto
      .createHmac('sha256', this.downloadSecret)
      .update(payload)
      .digest('hex');
  }

  private verifyDownloadToken(
    docId: string,
    expires: number,
    token: string,
  ): boolean {
    if (!Number.isInteger(expires) || expires <= Math.floor(Date.now() / 1000)) {
      return false;
    }

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return false;
    }

    const expectedToken = this.signDownload(docId, expires);

    const expectedBuffer = Buffer.from(expectedToken, 'hex');
    const actualBuffer = Buffer.from(token, 'hex');

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  }

  private createDownloadUrl(
    docId: string,
    fileName: string,
  ) {
    const expires =
      Math.floor(Date.now() / 1000) + this.expirySeconds;

    const token = this.signDownload(docId, expires);

    return {
      downloadUrl:
        `${this.apiBaseUrl}/api/v1/documents/${docId}/file` +
        `?expires=${expires}&token=${token}`,
      fileName,
      expiresInSeconds: this.expirySeconds,
    };
  }

  // --------------------------------------------------
  // API 1: GET /documents
  // FETCH DOCUMENT LIST
  // --------------------------------------------------

  async getDocuments(
    userId: string,
    query: DocumentsQuery,
  ) {
    const pool = this.db.getPool();

    const customerId = await this.getCustomer(userId);

    const category = query.category || 'all';
    const shipmentId = query.shipmentId?.trim();
    const search = query.search?.trim();

    const page = Math.max(
      1,
      Number.isFinite(Number(query.page))
        ? Math.floor(Number(query.page))
        : 1,
    );

    const limit = Math.min(
      100,
      Math.max(
        1,
        Number.isFinite(Number(query.limit))
          ? Math.floor(Number(query.limit))
          : 20,
      ),
    );

    const offset = (page - 1) * limit;

    if (
      category !== 'all' &&
      !ALLOWED_CATEGORIES.includes(category as DocumentCategory)
    ) {
      throw new BadRequestException('Invalid document category');
    }

    const values: any[] = [customerId];
    const conditions: string[] = ['sd.customer_id = $1'];

    if (category !== 'all') {
      values.push(category);
      conditions.push(`sd.category = $${values.length}`);
    }

    if (shipmentId) {
      values.push(shipmentId);
      conditions.push(`b.booking_ref = $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);

      const searchIndex = values.length;

      conditions.push(`
        (
          sd.doc_name ILIKE $${searchIndex}
          OR b.booking_ref ILIKE $${searchIndex}
          OR sd.doc_type ILIKE $${searchIndex}
        )
      `);
    }

    const whereClause = conditions.join(' AND ');

    // Total document count
    const countResult = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM shipment_documents sd
      LEFT JOIN bookings b ON b.id = sd.booking_id
      WHERE ${whereClause}
      `,
      values,
    );

    const totalRecords = Number(countResult.rows[0]?.total || 0);
    const totalPages = Math.ceil(totalRecords / limit);

    // Fetch documents
    const documentValues = [...values, limit, offset];

    const documentsResult = await pool.query(
      `
      SELECT
        sd.id,
        sd.doc_name,
        sd.doc_type,
        sd.category,
        sd.file_format,
        sd.file_url,
        sd.telematics_hash,
        sd.is_customer_uploaded,
        sd.status,
        sd.generated_at,
        b.booking_ref
      FROM shipment_documents sd
      LEFT JOIN bookings b ON b.id = sd.booking_id
      WHERE ${whereClause}
      ORDER BY sd.generated_at DESC
      LIMIT $${documentValues.length - 1}
      OFFSET $${documentValues.length}
      `,
      documentValues,
    );

    // Category counts
    const categoryCountsResult = await pool.query(
      `
      SELECT
        COUNT(*)::int AS all,
        COUNT(*) FILTER (
          WHERE category = 'invoices'
        )::int AS invoices,
        COUNT(*) FILTER (
          WHERE category = 'lorry_receipts'
        )::int AS lorry_receipts,
        COUNT(*) FILTER (
          WHERE category = 'proof_of_delivery'
        )::int AS proof_of_delivery,
        COUNT(*) FILTER (
          WHERE category = 'eway_bills'
        )::int AS eway_bills,
        COUNT(*) FILTER (
          WHERE category = 'temperature_reports'
        )::int AS temperature_reports
      FROM shipment_documents
      WHERE customer_id = $1
      `,
      [customerId],
    );

    const counts = categoryCountsResult.rows[0];

    const documents = documentsResult.rows.map((doc: any) => {
      const status = this.getStatus(doc.status);

      return {
        docId: doc.id,
        docName: doc.doc_name,
        shipmentNumber: doc.booking_ref || null,
        category: doc.category,
        typeLabel: this.getTypeLabel(doc.doc_type),
        generatedDateFormatted: new Date(
          doc.generated_at,
        ).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        generatedAt: doc.generated_at,
        statusBadge: status.statusBadge,
        statusCode: status.statusCode,
        badgeColor: status.badgeColor,
        fileFormat: doc.file_format,
        telematicsHash: doc.telematics_hash,
        isCustomerUploaded: doc.is_customer_uploaded,
      };
    });

    return {
      countsByCategory: {
        all: Number(counts.all),
        invoices: Number(counts.invoices),
        lorry_receipts: Number(counts.lorry_receipts),
        proof_of_delivery: Number(counts.proof_of_delivery),
        eway_bills: Number(counts.eway_bills),
        temperature_reports: Number(counts.temperature_reports),
      },

      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
      },

      documents,
    };
  }

  // --------------------------------------------------
  // API 2: GET /documents/:docId/download
  // GENERATE DOWNLOAD URL
  // --------------------------------------------------

  async getDownloadUrl(
    userId: string,
    docId: string,
  ) {
    const pool = this.db.getPool();

    const customerId = await this.getCustomer(userId);

    const result = await pool.query(
      `
      SELECT
        id,
        doc_name,
        file_url,
        file_format
      FROM shipment_documents
      WHERE id = $1
        AND customer_id = $2
      LIMIT 1
      `,
      [docId, customerId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Document not found');
    }

    const doc = result.rows[0];

    const fileName =
      path.basename(doc.file_url) ||
      `${doc.doc_name}.${doc.file_format}`;

    const signedUrl = this.createDownloadUrl(
      doc.id,
      fileName,
    );

    return {
      docId: doc.id,
      docName: doc.doc_name,
      downloadUrl: signedUrl.downloadUrl,
      fileName: signedUrl.fileName,
      expiresInSeconds: signedUrl.expiresInSeconds,
      generatedAt: new Date().toISOString(),
    };
  }

  // --------------------------------------------------
  // API 3: POST /documents/upload
  // UPLOAD CUSTOMER DOCUMENT
  // --------------------------------------------------

  async uploadDocument(
    userId: string,
    file: Express.Multer.File,
    body: UploadDocumentBody,
  ) {
    const pool = this.db.getPool();

    if (!file) {
      throw new BadRequestException('Please select a file');
    }

    if (!body.docLabel?.trim()) {
      throw new BadRequestException('Document label is required');
    }

    if (!body.category) {
      throw new BadRequestException('Document category is required');
    }

    if (
      !ALLOWED_CATEGORIES.includes(
        body.category as DocumentCategory,
      )
    ) {
      throw new BadRequestException('Invalid document category');
    }

    const customerId = await this.getCustomer(userId);

    // Validate optional shipment reference
    let bookingId: string | null = null;
    let bookingRef: string | null = null;

    if (body.shipmentId?.trim()) {
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

      if (bookingResult.rows.length === 0) {
        throw new NotFoundException(
          'Shipment not found for this customer',
        );
      }

      bookingId = bookingResult.rows[0].id;
      bookingRef = bookingResult.rows[0].booking_ref;
    }

    const extension = path.extname(file.originalname)
      .replace('.', '')
      .toLowerCase();

    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];

    if (!allowedExtensions.includes(extension)) {
      throw new BadRequestException(
        'Only PDF, JPG and PNG files are allowed',
      );
    }

    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type',
      );
    }

    const fileFormat = extension === 'jpeg' ? 'jpg' : extension;

    // Store relative path in database
    const relativeFilePath = path
      .relative(process.cwd(), file.path)
      .replace(/\\/g, '/');

    const insertResult = await pool.query(
      `
      INSERT INTO shipment_documents (
        customer_id,
        booking_id,
        doc_name,
        doc_type,
        category,
        file_format,
        file_url,
        is_customer_uploaded,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, 'ready')
      RETURNING
        id,
        doc_name,
        generated_at,
        file_url
      `,
      [
        customerId,
        bookingId,
        body.docLabel.trim(),
        'customer_upload',
        body.category,
        fileFormat,
        relativeFilePath,
      ],
    );

    const doc = insertResult.rows[0];

    const signedUrl = this.createDownloadUrl(
      doc.id,
      path.basename(doc.file_url),
    );

    return {
      docId: doc.id,
      docName: doc.doc_name,
      shipmentNumber: bookingRef,
      statusBadge: 'Available',
      statusCode: 'available',
      uploadedAt: doc.generated_at,
      fileUrl: signedUrl.downloadUrl,
    };
  }

  // --------------------------------------------------
  // DOWNLOAD FILE USING SIGNED URL
  // GET /documents/:docId/file
  // --------------------------------------------------

  async getDownloadFile(
    docId: string,
    expires: number,
    token: string,
  ): Promise<{
    filePath: string;
    fileName: string;
    fileFormat: string;
  }> {
    if (!this.verifyDownloadToken(docId, expires, token)) {
      throw new UnauthorizedException(
        'Download link is invalid or expired',
      );
    }

    const pool = this.db.getPool();

    const result = await pool.query(
      `
      SELECT file_url, doc_name, file_format
      FROM shipment_documents
      WHERE id = $1
      LIMIT 1
      `,
      [docId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Document not found');
    }

    const doc = result.rows[0];

    const relativePath = doc.file_url;

    if (
      typeof relativePath !== 'string' ||
      path.isAbsolute(relativePath) ||
      !relativePath.replace(/\\/g, '/').startsWith('uploads/documents/')
    ) {
      throw new ForbiddenException('Invalid document file path');
    }

    const safeRoot = path.resolve(this.uploadDirectory);
    const filePath = path.resolve(process.cwd(), relativePath);

    if (
      filePath !== safeRoot &&
      !filePath.startsWith(safeRoot + path.sep)
    ) {
      throw new ForbiddenException('Invalid document file path');
    }

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Document file not found');
    }

    return {
      filePath,
      fileName: `${doc.doc_name}.${doc.file_format}`,
      fileFormat: doc.file_format,
    };
  }

  // --------------------------------------------------
  // CREATE FILE STREAM
  // --------------------------------------------------

  createReadStream(filePath: string): ReadStream {
    return createReadStream(filePath);
  }
}
