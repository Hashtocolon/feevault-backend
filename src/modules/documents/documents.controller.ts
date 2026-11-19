
import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  StreamableFile,
  Res,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { Response } from 'express';
import * as path from 'path';

import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const uploadDirectory = path.join(
  process.cwd(),
  'uploads',
  'documents',
);

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
  ) {}

  // API 1: Fetch documents list
  @Get()
  async getDocuments(
    @CurrentUser('id') userId: string,
    @Query('category') category?: string,
    @Query('shipmentId') shipmentId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.documentsService.getDocuments(userId, {
      category,
      shipmentId,
      search,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  // API 2: Generate secure document download URL
  @Get(':docId/download')
  async getDownloadUrl(
    @Param('docId') docId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.documentsService.getDownloadUrl(userId, docId);
  }

  // Secure file endpoint used by the generated download URL
  @Get(':docId/file')
  async downloadFile(
    @Param('docId') docId: string,
    @Query('expires', ParseIntPipe) expires: number,
    @Query('token') token: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.documentsService.getDownloadFile(
      docId,
      expires,
      token,
    );

    response.set({
      'Content-Type': this.getMimeType(file.fileFormat),
      'Content-Disposition':
        `attachment; filename="${file.fileName}"`,
      'X-Content-Type-Options': 'nosniff',
    });

    return new StreamableFile(
      this.documentsService.createReadStream(file.filePath),
    );
  }

  // API 3: Upload customer document
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDirectory,
        filename: (_req, file, callback) => {
          const extension = path.extname(file.originalname).toLowerCase();
          callback(null, `${randomUUID()}${extension}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
      fileFilter: (_req, file, callback) => {
        const allowedMimeTypes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
        ];

        if (!allowedMimeTypes.includes(file.mimetype)) {
          return callback(
            new Error('Only PDF, JPG and PNG files are allowed'),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  async uploadDocument(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('docLabel') docLabel: string,
    @Body('category') category: string,
    @Body('shipmentId') shipmentId?: string,
  ) {
    return this.documentsService.uploadDocument(
      userId,
      file,
      {
        docLabel,
        category,
        shipmentId,
      },
    );
  }

  private getMimeType(format: string): string {
    const types: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
    };

    return types[format.toLowerCase()] || 'application/octet-stream';
  }
}
