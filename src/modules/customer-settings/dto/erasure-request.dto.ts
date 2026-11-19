import { IsString, Length, MaxLength } from 'class-validator';

export class ErasureRequestDto {
  @IsString()
  confirmationText: string;

  @IsString()
  @MaxLength(500)
  reason: string;

  @IsString()
  @Length(6, 6)
  otp: string;
}