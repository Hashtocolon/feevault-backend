import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class WithdrawConsentDto {
  @IsOptional()
  @IsBoolean()
  withdrawAnalytics?: boolean;

  @IsOptional()
  @IsBoolean()
  withdrawMarketing?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}