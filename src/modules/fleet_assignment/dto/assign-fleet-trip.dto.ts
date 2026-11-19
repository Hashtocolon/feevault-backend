import { IsUUID } from 'class-validator';

export class AssignFleetTripDto {
  @IsUUID()
  vehicleId: string;

  @IsUUID()
  driverId: string;
}