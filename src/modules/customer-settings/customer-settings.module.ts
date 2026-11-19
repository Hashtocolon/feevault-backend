import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';

import { CustomerSettingsController } from './customer-settings.controller';
import { CustomerSettingsService } from './customer-settings.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CustomerSettingsController],
  providers: [CustomerSettingsService],
  exports: [CustomerSettingsService],
})
export class CustomerSettingsModule {}