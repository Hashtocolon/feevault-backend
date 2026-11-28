import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../../database/database.service';

import { CreateIncidentDto } from './dto/create-incident.dto';
import { CreateRescueDto } from './dto/create-rescue.dto';
import { CustomerDecisionDto } from './dto/customer-decision.dto';
import { CreateClaimDto } from './dto/create-claim.dto';
import { AlertRulesDto } from './dto/alert-rules.dto';

@Injectable()
export class AdminQualityService {
  constructor(private readonly db: DatabaseService) {}

  // API 4.1 - Get incidents
  async getIncidents() {
    const result = await this.db.query(
      `SELECT
          incident_ticket_id,
          trip_reference,
          incident_type,
          severity,
          current_temp,
          setpoint,
          duration_minutes,
          assigned_response,
          status
       FROM admin_quality_incidents
       ORDER BY created_at DESC`,
    );

    return result.rows.map((row: any) => ({
      incidentId: row.incident_ticket_id,
      tripReference: row.trip_reference,
      type: row.incident_type,
      severity: row.severity,
      currentTemp: row.current_temp === null
        ? null
        : Number(row.current_temp),
      setpoint: row.setpoint === null
        ? null
        : Number(row.setpoint),
      durationMinutes: row.duration_minutes,
      assignedTo: row.assigned_response,
      status: row.status,
    }));
  }

  // API 4.2 - Create incident
  async createIncident(
    dto: CreateIncidentDto,
    adminId: string,
  ) {
    const ticketId = `INC-TKT-${Date.now()}`;

    await this.db.query(
      `INSERT INTO admin_quality_incidents (
        incident_ticket_id,
        trip_reference,
        incident_type,
        severity,
        assigned_response,
        current_location,
        incident_details,
        status,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        ticketId,
        dto.tripReference,
        dto.incidentType,
        dto.severity,
        dto.assignedResponse,
        dto.currentLocation,
        dto.incidentDetails,
        'ACTIVE_DISPATCH',
        adminId,
      ],
    );

    return {
      incidentTicketId: ticketId,
      status: 'ACTIVE_DISPATCH',
    };
  }

  // API 4.3 - Reefer rescue
  async createRescue(
    dto: CreateRescueDto,
    adminId: string,
  ) {
    const rescueRef = `CR-FTL-RESCUE-${Date.now()}`;

    await this.db.query(
      `INSERT INTO admin_reefer_rescues (
        rescue_booking_ref,
        trip_reference,
        rescue_radius_km,
        customer_decision,
        rescue_vehicle_registration,
        transfer_cost_notes,
        status,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        rescueRef,
        dto.tripReference,
        dto.rescueRadiusKm,
        dto.customerDecision,
        dto.rescueVehicleRegistration ?? null,
        dto.transferCostNotes ?? null,
        'REQUESTED',
        adminId,
      ],
    );

    return {
      success: true,
      rescueBookingRef: rescueRef,
      message: 'Rescue request recorded successfully.',
    };
  }

  // API 4.4 - Customer incident decision
  async recordCustomerDecision(
    dto: CustomerDecisionDto,
    adminId: string,
  ) {
    await this.db.query(
      `INSERT INTO admin_customer_incident_decisions (
        trip_reference,
        decision,
        customer_instruction,
        recorded_by
      )
      VALUES ($1,$2,$3,$4)`,
      [
        dto.tripReference,
        dto.decision,
        dto.customerInstruction,
        adminId,
      ],
    );

    return {
      success: true,
      message:
        'Customer consent recorded and attached to trip audit trail',
    };
  }

  // API 4.5 - Get claims
  async getClaims() {
    const result = await this.db.query(
      `SELECT
        claim_id,
        booking_reference,
        customer,
        claim_reason,
        claim_amount_inr,
        claim_window_end,
        status
       FROM admin_cargo_claims
       ORDER BY created_at DESC`,
    );

    return result.rows.map((row: any) => ({
      claimId: row.claim_id,
      bookingReference: row.booking_reference,
      customer: row.customer,
      reason: row.claim_reason,
      claimAmountInr: Number(row.claim_amount_inr),
      claimWindowEnd: row.claim_window_end,
      status: row.status,
    }));
  }

  // API 4.6 - Create claim
  async createClaim(
    dto: CreateClaimDto,
    adminId: string,
  ) {
    const claimId = `CLM-${new Date().getFullYear()}-${Date.now()}`;

    await this.db.query(
      `INSERT INTO admin_cargo_claims (
        claim_id,
        booking_reference,
        customer,
        claim_reason,
        claim_amount_inr,
        claim_window_end,
        claim_summary,
        status,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        claimId,
        dto.bookingReference,
        dto.customer,
        dto.claimReason,
        dto.claimAmountInr,
        dto.claimWindowEnd,
        dto.claimSummary,
        'SUBMITTED',
        adminId,
      ],
    );

    return {
      claimId,
      status: 'SUBMITTED',
    };
  }

  // API 4.7 - Configure temperature alert rules
  async updateAlertRules(
    dto: AlertRulesDto,
    adminId: string,
  ) {
    if (dto.criticalDurationMin < dto.warningDurationMin) {
      throw new BadRequestException(
        'Critical duration cannot be less than warning duration',
      );
    }

    await this.db.query(
      `INSERT INTO admin_temperature_alert_rules (
        cargo_category,
        warning_duration_min,
        critical_duration_min,
        door_open_grace_min,
        defrost_cycle_window,
        probe_type,
        updated_by,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
      ON CONFLICT (cargo_category)
      DO UPDATE SET
        warning_duration_min = EXCLUDED.warning_duration_min,
        critical_duration_min = EXCLUDED.critical_duration_min,
        door_open_grace_min = EXCLUDED.door_open_grace_min,
        defrost_cycle_window = EXCLUDED.defrost_cycle_window,
        probe_type = EXCLUDED.probe_type,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()`,
      [
        dto.cargoCategory,
        dto.warningDurationMin,
        dto.criticalDurationMin,
        dto.doorOpenGraceMin,
        dto.defrostCycleWindow,
        dto.probeType,
        adminId,
      ],
    );

    return {
      success: true,
      message: `Alert rules successfully updated for ${dto.cargoCategory} category`,
    };
  }
}