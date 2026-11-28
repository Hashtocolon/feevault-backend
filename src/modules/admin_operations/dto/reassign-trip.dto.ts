import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ReassignTripDto {
  @IsString()
  @IsNotEmpty()
  bookingReference: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;

  @IsString()
  @IsNotEmpty()
  newVehicle: string;

  @IsString()
  @IsNotEmpty()
  newDriver: string;

  @IsOptional()
  @IsBoolean()
  updateEWayBillPartB?: boolean;
}