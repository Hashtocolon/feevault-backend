import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';

@Injectable()
export class SupportService {
  constructor(private readonly databaseService: DatabaseService) {}

  private get db() {
    return this.databaseService.getPool();
  }

  private async getCustomer(userId: string) {
    const result = await this.db.query(
      `
      SELECT
        cp.id AS customer_id,
        cp.company_name,
        u.id AS user_id,
        u.full_name,
        u.mobile_number,
        u.email
      FROM customer_profiles cp
      INNER JOIN users u ON u.id = cp.user_id
      WHERE u.id = $1
        AND u.role = 'customer'
        AND u.is_active = TRUE
      LIMIT 1
      `,
      [userId],
    );

    if (!result.rows.length) {
      throw new NotFoundException('Customer profile not found.');
    }

    return result.rows[0];
  }

  // 1. GET /api/v1/support/overview
  async getOverview(userId: string) {
    const customer = await this.getCustomer(userId);

    // Fetch active tickets for this customer
    const ticketsRes = await this.db.query(
      `
      SELECT 
        st.id,
        st.ticket_code,
        st.issue_category,
        st.title,
        st.description,
        st.status,
        st.created_at,
        b.booking_ref AS shipment_number
      FROM support_tickets st
      LEFT JOIN bookings b ON b.id = st.booking_id
      WHERE st.customer_id = $1
      ORDER BY st.created_at DESC
      LIMIT 10
      `,
      [customer.customer_id],
    );

    // Fetch recent shipments to populate dropdown in frontend
    const shipmentsRes = await this.db.query(
      `
      SELECT 
        id AS booking_id,
        booking_ref AS shipment_number,
        status,
        pickup_city,
        drop_city,
        created_at
      FROM bookings
      WHERE customer_id = $1
      ORDER BY created_at DESC
      LIMIT 10
      `,
      [customer.customer_id],
    );

    return {
      activeTicketsCount: ticketsRes.rows.filter(
        (t) => t.status === 'open' || t.status === 'in_progress',
      ).length,
      tickets: ticketsRes.rows.map((t) => ({
        ticketId: t.id,
        ticketCode: `#${t.ticket_code}`,
        shipmentNumber: t.shipment_number || null,
        issueCategory: t.issue_category,
        status: t.status,
        statusLabel:
          t.status === 'in_progress'
            ? 'In progress'
            : t.status === 'open'
              ? 'Open'
              : t.status === 'resolved'
                ? 'Resolved'
                : 'Closed',
        createdAt: t.created_at,
      })),
      recentShipments: shipmentsRes.rows.map((s) => ({
        bookingId: s.booking_id,
        shipmentNumber: s.shipment_number,
        status: s.status,
        route:
          s.pickup_city && s.drop_city
            ? `${s.pickup_city} to ${s.drop_city}`
            : s.shipment_number,
      })),
      issueCategories: [
        { key: 'shipment_status', label: 'Shipment Status' },
        { key: 'temperature_query', label: 'Temperature Query' },
        { key: 'invoice_correction', label: 'Invoice Correction' },
        { key: 'booking_issue', label: 'Booking Issue' },
        { key: 'other', label: 'Other Query' },
      ],
      supportChannels: {
        phone: '+911800266300',
        email: 'noc@coldroute.in',
        availability: '24/7 Ops Desk',
      },
    };
  }

