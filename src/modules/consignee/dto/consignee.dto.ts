import { IsString, IsOptional } from 'class-validator';

export class ConsigneePortalDto {
  @IsString()
  token: string;
}

export class VerifyDeliveryOtpDto {
  @IsString()
  token: string;

  @IsString()
  otp: string;
}

export class SubmitOutcomeDto {
  @IsString()
  token: string;

  @IsString()
  outcome: string; // 'DELIVERED' | 'FAILED'

  @IsString()
  @IsOptional()
  note?: string;
}

