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
import { DocumentsModule } from './modules/documents/documents.module';
import { ClaimsModule } from './modules/claims/claims.module';
import { CustomerSettingsModule } from './modules/customer-settings/customer-settings.module';
import { SupportModule } from './modules/support/support.module';
import { DispatchOffersModule } from './modules/dispatch_offers/dispatch_offers.module';
import { FleetAssignmentModule } from './modules/fleet_assignment/fleet_assignment.module';
import { PretripModule } from './modules/pretrip/pretrip.module';
import { PrecoolingModule } from './modules/precooling/precooling.module';
import { CompartmentModule } from './modules/compartment/compartment.module';
import { PickupArrivalModule } from './modules/pickup_arrival/pickup_arrival.module';
import { TripSettlementModule } from './modules/trip_settlement/trip_settlement.module';
import { StatementsModule } from './modules/statements/statements.module';
import { VehicleHealthModule } from './modules/vehicle_health/vehicle_health.module';
import { FleetModule } from './modules/fleet/fleet.module';
import { DriverProfileModule } from './modules/driver_profile/driver_profile.module';
import { AdminAuthModule } from './modules/admin_auth/admin_auth.module';
import { AdminOperationsModule } from './modules/admin_operations/admin_operations.module';
import { AdminOnboardingModule } from './modules/admin_onboarding/admin_onboarding.module';
import { AdminQualityModule } from './modules/admin_quality/admin_quality.module';
import { AdminFinanceModule } from './modules/admin_finance/admin_finance.module';
import { AdminGovernanceModule } from './modules/admin_governance/admin_governance.module';

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
    DocumentsModule,
    ClaimsModule,
    CustomerSettingsModule,
    SupportModule,
    DispatchOffersModule,
    FleetAssignmentModule,
    PretripModule,
    PrecoolingModule,
    CompartmentModule,
    PickupArrivalModule,
    TripSettlementModule,
    StatementsModule,
    VehicleHealthModule,
    FleetModule,
    DriverProfileModule,
    AdminAuthModule,
    AdminOperationsModule,
    AdminOnboardingModule,
    AdminQualityModule,
    AdminFinanceModule,
    AdminGovernanceModule,
  ],
})
export class AppModule {}
