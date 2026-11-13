import { IsString } from 'class-validator';

export class VerifyGstinDto {
  @IsString()
  gstin: string;

  @IsString()
  bookingId: string;
}

export class VerifyEwayBillDto {
  @IsString()
  ewayBillNumber: string;

  @IsString()
  bookingId: string;
}

