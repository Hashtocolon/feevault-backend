import { IsNotEmpty, IsString, Matches, IsOptional } from 'class-validator';

export class SendOtpDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+91[6-9]\d{9}$/, {
    message: 'Mobile number must be a valid 10-digit Indian number starting with +91',
  })
  mobileNumber: string;

  @IsOptional()
  @IsString()
  role?: string;
}

export class VerifyOtpDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+91[6-9]\d{9}$/, {
    message: 'Mobile number must be a valid 10-digit Indian number starting with +91',
  })
  mobileNumber: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 numeric digits' })
  otp: string;

  @IsOptional()
  @IsString()
  role?: string;
}

export class RefreshTokenDto {
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}

