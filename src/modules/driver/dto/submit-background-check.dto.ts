
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class SubmitBackgroundCheckDto {
  @IsString()
  @IsNotEmpty()
  @IsIn([
    'POLICE_VERIFICATION_CERTIFICATE',
    'BACKGROUND_AGENCY',
  ])
  verificationMethod: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  certificateNumber: string;

  @IsDateString()
  pvcIssueDate: string;

  @IsDateString()
  pvcExpiryDate: string;
}
