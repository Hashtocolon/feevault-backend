
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePartnerDto {
  @IsString()
  @MaxLength(200)
  partnerName: string;

  @IsIn(['Fleet owner', 'Owner-cum-driver'])
  partnerType: string;

  @IsString()
  @MaxLength(10)
  pan: string;

  @IsOptional()
  @IsString()
  bankUpiReference?: string;

  @IsOptional()
  @IsString()
  vehicleRegistration?: string;

  @IsOptional()
  @IsString()
  reeferMakeModel?: string;
}
