import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export const COMPLIANCE_DOCUMENT_CODES = [
  'FITNESS_CERTIFICATE',
  'NATIONAL_PERMIT',
  'COMMERCIAL_INSURANCE',
  'CARRIER_LEGAL_LIABILITY',
  'POLLUTION_UNDER_CONTROL',
  'NABL_REEFER_CALIBRATION',
  'CONTAINER_PEST_HYGIENE',
  'DRIVING_LICENSE',
  'POLICE_VERIFICATION',
] as const;

export class RenewComplianceDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(COMPLIANCE_DOCUMENT_CODES)
  documentCode: string;

  @IsString()
  @IsNotEmpty()
  certificateNumber: string;

  @IsDateString()
  newExpiryDate: string;
}