  // 2. POST /api/v1/support/tickets
  async createTicket(
    userId: string,
    dto: CreateSupportTicketDto,
    files: Express.Multer.File[] = [],
  ) {
    const customer = await this.getCustomer(userId);

    const rawShipment = dto.shipmentNumber?.trim();
    let bookingId: string | null = null;
    let validatedShipmentNumber: string | null = null;

    // Only validate if a non-empty shipmentNumber was provided
    if (
      rawShipment &&
      rawShipment !== '' &&
      rawShipment !== 'null' &&
      rawShipment !== 'undefined'
    ) {
      const bookingRes = await this.db.query(
        `
        SELECT id, booking_ref
        FROM bookings
        WHERE (booking_ref = $1 OR id::text = $1)
          AND customer_id = $2
        LIMIT 1
        `,
        [rawShipment, customer.customer_id],
      );

      if (bookingRes.rows.length) {
        bookingId = bookingRes.rows[0].id;
        validatedShipmentNumber = bookingRes.rows[0].booking_ref;
      } else {
        // If not found in bookings, keep the number in description/meta without crashing
        validatedShipmentNumber = rawShipment;
      }
    }

    const ticketCode = `TK-${Math.floor(1000 + Math.random() * 9000)}`;
    const title =
      dto.issueCategory?.replace(/_/g, ' ').toUpperCase() || 'SUPPORT TICKET';
    const attachmentPaths = files.map(
      (f) => `/uploads/support-tickets/${f.filename}`,
    );

    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Insert ticket
      const ticketRes = await client.query(
        `
        INSERT INTO support_tickets (
          ticket_code,
          customer_id,
          booking_id,
          issue_category,
          title,
          description,
          status,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'in_progress', NOW(), NOW())
        RETURNING *
        `,
        [
          ticketCode,
          customer.customer_id,
          bookingId,
          dto.issueCategory,
          title,
          dto.description,
        ],
      );

      const ticket = ticketRes.rows[0];

      // Insert initial customer message
      await client.query(
        `
        INSERT INTO ticket_messages (
          ticket_id,
          sender_type,
          sender_name,
          message_text,
          attachments,
          sent_at
        )
        VALUES ($1, 'customer', $2, $3, $4, NOW())
        `,
        [
          ticket.id,
          customer.full_name || 'Customer',
          dto.description,
          attachmentPaths,
        ],
      );

      await client.query('COMMIT');

      return {
        ticketId: ticket.ticket_code,
        displayCode: `#${ticket.ticket_code}`,
        shipmentNumber: validatedShipmentNumber || '',
        issueCategory: ticket.issue_category,
        status: ticket.status,
        statusLabel: 'In progress',
        createdAt: ticket.created_at,
        estimatedResponseMinutes: 15,
        message:
          'Ticket created. An operations specialist will review and respond within 15 minutes.',
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // 3. GET /api/v1/support/tickets/:ticketId
  async getTicketConversation(userId: string, ticketIdOrCode: string) {
    const customer = await this.getCustomer(userId);

    const ticketRes = await this.db.query(
      `
      SELECT 
        st.*,
        b.booking_ref AS shipment_number
      FROM support_tickets st
      LEFT JOIN bookings b ON b.id = st.booking_id
      WHERE (st.id::text = $1 OR st.ticket_code = $1)
        AND st.customer_id = $2
      LIMIT 1
      `,
      [ticketIdOrCode.replace('#', ''), customer.customer_id],
    );

    if (!ticketRes.rows.length) {
      throw new NotFoundException('Support ticket not found.');
    }

    const ticket = ticketRes.rows[0];

    const messagesRes = await this.db.query(
      `
      SELECT 
        id,
        sender_type,
        sender_name,
        message_text,
        attachments,
        sent_at
      FROM ticket_messages
      WHERE ticket_id = $1
      ORDER BY sent_at ASC
      `,
      [ticket.id],
    );

    return {
      ticketId: ticket.ticket_code,
      displayCode: `#${ticket.ticket_code}`,
      shipmentNumber: ticket.shipment_number || null,
      issueCategory: ticket.issue_category,
      status: ticket.status,
      statusLabel:
        ticket.status === 'in_progress' ? 'In progress' : ticket.status,
      createdAt: ticket.created_at,
      messages: messagesRes.rows.map((m) => ({
        messageId: m.id,
        senderType: m.sender_type,
        senderName: m.sender_name,
        text: m.message_text,
        attachments: m.attachments || [],
        sentAt: m.sent_at,
      })),
    };
  }

  // 4. POST /api/v1/support/tickets/:ticketId/messages
  async replyToTicket(userId: string, ticketIdOrCode: string, text: string) {
    if (!text || !text.trim()) {
      throw new BadRequestException('Message text cannot be empty.');
    }

    const customer = await this.getCustomer(userId);

    const ticketRes = await this.db.query(
      `
      SELECT id, ticket_code
      FROM support_tickets
      WHERE (id::text = $1 OR ticket_code = $1)
        AND customer_id = $2
      LIMIT 1
      `,
      [ticketIdOrCode.replace('#', ''), customer.customer_id],
    );

    if (!ticketRes.rows.length) {
      throw new NotFoundException('Support ticket not found.');
    }

    const ticket = ticketRes.rows[0];

    const msgRes = await this.db.query(
      `
      INSERT INTO ticket_messages (
        ticket_id,
        sender_type,
        sender_name,
        message_text,
        attachments,
        sent_at
      )
      VALUES ($1, 'customer', $2, $3, '{}', NOW())
      RETURNING *
      `,
      [ticket.id, customer.full_name || 'Customer', text.trim()],
    );

    return {
      messageId: msgRes.rows[0].id,
      ticketCode: `#${ticket.ticket_code}`,
      senderType: 'customer',
      senderName: customer.full_name || 'Customer',
      text: msgRes.rows[0].message_text,
      sentAt: msgRes.rows[0].sent_at,
    };
  }
}