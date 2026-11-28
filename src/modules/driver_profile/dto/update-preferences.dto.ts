
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsString()
  @IsIn(['en', 'hi', 'kn', 'ta', 'te', 'mr'])
  preferredLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  emergencyContactRelationship?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+91[6-9]\d{9}$/, {
    message: 'Enter a valid Indian mobile number with +91',
  })
  emergencyContactPhone?: string;
}
