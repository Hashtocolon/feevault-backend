
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
} from 'class-validator';

export class CreateClaimDto {
  @IsString()
  @IsNotEmpty()
  bookingReference: string;

  @IsString()
  @IsNotEmpty()
  customer: string;

  @IsString()
  @IsNotEmpty()
  claimReason: string;

  @IsNumber()
  @Min(0)
  claimAmountInr: number;

  @IsDateString()
  claimWindowEnd: string;

  @IsString()
  @IsNotEmpty()
  claimSummary: string;
}