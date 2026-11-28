import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class InviteDriverDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  driverName: string;

  @IsString()
  @Matches(/^\+91[6-9]\d{9}$/, {
    message: 'Enter a valid Indian mobile number with +91',
  })
  driverMobileNumber: string;

  @IsOptional()
  @IsString()
  defaultAssignedVehicleId?: string;
}