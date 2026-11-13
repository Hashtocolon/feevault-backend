import { IsString, IsOptional } from 'class-validator';

export class EscalateOpsDto {
  @IsString()
  reason: string;

  @IsString()
  @IsOptional()
  note?: string;
}

export class CancelBookingDto {
  @IsString()
  reason: string;
}

