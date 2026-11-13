import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { CustomerModule } from './modules/customer/customer.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { DriverModule } from './modules/driver/driver.module';
import { CargoModule } from './modules/cargo/cargo.module';
import { MasterModule } from './modules/master/master.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { DispatchModule } from './modules/dispatch/dispatch.module';
import { TripsModule } from './modules/trips/trips.module';
import { CreditModule } from './modules/credit/credit.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { FailedDeliveryModule } from './modules/failed-delivery/failed-delivery.module';
import { ProfileModule } from './modules/profile/profile.module';
import { ConsentModule } from './modules/consent/consent.module';
import { ShareLinkModule } from './modules/share-link/share-link.module';
import { ConsigneeModule } from './modules/consignee/consignee.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    AuthModule,
    CustomerModule,
    BookingsModule,
    DriverModule,
    CargoModule,
    MasterModule,
    ComplianceModule,
    DispatchModule,
    TripsModule,
    CreditModule,
    DashboardModule,
    FailedDeliveryModule,
    ProfileModule,
    ConsentModule,
    ShareLinkModule,
    ConsigneeModule,
  ],
})
export class AppModule {}
