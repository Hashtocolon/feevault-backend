import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class ManualAllocationDto {
  @IsString()
  bookingReference: string;

  @IsUUID()
  vehicleId: string;

  @IsUUID()
  driverId: string;

  @IsNumber()
  @Min(1)
  @Max(3600)
  offerExpirySeconds: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  incentiveInr?: number;

  @IsString()
  @MaxLength(1000)
  allocationReason: string;
}