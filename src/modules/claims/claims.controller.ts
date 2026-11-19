
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { ClaimsService } from './claims.service';

// Existing project authentication imports
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// --------------------------------------------------
// CLAIM FILE UPLOAD DIRECTORY
// --------------------------------------------------

const CLAIM_UPLOAD_DIRECTORY = path.join(
  process.cwd(),
  'uploads',
  'claims',
);

// Create directory if it does not exist
fs.mkdirSync(CLAIM_UPLOAD_DIRECTORY, { recursive: true });

// --------------------------------------------------
// MULTER UPLOAD CONFIGURATION
// --------------------------------------------------

const claimUploadOptions = {
  storage: diskStorage({
    destination: CLAIM_UPLOAD_DIRECTORY,

    filename: (
      req: any,
      file: Express.Multer.File,
      callback: (error: Error | null, filename: string) => void,
    ) => {
      const extension = path
        .extname(file.originalname)
        .toLowerCase();

      callback(null, `${randomUUID()}${extension}`);
    },
  }),

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
  },

  fileFilter: (
    req: any,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new BadRequestException(
          'Only PDF, JPG and PNG files are allowed',
        ),
        false,
      );
    }

    callback(null, true);
  },
};

@Controller('claims')
@UseGuards(JwtAuthGuard)
export class ClaimsController {
  constructor(
    private readonly claimsService: ClaimsService,
  ) {}

  // ==================================================
  // API 1: FETCH CLAIMS LIST
  // GET /api/v1/claims
  // ==================================================

  @Get()
  async getClaims(
    @CurrentUser('id') userId: string,

    @Query('status') status?: string,

    @Query('page') page?: string,

    @Query('limit') limit?: string,
  ) {
    return this.claimsService.getClaims(
      userId,
      {
        status,
        page: Number(page) || 1,
        limit: Number(limit) || 20,
      },
    );
  }

  // ==================================================
  // API 2: SUBMIT NEW CLAIM
  // POST /api/v1/claims
  // ==================================================

  @Post()
  @UseInterceptors(
    FilesInterceptor(
      'evidenceFiles',
      10,
      claimUploadOptions,
    ),
  )
  async createClaim(
    @CurrentUser('id') userId: string,

    @Body() body: any,

    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.claimsService.createClaim(
      userId,
      body,
      files || [],
    );
  }

  // ==================================================
  // API 3: VIEW EVIDENCE PACK
  // GET /api/v1/claims/:claimId/evidence
  // ==================================================

  @Get(':claimId/evidence')
  async getEvidencePack(
    @CurrentUser('id') userId: string,

    @Param('claimId') claimId: string,
  ) {
    return this.claimsService.getEvidencePack(
      userId,
      claimId,
    );
  }

  // ==================================================
  // API 4: ADD CLAIM REMARK / APPEAL UPDATE
  // POST /api/v1/claims/:claimId/remarks
  // ==================================================

  @Post(':claimId/remarks')
  @UseInterceptors(
    FilesInterceptor(
      'additionalFiles',
      10,
      claimUploadOptions,
    ),
  )
  async addRemark(
    @CurrentUser('id') userId: string,

    @Param('claimId') claimId: string,

    @Body('remark') remark: string,

    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.claimsService.addRemark(
      userId,
      claimId,
      remark,
      files || [],
    );
  }
}
