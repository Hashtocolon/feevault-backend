import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ConfirmAssignmentDto {
  @IsIn(['CONFIRM', 'REJECT'])
  action: 'CONFIRM' | 'REJECT';

  @IsOptional()
  @IsIn([
    'HEALTH_ISSUE',
    'VEHICLE_ISSUE',
    'KEYS_UNAVAILABLE',
    'SHIFT_HOURS_EXCEEDED',
    'OTHER',
  ])
  rejectionReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionRemarks?: string;
}