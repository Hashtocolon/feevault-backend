
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class DeclineDispatchOfferDto {
  @IsString()
  @IsIn([
    'VEHICLE_UNAVAILABLE',
    'OUTSIDE_OPERATING_CORRIDOR',
    'INSUFFICIENT_CAPACITY',
    'REST_DRIVER_UNAVAILABLE',
    'VEHICLE_MAINTENANCE',
    'OTHER',
  ])
  declineReason: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  declineRemarks?: string;
}
