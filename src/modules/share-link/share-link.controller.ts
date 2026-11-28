import { Controller, Post, Param, UseGuards, Body } from '@nestjs/common';
import { ShareLinkService } from './share-link.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('trips')
export class ShareLinkController {
  constructor(private readonly shareLinkService: ShareLinkService) { }

  @UseGuards(JwtAuthGuard)
  @Post(':bookingId/share-link')
  async generateConsigneeShareLink(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      consigneeMobile: string;
      notifyViaSms?: boolean;
      notifyViaWhatsapp?: boolean;
    },
  ) {
    return this.shareLinkService.generateConsigneeShareLink(
      bookingId,
      userId,
      body,
    );
  }
}