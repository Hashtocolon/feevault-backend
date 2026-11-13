import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class SaveConsentsDto {
  @IsBoolean()
  @IsOptional()
  termsAccepted?: boolean;

  @IsBoolean()
  @IsOptional()
  marketingOptIn?: boolean;

  @IsObject()
  @IsOptional()
  consentData?: Record<string, boolean>;
}

