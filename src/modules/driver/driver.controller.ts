import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  Param,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { DriverService } from './driver.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('driver')
export class DriverController {
  constructor(private readonly driverService: DriverService) { }

  @Get('dashboard')
  @UseGuards(JwtAuthGuard)
  async getDashboard(@CurrentUser('userId') userId: string) {
    const data = await this.driverService.getDashboard(userId);
    return {
      success: true,
      message: 'Dashboard summary retrieved successfully',
      data,
    };
  }

  @Patch('duty/status')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async toggleDuty(
    @CurrentUser('userId') userId: string,
    @Body() body: any,
  ) {
    const data = await this.driverService.toggleDutyStatus(userId, body);
    return {
      success: true,
      message: `You are now ${data.dutyStatus}. Ready for FTL dispatch waves.`,
      data,
    };
  }

  @Get('compliance/calendar')
  @UseGuards(JwtAuthGuard)
  async getCompliance(@CurrentUser('userId') userId: string) {
    const data = await this.driverService.getComplianceCalendar(userId);
    return {
      success: true,
      data,
    };
  }
  @Get('debug/partner-role-schema')
  @UseGuards(JwtAuthGuard)
  async inspectPartnerRoleSchema() {
    const data = await this.driverService.inspectPartnerRoleSchema();

    return {
      success: true,
      message: 'Database schema inspected successfully',
      data,
    };
  }
  @Post('profile/role')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async selectPartnerRole(
    @CurrentUser('userId') userId: string,
    @Body() body: { partnerRole: string },
  ) {
    const data = await this.driverService.selectPartnerRole(
      userId,
      body,
    );

    return {
      success: true,
      message: 'Partner role saved successfully',
      data,
    };
  }
  @Post('fleet/link')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async linkToFleet(
    @CurrentUser('userId') userId: string,
    @Body()
    body: {
      fleetCode?: string;
      ownerMobileNumber?: string;
    },
  ) {
    const data = await this.driverService.linkToFleet(userId, body);

    return {
      success: true,
      message:
        'Fleet link request submitted successfully. Awaiting fleet owner approval.',
      data,
    };
  }
  // API 3.1 - Submit Personal and Driving Licence KYC
  @Post('kyc/personal')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'aadhaarFrontPhoto', maxCount: 1 },
        { name: 'dlFrontPhoto', maxCount: 1 },
        { name: 'dlBackPhoto', maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 5 * 1024 * 1024,
          files: 3,
        },
        fileFilter: (_req, file, callback) => {
          const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
          ];

          if (!allowedTypes.includes(file.mimetype)) {
            return callback(
              new BadRequestException(
                'Only JPG, PNG and WEBP images are allowed',
              ),
              false,
            );
          }

          callback(null, true);
        },
      },
    ),
  )
  async submitPersonalKyc(
    @CurrentUser('userId') userId: string,
    @Body()
    body: {
      fullName: string;
      dateOfBirth: string;
      panNumber: string;
      aadhaarNumber: string;
      dlNumber: string;
      dlExpiryDate: string;
    },
    @UploadedFiles()
    files: {
      aadhaarFrontPhoto?: any[];
      dlFrontPhoto?: any[];
      dlBackPhoto?: any[];
    },
  ) {
    const data = await this.driverService.submitPersonalKyc(
      userId,
      body,
      files,
    );

    return {
      success: true,
      message:
        'Personal KYC, Aadhaar and Driving License submitted successfully',
      data,
    };
  }
  // API 4.1 - Register Vehicle and Upload Documents
  @Post('kyc/vehicle')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'rcPhoto', maxCount: 1 },
        { name: 'insuranceDoc', maxCount: 1 },
        { name: 'goodsInsuranceDoc', maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 10 * 1024 * 1024,
          files: 3,
        },
        fileFilter: (_req, file, callback) => {
          const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
            'application/pdf',
          ];

          if (!allowedTypes.includes(file.mimetype)) {
            return callback(
              new BadRequestException(
                'Only JPG, PNG, WEBP and PDF documents are allowed',
              ),
              false,
            );
          }

          callback(null, true);
        },
      },
    ),
  )
  async registerVehicle(
    @CurrentUser('userId') userId: string,
    @Body()
    body: {
      vehicleNumber: string;
      vehicleClass: string;
      payloadCapacityKg: string;
      fitnessExpiryDate: string;
      permitExpiryDate: string;
    },
    @UploadedFiles()
    files: {
      rcPhoto?: any[];
      insuranceDoc?: any[];
      goodsInsuranceDoc?: any[];
    },
  ) {
    const data = await this.driverService.registerVehicle(
      userId,
      body,
      files,
    );

    return {
      success: true,
      message:
        'Vehicle details and compliance documents submitted successfully',
      data,
    };
  }
  // API 5.1 - Reefer Hygiene KYC
  @Post('kyc/reefer-hygiene')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'calibrationCert', maxCount: 1 },
        { name: 'pestControlCert', maxCount: 1 },
        { name: 'containerInteriorPhoto', maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 10 * 1024 * 1024,
          files: 3,
        },
        fileFilter: (_req, file, callback) => {
          const imageTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
          ];

          const certificateTypes = [
            ...imageTypes,
            'application/pdf',
          ];

          const allowedTypes =
            file.fieldname === 'containerInteriorPhoto'
              ? imageTypes
              : certificateTypes;

          if (!allowedTypes.includes(file.mimetype)) {
            return callback(
              new BadRequestException(
                `Invalid file format for ${file.fieldname}`,
              ),
              false,
            );
          }

          callback(null, true);
        },
      },
    ),
  )
  async submitReeferHygiene(
    @CurrentUser('userId') userId: string,
    @Body()
    body: {
      vehicleId: string;
      reeferMake: string;
      reeferModel: string;
      reeferSerialNumber: string;
      minTempCapabilityCelsius: string;
      maxTempCapabilityCelsius: string;
      calibrationExpiryDate: string;
    },
    @UploadedFiles()
    files: {
      calibrationCert?: any[];
      pestControlCert?: any[];
      containerInteriorPhoto?: any[];
    },
  ) {
    const data = await this.driverService.submitReeferHygiene(
      userId,
      body,
      files,
    );

    return {
      success: true,
      message:
        'Reefer specifications and hygiene compliance submitted successfully',
      data,
    };
  }
  // DEBUG: Inspect trip and cargo database structure
  @Get('debug/trip-cargo-schema')
  @UseGuards(JwtAuthGuard)
  async inspectTripCargoSchema() {
    const data = await this.driverService.inspectTripCargoSchema();

    return {
      success: true,
      message: 'Trip and cargo schema inspected successfully',
      data,
    };
  }


  // API 16.1 - Submit Cargo Condition & Core Temperature Intake Check
  @Post('trips/:tripId/pickup/cargo-check')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'cargoIntakeTempProbePhoto', maxCount: 1 },
        { name: 'cargoPhotos', maxCount: 10 },
      ],
      {
        limits: {
          fileSize: 10 * 1024 * 1024,
          files: 11,
        },
        fileFilter: (_req, file, callback) => {
          const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
          ];

          if (!allowedTypes.includes(file.mimetype)) {
            return callback(
              new BadRequestException(
                'Only JPG, PNG and WEBP images are allowed',
              ),
              false,
            );
          }

          callback(null, true);
        },
      },
    ),
  )
  async submitCargoIntakeCheck(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
    @Body()
    body: {
      cargoIntakeTempCelsius: string;
      tempProbeId: string;
      packagingCondition: string;
      labelCompliance: string;
      cargoAccepted: string;
    },
    @UploadedFiles()
    files: {
      cargoIntakeTempProbePhoto?: any[];
      cargoPhotos?: any[];
    },
  ) {
    const data = await this.driverService.submitCargoIntakeCheck(
      userId,
      tripId,
      body,
      files,
    );

    return {
      success: true,
      message:
        data.cargoCheckStatus === 'ACCEPTED'
          ? 'Cargo condition check passed. Proceeding to loading.'
          : 'Cargo refused. Proceed to cargo refusal details.',
      data,
    };
  }
  @Get('debug/my-trips')
  @UseGuards(JwtAuthGuard)
  async debugMyTrips(@CurrentUser('userId') userId: string) {
    const data = await this.driverService.getMyTripsForDebug(userId);

    return {
      success: true,
      data,
    };
  }

  // API 17.1 - Submit Cargo Refusal with Evidence
  @Post('trips/:tripId/pickup/cargo-refusal')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'shipperAcknowledgementPhoto', maxCount: 1 },
        { name: 'refusalEvidencePhotos', maxCount: 10 },
      ],
      {
        limits: {
          fileSize: 10 * 1024 * 1024,
          files: 11,
        },
        fileFilter: (_req, file, callback) => {
          const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
          ];

          if (!allowedTypes.includes(file.mimetype)) {
            return callback(
              new BadRequestException(
                'Only JPG, PNG and WEBP images are allowed',
              ),
              false,
            );
          }

          callback(null, true);
        },
      },
    ),
  )
  async submitCargoRefusal(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
    @Body()
    body: {
      refusalReason: string;
      measuredTempCelsius: string;
      totalLoadedCount: string;
      refusedCount: string;
      quantityUnit: string;
      refusalRemarks: string;
      shipperRepresentativeName: string;
      detentionClaimRequired: string;
    },
    @UploadedFiles()
    files: {
      shipperAcknowledgementPhoto?: any[];
      refusalEvidencePhotos?: any[];
    },
  ) {
    const data = await this.driverService.submitCargoRefusal(
      userId,
      tripId,
      body,
      files,
    );

    return {
      success: true,
      message:
        'Cargo refusal recorded. Evidence saved. Ops notification is pending integration.',
      data,
    };
  }

  // API 18.1 - Submit Loading Proof, Cargo Counts & Door Exposure Log
  @Post('trips/:tripId/pickup/loading')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'boltSealPhoto', maxCount: 1 },
        { name: 'loadingPhotos', maxCount: 10 },
      ],
      {
        limits: {
          fileSize: 10 * 1024 * 1024,
          files: 11,
        },
        fileFilter: (_req, file, callback) => {
          const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
          ];

          if (!allowedTypes.includes(file.mimetype)) {
            return callback(
              new BadRequestException(
                'Only JPG, PNG and WEBP images are allowed',
              ),
              false,
            );
          }

          callback(null, true);
        },
      },
    ),
  )
  async submitLoadingProof(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
    @Body()
    body: {
      compartmentNumber: string;
      palletCount: string;
      cartonCount: string;
      cargoDescription: string;
      doorOpenTimestamp: string;
      doorCloseTimestamp: string;
      doorOpenDurationSeconds: string;
      loadingSequenceConfirmed: string;
      boltSealNumber: string;
    },
    @UploadedFiles()
    files: {
      boltSealPhoto?: any[];
      loadingPhotos?: any[];
    },
  ) {
    const data = await this.driverService.submitLoadingProof(
      userId,
      tripId,
      body,
      files,
    );

    return {
      success: true,
      message: 'Loading proof recorded. Proceeding to shipper sign-off.',
      data,
    };
  }

  // API 10.1 - Accept Dispatch Job Offer
  @Post('trips/:tripId/accept')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async acceptDispatchOffer(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
    @Body()
    body: {
      acceptedAtLatitude: number | string;
      acceptedAtLongitude: number | string;
    },
  ) {
    const data = await this.driverService.acceptDispatchOffer(
      userId,
      tripId,
      body,
    );

    return {
      success: true,
      message: `Trip ${data.tripId} accepted successfully! Navigation and Pre-Trip checklist unlocked.`,
      data,
    };
  }

  // API 19.1 - Submit Shipper Sign-Off & Handover
  @Post('trips/:tripId/pickup/signoff')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'shipperSignaturePhoto', maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 10 * 1024 * 1024,
          files: 1,
        },
        fileFilter: (_req, file, callback) => {
          const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
          ];

          if (!allowedTypes.includes(file.mimetype)) {
            return callback(
              new BadRequestException(
                'Only JPG, PNG and WEBP images are allowed',
              ),
              false,
            );
          }

          callback(null, true);
        },
      },
    ),
  )
  async submitShipperSignoff(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
    @Body()
    body: {
      shipperContactName: string;
      shipperOtp?: string;
      lorryReceiptNumber: string;
      driverConfirmationCheck: string;
      pickupCompletedTimestamp: string;
    },
    @UploadedFiles()
    files: {
      shipperSignaturePhoto?: any[];
    },
  ) {
    const data = await this.driverService.submitShipperSignoff(
      userId,
      tripId,
      body,
      files,
    );

    return {
      success: true,
      message:
        'Shipper sign-off complete. Trip officially started. Drive safe!',
      data,
    };
  }

  // API 20.1 - Get Active Trip Status & Live Telematics
  @Get('trips/:tripId/live-status')
  @UseGuards(JwtAuthGuard)
  async getActiveTripLiveStatus(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
  ) {
    const data = await this.driverService.getActiveTripLiveStatus(
      userId,
      tripId,
    );

    return {
      success: true,
      data,
    };
  }
  // API 20.2 - Log Trip Checkpoint / Milestone Update
  @Post('trips/:tripId/checkpoint')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'tollReceiptPhoto', maxCount: 1 },
        { name: 'checkpointPhoto', maxCount: 1 },
      ],
      {
        limits: {
          fileSize: 10 * 1024 * 1024,
          files: 2,
        },
        fileFilter: (_req, file, callback) => {
          const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
          ];

          if (!allowedTypes.includes(file.mimetype)) {
            return callback(
              new BadRequestException(
                'Only JPG, PNG and WEBP images are allowed',
              ),
              false,
            );
          }

          callback(null, true);
        },
      },
    ),
  )
  async logTripCheckpoint(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
    @Body() body: any,
    @UploadedFiles()
    files: {
      tollReceiptPhoto?: any[];
      checkpointPhoto?: any[];
    },
  ) {
    const data = await this.driverService.logTripCheckpoint(
      userId,
      tripId,
      body,
      files,
    );

    return {
      success: true,
      message: 'Checkpoint logged successfully.',
      data,
    };
  }


  // API 21.1 - Submit Manual Temperature Log (2-Hour IoT Fallback)
  @Post('trips/:tripId/temperature/manual-log')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'thermometerPhoto', maxCount: 1 }],
      {
        limits: {
          fileSize: 10 * 1024 * 1024,
          files: 1,
        },
        fileFilter: (_req, file, callback) => {
          const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
          ];

          if (!allowedTypes.includes(file.mimetype)) {
            return callback(
              new BadRequestException(
                'Only JPG, PNG and WEBP images are allowed',
              ),
              false,
            );
          }

          callback(null, true);
        },
      },
    ),
  )
  async submitManualTemperatureLog(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
    @Body() body: any,
    @UploadedFiles()
    files: {
      thermometerPhoto?: any[];
    },
  ) {
    const data =
      await this.driverService.submitManualTemperatureLog(
        userId,
        tripId,
        body,
        files,
      );

    return {
      success: true,
      message:
        'Manual temperature reading saved. Clearly labelled as Driver Entered.',
      data,
    };
  }

  // API 22.1 - Trigger Emergency SOS Incident Alert
  @Post('trips/:tripId/emergency/sos')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [{ name: 'evidenceMedia', maxCount: 1 }],
      {
        limits: {
          fileSize: 10 * 1024 * 1024,
          files: 1,
        },
        fileFilter: (_req, file, callback) => {
          const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
            'video/mp4',
            'video/quicktime',
          ];

          if (!allowedTypes.includes(file.mimetype)) {
            return callback(
              new BadRequestException(
                'Only JPG, PNG, WEBP, MP4 and MOV files are allowed',
              ),
              false,
            );
          }

          callback(null, true);
        },
      },
    ),
  )
  async triggerEmergencySOS(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
    @Body() body: any,
    @UploadedFiles()
    files: {
      evidenceMedia?: any[];
    },
  ) {
    const data =
      await this.driverService.triggerEmergencySOS(
        userId,
        tripId,
        body,
        files,
      );

    return {
      success: true,
      message: data.opsNotified
        ? 'Emergency SOS transmitted to 24/7 Ops Command Desk.'
        : 'Emergency SOS recorded. Ops notification is pending integration.',
      data,
    };
  }
  // API 23.1 - Record Delivery Arrival & Door Exposure
  @Post('trips/:tripId/delivery/arrival')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async recordDeliveryArrival(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
    @Body() body: any,
  ) {
    const data =
      await this.driverService.recordDeliveryArrival(
        userId,
        tripId,
        body,
      );

    return {
      success: true,
      message:
        'Delivery arrival and door exposure recorded. Proceeding to handover evidence.',
      data,
    };
  }

  // API 24.1 - Submit Delivery Handover Evidence
  @Post('trips/:tripId/delivery/handover-evidence')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'boltSealCutPhoto', maxCount: 1 },
        { name: 'cargoConditionPhotos', maxCount: 10 },
      ],
      {
        limits: {
          fileSize: 10 * 1024 * 1024,
          files: 11,
        },
        fileFilter: (_req, file, callback) => {
          const allowedTypes = [
            'image/jpeg',
            'image/png',
          ];

          if (!allowedTypes.includes(file.mimetype)) {
            return callback(
              new BadRequestException(
                'Only JPG and PNG images are allowed',
              ),
              false,
            );
          }

          callback(null, true);
        },
      },
    ),
  )
  async submitDeliveryHandoverEvidence(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
    @Body() body: any,
    @UploadedFiles()
    files: {
      boltSealCutPhoto?: any[];
      cargoConditionPhotos?: any[];
    },
  ) {
    const data =
      await this.driverService.submitDeliveryHandoverEvidence(
        userId,
        tripId,
        body,
        files,
      );

    return {
      success: true,
      message:
        'Handover evidence recorded. Proceed to receiver outcome.',
      data,
    };
  }

  // API 25.1 - Record Receiver Outcome Choice
  @Patch('trips/:tripId/delivery/outcome')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async recordDeliveryOutcomeChoice(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
    @Body() body: {
      deliveryOutcome: string;
      outcomeSelectedTimestamp: string;
    },
  ) {
    const data =
      await this.driverService.recordDeliveryOutcomeChoice(
        userId,
        tripId,
        body,
      );

    return {
      success: true,
      message: 'Delivery outcome recorded.',
      data,
    };
  }

  // ============================================================
  // API 30.1 - Fetch Ops Disposition Instruction
  // ============================================================

  @Get('trips/:tripId/delivery/disposition')
  @UseGuards(JwtAuthGuard)
  async getOpsDispositionInstruction(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
  ) {
    const data =
      await this.driverService.getOpsDispositionInstruction(
        userId,
        tripId,
      );

    return {
      success: true,
      data,
    };
  }

  // ============================================================
  // API 30.2 - Acknowledge Ops Disposition Instruction
  // ============================================================

  @Post('trips/:tripId/delivery/disposition-ack')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async acknowledgeOpsDisposition(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
    @Body()
    body: {
      opsTicketRef: string;
      dispositionInstruction: string;
      driverAcknowledged: boolean;
      acknowledgementTimestamp: string;
      opsAgentName: string;
      dispositionDeadlineTimestamp: string;
      driverCurrentLatitude: number;
      driverCurrentLongitude: number;
      driverNote?: string;
    },
  ) {
    const data =
      await this.driverService.acknowledgeOpsDisposition(
        userId,
        tripId,
        body,
      );

    return {
      success: true,
      message:
        'Disposition instruction acknowledged. Deadline monitoring registered.',
      data,
    };
  }


  // ============================================================
  // API 26.1 + 27.1 + 28.1 + 29.1 + 31.1
  // Submit Delivery Proof of Delivery
  // ============================================================

  @Post('trips/:tripId/delivery/pod')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        // API 26.1
        { name: 'receiverSignaturePhoto', maxCount: 1 },
        { name: 'podPhotos', maxCount: 10 },
        { name: 'receiverStampPhoto', maxCount: 1 },

        // API 27.1
        { name: 'quantityMismatchPhotos', maxCount: 10 },

        // API 28.1
        { name: 'excursionPhotos', maxCount: 10 },

        // API 29.1
        { name: 'rejectionPhotos', maxCount: 10 },
        { name: 'receiverRefusalLetterPhoto', maxCount: 1 },

        // API 31.1
        { name: 'receiverCallLogScreenshot', maxCount: 1 },
        { name: 'arrivalEvidencePhoto', maxCount: 1 },
        { name: 'failureEvidencePhotos', maxCount: 10 },
      ],
      {
        limits: {
          fileSize: 10 * 1024 * 1024,
          files: 55,
        },
        fileFilter: (_req, file, callback) => {
          const allowedTypes = [
            'image/jpeg',
            'image/png',
          ];

          if (!allowedTypes.includes(file.mimetype)) {
            return callback(
              new BadRequestException(
                'Only JPG and PNG images are allowed',
              ),
              false,
            );
          }

          callback(null, true);
        },
      },
    ),
  )
  async submitFullAcceptancePOD(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
    @Body() body: any,
    @UploadedFiles()
    files: {
      // API 26.1
      receiverSignaturePhoto?: any[];
      podPhotos?: any[];
      receiverStampPhoto?: any[];

      // API 27.1
      quantityMismatchPhotos?: any[];

      // API 28.1
      excursionPhotos?: any[];

      // API 29.1
      rejectionPhotos?: any[];
      receiverRefusalLetterPhoto?: any[];

      // API 31.1
      receiverCallLogScreenshot?: any[];
      arrivalEvidencePhoto?: any[];
      failureEvidencePhotos?: any[];
    },
  ) {
    const outcome = String(
      body?.deliveryOutcome || '',
    )
      .trim()
      .toUpperCase();

    let data: any;
    let message: string;

    // API 26.1 - Full Acceptance
    if (outcome === 'FULL_ACCEPTANCE') {
      data = await this.driverService.submitFullAcceptancePOD(
        userId,
        tripId,
        body,
        files,
      );

      message =
        'Full acceptance POD submitted. Trip delivery complete.';
    }

    // API 27.1 - Partial Acceptance
    else if (outcome === 'PARTIAL_ACCEPTANCE') {
      data = await this.driverService.submitPartialAcceptancePOD(
        userId,
        tripId,
        body,
        files,
      );

      message = 'Partial acceptance POD submitted.';
    }

    // API 28.1 - Excursion Claim
    else if (outcome === 'EXCURSION_CLAIM') {
      data = await this.driverService.submitExcursionClaimPOD(
        userId,
        tripId,
        body,
        files,
      );

      message = 'Excursion claim POD submitted.';
    }

    // API 29.1 - Full Rejection
    else if (outcome === 'FULL_REJECTION') {
      data = await this.driverService.submitFullRejectionPOD(
        userId,
        tripId,
        body,
        files,
      );

      message =
        'Full rejection recorded. Ops disposition workflow initiated.';
    }

    // API 31.1 - Failed Delivery
    else if (outcome === 'FAILED_DELIVERY') {
      data = await this.driverService.submitFailedDeliveryPOD(
        userId,
        tripId,
        body,
        files,
      );

      message = data.shipperNotified
        ? 'Failed delivery recorded. Ops re-delivery ticket raised. Shipper notified.'
        : 'Failed delivery recorded. Ops re-delivery ticket raised. Shipper notification is pending integration.';
    }

    else {
      throw new BadRequestException(
        'Invalid deliveryOutcome. Allowed values: FULL_ACCEPTANCE, PARTIAL_ACCEPTANCE, EXCURSION_CLAIM, FULL_REJECTION, FAILED_DELIVERY',
      );
    }

    return {
      success: true,
      message,
      data,
    };
  }
  // ============================================================
  // API 32.1 - SUBMIT FINAL DIGITAL e-POD
  // POST /api/v1/driver/trips/:tripId/delivery/epod/submit
  // ============================================================

  @Post('trips/:tripId/delivery/epod/submit')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async submitFinalEPOD(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
    @Body() body: any,
  ) {
    const data = await this.driverService.submitFinalEPOD(
      userId,
      tripId,
      body,
    );

    return {
      success: true,
      message: 'Digital e-POD submitted successfully.',
      data,
    };
  }
  // ============================================================
  // API 33.1 - SUBMIT TRIP EXPENSE
  // ============================================================

  @Post('trips/:tripId/expenses')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        {
          name: 'receiptPhoto',
          maxCount: 1,
        },
      ],
      {
        limits: {
          fileSize: 10 * 1024 * 1024,
          files: 1,
        },
        fileFilter: (_req, file, callback) => {
          const allowedTypes = [
            'image/jpeg',
            'image/png',
            'application/pdf',
          ];

          if (!allowedTypes.includes(file.mimetype)) {
            return callback(
              new BadRequestException(
                'Only JPG, PNG and PDF receipts are allowed',
              ),
              false,
            );
          }

          callback(null, true);
        },
      },
    ),
  )
  async submitTripExpense(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
    @Body() body: any,
    @UploadedFiles()
    files: {
      receiptPhoto?: any[];
    },
  ) {
    const data = await this.driverService.submitTripExpense(
      userId,
      tripId,
      body,
      files,
    );

    return {
      success: true,
      message: 'Expense entry recorded.',
      data,
    };
  }


  // ============================================================
  // API 33.2 - GET ALL EXPENSE ENTRIES
  // ============================================================

  @Get('trips/:tripId/expenses')
  @UseGuards(JwtAuthGuard)
  async getTripExpenses(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
  ) {
    const data = await this.driverService.getTripExpenses(
      userId,
      tripId,
    );

    return {
      success: true,
      data,
    };
  }
  // ============================================================
  // API 34.1 - SUBMIT TWO-WAY TRIP RATING
  // POST /api/v1/driver/trips/:tripId/rating
  // ============================================================

  @Post('trips/:tripId/rating')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async submitTripRating(
    @CurrentUser('userId') userId: string,
    @Param('tripId') tripId: string,
    @Body() body: any,
  ) {
    const data = await this.driverService.submitTripRating(
      userId,
      tripId,
      body,
    );

    return {
      success: true,
      message:
        'Trip rating submitted successfully. Proceeding to earnings settlement.',
      data,
    };
  }
}