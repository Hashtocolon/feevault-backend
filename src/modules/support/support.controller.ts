import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SupportService } from './support.service';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';

const uploadDirectory = join(
  process.cwd(),
  'uploads',
  'support-tickets',
);

if (!existsSync(uploadDirectory)) {
  mkdirSync(uploadDirectory, { recursive: true });
}

@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('overview')
  getOverview(@Req() req: any) {
    const userId = req.user?.userId || req.user?.id;
    return this.supportService.getOverview(userId);
  }

  @Post('tickets')
  @UseInterceptors(
    FilesInterceptor('attachments', 3, {
      storage: diskStorage({
        destination: uploadDirectory,
        filename: (req, file, callback) => {
          const uniqueName =
            `${Date.now()}-${Math.round(Math.random() * 1e9)}` +
            extname(file.originalname).toLowerCase();

          callback(null, uniqueName);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024,
        files: 3,
      },
      fileFilter: (req, file, callback) => {
        const allowedTypes = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'application/pdf',
        ];

        if (!allowedTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              'Only JPG, PNG, WEBP and PDF files are allowed.',
            ),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  createTicket(
    @Req() req: any,
    @Body() dto: CreateSupportTicketDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const userId = req.user?.userId || req.user?.id;
    return this.supportService.createTicket(
      userId,
      dto,
      files || [],
    );
  }

  @Get('tickets/:ticketId')
  getTicketConversation(
    @Req() req: any,
    @Param('ticketId') ticketId: string,
  ) {
    const userId = req.user?.userId || req.user?.id;
    return this.supportService.getTicketConversation(
      userId,
      ticketId,
    );
  }

  @Post('tickets/:ticketId/messages')
  replyToTicket(
    @Req() req: any,
    @Param('ticketId') ticketId: string,
    @Body('text') text: string,
  ) {
    const userId = req.user?.userId || req.user?.id;
    return this.supportService.replyToTicket(
      userId,
      ticketId,
      text,
    );
  }
}