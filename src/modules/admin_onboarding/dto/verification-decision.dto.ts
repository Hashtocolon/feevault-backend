
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class VerificationDecisionDto {
  @IsIn(['APPROVED', 'REJECTED'])
  decision: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewerNote?: string;
}
