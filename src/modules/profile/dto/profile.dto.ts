import { IsString, IsOptional } from 'class-validator';

export class SaveProfileDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  gstin?: string;

  @IsString()
  @IsOptional()
  companyName?: string;

  @IsString()
  @IsOptional()
  address?: string;
}

export class VerifyProfileGstinDto {
  @IsString()
  gstin: string;
}

