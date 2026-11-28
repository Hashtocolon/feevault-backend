import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateExpenseDto {
  @IsString()
  @IsIn(['APPROVED', 'REJECTED'])
  status: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  approvedAmountInr?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  financeNote?: string;
}