
import { Module } from '@nestjs/common';

import { ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ClaimsController],
  providers: [ClaimsService],
  exports: [ClaimsService],
})
export class ClaimsModule {}
