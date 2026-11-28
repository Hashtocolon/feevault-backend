
import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { AdminJwtAuthGuard } from '../admin_auth/admin-jwt-auth.guard';
import { AdminOperationsService } from './admin_operations.service';

import { CreateBookingDto } from './dto/create-booking.dto';
import { ManualAllocationDto } from './dto/manual-allocation.dto';
import { DispatchRulesDto } from './dto/dispatch-rules.dto';
import { ReassignTripDto } from './dto/reassign-trip.dto';

@Controller('admin')
@UseGuards(AdminJwtAuthGuard)
export class AdminOperationsController {
  constructor(
    private readonly adminOperationsService: AdminOperationsService,
  ) {}

  // API 2.1 - Dashboard KPIs
  @Get('dashboard/kpis')
  getDashboardKpis() {
    return this.adminOperationsService.getDashboardKpis();
  }

  // API 2.2 - Live Trip Monitor
  @Get('trips/live')
  getLiveTrips() {
    return this.adminOperationsService.getLiveTrips();
  }

  // API 2.3 - Create FTL Booking
  @Post('bookings/test-create')
  @HttpCode(HttpStatus.CREATED)
  createBooking(@Body() dto: CreateBookingDto, @Req() req: any) {
    return this.adminOperationsService.createBooking(
      dto,
      req.admin.id,
    );
  }

  // API 2.4 - Dispatch Queue
  @Get('dispatch/queue')
  getDispatchQueue() {
    return this.adminOperationsService.getDispatchQueue();
  }

  // API 2.5 - Manual Allocation
  @Post('dispatch/allocate-manual')
  allocateManual(@Body() dto: ManualAllocationDto, @Req() req: any) {
    return this.adminOperationsService.allocateManual(
      dto,
      req.admin.id,
    );
  }

  // API 2.6 - Configure Dispatch Rules
  @Put('dispatch/rules')
  updateDispatchRules(@Body() dto: DispatchRulesDto, @Req() req: any) {
    return this.adminOperationsService.updateDispatchRules(
      dto,
      req.admin.id,
    );
  }

  // API 2.7 - Emergency Reassignment
  @Post('trips/reassign')
  reassignTrip(@Body() dto: ReassignTripDto, @Req() req: any) {
    return this.adminOperationsService.reassignTrip(
      dto,
      req.admin.id,
    );
  }
}
